
/* ========== report ========== */
const QA = [
  ['대안 신용점수가 뭐예요?', '대출·연체 기록만 보는 기존 방식과 달리, 통신비·간편결제·보험료를 꾸준히 낸 기록까지 함께 보고 매긴 점수예요.', ['대안', '뭐예요', '무엇']],
  ['DSR은 무엇인가요?', '1년 동안 번 돈 중에서 빚(원금과 이자)을 갚는 데 쓴 비율이에요. 낮을수록 갚을 여유가 있다는 뜻이고, 보통 40%를 넘으면 추가 대출이 어려워집니다.', ['dsr', '상환 부담', '부담률']],
  ['SHAP 영향도는?', '기준 점수에서 시작해 어떤 항목이 내 점수를 얼마나 올리고 내렸는지 나눠서 보여 주는 방법이에요.', ['shap', '영향도']],
  ['등급은 어떻게 나뉘나요?', 'Caution 664점 이하, Standard 665~779점, Good 780점 이상의 3단계입니다. 경계 점수는 시연용 예시이고 모형이 확정되면 바뀔 수 있습니다.', ['등급', 'good', 'caution', 'standard']],
  ['카드 사용 비율은 왜 보나요?', '한도에 비해 많이 쓸수록 돈이 빠듯하다고 보고 점수를 낮춥니다. 한도의 30% 아래로 쓰면 좋습니다.', ['카드', '한도', '사용 비율']],
  ['연체는 얼마나 영향이 있나요?', '예시 모델에서는 최근 1년 연체 1회마다 약 14점이 내려갑니다. 갚은 뒤 시간이 지나면 영향이 줄어듭니다.', ['연체', '밀리']],
  ['소득 변동성은 왜 보나요?', '달마다 버는 돈이 크게 달라지면 빠듯한 달에 상환이 밀릴 수 있어서 대안 점수에 반영합니다. 변동 계수가 12%를 넘으면 감점됩니다.', ['변동', '소득']]
];
function sparkline(vals) {
  if (vals.length < 2) return '';
  const w = 220, h = 56, mn = Math.min(...vals) - 6, mx = Math.max(...vals) + 6;
  const x = (i) => 6 + i * (w - 12) / (vals.length - 1), y = (v) => h - 6 - (v - mn) / (mx - mn) * (h - 12);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="대안 점수 추이 ${vals.join(', ')}" style="max-width:100%">
    <polygon points="6,${h - 6} ${pts} ${x(vals.length - 1).toFixed(1)},${h - 6}" fill="#00e6a5" fill-opacity=".12"/>
    <polyline points="${pts}" fill="none" stroke="#00e6a5" stroke-width="2"/>
    <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="4" fill="#00e6a5"/></svg>`;
}
function scaleBar(T, A) {
  const p = (s) => ((clamp(s, 300, 900) - 300) / 600 * 100).toFixed(1);
  return `<div style="position:relative;height:64px;margin:4px 6px" role="img" aria-label="등급 기준선 위 기존 ${T}점과 대안 ${A}점의 위치">
    <span class="num" style="position:absolute;top:0;left:${p(A)}%;transform:translateX(-50%);font-size:12px;color:var(--mint);white-space:nowrap">대안 ${A}</span>
    <div style="position:absolute;top:24px;left:0;right:0;height:10px;border-radius:5px;display:flex;overflow:hidden"><span style="width:60.75%;background:#5a2a33"></span><span style="width:19.17%;background:#5b4a1c"></span><span style="flex:1;background:#0f4a3c"></span></div>
    <span style="position:absolute;top:18px;left:${p(A)}%;width:3px;height:22px;margin-left:-1.5px;background:var(--mint);border-radius:2px"></span>
    <span style="position:absolute;top:18px;left:${p(T)}%;width:3px;height:22px;margin-left:-1.5px;background:var(--mut);border-radius:2px"></span>
    <span class="num" style="position:absolute;top:44px;left:${p(T)}%;transform:translateX(-50%);font-size:12px;color:var(--mut);white-space:nowrap">기존 ${T}</span>
  </div>
  <div class="hint num" style="position:relative;height:18px;font-size:11.5px;margin:0 6px"><span style="position:absolute;left:30.4%;transform:translateX(-50%);white-space:nowrap">Caution ~664</span><span style="position:absolute;left:70.3%;transform:translateX(-50%);white-space:nowrap">Standard</span><span style="position:absolute;left:90%;transform:translateX(-50%);white-space:nowrap">Good 780~</span></div>`;
}
const pdOf = (s) => 100 / (1 + Math.exp((s - 520) / 38));
const pdTxt = (s) => { const v = pdOf(s); return (v < 1 ? v.toFixed(2) : v.toFixed(1)) + '%'; };
function helpCard(cls = '') {
  const R = UI.report;
  return `<section class="panel ${cls}" data-nocard aria-labelledby="hQa"><div class="row between"><div><span class="tag">Help</span><h2 class="h2" id="hQa">금융 용어 도우미</h2></div><span class="row" style="gap:6px"><span class="chip num" title="직접 쓴 질문만 차감됩니다">직접 질문 오늘 ${R.left}회 남음</span><button class="cbtn" data-a="helpToggle" aria-label="용어 도우미 닫기">닫기 ✕</button></span></div>
    <div class="row" style="gap:6px">${QA.slice(0, 4).map((q, i) => `<button class="btn btn-s" data-a="askQ" data-i="${i}">${q[0]}</button>`).join('')}</div>
    <form class="row" data-f="ask" style="flex-wrap:nowrap;gap:8px"><label class="lb" for="${fid('report.q')}" style="position:absolute;left:-9999px">궁금한 용어</label><input class="inp" id="${fid('report.q')}" data-bind="report.q" value="${esc(R.q)}" placeholder="예: 연체는 얼마나 영향이 있나요?" ${R.left ? '' : 'disabled'}><button class="btn btn-p" type="submit" ${R.left ? '' : 'disabled'}>묻기</button></form>
    ${R.ans ? `<div class="sunk stack" style="gap:6px" role="status"><span class="row between"><b>${esc(R.ansQ)}</b><span class="chip">${R.src || ''}</span></span><p style="color:var(--fg2)">${esc(R.ans)}</p></div>` : '<p class="hint">위의 자주 묻는 질문은 미리 등록한 답이 바로 나오고 횟수가 줄지 않습니다(N-32-1). 직접 쓴 질문만 AI가 답하고 하루 횟수에서 차감됩니다(N-32-2).</p>'}</section>`;
}
const AREAS = [['카드·현금서비스', (l) => /^카드 사용|현금서비스/.test(l)], ['대출', (l) => /대출 잔액|신규 대출|대부업/.test(l)], ['연체', (l) => /연체/.test(l)], ['소득 안정성', (l) => /소득/.test(l)], ['대안 납부 기록', () => true]];
function areaOf(label) { return AREAS.find(([, t]) => t(label))[0]; }
const MODEL_FEATS = ['카드 사용 비율', '대출 잔액', '보유 대출 건수', '최근 1년 연체', '현금서비스 이용', '신규 대출', '대부업 이용', '근속·운영 기간', '연소득'];
const ALT_FEATS = ['통신비 납부', '간편결제 이용', '건강보험료 납부', '국민연금 납부', '월별 소득 변동'];
function gauge(v, color, label) {
  const cx = 150, cy = 140, R = 110, a = (s) => Math.PI * (1 - (clamp(s, 300, 900) - 300) / 600), P = (s, r = R) => [cx + r * Math.cos(a(s)), cy - r * Math.sin(a(s))];
  const arc = (s0, s1) => { const [x0, y0] = P(s0), [x1, y1] = P(s1); return `M${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
  const tick = (s) => { const [x, y] = P(s), [lx, ly] = P(s, R + 22); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" style="fill:var(--fg)"/><text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" font-size="12" text-anchor="middle" style="fill:var(--mut)">${s}</text>`; };
  return `<svg viewBox="0 0 300 175" width="100%" style="max-width:300px;display:block;margin:0 auto" role="img" aria-label="${label} ${v}점 (300~900)">
    <path d="${arc(300, 900)}" fill="none" style="stroke:var(--line)" stroke-width="22" stroke-linecap="round"/>
    <path d="${arc(300, v)}" fill="none" style="stroke:${color}" stroke-width="22" stroke-linecap="round"/>
    ${tick(665)}${tick(780)}
    <text x="${cx}" y="${cy - 2}" font-size="50" font-weight="700" text-anchor="middle" style="fill:${color}">${v}</text>
    <text x="${cx - R}" y="${cy + 24}" font-size="12" text-anchor="middle" style="fill:var(--mut)">300</text><text x="${cx + R}" y="${cy + 24}" font-size="12" text-anchor="middle" style="fill:var(--mut)">900</text></svg>`;
}
function scoreCard(sc, h, e) {
  const chips = (alt) => MODEL_FEATS.map((f) => `<span class="fchip">${f}</span>`).join('') + (alt ? ALT_FEATS.map((f) => `<span class="fchip alt">${f}</span>`).join('') : '');
  const side = (title, sub, v, color, alt, right) => `<div class="sunk stack" style="gap:10px;padding:16px"><div class="row between" style="align-items:flex-start"><div><b style="font-size:15px">${title}</b><div class="hint">${sub}</div></div><span class="row" style="gap:8px">${right}${gchip(v)}</span></div>
    ${gauge(v, color, title)}<span class="lb">${e ? '이 점수가 보는 항목' : '이 모델이 보는 피처'}</span><div class="row" style="gap:6px">${chips(alt)}</div>${alt ? '<p class="hint">보라색 태그는 대안 모델에서 새로 더한 비금융 피처입니다.</p>' : ''}</div>`;
  return `<section class="panel s3" aria-labelledby="hSc"><div class="row between"><div><span class="tag">Score</span><h2 class="h2" id="hSc">${e ? '내 점수 한눈에' : '점수 비교'}</h2></div><span class="chip num">${h[0].at} 산출</span></div>
    <div class="g2" style="--min:300px">
      ${side(e ? '예전 방식 점수' : '기존 모델', '금융 이력 중심 (대출·카드·연체)', sc.T, 'var(--mut)', false, '')}
      ${side(e ? '성실 납부까지 본 점수' : '대안 모델', '금융 이력 + 비금융 납부 이력', sc.A, 'var(--c-pos)', true, `<span class="num" style="color:${sc.A >= sc.T ? 'var(--mint)' : 'var(--bad)'};font-size:13px;font-weight:600">기존보다 ${sgn(sc.A - sc.T)}</span>`)}
    </div></section>`;
}
function shapChart(sc, e) {
  const rows = [...sc.f].sort((a, b) => b.v - a.v);
  const max = Math.max(30, ...rows.map((x) => Math.abs(x.v)));
  const bar = (v, color) => { const w = Math.abs(v) / max * 50; return `<span class="sbar" aria-hidden="true"><span class="mid0"></span><span style="left:${(v >= 0 ? 50 : 50 - w).toFixed(1)}%;width:${w.toFixed(1)}%;background:${color}"></span></span>`; };
  const row = (label, v, color, tag) => `<div class="srow"><span class="sl">${tag}${label}</span>${bar(v, color)}<b class="num sv" style="color:${color}">${sgn(v)}</b></div>`;
  return `<section class="panel s2" aria-labelledby="hShap"><div><span class="tag">Explain</span><h2 class="h2" id="hShap">${e ? '점수를 올리고 내린 이유' : '영역별 영향도 (SHAP)'}</h2></div>
    <div class="row num" style="gap:8px 14px;font-size:13.5px"><span class="hint">기준점</span><b>639</b><span class="hint">→ 모델 점수</span><b style="color:var(--mint)">${sc.A}</b></div>
    <div class="slegend hint"><span><i style="background:var(--c-pos)"></i>점수를 올림</span><span><i style="background:var(--c-neg)"></i>점수를 내림</span><span><b class="atag">대안</b> 대안 데이터 항목</span></div>
    <div class="stack" style="gap:9px">${rows.map((x) => row(x.label, x.v, x.v > 0 ? 'var(--c-pos)' : 'var(--c-neg)', x.kind === 'alt' ? '<b class="atag">대안</b>' : '')).join('')}</div>
  </section>`;
}
const SHORT = [[/^대안 데이터/, '대안 데이터'], [/^통신비/, '통신비 납부'], [/^간편결제/, '간편결제'], [/^건강보험/, '건강보험료'], [/^국민연금/, '국민연금'], [/소득 변동|소득이 꾸준/, '소득 안정성'], [/^카드 사용/, '카드 사용률'], [/대출 잔액/, '대출 잔액'], [/연체/, '연체'], [/현금서비스/, '현금서비스'], [/신규 대출/, '신규 대출'], [/대부업/, '대부업'], [/보유 대출/, '보유 대출'], [/기간/, '근속·운영'], [/^연소득/, '연소득']];
const shortOf = (l) => { const m = SHORT.find(([re]) => re.test(l)); return m ? m[1] : l; };
function summaryCard(sc) {
  const pos = sc.f.filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3), neg = sc.f.filter((x) => x.v < 0).sort((a, b) => a.v - b.v).slice(0, 3);
  const items = [...pos.map((x) => [shortOf(x.label), x.v, 'var(--c-pos)', x.kind === 'alt']), ...neg.map((x) => [shortOf(x.label), x.v, 'var(--c-neg)', x.kind === 'alt'])];
  const pmax = Math.max(0, ...items.map((x) => x[1])), nmax = Math.max(0, ...items.map((x) => -x[1])), tot = Math.max(20, pmax + nmax);
  const W = 360, H = 300, Y0 = 26, Y1 = H - 74, zero = Y0 + (Y1 - Y0) * pmax / tot, k = (Y1 - Y0) / tot, cw = W / Math.max(1, items.length), bw = Math.min(40, cw * 0.56);
  return `<section class="panel" aria-labelledby="hSum"><span class="tag">Summary</span><h2 class="h2" id="hSum">한눈에 보는 요약</h2>
    <div class="slegend hint"><span><i style="background:var(--c-pos)"></i>점수를 크게 올린 항목</span><span><i style="background:var(--c-neg)"></i>점수를 크게 내린 항목</span></div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="점수를 크게 올린 항목과 내린 항목: ${items.map((x) => `${x[0]} ${sgn(x[1])}점`).join(', ')}" style="max-width:100%">
      <line x1="0" x2="${W}" y1="${zero.toFixed(1)}" y2="${zero.toFixed(1)}" style="stroke:var(--line2)" stroke-width="1.5"/>
      ${items.map(([n, v, c, alt], i) => { const h = Math.abs(v) * k, x = i * cw + (cw - bw) / 2, y = v >= 0 ? zero - h : zero, words = n.split(' ');
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="3" style="fill:${c}"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${(v >= 0 ? y - 7 : y + h + 15).toFixed(1)}" font-size="12.5" font-weight="700" text-anchor="middle" style="fill:${c}">${sgn(v)}</text>
        ${words.map((t, li) => `<text x="${(i * cw + cw / 2).toFixed(1)}" y="${H - 44 + li * 14}" font-size="11.5" text-anchor="middle" style="fill:var(--mut)">${t}</text>`).join('')}
        ${alt ? `<text x="${(i * cw + cw / 2).toFixed(1)}" y="${H - 44 + words.length * 14}" font-size="10.5" font-weight="700" text-anchor="middle" style="fill:var(--vio)">대안</text>` : ''}`; }).join('')}
    </svg>
    <div class="note stack" style="gap:10px"><span>조건이 바뀌면 점수가 어떻게 달라지는지 시뮬레이터에서 미리 확인해 보세요.</span><a class="btn btn-p" href="#sim" style="color:inherit">신용케어 시뮬레이터로 가기</a></div></section>`;
}
function peersCard() {
  const u = me(), d = u.data, sc = scoreOf(d), e = UI.report.easy;
  const m = PEER[d.job], sdv = 60; const bins = []; for (let lo = 520; lo < 880; lo += 30) bins.push([lo, 100 * (phi((lo + 30 - m) / sdv) - phi((lo - m) / sdv))]);
  const bmax = Math.max(...bins.map((b) => b[1])); const myBin = bins.findIndex(([lo]) => sc.A >= lo && sc.A < lo + 30);
  const top = Math.max(1, Math.round((1 - phi((sc.A - m) / sdv)) * 100));
  return `<section class="panel" aria-labelledby="hPeer"><span class="tag">Peers</span><h2 class="h2" id="hPeer">${e ? `같은 ${JOBS[d.job]} 100명 중 내 위치` : '동일 직군 대비 백분위'}</h2>
    <p><b class="mid" style="color:var(--vio)">상위 ${top}%</b> <span class="hint">${JOBS[d.job]} 평균 ${m}점 기준 (예시 분포)</span></p>
    <svg viewBox="0 0 480 170" width="100%" role="img" aria-label="${JOBS[d.job]} 점수 분포, 내 점수 ${sc.A}점은 상위 ${top}%" style="max-width:100%">
      ${bins.map(([lo, c], i) => { const bh = c / bmax * 120; return `<rect x="${i * 40 + 3}" y="${135 - bh}" width="34" height="${bh}" rx="3" fill="${i === myBin ? '#a78bfa' : '#3b3470'}"/>`; }).join('')}
      <line x1="0" x2="480" y1="135.5" y2="135.5" stroke="#2d3e5c"/>
      ${bins.map(([lo], i) => i % 2 === 0 ? `<text x="${i * 40 + 3}" y="155" font-size="11" fill="#8a9bb4">${lo}</text>` : '').join('')}
      ${myBin >= 0 ? `<text x="${myBin * 40 + 20}" y="${135 - bins[myBin][1] / bmax * 120 - 6}" font-size="11" fill="#c4b5fd" text-anchor="middle">나</text>` : ''}
    </svg></section>`;
}
function vReport() {
  const u = me(), d = u.data, sc = scoreOf(d), h = u.history, prev = h[1], R = UI.report, e = R.easy;
  const lastAlert = R.alert && h.length ? `<div class="okbox row between" role="status"><span>새 점수가 나왔어요 · 대안 <b class="num">${h[0].A}점</b>${prev ? ` (지난번보다 <b class="num">${sgn(h[0].A - prev.A)}</b>)` : ''}</span><button class="btn btn-s" data-a="closeAlert">닫기</button></div>` : '';
  return userShell('report', `${lastAlert}${head('신용 리포트', `${JOBS[d.job]} 기준 · 마지막 산출 ${h[0].at}`, `<div class="row">${sw('쉬운 말로 보기', e, 'toggleEasy')}<button class="btn btn-s" data-a="editData">데이터 다시 입력</button></div>`)}
  <div class="lay">${scoreCard(sc, h, e)}${shapChart(sc, e)}${summaryCard(sc)}</div>`);
}
A.toggleEasy = () => { UI.report.easy = !UI.report.easy; render(); };
A.closeAlert = () => { UI.report.alert = false; render(); };
A.editData = () => { UI.input.d = clone(me().data); go('input'); };
function answer(qText, idx) {
  const R = UI.report; if (idx == null && !R.left) return;
  let hit = idx != null ? QA[idx] : null;
  if (!hit) { const t = qText.toLowerCase(); hit = QA.find((q) => q[2].some((k) => t.includes(k))); }
  R.ansQ = idx != null ? QA[idx][0] : qText;
  R.ans = hit ? hit[1] : '아직 준비한 답이 없는 질문이에요. DSR, 등급, 연체, 카드 사용 비율처럼 용어를 넣어 다시 물어봐 주세요.';
  R.src = idx != null ? '등록된 답변' : 'AI 답변 (시연용)';
  if (idx == null) R.left -= 1; render();
}
A.askQ = (x) => answer('', N(x.i));
A.setTheme = (x) => { S.theme = x.x === 'dark' ? 'dark' : 'light'; render(); };
A.helpToggle = () => { UI.help = !UI.help; render(); if (UI.help) setTimeout(() => { const el = document.getElementById('f_report_q'); if (el) el.focus({ preventScroll: true }); }, 30); };
F.ask = () => { const q = String(UI.report.q || '').trim(); if (!q) return; UI.report.q = ''; answer(q, null); };

/* ========== finance: health ========== */
const PEERS = { self: [4100, 9800, 5600], free: [3600, 4200, 1800], salary: [4300, 9000, 4800] };
function vHealth() {
  const d = me().data;
  if (!UI.health) UI.health = { asset: d.asset, income: annual(d), debt: debtOf(d) };
  const H = UI.health, a = N(H.asset), i = N(H.income), dt = N(H.debt);
  const monthlyPay = debtOf(d) > 0 ? payOf(d) * dt / debtOf(d) : dt * 0.048;
  const annualPay = monthlyPay * 12, burden = i > 0 ? annualPay / i * 100 : 0, toAsset = a > 0 ? dt / a * 100 : 0, net = a - dt, toNet = net > 0 ? dt / net * 100 : 999;
  const stage = (v, w, b) => v >= b ? ['위험', 'var(--bad)', 2] : v >= w ? ['주의', 'var(--warn)', 1] : ['안전', 'var(--mint)', 0];
  const R = [['상환 부담률 (DSR)', burden, 80, 30, 40, '1년 소득 중 빚 갚는 데 쓰는 비율. 40%를 넘으면 추가 대출이 어려워집니다.'], ['자산 대비 부채', toAsset, 120, 40, 60, '가진 자산 중 빚이 차지하는 비율입니다.'], ['순자산 대비 부채', toNet, 200, 70, 100, '자산에서 빚을 뺀 금액과 비교한 빚의 크기입니다.']]
    .map(([l, v, mx, w, b, desc]) => ({ l, v, mx, w, b, desc, s: stage(v, w, b) }));
  const worst = Math.max(...R.map((r) => r.s[2])); const badge = [['안전', 'var(--mint)'], ['주의', 'var(--warn)'], ['위험', 'var(--bad)']][worst];
  const pe = PEERS[d.job];
  return userShell('health', `${head('직군별 재무 진단', `${JOBS[d.job]} 기준으로 빚이 얼마나 부담되는지 봅니다. 숫자를 바꾸면 바로 다시 계산합니다.`)}${finSub('health')}
  <div class="cols">
    <section class="panel side" aria-labelledby="hHi"><h2 class="h2" id="hHi">내 재무 상태</h2>
      ${fld('총자산', 'health.asset', { num: true, live: true, unit: '만원' })}${fld('연소득', 'health.income', { num: true, live: true, unit: '만원' })}${fld('총부채', 'health.debt', { num: true, live: true, unit: '만원' })}
      <p class="hint num">순자산 ${fmt(net)}만원 · 연 상환액 ${fmt(annualPay)}만원</p>
      <button class="btn btn-s" data-a="resetHealth">내 데이터로 되돌리기</button></section>
    <section class="panel main" aria-labelledby="hHr"><div class="row between"><h2 class="h2" id="hHr">건전성 진단</h2><span class="chip" style="color:${badge[1]};border-color:${badge[1]}">종합 ${badge[0]}</span></div>
      ${R.map((r) => `<div class="stack" style="gap:6px"><div class="row between"><b>${r.l}</b><span class="row" style="gap:8px"><b class="num">${r.v >= 999 ? '—' : r.v.toFixed(1) + '%'}</b><span class="chip" style="color:${r.s[1]};border-color:${r.s[1]}">${r.s[0]}</span></span></div>
        <div class="track" role="img" aria-label="${r.l} ${r.v >= 999 ? '계산 불가' : r.v.toFixed(1) + '%'}, 위험 기준 ${r.b}%"><i style="width:${Math.min(100, r.v / r.mx * 100).toFixed(1)}%;background:${r.s[1]}"></i><span style="position:absolute;top:-3px;bottom:-3px;left:${(r.b / r.mx * 100).toFixed(1)}%;width:2px;background:var(--fg2)"></span></div>
        <span class="hint">${r.desc} 위험 기준 ${r.b}%</span></div>`).join('')}
    </section>
  </div>
  <div class="cols">
    <section class="panel" aria-labelledby="hPe"><h2 class="h2" id="hPe">같은 직군 평균과 비교</h2>
      ${[['연소득', i, pe[0]], ['총자산', a, pe[1]], ['총부채', dt, pe[2]]].map(([l, mv, av]) => { const mx = Math.max(mv, av, 1); return `<div class="stack" style="gap:4px"><span class="lb">${l}</span>
        <div style="display:grid;grid-template-columns:44px 1fr 90px;gap:8px;align-items:center;font-size:12.5px"><span>나</span><div class="track"><i style="width:${(mv / mx * 100).toFixed(1)}%;background:var(--mint)"></i></div><b class="num" style="text-align:right">${fmt(mv)}</b>
        <span class="hint">평균</span><div class="track"><i style="width:${(av / mx * 100).toFixed(1)}%;background:var(--line2)"></i></div><span class="num hint" style="text-align:right">${fmt(av)}</span></div></div>`; }).join('')}
      <p class="hint">${JOBS[d.job]} 평균은 합성 데이터 12,000명 기준 예시입니다. 단위 만원.</p></section>
    <section class="panel" aria-labelledby="hLn"><h2 class="h2" id="hLn">보유 대출</h2>
      ${d.loans.length ? `<div class="tblw"><table class="tbl"><thead><tr><th>종류</th><th class="r">잔액</th><th class="r">금리</th><th>방식</th><th class="r">월 상환</th></tr></thead><tbody>${d.loans.map((l) => `<tr><td>${esc(l.type)}</td><td class="r num">${fmt(l.amt)}</td><td class="r num">${l.rate.toFixed(1)}%</td><td>${l.kind === '변동' ? '<span class="chip" style="color:var(--warn);border-color:var(--warn)">변동</span>' : '고정'}</td><td class="r num">${fmt(l.pay)}</td></tr>`).join('')}</tbody></table></div>
      ${d.loans.some((l) => l.kind === '변동') ? '<p class="hint">변동금리 대출은 금리가 오르면 월 상환액이 늘어납니다. <a href="#stress">스트레스 테스트에서 확인하기</a></p>' : ''}` : '<p class="hint">등록한 대출이 없습니다.</p>'}</section>
  </div>`);
}
A.resetHealth = () => { UI.health = null; render(); };

/* ========== finance: stress ========== */
function rangeNum(label, p, min, max, step, text, ends, tmin, tmax, unit) {
  const id = fid(p);
  return `<div class="fld"><label class="lb" for="${id}"><span>${label}</span><b class="num" style="color:var(--fg)">${text}</b></label>
    <div class="row" style="flex-wrap:nowrap;gap:10px"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${esc(clamp(N(gp(p)), min, max))}" data-bind="${p}" data-num data-live style="flex:1">
    <span class="row" style="flex-wrap:nowrap;gap:4px"><label for="${id}_n" style="position:absolute;left:-9999px">${label} 직접 입력</label><input class="inp num" id="${id}_n" type="number" min="${tmin}" max="${tmax}" step="${step}" value="${esc(gp(p))}" data-bind="${p}" data-num data-commit style="width:84px;min-height:38px;padding:6px 8px"><span class="hint">${unit}</span></span></div>
    <span class="hint row between"><span>${ends[0]}</span><span>${ends[1]} · 칸에 직접 넣으면 ${tmin}~${tmax}${unit}</span></span></div>`;
}
function vStress() {
  const d = me().data, s = UI.stress;
  s.rate = clamp(N(s.rate), -5, 10); s.inc = clamp(N(s.inc), -100, 100); s.exp = clamp(N(s.exp), -50, 100);
  const rate = s.rate, inc = s.inc, exp = s.exp;
  const bI = annual(d) / 12, bL = N(d.living) + fixedOf(d), bP = payOf(d), variable = sum(d.loans.filter((l) => l.kind === '변동').map((l) => l.amt));
  const extra = variable * rate / 100 / 12, I = bI * (1 + inc / 100), L = bL * (1 + exp / 100), P = Math.max(0, bP + extra), sur = I - L - P, bS = bI - bL - bP, burden = I > 0 ? P / I * 100 : 0, bBurden = bI > 0 ? bP / bI * 100 : 0;
  const mx = Math.max(bI, I, bL, L, bP, P, Math.abs(bS), Math.abs(sur), 1);
  const w = (v) => Math.min(100, Math.abs(v) / mx * 100).toFixed(1);
  const bad = [['r1', '금리 +1%p', 1, 0, 0], ['r2', '금리 +2%p', 2, 0, 0], ['inc', '소득 −20%', 0, -20, 0], ['combo', '악화 복합 (금리 +1%p · 소득 −20% · 지출 +10%)', 1, -20, 10]];
  const good = [['rd', '금리 −1%p', -1, 0, 0], ['incp', '소득 +10%', 0, 10, 0], ['expd', '지출 −10%', 0, 0, -10], ['better', '호전 복합 (금리 −0.5%p · 소득 +10% · 지출 −10%)', -0.5, 10, -10]];
  const pbtn = ([id, l, r, i2, e2]) => `<button class="btn btn-s" data-a="preset" data-x="${id}" data-r="${r}" data-i="${i2}" data-e="${e2}" aria-pressed="${s.preset === id}" style="justify-content:flex-start;${s.preset === id ? 'background:var(--pri);border-color:var(--pri);color:' + (S.theme === 'dark' ? '#fff' : '#1b4e43') : ''}">${l}</button>`;
  const liquid = N(d.asset) * 0.25; const lasts = sur < 0 ? Math.floor(liquid / -sur) : null;
  const rows = [['월 소득', bI, I], ['월 고정 지출', bL, L], ['월 원리금', bP, P], ['월 잉여', bS, sur]];
  const diff = sur - bS;
  const verdict = sur < 0 ? `<p class="warnbox">이 상황이면 매달 <b class="num">${fmt(-sur)}만원</b>이 모자랍니다. 바로 쓸 수 있는 돈을 자산의 25%(${fmt(liquid)}만원)로 보면 약 <b class="num">${lasts}개월</b> 버틸 수 있습니다.</p>`
    : diff > 0.5 ? `<p class="okbox">지금보다 매달 <b class="num">${fmt(diff)}만원</b> 더 남습니다 (월 잉여 ${fmt(sur)}만원). 남는 돈으로 원금을 갚으면 상환 부담률이 ${bBurden.toFixed(1)}% → ${burden.toFixed(1)}%보다 더 내려갑니다.</p>`
    : `<p class="okbox">이 상황에서도 매달 <b class="num">${fmt(sur)}만원</b>이 남습니다${diff < -0.5 ? ` (지금보다 ${fmt(-diff)}만원 적음)` : ''}.</p>`;
  return userShell('stress', `${head('시나리오 테스트', '금리·소득·지출이 나빠지거나 좋아질 때 매달 남는 돈이 어떻게 바뀌는지 미리 봅니다.')}${finSub('stress')}
  <div class="cols">
    <section class="panel side" aria-labelledby="hSc1"><h2 class="h2" id="hSc1">상황 고르기</h2>
      <button class="btn btn-s" data-a="preset" data-x="base" data-r="0" data-i="0" data-e="0" aria-pressed="${s.preset === 'base'}" style="justify-content:flex-start">현재 그대로</button>
      <div class="stack" style="gap:6px"><span class="lb" style="color:var(--bad)">▼ 나빠지는 경우</span>${bad.map(pbtn).join('')}</div>
      <div class="stack" style="gap:6px"><span class="lb" style="color:var(--mint)">▲ 좋아지는 경우</span>${good.map(pbtn).join('')}</div>
      ${rangeNum('금리 변화', 'stress.rate', -2, 3, 0.5, `${rate > 0 ? '+' : rate < 0 ? '−' : '±'}${Math.abs(rate).toFixed(1)}%p`, ['−2%p', '+3%p'], -5, 10, '%p')}
      ${rangeNum('소득 변화', 'stress.inc', -50, 30, 5, `${sgn(inc)}%`, ['−50%', '+30%'], -100, 100, '%')}
      ${rangeNum('지출 변화', 'stress.exp', -30, 30, 5, `${sgn(exp)}%`, ['−30%', '+30%'], -50, 100, '%')}
      <p class="hint num">변동금리 대출 ${fmt(variable)}만원에 금리 변화를 적용합니다.</p></section>
    <section class="panel main" aria-labelledby="hSr"><h2 class="h2" id="hSr">결과</h2>
      <div class="g2" style="--min:170px">
        <div class="sunk stack" style="gap:2px"><span class="hint">이 상황의 월 잉여</span><b class="mid" style="color:${sur < 0 ? 'var(--bad)' : 'var(--mint)'}">${sgn(sur)}만원</b><span class="hint num">지금보다 ${sgn(diff)}만원</span></div>
        <div class="sunk stack" style="gap:2px"><span class="hint">상환 부담률</span><b class="mid" style="color:${burden >= 40 ? 'var(--bad)' : burden >= 30 ? 'var(--warn)' : 'var(--mint)'}">${burden.toFixed(1)}%</b><span class="hint num">지금 ${bBurden.toFixed(1)}%</span></div>
        <div class="sunk stack" style="gap:2px"><span class="hint">월 이자 변화</span><b class="mid" style="color:${extra > 0 ? 'var(--bad)' : extra < 0 ? 'var(--mint)' : 'var(--fg)'}">${sgn(extra)}만원</b></div>
      </div>
      <div class="stack" style="gap:12px">${rows.map(([l, b, v], k) => `<div class="stack" style="gap:4px"><span class="lb">${l}</span>
        <div style="display:grid;grid-template-columns:44px 1fr 70px;gap:8px;align-items:center;font-size:12.5px"><span class="hint">현재</span><div class="track"><i style="width:${w(b)}%;background:var(--line2)"></i></div><span class="num hint" style="text-align:right">${sgn(b).replace('+', '')}</span>
        <span>상황</span><div class="track"><i style="width:${w(v)}%;background:${k === 3 ? (v < 0 ? 'var(--bad)' : 'var(--mint)') : 'var(--vio)'}"></i></div><b class="num" style="text-align:right">${sgn(v).replace('+', '')}</b></div></div>`).join('')}</div>
      ${verdict}
      <p class="hint">단위 만원 · 원리금은 입력한 대출 기준, 월 고정 지출에는 할부·정기결제를 포함합니다.</p></section>
  </div>`);
}
A.preset = (x) => { Object.assign(UI.stress, { rate: N(x.r), inc: N(x.i), exp: N(x.e), preset: x.x }); render(); };

/* ========== finance: cash flow ========== */
function vCash() {
  const d = me().data; const A0 = scoreOf(d).A;
  if (!UI.cash) { const p = { vol: 100, living: N(d.living), pay: 'ok', hz: 12 }; UI.cash = { ...p, applied: { ...p } }; }
  const C = UI.cash, a = C.applied;
  const act = d.months.map(N); const avg = sum(act) / 12; const other = fixedOf(d), pay = payOf(d);
  const hz = N(a.hz), vol = N(a.vol), expense = N(a.living) + other + pay;
  const fc = Array.from({ length: hz }, (_, i) => Math.max(0, avg + (act[i % 12] - avg) * vol / 100));
  const all = act.concat(fc), n = all.length;
  const X0 = 52, X1 = 908, Y0 = 36, Y1 = 270; const step = (X1 - X0) / n, bw = step * 0.62;
  const ymax = Math.ceil(Math.max(...all, expense, 100) * 1.15 / 100) * 100;
  const y = (v) => Y1 - Math.min(v, ymax) / ymax * (Y1 - Y0);
  const sy = (s) => Y1 - (clamp(s, 600, 800) - 600) / 200 * (Y1 - Y0);
  let score = A0; const spts = [];
  fc.forEach((v, i) => { score += (a.pay === 'ok' ? 1.2 : -3) + (v - expense < 0 ? -0.8 : 0); spts.push([X0 + (12 + i) * step + step / 2, sy(score)]); });
  const endScore = Math.round(score);
  const nets = fc.map((v) => v - expense); let wi = 0; nets.forEach((v, i) => { if (v < nets[wi]) wi = i; });
  const fLabel = (i) => { const m = ((10 + i) % 12) + 1; return String(m); };
  const sd = Math.sqrt(sum(act.map((v) => (v - avg) ** 2)) / 12); const minI = act.indexOf(Math.min(...act));
  const deficit = act.filter((v) => v < expense).length;
  const dirty = ['vol', 'living', 'pay', 'hz'].some((k) => String(C[k]) !== String(a[k]));
  const ticks = [0, ymax / 2, ymax];
  const svg = `<svg viewBox="0 0 960 300" width="100%" role="img" aria-label="최근 12개월 소득과 앞으로 ${hz}개월 예측 소득, 월 지출 ${fmt(expense)}만원, 예상 점수 ${A0}점에서 ${endScore}점" style="max-width:100%">
    ${ticks.map((t) => `<line x1="${X0}" x2="${X1}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="#22314b"/><text x="${X0 - 8}" y="${(y(t) + 4).toFixed(1)}" font-size="11" fill="#8a9bb4" text-anchor="end">${fmt(t)}</text>`).join('')}
    ${[600, 700, 800].map((t) => `<text x="${X1 + 8}" y="${(sy(t) + 4).toFixed(1)}" font-size="11" style="fill:var(--c-score)">${t}</text>`).join('')}
    ${all.map((v, i) => { const x = X0 + i * step + (step - bw) / 2; const top = y(v); return i < 12 ? `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y1 - top).toFixed(1)}" rx="2" style="fill:${v < expense ? 'var(--c-def)' : 'var(--c-act)'}"/>` : `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y1 - top).toFixed(1)}" rx="2" style="fill:${v < expense ? 'var(--c-def)' : 'var(--c-act)'};fill-opacity:.32;stroke:${v < expense ? 'var(--c-def)' : 'var(--c-act)'}" stroke-width="1.4" stroke-dasharray="4 3"/>`; }).join('')}
    <line x1="${X0}" x2="${X1}" y1="${y(expense).toFixed(1)}" y2="${y(expense).toFixed(1)}" style="stroke:var(--c-halo)" stroke-width="6" stroke-opacity=".85"/>
    <line x1="${X0}" x2="${X1}" y1="${y(expense).toFixed(1)}" y2="${y(expense).toFixed(1)}" style="stroke:var(--c-exp)" stroke-width="2.5" stroke-dasharray="8 5"/>
    <text x="${X0 + 6}" y="${(y(expense) - 8).toFixed(1)}" font-size="12" font-weight="700" paint-order="stroke" stroke-width="4" style="fill:var(--c-exp);stroke:var(--c-halo)">월 지출 ${fmt(expense)}</text>
    ${spts.length ? (() => { const pl = [[X0 + 11 * step + step / 2, sy(A0)], ...spts].map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '); const L = spts[spts.length - 1];
      return `<polyline points="${pl}" fill="none" style="stroke:var(--c-halo)" stroke-width="7" stroke-opacity=".9" stroke-linejoin="round"/><polyline points="${pl}" fill="none" style="stroke:var(--c-score)" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="5.5" style="fill:var(--c-score);stroke:var(--c-halo)" stroke-width="2.5"/>
      <text x="${(L[0] - 8).toFixed(1)}" y="${(L[1] - 12).toFixed(1)}" font-size="12" font-weight="700" text-anchor="end" paint-order="stroke" stroke-width="4" style="fill:var(--c-score);stroke:var(--c-halo)">예상 ${endScore}점</text>`; })() : ''}
    <line x1="${(X0 + 12 * step).toFixed(1)}" x2="${(X0 + 12 * step).toFixed(1)}" y1="${Y0 - 14}" y2="${Y1}" style="stroke:var(--mut2)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${(X0 + 12 * step - 6).toFixed(1)}" y="${Y0 - 2}" font-size="12" font-weight="700" text-anchor="end" style="fill:var(--mut)">◀ 지난 12개월 (실제)</text>
    <text x="${(X0 + 12 * step + 6).toFixed(1)}" y="${Y0 - 2}" font-size="12" font-weight="700" style="fill:var(--mut)">앞으로 ${hz}개월 (예측 · 연한 색) ▶</text>
    ${all.map((_, i) => (n <= 18 || i % 2 === 0) ? `<text x="${(X0 + i * step + step / 2).toFixed(1)}" y="${Y1 + 18}" font-size="11" fill="#8a9bb4" text-anchor="middle">${i < 12 ? MONTHS[i].slice(5).replace(/^0/, '') : fLabel(i - 12)}월</text>` : '').join('')}
  </svg>`;
  return userShell('cash', `${head('현금흐름·소득 변동성', '달마다 들어오는 돈과 나가는 돈을 겹쳐 보고, 앞으로 몇 달을 예측합니다.')}${finSub('cash')}
  <div class="kpis">
    <div class="panel" data-nocard style="gap:2px"><span class="hint">월평균 소득</span><b class="mid">${fmt(avg)}만원</b></div>
    <div class="panel" data-nocard style="gap:2px"><span class="hint">소득 변동 계수</span><b class="mid" style="color:${sd / avg > 0.12 ? 'var(--warn)' : 'var(--mint)'}">${(sd / avg * 100).toFixed(1)}%</b></div>
    <div class="panel" style="gap:2px"><span class="hint">지난 1년 적자 달</span><b class="mid" style="color:${deficit ? 'var(--bad)' : 'var(--mint)'}">${deficit}개월</b></div>
    <div class="panel" style="gap:2px"><span class="hint">가장 적게 번 달</span><b class="mid">${MONTHS[minI].slice(5).replace(/^0/, '')}월 · ${fmt(act[minI])}</b></div>
  </div>
  <div class="cols">
    <section class="panel side" aria-labelledby="hCs"><h2 class="h2" id="hCs">예측 조건</h2>
      ${range('앞으로의 소득 변동 폭', 'cash.vol', 0, 200, 10, `지난 1년의 ${C.vol}%`, { ends: ['일정하게', '2배로 출렁임'] })}
      ${fld('월 고정 지출', 'cash.living', { num: true, live: true, unit: '만원' })}
      ${sel('카드값·대출 납부', 'cash.pay', [['ok', '제때 낸다'], ['late', '가끔 밀린다']])}
      ${sel('예측 기간', 'cash.hz', [[3, '3개월'], [6, '6개월'], [12, '12개월']], { num: true })}
      <p class="hint" style="color:${dirty ? 'var(--warn)' : 'var(--mut2)'}">${dirty ? '조건이 바뀌었습니다. [예측 다시 하기]를 눌러 주세요.' : '현재 조건으로 예측한 결과입니다.'}</p>
      <button class="btn btn-p" data-a="applyCash" ${dirty ? '' : 'disabled'}>예측 다시 하기</button></section>
    <section class="panel main" aria-labelledby="hCc"><div class="row between"><h2 class="h2" id="hCc">월별 소득과 지출</h2>
      <span class="row hint" style="gap:12px;font-size:12px"><span><span style="color:var(--c-act)">■</span> 실제 소득</span><span><span style="color:var(--c-def)">■</span> 지출보다 적은 달</span><span><span style="color:var(--c-act);opacity:.45">■</span> 예측 소득(연한 색)</span><span><b style="color:var(--c-exp)">┅</b> 월 지출</span><span><b style="color:var(--c-score)">━</b> 예상 점수(오른쪽 축)</span></span></div>
      <div class="tblw">${svg}</div>
      <div class="g2" style="--min:180px">
        <div class="sunk stack" style="gap:2px"><span class="hint">예측 기간 누적 잉여</span><b class="mid" style="color:${sum(nets) < 0 ? 'var(--bad)' : 'var(--mint)'}">${sgn(sum(nets))}만원</b></div>
        <div class="sunk stack" style="gap:2px"><span class="hint">가장 빠듯한 달</span><b class="mid">${fLabel(wi)}월 · ${sgn(nets[wi])}</b></div>
        <div class="sunk stack" style="gap:2px"><span class="hint">${hz}개월 뒤 예상 점수</span><b class="mid" style="color:var(--mint)">${endScore} <span class="hint">(${sgn(endScore - A0)})</span></b></div>
      </div></section>
  </div>`);
}
A.applyCash = () => { const C = UI.cash; C.applied = { vol: C.vol, living: C.living, pay: C.pay, hz: C.hz }; render(); };

/* ========== finance: area ========== */
const AREA = { '서교동': [[96, 88, 102, 91], 142, 3.8, '−5%'], '연남동': [[84, 79, 90, 93], 118, 3.1, '+11%'], '합정동': [[72, 70, null, 76], 77, 2.6, '+6%'], '망원1동': [[58, 55, 61, 63], 49, 2.2, '+9%'], '공덕동': [[82, 85, 87, 88], 96, 2.7, '+4%'], '상암동': [[66, 64, 69, 70], 58, 1.8, '+7%'] };
const AREA_MAP = [['서교동', 96, 3.8], ['연남동', 93, 3.1], ['합정동', 76, 2.6], ['망원1동', 63, 2.2], ['망원2동', 51, 2.0], ['성산1동', 47, 2.4], ['상암동', 70, 1.8], ['공덕동', 88, 2.7], ['도화동', 66, 3.3], ['아현동', null, null], ['대흥동', 54, 2.9], ['신수동', 49, 2.1]];
function vArea() {
  return userShell('area', `${head('상권 분석', '서울 행정동별 상권 지표를 업종별로 봅니다. 내 사업장이 있는 동이 먼저 보이고, 동을 누르면 상세와 업종 순위가 열립니다.', '<span class="chip">N-24 · 네이버 지도 API 자리 · 예시 데이터</span>')}${finSub('area')}
  <section class="panel" aria-labelledby="hHeat" style="padding:14px"><h2 class="h2" id="hHeat">서울 상권 히트맵${me().data.job === 'self' ? '' : ' <span class="hint" style="font-weight:400">· 사업장 정보가 없어 서울 전체로 시작합니다</span>'}</h2>
  <iframe id="heatFrame" class="heat" title="서울 상권 히트맵" loading="eager"></iframe></section>`);
}
A.noArea = () => toast('이 동네는 상세 자료가 없습니다.');

/* ========== simulator ========== */
function simReal() { const d = me().data; return { telco: d.alt.telco ? N(d.telcoM) : 0, dq: N(d.dq), cash: N(d.cash), newl: N(d.newl), pay: d.alt.easy ? N(d.easyCnt) : 0, limit: N(d.limit), use: N(d.use), loan: debtOf(d), lender: N(d.lender) }; }
function simData(v) {
  const d = clone(me().data);
  d.telcoM = N(v.telco); d.alt.telco = N(v.telco) > 0 || d.alt.telco; d.dq = N(v.dq); d.cash = N(v.cash); d.newl = N(v.newl);
  d.easyCnt = N(v.pay); d.alt.easy = N(v.pay) > 0 || d.alt.easy; d.limit = N(v.limit); d.use = N(v.use); d.lender = N(v.lender);
  const cur = debtOf(d);
  if (cur > 0) d.loans = d.loans.map((l) => ({ ...l, amt: l.amt * N(v.loan) / cur, pay: l.pay * N(v.loan) / cur }));
  else if (N(v.loan) > 0) d.loans = [{ type: '대출', amt: N(v.loan), rate: 6, kind: '고정', months: 36, pay: N(v.loan) * 0.048 }];
  return d;
}
function vSim() {
  const real = simReal();
  if (!UI.sim) UI.sim = { v: { ...real }, ap: { ...real } };
  const v = UI.sim.v, ap = UI.sim.ap;
  const base = scoreOf(me().data), r = scoreOf(simData(ap));
  const delta = r.A - base.A, g0 = gradeOf(base.A), g1 = gradeOf(r.A);
  const dirty = JSON.stringify(v) !== JSON.stringify(ap);
  const FIX = [
    [/^카드 사용/, ['use', 'limit'], '월 카드 사용액 · 카드 한도', () => ({ use: Math.round(real.limit * 0.3) }), '한도의 30% 아래로 쓰기'],
    [/대출 잔액/, ['loan'], '대출 잔액', () => ({ loan: Math.round(real.loan * 0.5) }), '잔액을 절반으로 줄이기'],
    [/연체/, ['dq'], '최근 1년 연체 횟수', () => ({ dq: 0 }), '연체 없이 1년 보내기'],
    [/현금서비스/, ['cash'], '현금서비스 이용 기간', () => ({ cash: 0 }), '현금서비스 쓰지 않기'],
    [/신규 대출/, ['newl'], '최근 3개월 신규 대출', () => ({ newl: 0 }), '새 대출 미루기'],
    [/대부업/, ['lender'], '대부업 대출 잔액', () => ({ lender: 0 }), '대부업 대출 먼저 갚기']
  ];
  const negs = base.f.filter((x) => x.v < 0).sort((a, b) => a.v - b.v).slice(0, 3).map((x) => {
    const fx = FIX.find((q) => q[0].test(x.label));
    const gain = fx ? scoreOf(simData({ ...real, ...fx[3]() })).A - base.A : 0;
    return { x, fx, gain };
  });
  UI.sim.negs = negs.map((n) => n.fx ? { keys: n.fx[1], ch: n.fx[3]() } : null);
  const sl = [['telco', '통신비 정시 납부 기간', 0, 36, '개월'], ['dq', '최근 1년 연체 횟수', 0, 8, '회'], ['cash', '현금서비스 이용 기간 (최근 12개월)', 0, 12, '개월'], ['newl', '최근 3개월 신규 대출', 0, 5, '건'], ['pay', '간편결제 월 이용 건수', 0, 60, '건']];
  const prods = productsOf(r.A, me().data.job);
  return userShell('sim', `${head('신용케어 시뮬레이터', '조건을 바꾸고 [예상 점수 계산하기]를 누르면 점수와 받을 수 있는 대출이 어떻게 바뀌는지 보여 줍니다. 실제 점수에는 반영되지 않습니다.')}
  <section class="panel" aria-labelledby="hTip"><div class="row between"><div><span class="tag">From SHAP</span><h2 class="h2" id="hTip">내 점수를 가장 많이 깎은 요인 3가지</h2></div><a class="btn btn-s" href="#report">영향도 전체 보기</a></div>
    <p class="hint">신용 리포트의 영역별 영향도(SHAP)에서 감점이 큰 순서입니다. [예시 값 넣어 보기]를 누르면 아래 조건 칸에 예시 값이 들어가고 그 칸이 표시됩니다. 값을 더 바꿔 보고 [예상 점수 계산하기]를 눌러 얼마나 좋아지는지 확인해 보세요.</p>
    <div class="lay">${negs.length ? negs.map((n, i) => `<div class="sunk stack" style="gap:6px"><span class="row between"><b>${i + 1}. ${n.x.label}</b><b class="num" style="color:var(--bad)">${sgn(n.x.v)}점</b></span>
      ${n.fx ? `<span class="hint">바꿀 조건: ${n.fx[2]}</span><span>예: ${n.fx[4]} → 최대 <b class="num" style="color:var(--mint)">${sgn(n.gain)}점</b></span>
        <div class="row" style="gap:6px"><button class="btn btn-s btn-p" data-a="simFill" data-i="${i}">예시 값 넣어 보기</button></div>`
      : `<span class="hint">이 시뮬레이터에서 바로 바꿀 수 없는 항목입니다. ${/소득/.test(n.x.label) ? '<a href="#cash">현금흐름·소득 변동성</a>에서 소득 흐름을 확인해 보세요.' : '<a href="#report">리포트</a>에서 내용을 확인해 보세요.'}</span>`}</div>`).join('') : '<p class="hint">감점 요인이 없습니다.</p>'}</div></section>
  <div class="cols">
    <section class="panel main" aria-labelledby="hSv"><div class="row between"><h2 class="h2" id="hSv">조건 바꾸기</h2><button class="btn btn-s" data-a="simReset">내 실제 값으로 되돌리기</button></div>
      <div class="g2" style="--min:260px">${sl.map(([k, l, mn, mx, un]) => range(l, `sim.v.${k}`, mn, mx, 1, `${v[k]}${un}`, { ends: [`${mn}${un}`, `${mx}${un} · 지금 ${real[k]}${un}`] })).join('')}</div>
      <div class="g2" style="--min:170px">${[['limit', '카드 한도'], ['use', '월 카드 사용액'], ['loan', '대출 잔액'], ['lender', '대부업 대출 잔액']].map(([k, l]) => fld(l, `sim.v.${k}`, { num: true, live: true, unit: '만원', min: 0 })).join('')}</div>
      <p class="hint num">카드 사용 비율 ${N(v.limit) > 0 ? Math.round(N(v.use) / N(v.limit) * 100) + '%' : '—'}</p>
      <div class="row"><button class="btn btn-p" data-a="simCalc">예상 점수 계산하기</button><span class="hint" style="color:${dirty ? 'var(--warn)' : 'var(--mut2)'}">${dirty ? '조건이 바뀌었습니다. 계산하기를 눌러 주세요.' : '지금 조건으로 계산한 결과입니다.'}</span></div></section>
    <section class="panel side" aria-labelledby="hSo" style="position:sticky;top:12px"><span class="tag">Result</span><h2 class="h2" id="hSo">예상 대안 점수</h2>
      <div class="row" style="gap:10px;align-items:baseline"><b class="big" style="color:${GC[g1]}">${r.A}</b><b class="mid" style="color:${delta >= 0 ? 'var(--mint)' : 'var(--bad)'}">${sgn(delta)}</b></div>
      <span class="chip" style="color:${GC[g1]};border-color:${GC[g1]};align-self:flex-start">${g0 === g1 ? `${g1} 등급 유지` : `${g0} → ${g1}`}</span>
      <div class="g2" style="--min:110px"><div class="sunk stack" style="gap:2px"><span class="hint">금융 이력 영향</span><b class="num">${sgn(r.model - base.model)}</b></div><div class="sunk stack" style="gap:2px"><span class="hint">대안 데이터 영향</span><b class="num">${sgn(r.alt - base.alt)}</b></div></div>
      <div class="tblw"><table class="tbl"><thead><tr><th></th><th class="r">지금</th><th class="r">바꾸면</th></tr></thead><tbody>
        <tr><td>예상 금리</td><td class="r num">연 ${rateOf(base.A).toFixed(1)}%</td><td class="r num" style="color:var(--mint)">연 ${rateOf(r.A).toFixed(1)}%</td></tr>
        <tr><td>예상 한도</td><td class="r num">${fmt(limitOf(base.A))}만원</td><td class="r num" style="color:var(--mint)">${fmt(limitOf(r.A))}만원</td></tr>
        <tr><td>예상 부도 확률</td><td class="r num">${pdTxt(base.A)}</td><td class="r num" style="color:${pdOf(r.A) <= pdOf(base.A) ? 'var(--mint)' : 'var(--bad)'}">${pdTxt(r.A)}</td></tr></tbody></table></div>
      <p class="hint">금리·한도·상품은 같은 점수대의 예시 값입니다(N-18). 실제 점수에는 반영되지 않습니다.</p></section>
  </div>
  <section class="panel" aria-labelledby="hPr"><div class="row between"><h2 class="h2" id="hPr">이 점수로 알아볼 수 있는 대출 상품</h2><span class="row" style="gap:8px"><span class="chip">더미 상품 · 실제 상품 아님</span><a class="btn btn-s" href="#loans">전체 상품 보기</a></span></div>
    <div class="lay">${prods.map(loanCard).join('')}</div></section>`);
}
A.simCalc = () => { UI.sim.ap = { ...UI.sim.v }; render(); };
A.simGo = (x) => { const n = UI.sim.negs[N(x.i)]; if (!n) return; UI.sim.focus = n.keys; render(); setTimeout(() => { const el = document.getElementById('f_sim_v_' + n.keys[0]); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); } }, 30); };
A.simFill = (x) => { const n = UI.sim.negs[N(x.i)]; if (!n) return; UI.sim.v = { ...UI.sim.v, ...n.ch }; UI.sim.focus = n.keys; toast('예시 값을 넣었습니다. [예상 점수 계산하기]를 눌러 확인해 보세요.'); A.simGo(x); };
A.simReset = () => { UI.sim = null; render(); };

/* ========== loans (catalogue · detail · favourites) ========== */
const isFav = (id) => (me().favLoans || []).includes(id);
const favBtn = (l) => `<button class="btn btn-s" data-a="favLoan" data-x="${l.id}" aria-pressed="${isFav(l.id)}" aria-label="${l.n} 즐겨찾기 ${isFav(l.id) ? '해제' : '추가'}" style="${isFav(l.id) ? 'color:var(--warn);border-color:var(--warn)' : ''}">${isFav(l.id) ? '★ 즐겨찾기' : '☆ 즐겨찾기'}</button>`;
function loanBanner(l, big) {
  const [c, mark] = provOf(l);
  return `<div class="lbanner${big ? ' big' : ''}" style="--pc:${c}" role="img" aria-label="${l.p} ${l.n} 상품 배너">
    <span class="lmark" aria-hidden="true">${mark}</span>
    <div class="stack" style="gap:${big ? 8 : 2}px;min-width:0"><span class="lprov">${l.p} · 대출 상품</span><b class="lname">${l.n}</b>${big ? `<span class="ldesc">${l.d}</span>` : ''}</div>
    <span class="lribbon">예시 상품</span></div>`;
}
function loanCard(l) {
  const myA = scoreOf(me().data).A, ok = myA >= l.min;
  return `<article class="lcard" aria-label="${l.n}">${loanBanner(l)}
    <div class="stack" style="gap:8px;padding:14px">
      <p style="font-size:13.5px;color:var(--fg2)">${l.d}</p>
      <div class="row between num" style="gap:6px"><span><span class="hint">금리</span> <b>${rateTxt(l)}</b></span><span><span class="hint">한도</span> <b>최대 ${fmt(l.lm)}만원</b></span></div>
      <span class="hint num">대상 ${l.t} · ${l.min ? `대안 ${l.min}점 이상` : '점수 조건 없음'} · ${ok ? '<b style="color:var(--mint)">지금 점수로 가능</b>' : `<b style="color:var(--bad)">${l.min - myA}점 부족</b>`}</span>
      <div class="row" style="gap:6px"><button class="btn btn-s btn-p" data-a="openLoan" data-x="${l.id}">상세 보기 ›</button>${favBtn(l)}</div></div></article>`;
}
function vLoans() {
  const u = me(), L = UI.loans, myA = scoreOf(u.data).A;
  let list = LOANS.slice();
  if (L.f === 'ok') list = list.filter((l) => l.min <= myA);
  if (L.f === 'fav') list = list.filter((l) => isFav(l.id));
  if (L.f === 'job') list = list.filter((l) => l.jobs.includes(u.data.job));
  return userShell('loans', `${head('대출 상품', `내 대안 점수 ${myA}점으로 알아볼 수 있는 상품을 모았습니다. 모든 상품은 시연용 예시입니다.`, segBtns('loans.f', [['all', `전체 ${LOANS.length}`], ['ok', '지금 점수로 가능'], ['job', `${JOBS[u.data.job]} 대상`], ['fav', `즐겨찾기 ${(u.favLoans || []).length}`]], '상품 거르기'))}
  ${list.length ? `<div class="lay">${list.map(loanCard).join('')}</div>` : `<p class="sunk hint">${L.f === 'fav' ? '즐겨찾기한 상품이 없습니다. 상품 카드의 ☆을 누르면 여기 모입니다.' : '조건에 맞는 상품이 없습니다.'}</p>`}`);
}
function vLoan() {
  const u = me(), l = loanOf(UI.loans.sel) || LOANS[0], myA = scoreOf(u.data).A, ok = myA >= l.min;
  const kv = (k, v) => `<div class="lkv"><span class="hint">${k}</span><b class="num">${v}</b></div>`;
  return userShell('loan', `<div class="row"><a class="btn btn-s" href="#loans">‹ 대출 상품 목록</a></div>
  <article class="panel" style="padding:0;overflow:hidden" aria-labelledby="hLoan">
    ${loanBanner(l, true)}
    <div class="stack" style="padding:20px;gap:16px">
      <div class="row between" style="align-items:flex-start"><div class="stack" style="gap:4px"><span class="tag">상품 상세</span><h1 class="h1" id="hLoan" style="font-size:24px">${l.n}</h1><span class="hint">대출 사업자 · <b style="color:var(--fg)">${l.p}</b> · 시연용 예시 상품 (실제 상품 아님)</span></div>
        <span class="row" style="gap:6px">${favBtn(l)}<button class="btn btn-p" data-a="loanApply" style="color:inherit">신청하기</button></span></div>
      <div class="lkeys">${kv('금리 (연)', rateTxt(l).replace('연 ', ''))}${kv('최대 한도', fmt(l.lm) + '만원')}${kv('대출 기간', l.term)}${kv('상환 방식', l.way)}</div>
      <section class="stack" style="gap:6px" aria-labelledby="hLdesc"><h2 class="h2" id="hLdesc">상품 설명</h2><p style="color:var(--fg2)">${l.d}</p></section>
      <div class="lay">
        <section class="sunk stack s2" style="gap:10px" aria-labelledby="hLcond"><h2 class="h2" id="hLcond" style="font-size:15px">신청 조건과 특징</h2>
          <dl class="ldl"><dt>대상</dt><dd>${l.t}</dd><dt>점수 기준</dt><dd>${l.min ? `대안 신용점수 ${l.min}점 이상` : '점수 조건 없음'}</dd><dt>신청 직군</dt><dd>${l.jobs.length === 3 ? '모든 직군' : l.jobs.map((j) => JOBS[j]).join('·')}</dd><dt>필요 서류</dt><dd>${l.docs.join(', ')} (예시)</dd></dl>
          <ul class="stack" style="gap:6px;padding-left:18px;list-style:disc">${l.feats.map((f) => `<li>${f}</li>`).join('')}</ul></section>
        <section class="sunk stack" style="gap:10px" aria-labelledby="hLm"><h2 class="h2" id="hLm" style="font-size:15px">내 점수로 보면</h2>
          <div class="row" style="gap:10px;align-items:baseline"><b class="big" style="color:${ok ? 'var(--mint)' : 'var(--bad)'}">${myA}</b>${gchip(myA)}</div>
          ${ok ? `<p class="okbox">신청 조건을 채웁니다. 실제 금리는 ${rateTxt(l)} 안에서 심사로 정해집니다.</p>` : `<p class="warnbox">기준까지 <b class="num">${l.min - myA}점</b> 남았습니다.</p>`}
          <a class="btn btn-s" href="#sim">신용케어 시뮬레이터로 점수 올려 보기</a></section>
      </div>
      <p class="hint">유의 사항 · 대출을 받으면 신용점수가 내려갈 수 있고, 연체하면 연체 이자와 불이익이 생깁니다. 금리·한도는 심사 결과에 따라 달라집니다. 이 화면의 모든 상품과 수치는 시연용 예시입니다.</p>
    </div>
  </article>`);
}
A.loanApply = () => toast('시연에서는 신청을 받지 않습니다. 실제 서비스에서는 대출 사업자 신청 화면으로 넘어갑니다.');
A.openLoan = (x) => { UI.loans.sel = x.x; go('loan'); };
A.favLoan = (x) => { const u = me(); u.favLoans = u.favLoans || []; const i = u.favLoans.indexOf(x.x); if (i >= 0) u.favLoans.splice(i, 1); else u.favLoans.push(x.x); toast(i >= 0 ? '즐겨찾기에서 뺐습니다.' : '즐겨찾기에 담았습니다. 대출 상품 › 즐겨찾기에서 모아 볼 수 있습니다.'); render(); };

/* ========== my page ========== */
function vMy() {
  const u = me(), M = UI.my, mk = M.masked;
  const info = `<section class="panel" aria-labelledby="hMi"><div class="row between"><h2 class="h2" id="hMi">내 정보</h2><button class="btn btn-s" data-a="${mk ? 'askUnmask' : 'remask'}">${mk ? '가림 해제' : '다시 가리기'}</button></div>
    ${M.askPw ? `<form class="sunk stack" data-f="unmask"><span class="hint">개인정보를 보려면 비밀번호를 한 번 더 넣어 주세요.</span>${fld('비밀번호', 'my.pw', { type: 'password', auto: 'current-password', err: M.pwErr })}<div class="row"><button class="btn btn-p btn-s" type="submit">확인</button><button class="btn btn-s" type="button" data-a="cancelUnmask">취소</button></div></form>` : ''}
    <dl class="g2" style="--min:180px;margin:0">${[['아이디', u.id], ['닉네임', u.nick || '—'], ['이름', mk ? maskName(u.name) : u.name], ['휴대폰', mk ? maskPhone(u.phone) : (u.phone || '등록 안 됨')], ['이메일', mk ? maskMail(u.email) : u.email], ['가입일', u.joined], ['직군', u.data ? JOBS[u.data.job] : '미선택']].map(([k, v]) => `<div class="stack" style="gap:2px"><dt class="hint">${k}</dt><dd class="num" style="margin:0">${esc(v)}</dd></div>`).join('')}</dl>
  </section>`;
  const hist = `<section class="panel" aria-labelledby="hHist"><h2 class="h2" id="hHist">진단 내역</h2>
    ${u.history.length ? `<div class="tblw"><table class="tbl"><thead><tr><th>산출 일시</th><th>직군</th><th class="r">기존</th><th class="r">대안</th><th>등급</th><th class="r">변화</th></tr></thead><tbody>${u.history.map((h, i) => { const p = u.history[i + 1]; return `<tr><td class="num">${h.at}</td><td>${JOBS[h.job]}</td><td class="r num">${h.T}</td><td class="r num"><b>${h.A}</b></td><td>${gchip(h.A)}</td><td class="r num" style="color:${p ? (h.A >= p.A ? 'var(--mint)' : 'var(--bad)') : 'var(--mut2)'}">${p ? sgn(h.A - p.A) : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="hint">아직 진단 내역이 없습니다.</p>'}</section>`;
  const cards = `<section class="panel" aria-labelledby="hCd"><h2 class="h2" id="hCd">계정 관리</h2>
    <p class="hint">로그인 정보와 직군, 입력한 데이터를 바꿉니다. 화면 테마는 오른쪽 아래 테마 버튼으로 바꿉니다.</p>
    <div class="g2" style="--min:150px"><button class="btn btn-s" data-a="mailStart">이메일 바꾸기</button><button class="btn btn-s" data-a="pwStart">비밀번호 바꾸기</button><a class="btn btn-s" href="#job">직군 바꾸기</a><button class="btn btn-s" data-a="editData">데이터 다시 입력</button></div>
    ${M.mail ? `<div class="sunk stack"><b>이메일 바꾸기</b>${codeBlock('my.mail', 'my.mail.f.email', 'my.mail.f.code', { mailLabel: '새 이메일' })}<div class="row"><button class="btn btn-p btn-s" data-a="mailSave" ${M.mail.verified ? '' : 'disabled'}>바꾸기</button><button class="btn btn-s" data-a="mailCancel">취소</button></div></div>` : ''}
    ${M.pwc ? `<form class="sunk stack" data-f="pwChange"><b>비밀번호 바꾸기</b>${fld('지금 비밀번호', 'my.pwc.cur', { type: 'password', auto: 'current-password', err: M.pwc.errs.cur })}<div class="g2">${fld('새 비밀번호', 'my.pwc.pw', { type: 'password', auto: 'new-password', hint: '영문과 숫자를 섞어 8자 이상', err: M.pwc.errs.pw })}${fld('새 비밀번호 확인', 'my.pwc.pw2', { type: 'password', auto: 'new-password', err: M.pwc.errs.pw2 })}</div><div class="row"><button class="btn btn-p btn-s" type="submit">바꾸기</button><button class="btn btn-s" type="button" data-a="pwCancel">취소</button></div></form>` : ''}
  </section>`;
  const favs = (u.favLoans || []).map(loanOf).filter(Boolean);
  const fav = `<section class="panel" aria-labelledby="hFav"><div class="row between"><h2 class="h2" id="hFav">즐겨찾기한 대출 상품</h2><a class="btn btn-s" href="#loans">대출 상품 보기</a></div>
    ${favs.length ? `<ul class="stack" style="gap:8px">${favs.map((l) => `<li class="sunk row between"><span><b>${l.n}</b> <span class="hint num">${rateTxt(l)} · 최대 ${fmt(l.lm)}만원</span></span><span class="row" style="gap:6px"><button class="btn btn-s" data-a="openLoan" data-x="${l.id}">자세히</button>${favBtn(l)}</span></li>`).join('')}</ul>` : '<p class="hint">아직 없습니다. 대출 상품 카드의 ☆을 누르면 여기 모입니다.</p>'}</section>`;
  const bye = `<section class="panel" aria-labelledby="hBye"><h2 class="h2" id="hBye">회원 탈퇴</h2>
    ${M.bye ? `<form class="warnbox stack" data-f="bye"><span>탈퇴하면 진단 내역과 입력한 데이터가 모두 지워지고 되돌릴 수 없습니다. 게시판 글은 '탈퇴한 회원'으로 남습니다.</span>${fld('비밀번호', 'my.bye.pw', { type: 'password', auto: 'current-password', err: M.bye.err })}<div class="row"><button class="btn btn-d" type="submit">탈퇴하기</button><button class="btn" type="button" data-a="byeCancel">취소</button></div></form>` : '<div class="row"><p class="hint">진단 내역과 입력한 데이터가 모두 지워집니다.</p><button class="btn btn-s btn-d" data-a="byeStart">회원 탈퇴</button></div>'}</section>`;
  return userShell('mypage', `${head('마이 페이지', '내 정보와 계정, 즐겨찾기한 대출 상품, 진단 내역을 관리합니다.')}<div class="lay"><div class="s2" style="display:grid">${info}</div>${cards}</div>${fav}${hist}${bye}`);
}
A.askUnmask = () => { UI.my.askPw = true; UI.my.pwErr = ''; render(); };
A.cancelUnmask = () => { UI.my.askPw = false; render(); };
A.remask = () => { UI.my.masked = true; render(); };
F.unmask = () => { if (UI.my.pw === me().pw) { UI.my.masked = false; UI.my.askPw = false; UI.my.pw = ''; } else UI.my.pwErr = '비밀번호가 맞지 않습니다.'; render(); };
A.mailStart = () => { UI.my.mail = { f: { email: '', code: '' }, sent: false, code: '', verified: false, codeErr: '' }; render(); };
A.mailCancel = () => { UI.my.mail = null; render(); };
A.mailSave = () => { const u = me(); u.email = UI.my.mail.f.email.trim(); UI.my.mail = null; toast('이메일을 바꿨습니다.'); render(); };
A.pwStart = () => { UI.my.pwc = { cur: '', pw: '', pw2: '', errs: {} }; render(); };
A.pwCancel = () => { UI.my.pwc = null; render(); };
F.pwChange = () => {
  const u = me(), P = UI.my.pwc, e = {};
  if (P.cur !== u.pw) e.cur = '지금 비밀번호가 맞지 않습니다.';
  if (!okPw(P.pw)) e.pw = '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.';
  if (P.pw !== P.pw2) e.pw2 = '비밀번호가 서로 다릅니다.';
  P.errs = e; if (Object.keys(e).length) return render();
  u.pw = P.pw; UI.my.pwc = null; log('AUTH', `사용자 ${u.id} 비밀번호 변경`, 'auth-service'); toast('비밀번호를 바꿨습니다.'); render();
};
A.toggleCard = (x) => { const u = me(); u.cards[N(x.i)] = !u.cards[N(x.i)]; render(); };
A.showAllCards = () => { me().cards = [true, true, true, true, true, true]; render(); };
A.byeStart = () => { UI.my.bye = { pw: '', err: '' }; render(); };
A.byeCancel = () => { UI.my.bye = null; render(); };
F.bye = () => {
  const u = me(); if (UI.my.bye.pw !== u.pw) { UI.my.bye.err = '비밀번호가 맞지 않습니다.'; return render(); }
  S.posts.forEach((p) => { if (p.author === u.id) p.nick = '탈퇴한 회원'; p.comments.forEach((c) => { if (c.author === u.id) c.nick = '탈퇴한 회원'; }); });
  S.users = S.users.filter((x) => x.id !== u.id); delete S.notifs[u.id];
  log('INFO', `회원 탈퇴 · ${u.id}`, 'auth-service'); S.session = null; UI = freshUI(); toast('탈퇴를 마쳤습니다. 그동안 이용해 주셔서 감사합니다.'); go('main');
};

/* ========== board ========== */
function allTargets() {
  const out = [];
  S.posts.forEach((p) => { if (p.reports && p.reports.length) out.push({ key: 'p:' + p.id, kind: '게시글', t: p, post: p }); p.comments.forEach((c) => { if (c.reports && c.reports.length) out.push({ key: 'c:' + c.id, kind: '댓글', t: c, post: p }); }); });
  return out;
}
function getTarget(key) {
  const [k, id] = key.split(':');
  for (const p of S.posts) { if (k === 'p' && p.id === N(id)) return { key, kind: '게시글', t: p, post: p }; if (k === 'c') { const c = p.comments.find((x) => x.id === N(id)); if (c) return { key, kind: '댓글', t: c, post: p }; } }
  return null;
}
const reportsToday = (uid) => { const t = now().slice(0, 10); let n = 0; S.posts.forEach((p) => { [p, ...p.comments].forEach((x) => { (x.reports || []).forEach((r) => { if (r.by === uid && String(r.at).startsWith(t)) n++; }); }); }); return n; };
function reportPanel(key) {
  const R = UI.board.rep;
  return `<div class="sunk stack" role="group" aria-label="신고 사유"><b>신고 사유를 골라 주세요</b>
    <div class="g2" style="--min:150px">${REASONS.map((r) => `<label class="opt"><input type="radio" name="rep_${key}" value="${r}" data-bind="board.rep.reason" ${R.reason === r ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div>
    ${R.reason === '기타' ? fld('자세한 내용 (선택)', 'board.rep.etc', { area: true }) : ''}
    ${R.err ? `<p class="err" role="alert">${R.err}</p>` : ''}
    <p class="hint">작성자가 아니라 이 글(댓글) 자체를 신고합니다. 신고가 ${S.threshold}건 쌓이면 관리자 확인 전에 자동으로 숨겨집니다. 신고한 사람은 공개되지 않습니다. 신고는 하루 ${S.repDaily || 3}번까지 할 수 있습니다 (오늘 ${Math.max(0, (S.repDaily || 3) - reportsToday(me().id))}번 남음).</p>
    <div class="row"><button class="btn btn-p btn-s" data-a="doReport">신고하기</button><button class="btn btn-s" data-a="repCancel">취소</button></div></div>`;
}
function vBoard() {
  const u = me(), B = UI.board, q = String(B.q || '').trim();
  const posts = S.posts.filter((p) => !p.deleted && (!q || (p.title + p.body).includes(q))).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id));
  const p = B.sel != null ? S.posts.find((x) => x.id === B.sel && !x.deleted) : null;
  const mine = (t) => t.reports.some((r) => r.by === u.id);
  const repBtn = (key, t) => t.author === u.id ? '' : mine(t) ? '<span class="chip">신고함</span>' : `<button class="btn btn-s" data-a="repOpen" data-k="${key}">${key.startsWith('p:') ? '이 글 신고' : '이 댓글 신고'}</button>`;
  let detail;
  if (B.mode === 'write') {
    detail = `<form class="panel main" data-f="write" aria-labelledby="hW"><h2 class="h2" id="hW">글쓰기</h2>${fld('제목', 'board.w.title', { ph: '제목을 넣어 주세요' })}${fld('내용', 'board.w.body', { area: true, ph: '다른 사람의 개인정보나 계좌번호는 올리지 말아 주세요.' })}${B.wErr ? `<p class="err" role="alert">${B.wErr}</p>` : ''}<div class="row"><button class="btn btn-p" type="submit">등록</button><button class="btn" type="button" data-a="writeCancel">취소</button></div></form>`;
  } else if (!p) {
    detail = null;
  } else if (p.hidden) {
    detail = `<section class="panel main"><p class="warnbox">신고로 숨김 처리된 글입니다. 관리자가 확인한 뒤 다시 보이거나 삭제됩니다.</p><div class="row"><button class="btn btn-s" data-a="toList">목록으로</button></div></section>`;
  } else {
    detail = `<article class="panel main" aria-labelledby="hPost"><div class="row"><button class="btn btn-s" data-a="toList">← 목록으로</button></div>
      <div class="row between" style="align-items:flex-start"><div class="stack" style="gap:4px"><h2 class="h2" id="hPost">${esc(p.title)}</h2><span class="meta num"><span>${esc(p.nick)}${p.author === u.id ? ' · 내 글' : ''}</span><span>${p.at}</span><span>댓글 ${p.comments.filter((c) => !c.deleted && !c.hidden).length}</span></span></div>
        <div class="row" style="gap:6px">${repBtn('p:' + p.id, p)}${p.author === u.id ? (B.delAsk === p.id ? '<button class="btn btn-s btn-d" data-a="delPost">정말 삭제</button><button class="btn btn-s" data-a="delCancel">취소</button>' : '<button class="btn btn-s btn-d" data-a="delAsk">삭제</button>') : ''}</div></div>
      ${B.rep && B.rep.key === 'p:' + p.id ? reportPanel('p' + p.id) : ''}
      <p class="pre" style="font-size:14.5px;color:var(--fg2)">${esc(p.body)}</p>
      <div class="stack" style="gap:0;border-top:1px solid var(--line);padding-top:8px"><span class="lb" style="padding:6px 0">댓글 ${p.comments.filter((c) => !c.deleted).length}</span>
        ${p.comments.filter((c) => !c.deleted).map((c) => c.hidden ? `<div style="padding:10px 0;border-bottom:1px solid var(--line)" class="hint">신고로 숨김 처리된 댓글입니다.</div>` : `<div class="stack" style="gap:4px;padding:10px 0;border-bottom:1px solid var(--line)"><div class="row between"><span class="meta num"><b style="color:var(--fg)">${esc(c.nick)}</b><span>${c.at}</span></span>${repBtn('c:' + c.id, c)}</div><p class="pre" style="color:var(--fg2)">${esc(c.body)}</p>${B.rep && B.rep.key === 'c:' + c.id ? reportPanel('c' + c.id) : ''}</div>`).join('')}
      </div>
      <form class="stack" data-f="comment" style="gap:8px">${fld('댓글 쓰기', 'board.cmt', { area: true, ph: '따뜻한 말로 남겨 주세요' })}<div class="row"><button class="btn btn-p btn-s" type="submit">댓글 등록</button></div></form>
    </article>`;
  }
  const PER = 10, pages = Math.max(1, Math.ceil(posts.length / PER)), pg = clamp(N(B.page) || 1, 1, pages);
  const rows = posts.slice((pg - 1) * PER, pg * PER);
  const list = `<section class="panel" aria-labelledby="hList" style="gap:10px">
    <div class="row between"><h2 class="h2" id="hList">전체 글 <span class="hint num">${posts.length}건</span></h2>
      <form class="row" data-f="bsearch" style="flex-wrap:nowrap;gap:8px"><label for="${fid('board.q')}" style="position:absolute;left:-9999px">제목·내용 검색</label><input class="inp" id="${fid('board.q')}" data-bind="board.q" value="${esc(B.q)}" placeholder="제목·내용 검색 (예: DSR)" style="max-width:240px"><button class="btn btn-s" type="submit">검색</button></form></div>
    <div class="tblw"><table class="tbl btbl"><thead><tr><th class="r" style="width:56px">No</th><th>제목</th><th>작성자</th><th class="r">댓글</th><th class="r">등록일</th></tr></thead><tbody>
      ${rows.length ? rows.map((x, k) => { const no = posts.length - ((pg - 1) * PER + k); const nc = x.comments.filter((c) => !c.hidden && !c.deleted).length;
        return x.hidden ? `<tr><td class="r num hint">${no}</td><td class="hint">신고로 숨김 처리된 글입니다.</td><td class="hint">—</td><td class="r hint">—</td><td class="r num hint">${x.at.slice(0, 10).replace(/-/g, '.')}</td></tr>`
          : `<tr><td class="r num hint">${no}</td><td><button class="lnk" data-a="openPost" data-i="${x.id}">${esc(x.title)}</button>${x.author === u.id ? ' <span class="chip" style="color:var(--mint);border-color:var(--mint)">내 글</span>' : ''}</td><td class="hint">${esc(x.nick)}</td><td class="r num">${nc || ''}</td><td class="r num hint">${x.at.slice(0, 10).replace(/-/g, '.')}</td></tr>`; }).join('') : '<tr><td colspan="5" class="hint" style="text-align:center;padding:24px">찾는 글이 없습니다.</td></tr>'}
    </tbody></table></div>
    <nav class="pager" aria-label="페이지"><button data-a="bpage" data-i="${pg - 1}" ${pg <= 1 ? 'disabled' : ''} aria-label="이전 페이지">‹</button>${Array.from({ length: pages }, (_, i) => `<button data-a="bpage" data-i="${i + 1}" ${i + 1 === pg ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}<button data-a="bpage" data-i="${pg + 1}" ${pg >= pages ? 'disabled' : ''} aria-label="다음 페이지">›</button></nav>
  </section>`;
  return userShell('board', `${head('신용 라운지', '같은 고민을 가진 사람들과 이야기를 나눕니다. 이름 대신 닉네임으로 보이고, 문제 있는 글·댓글은 신고할 수 있습니다.', '<button class="btn btn-p" data-a="writeStart">글쓰기</button>')}
  ${detail || list}`);
}
A.toList = () => { const B = UI.board; B.sel = null; B.mode = 'view'; B.rep = null; B.delAsk = null; render(); };
A.bpage = (x) => { UI.board.page = N(x.i); render(); };
F.bsearch = () => { UI.board.page = 1; render(); };
A.openPost = (x) => { const B = UI.board; B.sel = N(x.i); B.mode = 'view'; B.rep = null; B.delAsk = null; render(); };
A.writeStart = () => { UI.board.mode = 'write'; UI.board.wErr = ''; render(); };
A.writeCancel = () => { UI.board.mode = 'view'; render(); };
F.write = () => {
  const u = me(), W = UI.board.w;
  if (!W.title.trim() || !W.body.trim()) { UI.board.wErr = '제목과 내용을 모두 넣어 주세요.'; return render(); }
  const id = Math.max(0, ...S.posts.map((p) => p.id)) + 1;
  S.posts.push({ id, title: W.title.trim(), body: W.body.trim(), author: u.id, nick: u.nick || u.id, at: now(), comments: [], reports: [] });
  UI.board.w = { title: '', body: '' }; UI.board.mode = 'view'; UI.board.sel = id; toast('글을 올렸습니다.'); render();
};
F.comment = () => {
  const u = me(), p = S.posts.find((x) => x.id === UI.board.sel); const t = String(UI.board.cmt || '').trim(); if (!p || !t) return;
  p.comments.push({ id: ++S.seq * 10, author: u.id, nick: u.nick || u.id, body: t, at: now(), reports: [] });
  if (p.author !== u.id && S.notifs[p.author]) notify(p.author, `내 글에 새 댓글: ${t.slice(0, 20)}`, 'board');
  UI.board.cmt = ''; render();
};
A.delAsk = () => { UI.board.delAsk = UI.board.sel; render(); };
A.delCancel = () => { UI.board.delAsk = null; render(); };
A.delPost = () => { const p = S.posts.find((x) => x.id === UI.board.sel); if (p) p.deleted = true; UI.board.sel = null; UI.board.delAsk = null; toast('글을 삭제했습니다.'); render(); };
A.repOpen = (x) => { const lim = S.repDaily || 3; if (reportsToday(me().id) >= lim) { toast(`오늘은 신고를 ${lim}번 모두 했습니다. 내일 다시 할 수 있습니다.`); return; } UI.board.rep = { key: x.k, reason: '', etc: '', err: '' }; render(); };
A.repCancel = () => { UI.board.rep = null; render(); };
A.doReport = () => {
  const u = me(), R = UI.board.rep; const tg = getTarget(R.key); if (!tg) return;
  const t = tg.t;
  if (!R.reason) { R.err = '신고 사유를 하나 골라 주세요.'; return render(); }
  if (t.reports.some((r) => r.by === u.id)) { UI.board.rep = null; toast('이미 신고한 글입니다. 같은 글은 한 번만 신고할 수 있습니다.'); return render(); }
  if (reportsToday(u.id) >= (S.repDaily || 3)) { R.err = `오늘은 신고를 ${S.repDaily || 3}번 모두 했습니다. 내일 다시 할 수 있습니다.`; return render(); }
  if (!t.rid) t.rid = 'R-' + (1032 + (++S.seq - 201));
  t.reports.push({ by: u.id, reason: R.reason, at: now(), etc: R.etc || '' });
  if (!t.status || t.status === 'reject' || t.status === 'none') t.status = 'open';
  const n = t.reports.length;
  log('INFO', `신고 접수 · ${t.rid} · ${R.reason} · 누적 ${n}건`, 'board');
  if (n >= S.threshold && !t.hidden) { t.hidden = true; t.autoAt = now(); log('WARN', `${tg.kind} 자동 숨김 · 신고 누적 ${n}건 (${t.rid})`, 'board'); toast(`신고를 접수했습니다. 신고가 ${n}건 쌓여 ${tg.kind}을 자동으로 숨겼습니다.`); }
  else toast('신고를 접수했습니다. 관리자가 확인한 뒤 알려 드립니다.');
  UI.board.rep = null; render();
};
