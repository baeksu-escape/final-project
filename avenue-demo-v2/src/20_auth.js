
/* ========== actions registry ========== */
const A = {}, F = {};

/* ========== auth: main / login ========== */
const SOCIAL = [['google', 'Google', 'G', '#ffffff', '#3c4043'], ['kakao', '카카오', 'K', '#fee500', '#191600'], ['naver', '네이버', 'N', '#03c75a', '#ffffff']];
function promoChart(vals, col, mark) {
  const w = 460, h = 150, X0 = 34, X1 = w - 10, Y0 = 10, Y1 = h - 24, y = (v) => Y1 - (v - 600) / 200 * (Y1 - Y0), x = (i) => X0 + i * (X1 - X0) / (vals.length - 1);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="12개월 점수 추이 ${vals[0]}점에서 ${vals[vals.length - 1]}점" style="max-width:100%">
    ${[600, 665, 735, 800].map((t) => `<line x1="${X0}" x2="${X1}" y1="${y(t)}" y2="${y(t)}" stroke="#22314b" ${t === 665 ? 'stroke-dasharray="4 3"' : ''}/><text x="${X0 - 6}" y="${y(t) + 4}" font-size="10" fill="#8a9bb4" text-anchor="end">${t}</text>`).join('')}
    <text x="${X1}" y="${y(665) - 5}" font-size="10" fill="#8a9bb4" text-anchor="end">Standard 665</text>
    <polygon points="${X0},${Y1} ${pts} ${X1},${Y1}" fill="${col}" fill-opacity=".14"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.4"/>
    <circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="4" fill="${col}"/>
    ${mark != null ? `<circle cx="${x(mark)}" cy="${y(vals[mark])}" r="4" fill="none" stroke="${col}" stroke-width="2"/><text x="${x(mark) + 8}" y="${y(vals[mark]) + 14}" font-size="10.5" fill="${col}">Standard 진입</text>` : ''}
    ${[['가입', 0], ['6개월', 6], ['12개월', 12]].map(([l, i]) => `<text x="${x(i)}" y="${h - 6}" font-size="10" fill="#8a9bb4" text-anchor="${i === 0 ? 'start' : i === 12 ? 'end' : 'middle'}">${l}</text>`).join('')}
  </svg>`;
}
function socialModal() {
  const o = UI.social; if (!o) return '';
  const P = SOCIAL.find((x) => x[0] === o.prov);
  let body;
  if (o.step === 'consent') body = `<span class="tag">OAuth 2.0 · 시연용 가짜 화면</span><h2 class="h2" id="hSoc">${P[1]} 계정으로 계속하기</h2>
    <p class="hint">실제 서비스에서는 ${P[1]} 로그인 창으로 넘어갑니다. Avenue가 받는 정보는 이름과 이메일뿐이며, 비밀번호는 받지 않습니다.</p>
    <div class="row"><button class="btn btn-p" data-a="socialOk">동의하고 계속</button><button class="btn" data-a="socialCancel">취소</button></div>`;
  else body = `<span class="tag">계정 연결</span><h2 class="h2" id="hSoc">처음 연결하는 ${P[1]} 계정입니다</h2>
    <p class="hint">최초 로그인이라 서비스 계정을 만들거나 기존 계정과 연결해야 합니다 (N-01-6).</p>
    <div class="sunk stack" style="gap:8px"><b>기존 아이디와 연결</b>${fld('아이디', 'social.id', { auto: 'username' })}${fld('비밀번호', 'social.pw', { type: 'password', auto: 'current-password' })}${o.err ? `<p class="err" role="alert">${o.err}</p>` : ''}<button class="btn btn-p" data-a="socialLink">연결하고 로그인</button></div>
    <div class="row between"><button class="btn" data-a="socialNew">새로 가입하기</button><button class="btn" data-a="socialCancel">취소</button></div>`;
  return `<div class="back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="hSoc">${body}</div></div>`;
}
function vLogin() {
  const L = UI.login, t = UI.tfa;
  const box = t ? `
    <form class="panel" data-f="tfa" aria-labelledby="hTfa">
      <span class="tag">2-Step Verification</span><h2 class="h2" id="hTfa">관리자 2단계 인증</h2>
      <p class="hint">${t.uid} 계정은 휴대폰으로 받은 6자리 인증번호를 한 번 더 넣어야 합니다.</p>
      <div class="note">시연용 인증번호: <b class="num">${t.code}</b></div>
      ${fld('인증번호 6자리', 'tfa.input', { num: true, err: t.err, auto: 'one-time-code' })}
      <div class="row"><button class="btn btn-p" type="submit">인증하고 들어가기</button><button class="btn" type="button" data-a="tfaCancel">취소</button></div>
    </form>` : `
    <form class="panel" data-f="login" aria-labelledby="hLogin">
      <h2 class="h2" id="hLogin" style="text-align:center">로그인</h2>
      ${fld('아이디', 'login.id', { auto: 'username', ph: '아이디를 입력해 주세요' })}
      ${fld('비밀번호', 'login.pw', { type: 'password', auto: 'current-password', ph: '비밀번호를 입력해 주세요' })}
      ${L.err ? `<p class="err" role="alert">${L.err}</p>` : ''}
      <button class="btn btn-p" type="submit">로그인</button>
      <div class="links"><a href="#find">아이디·비밀번호 찾기</a><a href="#signup">회원가입</a></div>
      <div class="or">간편 로그인</div>
      <div class="social">${SOCIAL.map(([k, n, g, bg, fg]) => `<button type="button" data-a="social" data-x="${k}" aria-label="${n}로 로그인" title="${n}" style="background:${bg};color:${fg}">${g || '<svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true"><path fill="currentColor" d="M13.3 9.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8C3.8 4.4 2.4 5.3 1.6 6.6c-1.6 2.8-.4 6.9 1.1 9.2.8 1.1 1.7 2.3 2.9 2.3 1.2-.1 1.6-.8 3-.8s1.8.8 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.5 1.3-2.6 0 0-2.4-.9-2.4-3.5zM11 2.8c.6-.8 1.1-1.8.9-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1.1.1 2.1-.5 2.8-1.3z"/></svg>'}</button>`).join('')}</div>
      <div class="sunk stack" style="gap:8px">
        <span class="tag">시연 계정</span>
        <div class="row between"><span>사용자 · 박서윤 (자영업자)</span><button class="btn btn-s" type="button" data-a="fillDemo" data-x="seoyun">채우기</button></div>
        <div class="row between"><span>관리자 · 김지훈</span><button class="btn btn-s" type="button" data-a="fillDemo" data-x="admin_kim">채우기</button></div>
        <span class="hint">간편 로그인: 네이버는 박서윤 계정에 연결돼 있습니다. 다른 제공자는 처음 연결하는 흐름을 보여 줍니다.</span>
      </div>
    </form>`;
  return `<div class="wrap">
  <header class="top">${brandUser()}<div class="row" style="gap:8px">${themeBtn()}<a class="btn btn-s" href="#signup">회원가입</a></div></header>
  <div class="auth">
    <div class="hello"><h1>꾸준한 일상, 새로운 신용</h1><p class="lead">통신비부터 보험료까지, 성실히 낸 기록을 함께 봅니다.</p></div>
    ${box}
  </div>
  ${socialModal()}</div>`;
}
function vMain() {
  const u = me();
  const before = [640, 642, 638, 641, 643, 639, 641, 640, 642, 639, 641, 640, 640];
  const after = [640, 646, 655, 668, 684, 699, 713, 726, 738, 749, 760, 770, 778];
  const right = u ? `<a class="btn btn-s btn-p" href="#${homeOf(u)}">${u.role === 'admin' ? '관리자 화면으로' : '내 리포트로'}</a>${themeBtn()}<button class="btn btn-s" data-a="logout">로그아웃</button>`
    : `${themeBtn()}<a class="btn btn-s" href="#login">로그인</a><a class="btn btn-s btn-p" href="#signup">회원가입</a>`;
  return `<div class="wrap">
  <header class="top">${brandUser()}<div class="row" style="gap:8px">${right}</div></header>
  <section class="hero stack" style="gap:12px;padding-block:18px 4px">
    <span class="tag" style="color:var(--mint)">연령·직군별 대안 신용평가</span>
    <h1>꾸준한 일상, 새로운 신용</h1>
    <p class="lead">대출 기록이 적어도 괜찮습니다. 통신비, 간편결제, 건강보험료, 국민연금처럼 매달 성실하게 낸 기록을 함께 보고 점수를 다시 매깁니다.</p>
    <div class="row">${u ? '' : '<a class="btn btn-p" href="#login">로그인하고 내 점수 보기</a>'}</div>
  </section>
  <section class="stack" aria-labelledby="hPromo" style="gap:14px;margin-top:18px">
    <div class="stack" style="gap:4px"><span class="tag" style="color:var(--mint)">N-10 · 홍보 그래프</span><h2 class="h1" id="hPromo" style="font-size:24px">금융 데이터의 시작부터 안전하게 보호합니다</h2></div>
    <div class="promo">
      <div class="panel" style="gap:6px"><span class="tag">Before · 앱 사용 전</span><b>기존 방식으로만 평가</b><span class="row" style="gap:6px;align-items:baseline"><b class="mid">640</b><span class="hint">점 ·</span><b class="mid" style="color:var(--bad)">Caution</b></span><span class="hint">대출·카드 이력이 짧아 12개월째 제자리</span>${promoChart(before, '#8a9bb4')}</div>
      <div class="panel" style="gap:6px"><span class="tag">After · 앱 사용 후</span><b>대안 신용평가 적용</b><span class="row" style="gap:6px;align-items:baseline"><b class="mid" style="color:var(--mint)">778</b><span class="hint">점 ·</span><b class="mid" style="color:var(--info)">Standard</b></span><span class="hint">통신비·간편결제 이력을 반영하자 12개월 만에 +137점</span>${promoChart(after, '#00e6a5', 3)}</div>
    </div>
    <p class="hint">광고용 예시 시나리오입니다. 금융 이력이 부족한 가상 고객을 가정했으며 실제 고객 결과가 아닙니다. 교육용 합성 데이터로 학습한 시연 화면입니다.</p>
  </section>
  <section class="lay" aria-label="주요 기능">
    ${[['신용 리포트', '기존 점수와 대안 점수를 나란히 보고, 어떤 항목이 점수를 올리고 내렸는지 확인합니다.'], ['재무 진단 4종', '자산·부채 건전성, 시나리오 테스트(악화·호전), 현금흐름·소득 변동성, 서울 상권 분석을 각각 봅니다.'], ['신용케어 시뮬레이터', '카드 사용액이나 연체를 바꾸면 점수와 받을 수 있는 대출이 어떻게 달라지는지 봅니다.']]
      .map(([t, d]) => `<div class="panel" style="gap:6px"><h3 style="font-size:15px">${t}</h3><p class="hint" style="font-size:13px">${d}</p></div>`).join('')}
  </section></div>`;
}

