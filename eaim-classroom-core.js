/* ══════════════════════════════════════════════════════════
   EAIM Classroom Core
   - 기존 eaim-classroom Firebase 프로젝트를 그대로 재사용합니다.
   - 국어 플레이(eaim-korean-play) / 과학 3종과 동일한 구조:
       teachers/{uid}/rooms/{roomId}
       roomCodes/{code} → {teacherUid, roomId}   (학생 공개 조회용)
       teachers/{uid}/rooms/{roomId}/students/{studentId}
       teachers/{uid}/rooms/{roomId}/submissions/{subId}
   - 이 파일 하나를 4개 앱(역사신문/사회사전/게임방/세계탐구)에서
     동일하게 <script type="module" src="eaim-classroom-core.js"> 로 불러옵니다.
   ══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  signInAnonymously, onAuthStateChanged, setPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, query, where, orderBy, getDocs,
  onSnapshot, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚠️ 기존 eaim-classroom 프로젝트의 값을 그대로 넣으세요 (다른 앱들과 동일한 값)
const firebaseConfig = {
  apiKey: "AIzaSyBalg0f5x0ydfHxn_nzgZ1pAELvJw6PzoY",
  authDomain: "eaim-classroom.firebaseapp.com",
  projectId: "eaim-classroom",
  storageBucket: "eaim-classroom.firebasestorage.app",
  messagingSenderId: "294479576192",
  appId: "1:294479576192:web:c60e994e319dbd2f11ba65",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ⚠️ 공용 컴퓨터 보호용: 로그인 상태를 "브라우저 세션"에만 저장합니다.
// 새로고침/탭 재열기에는 로그인이 유지되지만, 브라우저를 완전히 종료하면
// 자동으로 로그아웃돼요 (다음 사람이 그대로 이어서 쓰는 걸 방지).
setPersistence(auth, browserSessionPersistence).catch((e) => {
  console.warn('로그인 지속성 설정 실패(기본값으로 동작):', e);
});

/* ── 이 파일을 쓰는 앱의 이름을 각 HTML에서 지정 ──
   예) window.EAIM_APP_TYPE = 'history' | 'dict' | 'game' | 'world'; */
const APP_TYPE = () => window.EAIM_APP_TYPE || 'unknown';

/* ════════ 교사 인증 ════════ */
export function teacherLogin() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}
export function teacherLogout() {
  return signOut(auth);
}
export function onTeacherAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

/* ════════ 학생 익명 입장 ════════ */
export async function studentEnter() {
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}

/* ════════ 방(수업) 코드 생성 ════════ */
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자 제외
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * 교사: 새 수업방 생성
 * mode: 'class' (반 전체) | 'group' (모둠별, groupSize 필요) | 'individual' (개인별)
 * classes: [{name:'1반', count:24}, ...]  — 반 일괄 생성 시
 */
export async function createRoom({ title, mode, classes = [], groupSize = 4 }) {
  const uid = auth.currentUser.uid;
  const roomsCol = collection(db, `teachers/${uid}/rooms`);
  const roomRef = await addDoc(roomsCol, {
    app: APP_TYPE(),
    title, mode, classes, groupSize,
    isOpen: true,
    createdAt: serverTimestamp(),
  });

  // 코드 충돌 방지 트랜잭션
  let code = genCode();
  const codeRef0 = doc(db, 'roomCodes', code);
  await runTransaction(db, async (tx) => {
    let ref = codeRef0, snap = await tx.get(ref), tries = 0;
    while (snap.exists() && tries < 5) {
      code = genCode();
      ref = doc(db, 'roomCodes', code);
      snap = await tx.get(ref);
      tries++;
    }
    tx.set(ref, { teacherUid: uid, roomId: roomRef.id, app: APP_TYPE() });
  });

  await updateDoc(roomRef, { code });
  return { roomId: roomRef.id, code };
}

export async function toggleRoomOpen(roomId, isOpen) {
  const uid = auth.currentUser.uid;
  await updateDoc(doc(db, `teachers/${uid}/rooms/${roomId}`), { isOpen });
}

