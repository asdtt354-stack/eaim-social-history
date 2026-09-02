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

  function getStudentName() {
    let name = localStorage.getItem(NAME_KEY);
    if (!name) {
      name = (prompt('이름(또는 학번+이름)을 입력해 주세요.\n학습 기록에 사용됩니다.') || '').trim();
      if (!name) name = '이름 미입력';
      localStorage.setItem(NAME_KEY, name);
    }
    return name;
  }

  function logActivity(unit, subunit, type, result) {
    try {
      const name = getStudentName();
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      log.push({
        name,
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

  window.EAIM = { getStudentName, logActivity, getAllLogs, clearAllLogs };
})();