A.social = (x) => { UI.social = { prov: x.x, step: 'consent', err: '' }; UI.socialF = { id: '', pw: '' }; render(); };
A.socialCancel = () => { UI.social = null; render(); };
A.socialOk = () => {
  const o = UI.social; const uid = Object.keys(S.social).find((k) => (S.social[k] || []).includes(o.prov));
  const u = uid && userOf(uid);
  if (u && !u.locked) { log('AUTH', `사용자 ${u.id} 간편 로그인 (${o.prov})`, 'auth-service'); UI.social = null; return startSession(u); }
  o.step = 'link'; render();
};
A.socialLink = () => {
  const o = UI.social; const u = userOf(String(o.id || '').trim());
  if (!u || u.pw !== o.pw || u.role === 'admin') { o.err = '아이디 또는 비밀번호가 맞지 않습니다. (관리자 계정은 간편 로그인을 쓸 수 없습니다)'; return render(); }
  (S.social[u.id] = S.social[u.id] || []).push(o.prov); log('AUTH', `사용자 ${u.id} 간편 로그인 연결 (${o.prov})`, 'auth-service');
  toast(`${SOCIAL.find((p) => p[0] === o.prov)[1]} 계정을 연결했습니다.`); UI.social = null; startSession(u);
};
A.socialNew = () => { const prov = UI.social.prov; UI.social = null; UI.signup.f.name = '김간편'; UI.signup.f.nick = '간편가입' + code6().slice(0, 3); UI.signup.f.email = 'easy.' + prov + '@example.com'; UI.signup.via = prov; toast('간편 로그인 정보로 이름과 이메일을 채웠습니다. 나머지를 넣어 가입해 주세요.'); go('signup'); };
F.login = () => {
  const L = UI.login; const id = String(L.id || '').trim(); const u = userOf(id);
  L.err = '';
  if (!id || !L.pw) { L.err = '아이디와 비밀번호를 모두 넣어 주세요.'; return render(); }
  if (!u) { L.err = '아이디 또는 비밀번호가 맞지 않습니다.'; log('WARN', `없는 아이디로 로그인 시도 · ${id}`, 'auth-service'); return render(); }
  if (u.locked) { L.err = '로그인 5회 실패로 잠긴 계정입니다. [아이디·비밀번호 찾기]에서 비밀번호를 다시 설정하면 풀립니다.'; return render(); }
  if (u.pw !== L.pw) {
    u.fails = (u.fails || 0) + 1;
    if (u.fails >= 5) { u.locked = true; log('WARN', `사용자 ${u.id} 로그인 5회 실패 · 계정 잠금`, 'auth-service'); L.err = '비밀번호를 5회 틀려 계정을 잠갔습니다.'; }
    else { log('WARN', `사용자 ${u.id} 로그인 실패 ${u.fails}회`, 'auth-service'); L.err = `비밀번호가 맞지 않습니다. (${u.fails}/5회, 5회 틀리면 잠깁니다)`; }
    return render();
  }
  u.fails = 0;
  if (u.role === 'admin') { UI.tfa = { uid: u.id, code: code6(), input: '', err: '' }; return render(); }
  startSession(u);
};
F.tfa = () => {
  const t = UI.tfa;
  if (String(t.input) !== t.code) { t.err = '인증번호가 맞지 않습니다. 화면의 시연용 번호를 넣어 주세요.'; return render(); }
  startSession(userOf(t.uid));
};
A.tfaCancel = () => { UI.tfa = null; render(); };
A.fillDemo = (d) => { UI.login.id = d.x; UI.login.pw = d.x === 'seoyun' ? 'demo1234' : 'admin1234'; UI.login.err = ''; render(); };
function startSession(u) {
  S.session = { uid: u.id }; u.last = now();
  log('AUTH', u.role === 'admin' ? `관리자 ${u.id} 로그인 · 2단계 인증 통과` : `사용자 ${u.id} 로그인`, 'auth-service');
  UI = freshUI();
  toast(`${u.name}님, 환영합니다.`);
  go(u.role === 'admin' ? 'a-model' : !u.data ? 'job' : !u.history.length ? 'input' : 'report');
}
A.logout = () => { const u = me(); if (u) log('AUTH', `${u.role === 'admin' ? '관리자' : '사용자'} ${u.id} 로그아웃`, 'auth-service'); S.session = null; UI = freshUI(); toast('로그아웃했습니다.'); go('main'); };