export async function listMyRooms() {
  const uid = auth.currentUser.uid;
  const q = query(collection(db, `teachers/${uid}/rooms`), where('app', '==', APP_TYPE()));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ════════ 학생: 코드로 방 찾기 (URL의 ?code=XXXXXX 로 들어옴) ════════ */
export async function resolveRoomByCode(code) {
  const snap = await getDoc(doc(db, 'roomCodes', code.toUpperCase()));
  if (!snap.exists()) return null;
  const { teacherUid, roomId } = snap.data();
  const roomSnap = await getDoc(doc(db, `teachers/${teacherUid}/rooms/${roomId}`));
  if (!roomSnap.exists() || !roomSnap.data().isOpen) return null;
  return { teacherUid, roomId, ...roomSnap.data() };
}

/**
 * 학생 입장 기록 (번호 입력 → 모둠은 인원수 기준 자동 계산)
 */
export async function joinRoom({ teacherUid, roomId, className, number, name }) {
  await studentEnter();
  const room = (await getDoc(doc(db, `teachers/${teacherUid}/rooms/${roomId}`))).data();
  let group = null;
  if (room.mode === 'group' && room.groupSize) {
    group = Math.ceil(Number(number) / room.groupSize);
  }
  const studentId = auth.currentUser.uid;
  await setDoc(doc(db, `teachers/${teacherUid}/rooms/${roomId}/students/${studentId}`), {
    className: className || null, number: number || null, group,
    name: name || null, joinedAt: serverTimestamp(),
  }, { merge: true });
  return { studentId, group };
}

/* ════════ 학생 결과물 저장 (세특 생성 원료) ════════ */
export async function saveSubmission({ teacherUid, roomId, studentMeta, kind, title, content }) {
  const studentId = auth.currentUser?.uid;
  if (!studentId) return;
  await addDoc(collection(db, `teachers/${teacherUid}/rooms/${roomId}/submissions`), {
    studentId, ...studentMeta,
    app: APP_TYPE(), kind, title, content,
    createdAt: serverTimestamp(),
  });
}

/* ════════ 교사: 방의 모든 결과물 가져오기 (세특/시트 내보내기용) ════════ */
export async function listSubmissions(roomId) {
  const uid = auth.currentUser.uid;
  const q = query(
    collection(db, `teachers/${uid}/rooms/${roomId}/submissions`),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ════════ 게임 결과 저장/조회 (세특용 submissions와는 별도 컬렉션) ════════
   ⚠️ 의도적으로 saveSubmission()과 분리했습니다.
   listSubmissions()가 읽는 `submissions` 컬렉션에는 절대 쓰지 않으므로,
   세특 생성 화면(genSaenteuk)에는 게임 결과가 절대 나타나지 않습니다.
   교사가 "몇 점인지 / 뭘 틀렸는지"만 확인하는 용도로만 씁니다.       */
export async function saveGameResult({ teacherUid, roomId, studentMeta, game, score, correct, total, wrongLog = [] }) {
  const studentId = auth.currentUser?.uid;
  if (!studentId) return;
  await addDoc(collection(db, `teachers/${teacherUid}/rooms/${roomId}/gameResults`), {
    studentId, ...studentMeta,
    game, score, correct, total, wrongLog,
    createdAt: serverTimestamp(),
  });
}

export async function listGameResults(roomId) {
  const uid = auth.currentUser.uid;
  const q = query(
    collection(db, `teachers/${uid}/rooms/${roomId}/gameResults`),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ════════ 실시간 퀴즈 (카훗 스타일) ════════
   ⚠️ 경로를 얕게 유지합니다 — teachers/{uid}/rooms/{roomId}/{subcollection}/{docId}
   (딱 2단계)까지만 기존 Firestore 규칙의 "if true" 와일드카드가 적용되기 때문에,
   liveQuiz/current/answers 처럼 더 깊이 중첩하면 규칙을 추가로 안 걸어준 한
   막힙니다. 그래서 답안은 별도 규칙 없이도 통과하도록 liveQuizAnswers를
   rooms/{roomId} 바로 아래 평평한 컬렉션으로 둡니다.

   teachers/{uid}/rooms/{roomId}/liveQuiz/current
     { questions, currentIndex:-1, status:'lobby'|'question'|'reveal'|'ended',
       sessionId, questionStartedAt }
   teachers/{uid}/rooms/{roomId}/liveQuizAnswers/{sessionId}_{studentId}_{qIndex}
     { sessionId, studentId, ...studentMeta, qIndex, choiceIndex, correct, msTaken, points }
   (sessionId를 넣는 이유: 같은 방에서 퀴즈를 다시 만들어도 지난 회차 답안이
    새 순위에 안 섞이도록 하기 위함)                                        */

export async function createLiveQuiz({ teacherUid, roomId, questions }) {
  const sessionId = String(Date.now());
  const ref = doc(db, `teachers/${teacherUid}/rooms/${roomId}/liveQuiz/current`);
  await setDoc(ref, {
    questions, currentIndex: -1, status: 'lobby', sessionId,
    questionStartedAt: null, createdAt: serverTimestamp(),
  });
  return { ref, sessionId };
}

export function listenLiveQuiz(teacherUid, roomId, cb) {
  const ref = doc(db, `teachers/${teacherUid}/rooms/${roomId}/liveQuiz/current`);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
}

export async function advanceLiveQuiz(teacherUid, roomId, index) {
  const ref = doc(db, `teachers/${teacherUid}/rooms/${roomId}/liveQuiz/current`);
  await updateDoc(ref, { currentIndex: index, status: 'question', questionStartedAt: serverTimestamp() });
}

export async function revealLiveQuiz(teacherUid, roomId) {
  const ref = doc(db, `teachers/${teacherUid}/rooms/${roomId}/liveQuiz/current`);
  await updateDoc(ref, { status: 'reveal' });
}

export async function endLiveQuiz(teacherUid, roomId) {
  const ref = doc(db, `teachers/${teacherUid}/rooms/${roomId}/liveQuiz/current`);
  await updateDoc(ref, { status: 'ended' });
}

/** 학생이 답을 제출. 문항당 한 번만 기록되도록 결정론적 문서ID 사용(재제출 방지는 클라이언트에서 버튼 비활성화로 처리). */
export async function submitLiveAnswer({ teacherUid, roomId, sessionId, qIndex, choiceIndex, correct, msTaken, studentMeta }) {
  const studentId = auth.currentUser?.uid;
  if (!studentId) return;
  const points = correct ? Math.max(50, 1000 - Math.round(msTaken / 20)) : 0; // 빠를수록 높은 점수(카훗 방식)
  const ansRef = doc(db, `teachers/${teacherUid}/rooms/${roomId}/liveQuizAnswers/${sessionId}_${studentId}_${qIndex}`);
  await setDoc(ansRef, {
    sessionId, studentId, ...studentMeta, qIndex, choiceIndex, correct, msTaken, points,
    createdAt: serverTimestamp(),
  });
  return points;
}

/** 특정 문항의 실시간 응답 스트림 (호스트가 응답 수/정답률 표시할 때) */
export function listenLiveAnswers(teacherUid, roomId, sessionId, qIndex, cb) {
  const q = query(
    collection(db, `teachers/${teacherUid}/rooms/${roomId}/liveQuizAnswers`),
    where('sessionId', '==', sessionId), where('qIndex', '==', qIndex)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => d.data())));
}

/** 전체 문항 누적 순위 (한 번 읽기 — 최종 순위 화면용) */
export async function getLiveLeaderboard(teacherUid, roomId, sessionId) {
  const q = query(
    collection(db, `teachers/${teacherUid}/rooms/${roomId}/liveQuizAnswers`),
    where('sessionId', '==', sessionId)
  );
  const snap = await getDocs(q);
  const byStudent = {};
  snap.docs.forEach(d => {
    const a = d.data();
    const key = a.studentId;
    if (!byStudent[key]) byStudent[key] = { studentId: key, className: a.className, number: a.number, totalPoints: 0, correct: 0, total: 0 };
    byStudent[key].totalPoints += a.points || 0;
    byStudent[key].total += 1;
    if (a.correct) byStudent[key].correct += 1;
  });
  return Object.values(byStudent).sort((a, b) => b.totalPoints - a.totalPoints);
}

/* ════════ QR 코드 렌더 (외부 라이브러리 없이, 이미지 API 사용) ════════ */
export function qrImageUrl(link, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}`;
}
/** 방이 속한 앱(app)에 맞는 실제 파일로 학생 입장 링크를 만듭니다.
 *  ⚠️ 'student.html' 같은 공용 페이지는 존재하지 않으므로, 반드시 app별 실제 파일명으로 매핑합니다. */
const APP_FILE = {
  history: 'eaim-history-news.html',
  dict: 'eaim-social-dict.html',
  world: 'eaim-world-explorer.html',
  game: 'eaim-social-game.html',
};
export function studentLink(code, app, baseUrl = location.origin + location.pathname.replace(/[^/]+$/, '')) {
  const file = APP_FILE[app] || 'eaim-history-news.html';
  return `${baseUrl}${file}?code=${code}`;
}
