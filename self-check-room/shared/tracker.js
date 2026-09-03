/* ────────────────────────────────────────────────
   EAIM 학습 기록 트래커 (공통 스크립트)
   - 학생 이름을 한 번 물어보고 이 브라우저(기기)에 저장한다.
   - 각 소단원 페이지에서 EAIM.logActivity(...)를 호출하면
     활동 기록이 이 브라우저 안에 계속 쌓인다.
   - self-check-room/my-record.html 에서 쌓인 기록을 모아
     보여주고 인쇄(=PDF 저장) 할 수 있다.
   ──────────────────────────────────────────────── */
(function () {
  const NAME_KEY = 'eaim_student_name';
  const LOG_KEY = 'eaim_activity_log';

  const SUBJECT_LABELS = { social1:'사회1', social2:'사회2', history1:'역사1', history2:'역사2' };

  /** 현재 페이지 URL 경로에서 과목 폴더명(social1/social2/history1/history2)을 자동 인식 */
  function detectSubject() {
    const m = location.pathname.match(/\/(social1|social2|history1|history2)\//);
    return m ? m[1] : 'unknown';
  }

  function getStudentName() {
    let name = localStorage.getItem(NAME_KEY);
    if (!name) {
      name = (prompt('이름(또는 학번+이름)을 입력해 주세요.\n학습 기록에 사용됩니다.') || '').trim();
      if (!name) name = '이름 미입력';
      localStorage.setItem(NAME_KEY, name);
    }
    return name;
  }

  /** 이미 저장된 이름이 있으면 그대로 반환, 없으면 프롬프트 없이 null 반환(체크룸 등에서 미리 채워 넣을 때 사용) */
  function peekStudentName() {
    return localStorage.getItem(NAME_KEY) || null;
  }

  /** 체크룸 등 다른 화면에서 학생이 직접 입력한 이름을 tracker.js 저장소와 동기화 */
  function setStudentName(name) {
    const trimmed = (name || '').trim();
    if (trimmed) localStorage.setItem(NAME_KEY, trimmed);
  }

  function logActivity(unit, subunit, type, result) {
    try {
      const name = getStudentName();
      const subject = detectSubject();
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      log.push({
        name,
        subject,
        subjectLabel: SUBJECT_LABELS[subject] || subject,
        unit,
        subunit,
        type,
        result,
        time: new Date().toISOString(),
      });
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch (e) {
      console.warn('EAIM 기록 저장 실패:', e);
    }
  }

  function getAllLogs() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function clearAllLogs() {
    localStorage.removeItem(LOG_KEY);
  }

  window.EAIM = { getStudentName, peekStudentName, setStudentName, logActivity, getAllLogs, clearAllLogs, SUBJECT_LABELS };
})();