/* ========== email code helper ========== */
A.sendCode = (d) => {
  const sc = gp(d.x); const mail = sc.f ? sc.f.email : sc.email;
  sc.codeErr = ''; sc.err = '';
  if (!okMail(mail)) { sc.codeErr = '이메일 주소 형식을 확인해 주세요. 예: name@example.com'; return render(); }
  if (d.x === 'find.id') { const u = S.users.find((x) => x.name === sc.f.name.trim() && x.email === mail.trim()); if (!u) { sc.err = '이름과 이메일이 일치하는 계정이 없습니다.'; return render(); } sc.uid = u.id; }
  if (d.x === 'find.pw') { const u = S.users.find((x) => x.id === sc.f.id.trim() && x.name === String(sc.f.name || '').trim() && x.email === mail.trim()); if (!u) { sc.err = '아이디·이름·이메일이 모두 일치하는 계정이 없습니다.'; return render(); } sc.uid = u.id; }
  if (d.x === 'signup' && S.users.some((x) => x.email === mail.trim())) { sc.codeErr = '이미 가입된 이메일입니다. 아이디 찾기를 이용해 주세요.'; return render(); }
  sc.code = code6(); sc.sent = true; sc.verified = false;
  toast(`${mail}로 인증번호를 보냈습니다. (시연: 화면에 표시)`); render();
};
A.verifyCode = (d) => {
  const sc = gp(d.x); const v = String((sc.f ? sc.f.code : sc.input) || '').trim();
  if (v && v === sc.code) { sc.verified = true; sc.codeErr = ''; } else sc.codeErr = '인증번호가 맞지 않습니다.';
  render();
};
function codeBlock(scope, mailPath, codePath, opts = {}) {
  const sc = gp(scope);
  return `${fld(opts.mailLabel || '이메일', mailPath, { type: 'email', auto: 'email', dis: sc.verified, btn: `<button class="btn" type="button" data-a="sendCode" data-x="${scope}" ${sc.verified ? 'disabled' : ''}>${sc.sent ? '다시 받기' : '인증번호 받기'}</button>`, err: !sc.sent ? sc.codeErr : '' })}
  ${sc.sent ? (sc.verified ? `<p class="okbox" role="status">이메일 인증을 마쳤습니다.</p>` : `${fld('인증번호 6자리', codePath, { num: true, auto: 'one-time-code', hint: `시연용 인증번호: ${sc.code}`, err: sc.codeErr, btn: `<button class="btn" type="button" data-a="verifyCode" data-x="${scope}">확인</button>` })}`) : ''}`;
}

