# EAIM 사회·역사 플랫폼 — 교실 연동 1단계 완료

## 지금 만들어진 것
- `eaim-classroom-core.js` — Firebase Auth(교사 구글로그인/학생 익명입장) + Firestore(방 생성·QR코드·결과물 저장) 공유 모듈
- `teacher-hub.html` — 로그인 → 앱 선택(역사신문/사전/게임/세계탐구) → 반·모둠·개인 수업방 생성 → QR/링크 발급 → 세특 초안 생성(Gemini) → 구글시트 전송
- `apps-script-webhook.gs` — 구글시트에 세특 초안을 자동 기록하는 웹훅

## 지금 해야 할 일
1. `eaim-classroom-core.js` 상단의 `firebaseConfig`에 기존 **eaim-classroom** 프로젝트의 실제 키를 넣으세요 (국어 플레이/과학 앱과 동일한 값).
2. `teacher-hub.html`, `eaim-classroom-core.js`, `apps-script-webhook.gs`를 4개 앱 파일들과 같은 폴더(같은 Vercel 배포)에 올리세요.
3. Firestore 보안 규칙에 아래 컬렉션 규칙을 **추가**만 하세요 (기존 규칙은 건드리지 말 것 — 다른 앱의 `groups` 등과 충돌 방지):
   ```
   match /roomCodes/{code} {
     allow read: if true;
     allow write: if request.auth != null; // 교사만 room 생성 흐름에서 씀
   }
   match /teachers/{uid}/rooms/{roomId} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
     match /students/{studentId} {
       allow read: if request.auth != null && request.auth.uid == uid;
       allow write: if request.auth != null && request.auth.uid == studentId;
     }
     match /submissions/{subId} {
       allow read: if request.auth != null && request.auth.uid == uid;
       allow create: if request.auth != null;
     }
   }
   ```
4. Apps Script 웹훅 배포 후 URL을 교사 허브 "연동 설정"에 저장.

## 아직 안 된 것 (다음 턴에 이어서)
4개 앱(역사신문/사전/게임방/세계탐구) 본체에는 아직 손대지 않았습니다. 각 앱에 다음 2가지만 추가하면 완전히 연결됩니다:

1. **학생 진입부 교체**: 지금은 이름+반을 직접 입력하는 모달(`#nm`)로 시작하는데,
   → URL의 `?code=XXXXXX`를 읽어 `resolveRoomByCode()`로 방을 찾고 `joinRoom()`으로 입장하도록 교체 (모둠 자동계산 포함)
2. **결과물 저장 훅 추가**: 각 앱에서 "신문에 추가/사전에 추가/게임 종료/나라 탐구 완료" 되는 시점마다 `saveSubmission()` 한 줄만 호출

→ 4개 파일이 각각 커서, 어느 앱부터 연결할지 알려주시면 그 앱부터 순서대로 패치해드릴게요. (예: "역사신문부터")
