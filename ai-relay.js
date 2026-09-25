/* ══════════════════════════════════════════════════════════
   사회·역사 AI 연결 도우미  ai-relay.js  v1.0 (2026-09-25)
   - 앱이 Gemini를 브라우저에서 직접 부르지 않고, 같은 저장소의
     서버 함수 api/ai(중계 함수, 공통규칙 6-1)로 보냅니다.
     Gemini 키는 서버(Vercel 환경변수)에만 있고 학생 기기로 내려오지 않습니다.
   - 누가 쓰는 AI인지: 초대 링크(QR)로 들어온 수업방의 교사 UID,
     허브에서는 로그인한 교사 UID. 주소에 ?demo=<암호> 가 있으면 체험판 키.
   - 모델 이름은 보내지 않고 별칭(text, image-lite, tts …)만 보냅니다(공통규칙 6-2).
   - 이 파일은 사회·역사 저장소의 파일입니다(공통 파일 아님). api/ai.js 는
     음악과 eaim-play 기준본을 그대로 복사한 것이므로 여기서 고치지 않습니다.
   ══════════════════════════════════════════════════════════ */
(function () {
  // 예전 방식(기기에 저장한 Gemini 키)은 더 이상 쓰지 않으므로 이 기기에서 지웁니다.
  try { localStorage.removeItem('eaim_gemini_key'); } catch (e) {}

  const demo = (new URLSearchParams(location.search).get('demo') || '').slice(0, 64);

  function teacher() {
    return (window.EAIM_ROOM && window.EAIM_ROOM.teacherUid) || window.EAIM_AI_TEACHER || '';
  }
  /** AI를 쓸 수 있는 상태면 'relay', 아니면 '' (예전 코드의 key 자리에 그대로 들어갑니다) */
  function ready() {
    return (demo || teacher()) ? 'relay' : '';
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** fetch 와 같은 모양으로 쓰는 중계 호출.
   *  예전: fetch('…/models/gemini-flash-latest:generateContent?key='+key, {method, headers, body})
   *  지금: EAIM_AI.fetch('text', {method, headers, body})  → 돌아오는 응답 모양은 똑같습니다. */
  async function relayFetch(alias, init) {
    let src = {};
    try { src = JSON.parse((init && init.body) || '{}'); } catch (e) {}
    const body = { model: alias, teacher: teacher(), contents: src.contents };
    if (src.generationConfig) body.generationConfig = src.generationConfig;
    if ((src.tools || []).some((t) => t && (t.google_search || t.googleSearch))) body.search = true; // 검색 그라운딩
    if (demo) body.demo = demo;
    const opt = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    let r = await fetch('api/ai', opt);                         // 상대 경로(공통규칙 10-1)
    for (let i = 0; i < 2 && r.status === 503; i++) {           // 혼잡하면 자동 재시도(공통규칙 6-3)
      await sleep(1500 * (i + 1));
      r = await fetch('api/ai', opt);
    }
    return r;
  }

  const NO_AI = 'AI 기능은 선생님이 준 QR·링크로 들어왔을 때 쓸 수 있어요.';
  /** 실패 원인에 맞는 안내 문구(공통규칙 6-3: 키가 있는데 "키를 설정하세요"라고 하지 않기) */
  function why(err, what) {
    const m = (err && err.message) || '';
    if (!ready() || m === 'NO_KEY') return NO_AI;
    return `${what || 'AI 도움'}을 받지 못했어요. ${m || '잠시 뒤 다시 해 보세요.'}`;
  }

  // 체험판 주소(?demo=)로 들어왔으면, 이 페이지에서 여는 다른 앱 링크에도 체험 표시를 이어 붙입니다.
  if (demo) {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('a[href]').forEach((a) => {
        const h = a.getAttribute('href');
        if (!/^eaim-[a-z-]+\.html(\?|#|$)/.test(h)) return;      // 사회·역사 활동 앱 4개만
        const u = new URL(h, location.href);
        u.searchParams.set('demo', demo);
        a.setAttribute('href', u.pathname.split('/').pop() + u.search + u.hash);
      });
    });
  }

  window.EAIM_AI = { ready, fetch: relayFetch, teacher, demo, why, NO_AI };
})();