/* ========== signup ========== */
function vSignup() {
  const s = UI.signup, e = s.errs;
  return `<div class="wrap">
  <header class="top">${brandUser()}<a class="btn btn-s" href="#login">로그인으로</a></header>
  <form class="panel" data-f="signup" style="max-width:640px;width:100%;margin:0 auto" aria-labelledby="hSign" novalidate>
    <span class="tag">Sign up</span><h1 class="h1" id="hSign">회원가입</h1>
    <p class="hint">가입 후 직군을 고르고 내역을 넣으면 대안 신용점수를 받을 수 있습니다.</p>
    ${fld('아이디', 'signup.f.id', { auto: 'username', hint: '영문 소문자·숫자·밑줄 4~16자', err: e.id || (s.dup === false ? '이미 사용 중인 아이디입니다.' : ''), ok: s.dup === true ? '사용할 수 있는 아이디입니다.' : '', btn: '<button class="btn" type="button" data-a="dupCheck">중복 확인</button>' })}
    <div class="g2">${fld('비밀번호', 'signup.f.pw', { type: 'password', auto: 'new-password', hint: '영문과 숫자를 섞어 8자 이상', err: e.pw })}${fld('비밀번호 확인', 'signup.f.pw2', { type: 'password', auto: 'new-password', err: e.pw2 })}</div>
    ${fld('닉네임', 'signup.f.nick', { auto: 'nickname', ph: '예: 성수동바리스타', hint: '신용 라운지 글·댓글에는 이름 대신 닉네임만 보입니다 (2~12자)', err: e.nick })}
    <div class="g2">${fld('이름', 'signup.f.name', { auto: 'name', err: e.name })}${fld('출생연도', 'signup.f.birth', { num: true, ph: '예: 1994', err: e.birth, hint: '연령대별 기준을 고르는 데 씁니다' })}</div>
    ${codeBlock('signup', 'signup.f.email', 'signup.f.code')}
    ${e.email ? `<p class="err" role="alert">${e.email}</p>` : ''}
    <fieldset class="sunk stack" style="gap:2px;margin:0"><legend class="lb" style="padding:0 4px">약관 동의</legend>
      ${chk('<b>전체 동의</b>', 'signup.f.tAll')}
      ${chk('[필수] 서비스 이용약관', 'signup.f.t1')}
      ${chk('[필수] 개인정보 수집·이용 (소득·부채·납부 내역)', 'signup.f.t2')}
      ${chk('[선택] 점수 변동 알림·혜택 안내 받기', 'signup.f.t3')}
      ${e.terms ? `<p class="err" role="alert">${e.terms}</p>` : ''}
    </fieldset>
    <button class="btn btn-p" type="submit">가입하기</button>
  </form></div>`;
}
A.dupCheck = () => {
  const id = UI.signup.f.id.trim(); UI.signup.errs.id = '';
  if (!/^[a-z0-9_]{4,16}$/.test(id)) { UI.signup.dup = null; UI.signup.errs.id = '영문 소문자·숫자·밑줄로 4~16자를 넣어 주세요.'; return render(); }
  UI.signup.dup = !userOf(id); render();
};
F.signup = () => {
  const s = UI.signup, f = s.f, e = {}; const id = f.id.trim();
  if (!/^[a-z0-9_]{4,16}$/.test(id)) e.id = '영문 소문자·숫자·밑줄로 4~16자를 넣어 주세요.';
  else if (userOf(id)) e.id = '이미 사용 중인 아이디입니다.';
  else if (s.dup !== true) e.id = '[중복 확인]을 눌러 주세요.';
  if (!okPw(f.pw)) e.pw = '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.';
  if (f.pw !== f.pw2) e.pw2 = '비밀번호가 서로 다릅니다.';
  if (!f.name.trim()) e.name = '이름을 넣어 주세요.';
  const nk = String(f.nick || '').trim(); if (nk.length < 2 || nk.length > 12) e.nick = '닉네임을 2~12자로 넣어 주세요.'; else if (S.users.some((x) => x.nick === nk)) e.nick = '이미 쓰고 있는 닉네임입니다.';
  const by = N(f.birth); if (by < 1930 || by > 2008) e.birth = '1930~2008 사이의 출생연도를 넣어 주세요. 만 18세 이상만 가입할 수 있습니다.';
  if (!s.verified) e.email = '이메일 인증을 마쳐 주세요.';
  if (!f.t1 || !f.t2) e.terms = '필수 약관에 동의해 주세요.';
  s.errs = e;
  if (Object.keys(e).length) { toast('입력 내용을 확인해 주세요.'); return render(); }
  S.users.push({ id, nick: String(f.nick).trim(), pw: f.pw, name: f.name.trim(), email: f.email.trim(), phone: '', role: 'user', birth: by, joined: now().slice(0, 10), last: '', locked: false, fails: 0, data: null, history: [], cards: [true, true, true, true, true, true], marketing: !!f.t3 });
  S.notifs[id] = [{ text: '가입을 환영합니다. 직군을 고르고 첫 점수를 받아 보세요.', at: now(), read: false, go: 'job' }];
  log('INFO', `신규 회원 가입 · ${id}`, 'auth-service');
  UI = freshUI(); UI.login.id = id;
  toast('가입했습니다. 방금 만든 계정으로 로그인해 주세요.'); go('login');
};

/* ========== find account ========== */
function vFind() {
  const t = UI.find.tab, I = UI.find.id, P = UI.find.pw;
  const idBody = I.result ? `<div class="okbox stack" role="status" style="gap:6px"><span>가입하신 아이디는 <b class="num">${maskId(I.result)}</b> 입니다.</span><span class="hint">가입일 ${userOf(I.result).joined}</span></div>
      <div class="row"><button class="btn btn-p" type="button" data-a="fillLogin" data-x="${I.result}">이 아이디로 로그인</button><button class="btn" type="button" data-a="setv" data-p="find.tab" data-v="pw">비밀번호 재설정</button></div>`
    : `${fld('이름', 'find.id.f.name', { auto: 'name' })}${codeBlock('find.id', 'find.id.f.email', 'find.id.f.code', { mailLabel: '가입한 이메일' })}${I.err ? `<p class="err" role="alert">${I.err}</p>` : ''}
      <button class="btn btn-p" type="button" data-a="findId" ${I.verified ? '' : 'disabled'}>아이디 확인</button>`;
  const pwBody = `${fld('아이디', 'find.pw.f.id', { auto: 'username', dis: P.verified, btn: `<button class="btn" type="button" data-a="pwIdCheck" ${P.verified ? 'disabled' : ''}>아이디 확인</button>`, ok: P.idOk === true ? '가입된 아이디입니다.' : '', err: P.idOk === false ? '가입되지 않은 아이디입니다.' : '' })}${fld('이름', 'find.pw.f.name', { auto: 'name', dis: P.verified })}${codeBlock('find.pw', 'find.pw.f.email', 'find.pw.f.code', { mailLabel: '가입한 이메일' })}${P.err ? `<p class="err" role="alert">${P.err}</p>` : ''}
    ${P.verified ? `<div class="g2">${fld('새 비밀번호', 'find.pw.f.pw', { type: 'password', auto: 'new-password', hint: '영문과 숫자를 섞어 8자 이상', err: P.errs.pw })}${fld('새 비밀번호 확인', 'find.pw.f.pw2', { type: 'password', auto: 'new-password', err: P.errs.pw2 })}</div>
    <button class="btn btn-p" type="button" data-a="resetPw">비밀번호 바꾸기</button><p class="hint">비밀번호를 바꾸면 로그인 실패로 잠긴 계정도 함께 풀립니다.</p>` : ''}`;
  return `<div class="wrap"><header class="top">${brandUser()}<a class="btn btn-s" href="#login">로그인으로</a></header>
  <section class="panel" style="max-width:600px;width:100%;margin:0 auto" aria-labelledby="hFind">
    <span class="tag">Account recovery</span><h1 class="h1" id="hFind">아이디·비밀번호 찾기</h1>
    ${segBtns('find.tab', [['id', '아이디 찾기'], ['pw', '비밀번호 재설정']], '찾을 항목')}
    <div class="stack">${t === 'id' ? idBody : pwBody}</div>
    <p class="hint">시연 계정: 아이디 seoyun · 이름 박서윤 · 이메일 seoyun.park@example.com</p>
  </section></div>`;
}
A.pwIdCheck = () => { const P = UI.find.pw; const id = String(P.f.id || '').trim(); P.idOk = id ? !!S.users.find((x) => x.id === id && x.role !== 'admin') : null; render(); };
A.findId = () => { const I = UI.find.id; if (I.verified) { I.result = I.uid; render(); } };
A.fillLogin = (d) => { UI.login.id = d.x; UI.login.pw = ''; go('login'); };
A.resetPw = () => {
  const P = UI.find.pw, f = P.f, e = {};
  if (!okPw(f.pw)) e.pw = '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.';
  if (f.pw !== f.pw2) e.pw2 = '비밀번호가 서로 다릅니다.';
  P.errs = e; if (Object.keys(e).length) return render();
  const u = userOf(P.uid); u.pw = f.pw; const was = u.locked; u.locked = false; u.fails = 0;
  log('AUTH', `사용자 ${u.id} 비밀번호 재설정${was ? ' · 잠금 해제' : ''}`, 'auth-service');
  UI = freshUI(); UI.login.id = u.id; toast('비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.'); go('login');
};

