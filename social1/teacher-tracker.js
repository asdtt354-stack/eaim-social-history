/* ────────────────────────────────────────────────
   EAIM 셀프체크룸 — 선생님 실시간 대시보드 연동 스크립트
   - 학생이 선생님 QR로 들어오면(?t=선생님UID) 그 값을 기기에 저장해둔다.
   - 이후 셀프체크룸에서 문제를 풀 때마다, 그 선생님의 대시보드로
     결과가 실시간 전송된다.
   - 선생님 QR로 들어온 적이 없으면(t 파라미터가 한 번도 없었으면)
     기록 전송은 조용히 건너뛴다 — 개인 학습용으로만 써도 문제없음.
   ──────────────────────────────────────────────── */
(function () {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBalg0f5x0ydfHxn_nzgZ1pAELvJw6PzoY",
    authDomain: "eaim-classroom.firebaseapp.com",
    projectId: "eaim-classroom",
    storageBucket: "eaim-classroom.firebasestorage.app",
    messagingSenderId: "294479576192",
    appId: "1:294479576192:web:c60e994e319dbd2f11ba65"
  };
  const TEACHER_KEY = 'eaim_teacher_uid';
  let db = null, ready = false;

  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      ready = true;
    }
  } catch (e) {
    console.warn('선생님 대시보드 연동 초기화 실패(개인 학습 모드로만 동작):', e);
  }

  function initTeacherLink() {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('t');
      if (t) {
        localStorage.setItem(TEACHER_KEY, t);
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch (e) {}
  }

  function getTeacherUid() {
    return localStorage.getItem(TEACHER_KEY) || '';
  }

  // 학생이 QR을 거치지 않고, 선생님이 알려준 코드/링크를 직접 붙여넣어 연결할 때 쓴다.
  function connectTeacherManually(input) {
    if (!input) return false;
    let uid = String(input).trim();
    const match = uid.match(/[?&]t=([^&\s]+)/);
    if (match) uid = match[1];
    if (!uid) return false;
    localStorage.setItem(TEACHER_KEY, uid);
    return true;
  }

  function getStudentName() {
    if (window.EAIM && typeof window.EAIM.getStudentName === 'function') {
      return window.EAIM.getStudentName();
    }
    return '이름 미입력';
  }

  async function submitSocialResult({ subject, unitKey, unitLabel, correct, total, weakTopics, writtenAnswers }) {
    const uid = getTeacherUid();
    if (!uid || !ready) return false;
    try {
      await db.collection('teachers').doc(uid).collection('socialRecords').add({
        studentName: getStudentName(),
        subject: subject || '',
        unitKey: unitKey || '',
        unitLabel: unitLabel || '',
        correct: correct || 0,
        total: total || 0,
        weakTopics: weakTopics || [],
        writtenAnswers: writtenAnswers || [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (e) {
      console.warn('결과 전송 실패(오프라인이거나 네트워크 문제일 수 있음):', e);
      return false;
    }
  }

  // 학생이 "제출하기" 버튼을 누르면, 버튼 상태와 안내 문구까지 알아서 바꿔주는 헬퍼.
  async function submitWithUI(payload, buttonId, statusId) {
    const btn = document.getElementById(buttonId);
    const status = document.getElementById(statusId);
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 제출 중...'; }
    if (status) { status.textContent = ''; }
    const ok = await submitSocialResult(payload);
    if (ok) {
      if (btn) { btn.textContent = '✅ 제출 완료'; btn.classList.add('done'); }
      if (status) { status.textContent = '✅ 선생님께 정상적으로 제출됐어요.'; status.style.color = '#34d399'; }
    } else {
      if (btn) { btn.disabled = false; btn.textContent = '📤 다시 제출하기'; }
      if (status) { status.textContent = '⚠️ 제출에 실패했어요. 인터넷 연결을 확인하고 다시 눌러주세요.'; status.style.color = '#f43f5e'; }
    }
  }

  // 학생용: 내 이름으로 온 선생님 피드백을 실시간으로 구독한다.
  function subscribeMyFeedback(cb) {
    const uid = getTeacherUid();
    if (!uid || !ready) { cb([]); return null; }
    const name = getStudentName();
    return db.collection('teachers').doc(uid).collection('socialRecords')
      .where('studentName', '==', name)
      .onSnapshot(snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => r.feedback && r.feedback.trim());
        list.sort((a, b) => {
          const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        cb(list);
      }, err => { console.warn('피드백 조회 오류:', err); cb([]); });
  }

  function renderConnectionBadge() {
    try {
      // my-record.html처럼 자체적으로 연결 상태를 보여주는 페이지는 중복 표시하지 않는다.
      if (document.getElementById('connectedBadge')) return;
      const topbar = document.querySelector('.topbar');
      if (!topbar) return;

      const uid = getTeacherUid();
      const badge = document.createElement('div');
      badge.style.cssText = 'max-width:760px;margin:14px auto 0;padding:8px 20px;text-align:center;font-size:0.76em;';
      badge.innerHTML = uid
        ? '<span style="color:#34d399;">✅ 선생님과 연결되어 있어요 — 지금 푸는 문제 결과가 대시보드로 전송돼요.</span>'
        : '<span style="color:#fbbf24;">⚠️ 아직 선생님과 연결되지 않았어요. QR을 먼저 스캔해야 결과가 대시보드로 전송돼요. (개인 학습만 하실 거면 그냥 계속하셔도 돼요)</span>';
      topbar.insertAdjacentElement('afterend', badge);
    } catch (e) {}
  }
  function autoRenderBadge() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderConnectionBadge);
    } else {
      renderConnectionBadge();
    }
  }

  window.EAIM_TEACHER = { initTeacherLink, getTeacherUid, connectTeacherManually, submitSocialResult, submitWithUI, subscribeMyFeedback, renderConnectionBadge };
  initTeacherLink();
  autoRenderBadge();
})();