/* ========== guest predict ========== */
function guestData() {
  const g = UI.guest; const d = sample(g.job);
  const inc = N(g.income);
  if (g.job === 'salary') d.salary = inc / 12; else { const s = sum(d.months) || 1; d.months = d.months.map((m) => m * inc / s); }
  const debt = N(g.debt);
  d.loans = debt > 0 ? [{ type: '대출', amt: debt, rate: 6, kind: '고정', months: 36, pay: Math.round(debt * 0.048) }] : [];
  d.limit = 1000; d.use = N(g.util) * 10; d.dq = N(g.dq); d.cash = 2; d.newl = 0; d.lender = 0;
  d.telcoM = N(g.telco); d.alt = { telco: N(g.telco) > 0, easy: !!g.easy, health: !!g.health, pension: !!g.pension };
  d.healthMiss = 0; d.pensionMiss = 0; d.easyCnt = 38;
  return d;
}
function vGuest() {
  const g = UI.guest; const d = guestData(); const sc = scoreOf(d);
  const lo = sc.A - 15, hi = sc.A + 15;
  const top = [...sc.f].sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 4);
  return `<div class="wrap"><header class="top">${brandUser()}<div class="row" style="gap:8px"><a class="btn btn-s" href="#login">로그인</a><a class="btn btn-s btn-p" href="#signup">회원가입</a></div></header>
  ${head('로그인 없이 예상 점수 보기', '몇 가지만 고르면 대안 신용점수가 어느 정도 나올지 미리 볼 수 있습니다. 비회원 예측은 저장되지 않습니다.')}
  <div class="cols">
    <form class="panel main" data-f="noop" aria-label="예상 점수 조건" style="--b:480px">
      <div class="fld"><span class="lb">직군</span>${segBtns('guest.job', [['salary', '급여소득자'], ['self', '자영업자'], ['free', '프리랜서']], '직군')}</div>
      <div class="g2">${sel('나이대', 'guest.age', ['20대', '30대', '40대', '50대 이상'])}${fld('연소득', 'guest.income', { num: true, live: true, unit: '만원' })}</div>
      <div class="g2">${fld('대출 잔액 합계', 'guest.debt', { num: true, live: true, unit: '만원' })}${sel('최근 1년 연체', 'guest.dq', [[0, '없음'], [1, '1회'], [2, '2회'], [3, '3회 이상']], { num: true })}</div>
      ${range('카드 한도 대비 사용 비율', 'guest.util', 0, 100, 1, g.util + '%', { ends: ['0%', '100%'] })}
      ${range('통신비를 밀리지 않고 낸 기간', 'guest.telco', 0, 36, 1, g.telco + '개월', { ends: ['0개월', '36개월'] })}
      <fieldset class="sunk stack" style="gap:2px;margin:0"><legend class="lb" style="padding:0 4px">해당하는 항목을 고르세요</legend>
        ${chk('간편결제를 매달 꾸준히 쓴다', 'guest.easy')}${chk('최근 3년 건강보험료를 밀린 적이 없다', 'guest.health')}${chk('최근 1년 국민연금을 밀린 적이 없다', 'guest.pension')}
      </fieldset>
    </form>
    <section class="panel side" aria-labelledby="hGr" style="position:sticky;top:12px">
      <span class="tag">Estimate</span><h2 class="h2" id="hGr">예상 대안 신용점수</h2>
      <div class="row" style="align-items:baseline;gap:8px"><b class="big" style="color:var(--mint)">${lo}~${hi}</b><span class="hint">점</span>${gchip(sc.A)}</div>
      <p class="hint">기존 방식으로 매기면 <b class="num" style="color:var(--fg)">${sc.T}점</b> 근처입니다. 차이 <b class="num" style="color:var(--mint)">${sgn(sc.A - sc.T)}점</b></p>
      <div class="stack" style="gap:8px"><span class="lb">점수에 크게 영향을 준 항목</span>
        ${top.map((x) => `<div class="row between" style="font-size:13px"><span>${x.label}</span><b class="num" style="color:${x.v > 0 ? 'var(--mint)' : 'var(--bad)'}">${sgn(x.v)}</b></div>`).join('')}</div>
      <p class="note">가입 후 실제 소득·부채·납부 내역을 불러오면 범위 없이 정확한 점수와 리포트를 받습니다.</p>
      <a class="btn btn-p" href="#signup">가입하고 정확한 리포트 받기</a>
    </section>
  </div></div>`;
}
F.noop = () => {};

/* ========== job select ========== */
function vJob() {
  const u = me(); const cur = UI.job || (u.data && u.data.job) || null;
  const defs = [
    ['salary', '급여소득자', '회사에서 매달 정해진 월급을 받습니다.', '월급(보너스 제외), 부채, 자산, 지출', [true, true, true, true]],
    ['self', '자영업자', '가게나 사업장을 직접 운영하고 매출로 소득을 얻습니다.', '월별 소득, 부채, 자산, 지출', [true, true, true, true]],
    ['free', '프리랜서', '프로젝트·건별 계약으로 소득을 얻어 달마다 금액이 다릅니다.', '월별 소득, 부채, 자산, 지출', [true, true, true, true]]
  ];
  const tabN = ['자산·부채 건전성', '시나리오 테스트', '현금흐름·소득 변동성', '상권 분석'];
  const c = defs.find((x) => x[0] === cur);
  const change = u.data && cur && u.data.job !== cur;
  return userShell('job', `${head(`${esc(u.name)}님, 어떤 방식으로 소득을 얻으시나요?`, '직군에 따라 넣는 항목이 달라집니다. 재무 진단 탭은 직군과 상관없이 모두 볼 수 있습니다. 나중에 마이 페이지에서 바꿀 수 있습니다.')}
  <div class="grid" style="--min:260px" role="group" aria-label="직군 선택">
    ${defs.map(([id, l, desc]) => `<button type="button" class="panel" data-a="setv" data-p="job" data-v="${id}" aria-pressed="${cur === id}" style="cursor:pointer;text-align:left;color:var(--fg);border-color:${cur === id ? 'var(--vio)' : 'var(--line2)'};background:${cur === id ? '#1d1838' : 'var(--panel)'}">
      <span class="row between"><b style="font-size:18px">${l}</b><span aria-hidden="true" style="width:18px;height:18px;border-radius:50%;border:2px solid ${cur === id ? 'var(--vio)' : 'var(--line2)'};background:${cur === id ? 'var(--vio)' : 'transparent'}"></span></span>
      <span class="hint" style="font-size:13px">${desc}</span></button>`).join('')}
  </div>
  ${c ? `<section class="panel" aria-labelledby="hJc"><h2 class="h2" id="hJc">${c[1]}로 시작하면</h2>
    <div class="g2" style="--min:260px"><div class="stack" style="gap:6px"><span class="lb">넣을 항목</span><span>${c[3]} · 대안 데이터 4종</span></div>
    <div class="stack" style="gap:6px"><span class="lb">볼 수 있는 재무 진단</span><span class="row" style="gap:6px">${tabN.map((t, i) => `<span class="chip" style="${c[4][i] ? 'color:var(--fg2)' : 'opacity:.55'}">${t}${c[4][i] ? '' : ' (숨김)'}</span>`).join('')}</span></div></div>
    ${change ? `<p class="warnbox">직군을 ${JOBS[u.data.job]}에서 ${c[1]}로 바꾸면 소득 입력을 다시 해야 합니다. 이전 진단 내역은 그대로 남습니다.</p>` : ''}
    <div class="row"><button class="btn btn-p" data-a="pickJob">${c[1]}로 시작하기</button>${u.data && u.history.length ? '<a class="btn" href="#mypage">취소</a>' : ''}</div></section>`
    : '<p class="hint">직군을 하나 고르면 다음 단계로 넘어갈 수 있습니다.</p>'}`);
}
A.pickJob = () => {
  const u = me(); const j = UI.job || (u.data && u.data.job); if (!j) return;
  UI.input.d = u.data && u.data.job === j ? clone(u.data) : blank(j);
  UI.input.errs = [];
  go('input');
};

/* ========== data input ========== */
const ALT = [
  ['easy', '간편결제 이용 내역', (d) => `최근 12개월 · 월 평균 ${N(d.easyCnt)}건 · 결제 실패 0회`],
  ['telco', '통신비 납부 이력', (d) => `최근 ${N(d.telcoM)}개월 · 연체 0회 · 자동이체`],
  ['pension', '국민연금 납부 내역', (d) => `최근 36개월 · ${d.job === 'salary' ? '직장' : '지역'}가입 · 미납 ${N(d.pensionMiss)}회`],
  ['health', '건강보험료 납부 내역', (d) => `최근 36개월 · ${d.job === 'salary' ? '직장' : '지역'}가입 · 미납 ${N(d.healthMiss)}회`]
];
function inputStatus(d) {
  const filled = (v) => v !== '' && v != null;
  const inc = d.job === 'salary' ? filled(d.salary) && N(d.salary) > 0 : d.months.every(filled);
  return [['소득', inc], ['기간', filled(d.bizYears)], ['자산', filled(d.asset)], ['카드·부채', filled(d.limit) && filled(d.use)], ['지출', filled(d.living)], [`대안 데이터 ${ALT.filter(([k]) => d.alt[k]).length}/4`, ALT.some(([k]) => d.alt[k])]];
}
function vInput() {
  const u = me();
  if (!UI.input.d) UI.input.d = u.data ? clone(u.data) : blank(UI.job || 'self');
  const d = UI.input.d, j = d.job; const st = inputStatus(d); const ready = st.every((x) => x[1]);
  const pv = ready ? scoreOf(norm(d)) : null;
  const inc = j === 'salary'
    ? `<div class="g2">${fld('월급 (세후, 보너스 제외)', 'input.d.salary', { num: true, live: true, unit: '만원' })}</div><p class="hint">연 환산 ${fmt(N(d.salary) * 12)}만원</p>`
    : `<div class="g2" style="--min:120px">${MONTHS.map((m, i) => fld(m, `input.d.months.${i}`, { num: true, live: true, unit: '만원' })).join('')}</div>
       <p class="hint num">연 합계 ${fmt(sum(d.months))}만원 · 월평균 ${fmt(sum(d.months) / 12)}만원 · 변동 계수 ${(cvOf(norm(d)) * 100).toFixed(1)}%</p>`;
  const loanRows = d.loans.map((l, i) => `<tr><td>${esc(l.type)}</td><td class="r num">${fmt(l.amt)}</td><td class="r num">${N(l.rate).toFixed(1)}%</td><td>${esc(l.kind)}</td><td class="r num">${fmt(l.months)}개월</td><td class="r num">${fmt(l.pay)}</td><td><button class="btn btn-s btn-d" data-a="delLoan" data-i="${i}" aria-label="${esc(l.type)} 삭제">삭제</button></td></tr>`).join('');
  const fx = d.fixed.map((x, i) => `<li class="row between sunk" style="padding:8px 12px"><span><span class="chip">${esc(x.type)}</span> ${esc(x.name)}</span><span class="row" style="gap:8px"><b class="num">${fmt(x.amt)}만원</b><button class="btn btn-s btn-d" data-a="delFixed" data-i="${i}" aria-label="${esc(x.name)} 삭제">삭제</button></span></li>`).join('');
  return userShell('input', `${head('내 데이터 입력', `${JOBS[j]} 기준으로 넣습니다. 단위는 모두 만원입니다.`, `<div class="row"><span class="chip">${JOBS[j]}</span><a class="btn btn-s" href="#job">직군 바꾸기</a></div>`)}
  <div class="cols">
    <div class="stack main" style="gap:18px">
      <section class="panel" aria-labelledby="hInc"><h2 class="h2" id="hInc">${j === 'salary' ? '월급' : '최근 12개월 소득'}</h2>${inc}
        <div class="g2">${fld(TENURE[j], 'input.d.bizYears', { num: true, live: true, unit: '년', step: 0.1 })}${fld('총자산 (예금·보증금·차량 등)', 'input.d.asset', { num: true, live: true, unit: '만원' })}</div></section>
      <section class="panel" aria-labelledby="hLoan"><h2 class="h2" id="hLoan">대출</h2>
        ${d.loans.length ? `<div class="tblw"><table class="tbl"><thead><tr><th>종류</th><th class="r">잔액</th><th class="r">금리</th><th>방식</th><th class="r">남은 기간</th><th class="r">월 상환액</th><th><span class="tag">삭제</span></th></tr></thead><tbody>${loanRows}</tbody></table></div><p class="hint num">대출 합계 ${fmt(debtOf(norm(d)))}만원 · 월 상환 ${fmt(payOf(norm(d)))}만원</p>` : '<p class="hint">등록한 대출이 없습니다. 대출이 없으면 비워 두세요.</p>'}
        <div class="sunk stack"><span class="lb">대출 추가</span>
          <div class="g2" style="--min:130px">${sel('종류', 'input.dl.type', ['신용대출', '사업자 운전자금', '전세자금대출', '주택담보대출', '카드론', '기타'])}${fld('잔액', 'input.dl.amt', { num: true, unit: '만원' })}${fld('금리', 'input.dl.rate', { num: true, unit: '%', step: 0.1 })}${sel('방식', 'input.dl.kind', ['고정', '변동'])}${fld('남은 기간', 'input.dl.months', { num: true, unit: '개월' })}${fld('월 상환액', 'input.dl.pay', { num: true, unit: '만원', ph: '비우면 자동 계산' })}</div>
          <div class="row"><button class="btn" data-a="addLoan">대출 추가</button>${UI.input.lerr ? `<span class="err" role="alert">${UI.input.lerr}</span>` : ''}</div></div></section>
      <section class="panel" aria-labelledby="hCard"><h2 class="h2" id="hCard">카드·신용 이용</h2>
        <div class="g2" style="--min:170px">${fld('카드 한도', 'input.d.limit', { num: true, live: true, unit: '만원' })}${fld('월 카드 사용액', 'input.d.use', { num: true, live: true, unit: '만원' })}${fld('최근 1년 연체 횟수', 'input.d.dq', { num: true, live: true, unit: '회', min: 0 })}${fld('현금서비스 이용 (최근 12개월)', 'input.d.cash', { num: true, live: true, unit: '개월', min: 0, max: 12 })}${fld('최근 3개월 신규 대출', 'input.d.newl', { num: true, live: true, unit: '건', min: 0 })}${fld('대부업 대출 잔액', 'input.d.lender', { num: true, live: true, unit: '만원', min: 0 })}</div></section>
      <section class="panel" aria-labelledby="hExp"><h2 class="h2" id="hExp">지출</h2>
        <div class="g2">${fld('월 고정 지출 (식비·교통·공과금 등)', 'input.d.living', { num: true, live: true, unit: '만원' })}</div>
        ${fx ? `<ul class="stack" style="gap:8px">${fx}</ul>` : ''}
        <div class="sunk stack"><span class="lb">할부·정기결제 추가</span><div class="g2" style="--min:150px">${sel('종류', 'input.dx.type', ['할부', '정기결제'])}${fld('이름', 'input.dx.name', { ph: '예: 휴대폰 할부금' })}${fld('월 금액', 'input.dx.amt', { num: true, unit: '만원' })}</div><div class="row"><button class="btn" data-a="addFixed">추가</button></div></div></section>
      <section class="panel" aria-labelledby="hAlt"><h2 class="h2" id="hAlt">대안 데이터</h2>
        <p class="hint">항목마다 [불러오기]를 누르면 먼저 정보 제공 동의를 받습니다. 동의한 항목만 기관에서 불러오며(시연에서는 예시 내역), [연결 해제]로 언제든 동의를 거둘 수 있습니다.</p>
        <div class="g2" style="--min:240px">${ALT.map(([k, l, s]) => `<div class="sunk stack" style="gap:8px"><div class="row between"><b>${l}</b>${d.alt[k] ? '<span class="chip" style="color:var(--mint);border-color:var(--mint)">불러옴</span>' : '<span class="chip">연결 전</span>'}</div>
          <span class="hint">${d.alt[k] ? s(d) + (d.consent && d.consent[k] ? ` · 동의 ${d.consent[k]}` : '') : '동의 후 불러오면 점수에 반영됩니다.'}</span><button class="btn btn-s${d.alt[k] ? '' : ' btn-p'}" data-a="altToggle" data-k="${k}">${d.alt[k] ? '연결 해제' : '불러오기'}</button></div>`).join('')}</div></section>
    </div>
    <aside class="panel side" aria-labelledby="hProg" style="position:sticky;top:12px">
      <h2 class="h2" id="hProg">입력 현황</h2>
      <ul class="stack" style="gap:6px">${st.map(([l, ok]) => `<li class="row between"><span>${l}</span><span class="chip" style="color:${ok ? 'var(--mint)' : 'var(--warn)'};border-color:${ok ? 'var(--mint)' : 'var(--warn)'}">${ok ? '완료' : '입력 필요'}</span></li>`).join('')}</ul>
      ${pv ? `<div class="sunk stack" style="gap:4px"><span class="lb">지금 입력으로 미리 본 점수</span><span class="row" style="gap:10px"><span class="num">기존 <b>${pv.T}</b></span><span class="num" style="color:var(--mint)">대안 <b>${pv.A}</b></span>${gchip(pv.A)}</span></div>` : ''}
      ${UI.input.errs.length ? `<div class="warnbox" role="alert">${UI.input.errs.map(esc).join('<br>')}</div>` : ''}
      <button class="btn btn-p" data-a="runScore">점수 산출하기</button>
      <button class="btn" data-a="fillSample">예시 값으로 채우기</button>
      ${u.history.length ? '<a class="btn" href="#report" data-a="cancelInput">취소하고 리포트로</a>' : ''}
    </aside>
  </div>`);
}
const CONSENT = { easy: ['간편결제사(카카오페이·네이버페이 등)', '최근 12개월 결제 건수·결제 실패 여부'], telco: ['통신 3사', '최근 36개월 통신요금 납부일·연체 여부'], pension: ['국민연금공단', '최근 36개월 납부 여부·미납 횟수'], health: ['국민건강보험공단', '최근 36개월 보험료 납부 여부·미납 횟수'] };
function consentModal() {
  const c = UI.consent, A0 = ALT.find((a) => a[0] === c.k), C = CONSENT[c.k];
  return `<div class="back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="hCons"><span class="tag">정보 제공 동의 · 시연용</span><h2 class="h2" id="hCons">${A0[1]} 불러오기</h2>
    <dl class="stack" style="gap:6px;margin:0;font-size:13.5px"><div><b>제공 기관</b> · ${C[0]}</div><div><b>불러오는 항목</b> · ${C[1]}</div><div><b>이용 목적</b> · 대안 신용점수 산출과 리포트 제공</div><div><b>보관 기간</b> · 탈퇴하거나 동의를 거둘 때까지</div></dl>
    ${chk('[필수] 위 내용으로 정보를 불러오는 데 동의합니다', 'consent.ok')}${c.err ? `<p class="err" role="alert">${c.err}</p>` : ''}
    <p class="hint">동의하지 않아도 가입과 기본 점수 산출은 할 수 있습니다. 이 항목만 점수에 들어가지 않습니다.</p>
    <div class="row"><button class="btn btn-p" data-a="consentOk">동의하고 불러오기</button><button class="btn" data-a="consentCancel">취소</button></div></div></div>`;
}
A.consentCancel = () => { UI.consent = null; render(); };
A.consentOk = () => { const c = UI.consent; if (!c.ok) { c.err = '필수 동의에 체크해 주세요.'; return render(); } UI.consent = null; A.altLoad(c.k); };
A.altToggle = (x) => {
  const d = UI.input.d, k = x.k;
  if (d.alt[k]) { d.alt[k] = false; if (d.consent) delete d.consent[k]; toast('연결을 해제하고 동의를 거뒀습니다.'); return render(); }
  UI.consent = { k, ok: false, err: '' }; render();
};
A.altLoad = (k) => {
  const d = UI.input.d;
  const s = sample(d.job); d.alt[k] = true; (d.consent = d.consent || {})[k] = now().slice(0, 10);
  if (k === 'easy') d.easyCnt = s.easyCnt; if (k === 'telco') d.telcoM = s.telcoM; if (k === 'pension') d.pensionMiss = s.pensionMiss; if (k === 'health') d.healthMiss = s.healthMiss;
  toast(`${ALT.find((a) => a[0] === k)[1]}을 불러왔습니다.`); render();
};
A.addLoan = () => {
  const l = UI.input.dl; UI.input.lerr = '';
  if (!(N(l.amt) > 0) || !(N(l.rate) > 0) || !(N(l.months) > 0)) { UI.input.lerr = '잔액·금리·남은 기간을 0보다 크게 넣어 주세요.'; return render(); }
  let pay = N(l.pay);
  if (!pay) { const r = N(l.rate) / 100 / 12, n = N(l.months); pay = Math.round(N(l.amt) * r / (1 - Math.pow(1 + r, -n))); }
  UI.input.d.loans.push({ type: l.type, amt: N(l.amt), rate: N(l.rate), kind: l.kind, months: N(l.months), pay });
  UI.input.dl = { type: '신용대출', amt: '', rate: '', kind: '고정', months: '', pay: '' }; render();
};
A.delLoan = (x) => { UI.input.d.loans.splice(N(x.i), 1); render(); };
A.addFixed = () => { const f = UI.input.dx; if (!f.name.trim() || !(N(f.amt) > 0)) { toast('이름과 월 금액을 넣어 주세요.'); return; } UI.input.d.fixed.push({ type: f.type, name: f.name.trim(), amt: N(f.amt) }); UI.input.dx = { type: '정기결제', name: '', amt: '' }; render(); };
A.delFixed = (x) => { UI.input.d.fixed.splice(N(x.i), 1); render(); };
A.fillSample = () => { UI.input.d = sample(UI.input.d.job); UI.input.errs = []; toast(`${JOBS[UI.input.d.job]} 예시 값을 채웠습니다.`); render(); };
A.cancelInput = () => { UI.input.d = null; go('report'); };
A.runScore = () => {
  const d = UI.input.d; const st = inputStatus(d);
  const miss = st.filter((x) => !x[1]).map((x) => `${x[0].replace(/ \d\/4$/, '')} 항목을 채워 주세요.`);
  if (N(d.use) > N(d.limit) && N(d.limit) > 0) miss.push('월 카드 사용액이 카드 한도보다 큽니다.');
  UI.input.errs = miss;
  if (miss.length) { toast('입력하지 않은 항목이 있습니다.'); return render(); }
  const u = me(); u.data = norm(d); const sc = scoreOf(u.data);
  const prev = u.history[0];
  u.history.unshift({ at: now(), T: sc.T, A: sc.A, job: u.data.job });
  notify(u.id, `새 점수가 나왔습니다 · 대안 ${sc.A}점 (${gradeOf(sc.A)})`, 'report');
  log('INFO', `점수 산출 완료 · ${u.id} · 대안 ${sc.A}점${prev ? ` (${sgn(sc.A - prev.A)})` : ''}`, 'scoring-api');
  UI.input.d = null; UI.report.alert = true; UI.sim = null; UI.health = null; UI.cash = null;
  toast('점수를 산출했습니다.'); go('report');
};
