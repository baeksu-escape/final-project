
/* ========== admin: model ========== */
function vAModel() {
  const M = UI.model, cut = N(M.cut), group = M.group;
  const G = { '전체': { auc: [0.712, 0.781], imp: 1.0, pen: 0, n: '2,400' }, '금융 이력 부족': { auc: [0.641, 0.752], imp: 1.8, pen: 0.08, n: '520' }, '합성 집단 A': { auc: [0.705, 0.768], imp: 0.9, pen: 0, n: '1,440' }, '합성 집단 B': { auc: [0.718, 0.792], imp: 1.1, pen: 0, n: '960' } }[group];
  const t = (cut - 550) / 200, cl = (v) => clamp(v, 0.01, 0.95);
  const grB = cl(0.12 + t * 0.45 + G.pen), grA = cl(grB - 0.07 * G.imp), baB = cl(0.38 - t * 0.30 + G.pen / 2), baA = cl(baB - 0.05 * G.imp), pd = 0.15;
  const acc = (gr, ba) => 1 - (gr * (1 - pd) + ba * pd), cost = (gr, ba) => gr * (1 - pd) + ba * pd * 5, appr = (gr, ba) => (1 - gr) * (1 - pd) + ba * pd;
  const pct = (v) => (v * 100).toFixed(1) + '%';
  const dp = (a, b, lower) => { const d = (b - a) * 100; const good = lower ? d < 0 : d > 0; return [(d > 0 ? '+' : '') + d.toFixed(1) + '%p', Math.abs(d) < 0.05 ? 'var(--mut)' : good ? 'var(--mint)' : 'var(--bad)']; };
  const rows = [['ROC-AUC', G.auc[0].toFixed(3), G.auc[1].toFixed(3), ['+' + (G.auc[1] - G.auc[0]).toFixed(3), 'var(--mint)']], ['정확도', pct(acc(grB, baB)), pct(acc(grA, baA)), dp(acc(grB, baB), acc(grA, baA), false)],
    ['오분류 비용 (상대값)', cost(grB, baB).toFixed(3), cost(grA, baA).toFixed(3), [(cost(grA, baA) - cost(grB, baB)).toFixed(3), cost(grA, baA) < cost(grB, baB) ? 'var(--mint)' : 'var(--bad)']],
    ['우량 고객 오거절률', pct(grB), pct(grA), dp(grB, grA, true)], ['부도 고객 오승인률', pct(baB), pct(baA), dp(baB, baA, true)], ['승인률', pct(appr(grB, baB)), pct(appr(grA, baA)), dp(appr(grB, baB), appr(grA, baA), false)]];
  const curve = (auc) => { const k = 1 / auc - 1, p = []; for (let i = 0; i <= 20; i++) { const x = i / 20; p.push((40 + x * 260).toFixed(1) + ',' + (280 - Math.pow(x, k) * 260).toFixed(1)); } return p.join(' '); };
  const scale = 0.6 + t * 0.9;
  const jobs = [['급여소득자', 0.14, 0.12], ['자영업자', 0.26, 0.17], ['프리랜서', 0.31, 0.19]].map(([l, b, a]) => [l, Math.min(0.95, b * scale), Math.min(0.95, a * scale)]);
  return adminShell('a-model', `${head('모형 성능 비교', '기존 방식(금융 이력만)과 대안 모형(금융 이력 + 대안 데이터)을 같은 검증 표본으로 비교합니다. 수치는 시연용 예시입니다.')}
  <section class="panel row" aria-label="비교 조건" style="flex-direction:row;align-items:flex-end;gap:16px">
    <div style="flex:1 1 220px">${sel('고객 집단', 'model.group', ['전체', '금융 이력 부족', '합성 집단 A', '합성 집단 B'])}</div>
    <div style="flex:2 1 320px">${range('승인 기준 점수 (컷오프)', 'model.cut', 550, 750, 10, cut + '점', { ends: ['550', '750'] })}</div>
    <span class="chip num">검증 표본 ${G.n}명</span></section>
  <div class="cols">
    <section class="panel main" aria-labelledby="hMt"><h2 class="h2" id="hMt">지표 비교 · ${group} · 컷오프 ${cut}점</h2>
      <div class="tblw"><table class="tbl"><thead><tr><th>지표</th><th class="r">기존</th><th class="r">대안</th><th class="r">차이</th></tr></thead><tbody>${rows.map(([l, b, a, [df, c]]) => `<tr><td>${l}</td><td class="r num">${b}</td><td class="r num"><b>${a}</b></td><td class="r num" style="color:${c}">${df}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">컷오프를 올리면 부도 고객 오승인은 줄고 우량 고객 오거절은 늘어납니다. 오분류 비용은 부도 오승인을 5배로 보고 계산합니다.</p></section>
    <section class="panel side" aria-labelledby="hRoc"><h2 class="h2" id="hRoc">ROC 곡선</h2>
      <svg viewBox="0 0 320 310" width="100%" role="img" aria-label="${group} ROC 곡선, 기존 AUC ${G.auc[0]}, 대안 AUC ${G.auc[1]}" style="max-width:360px">
        <rect x="40" y="20" width="260" height="260" fill="none" stroke="#2d3e5c"/>
        ${[0.25, 0.5, 0.75].map((v) => `<line x1="${40 + v * 260}" x2="${40 + v * 260}" y1="20" y2="280" stroke="#22314b"/><line x1="40" x2="300" y1="${280 - v * 260}" y2="${280 - v * 260}" stroke="#22314b"/>`).join('')}
        <line x1="40" y1="280" x2="300" y2="20" stroke="#4a5b78" stroke-dasharray="4 4"/>
        <polyline points="${curve(G.auc[0])}" fill="none" stroke="#a7b4c6" stroke-width="2"/>
        <polyline points="${curve(G.auc[1])}" fill="none" stroke="#a78bfa" stroke-width="2.5"/>
        <text x="170" y="302" font-size="11" fill="#8a9bb4" text-anchor="middle">거짓 양성률</text>
        <text x="14" y="150" font-size="11" fill="#8a9bb4" text-anchor="middle" transform="rotate(-90 14 150)">참 양성률</text>
        <text x="296" y="262" font-size="11" fill="#a7b4c6" text-anchor="end">기존 ${G.auc[0].toFixed(3)}</text>
        <text x="296" y="246" font-size="11" fill="#c4b5fd" text-anchor="end">대안 ${G.auc[1].toFixed(3)}</text>
      </svg></section>
  </div>
  <section class="panel" aria-labelledby="hJe"><h2 class="h2" id="hJe">직군별 우량 고객 오거절률 · 컷오프 ${cut}점</h2>
    ${jobs.map(([l, b, a]) => `<div style="display:grid;grid-template-columns:90px 1fr 64px;gap:8px 12px;align-items:center;font-size:13px"><b style="grid-row:span 2">${l}</b><div class="track"><i style="width:${(b / 0.6 * 100).toFixed(1)}%;background:#a7b4c6"></i></div><span class="num hint">기존 ${pct(b)}</span><div class="track"><i style="width:${(a / 0.6 * 100).toFixed(1)}%;background:var(--vio)"></i></div><b class="num">대안 ${pct(a)}</b></div>`).join('')}
    <p class="hint">자영업자·프리랜서처럼 금융 이력이 짧은 직군에서 대안 모형의 개선 폭이 큽니다.</p></section>`);
}

/* ========== admin: stats ========== */
const STAT = { job: [['급여소득자', 5400, 671, 712], ['자영업자', 3900, 628, 689], ['프리랜서', 2700, 611, 684]], age: [['20대', 2900, 603, 676], ['30대', 3800, 648, 703], ['40대', 3100, 664, 709], ['50대 이상', 2200, 671, 699]] };
const distOf = (avg) => { const p = phi((664.5 - avg) / 75), g = 1 - phi((779.5 - avg) / 75); return [p, 1 - p - g, g]; };
function stack3(dist, label) {
  const c = ['#a8464f', '#b8902a', '#00a77a'];
  return `<div style="display:flex;height:22px;border-radius:6px;overflow:hidden" role="img" aria-label="${label}: Caution ${(dist[0] * 100).toFixed(0)}%, Standard ${(dist[1] * 100).toFixed(0)}%, Good ${(dist[2] * 100).toFixed(0)}%">${dist.map((v, i) => `<span class="num" style="width:${(v * 100).toFixed(1)}%;background:${c[i]};font-size:11px;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden">${v >= 0.08 ? Math.round(v * 100) + '%' : ''}</span>`).join('')}</div>`;
}
function statsBody(user) {
  const dim = UI.stats.dim, rows = STAT[dim];
  const tot = sum(rows.map((r) => r[1])), avgT = sum(rows.map((r) => r[1] * r[2])) / tot, avgA = sum(rows.map((r) => r[1] * r[3])) / tot;
  const apB = 1 - sum(rows.map((r) => r[1] * distOf(r[2])[0])) / tot, apA = 1 - sum(rows.map((r) => r[1] * distOf(r[3])[0])) / tot;
  const members = S.users.filter((u) => u.role === 'user');
  const today = now().slice(0, 10); const scoredToday = S.logs.filter((l) => l.msg.startsWith('점수 산출 완료') && l.t.startsWith(today)).length;
  const u = me(), d = u && u.data, myAge = u && u.birth ? (2026 - u.birth >= 50 ? '50대 이상' : Math.floor((2026 - u.birth) / 10) * 10 + '대') : null;
  const mine = user ? (dim === 'job' ? (d ? JOBS[d.job] : null) : myAge) : null; const myRow = rows.find((r) => r[0] === mine);
  return `${head(user ? '비교 분석' : '직군·연령별 통계', user ? '나와 같은 직군·연령대의 점수와 등급을 합성 데이터 12,000명과 비교합니다. 강조된 줄이 내가 속한 집단입니다.' : '합성 데이터 12,000명을 기준으로 집단마다 점수와 등급이 어떻게 달라지는지 봅니다.', segBtns('stats.dim', [['job', '직군별'], ['age', '연령별']], '나눌 기준'))}
  <div class="kpis">
    <div class="panel" style="gap:2px"><span class="hint">전체 고객</span><b class="mid">${fmt(tot)}명</b></div>
    <div class="panel" style="gap:2px"><span class="hint">평균 점수 기존 → 대안</span><b class="mid">${Math.round(avgT)} → <span style="color:var(--vio)">${Math.round(avgA)}</span></b></div>
    <div class="panel" style="gap:2px"><span class="hint">Standard 이상 비율</span><b class="mid">${(apB * 100).toFixed(1)}% → <span style="color:var(--vio)">${(apA * 100).toFixed(1)}%</span></b></div>
    ${user ? `<div class="panel" style="gap:2px"><span class="hint">내 집단 · ${mine || '—'} 평균 대안</span><b class="mid">${myRow ? myRow[3] + '점' : '—'}${u.history.length ? ` <span class="hint" style="font-size:13px">나 ${u.history[0].A}점</span>` : ''}</b></div>` : `<div class="panel" style="gap:2px"><span class="hint">데모 가입 회원 · 오늘 산출</span><b class="mid">${members.length}명 · ${scoredToday}건</b></div>`}
  </div>
  ${user && d && u.history.length ? `<div class="lay">${peersCard()}` : '<div class="lay">'}
  <section class="panel ${user && d && u.history.length ? 's2' : 's3'}" aria-labelledby="hSt"><h2 class="h2" id="hSt">${dim === 'job' ? '직군별' : '연령별'} 요약</h2>
    <div class="tblw"><table class="tbl"><thead><tr><th>집단</th><th class="r">고객 수</th><th class="r">평균 기존</th><th class="r">평균 대안</th><th class="r">상승폭</th><th class="r">Standard 이상 (기존 → 대안)</th></tr></thead><tbody>
    ${rows.map(([l, n, T, A2]) => `<tr ${l === mine ? 'style="background:var(--sel);font-weight:600"' : ''}><td>${l}${l === mine ? ' <span class="chip" style="color:var(--vio);border-color:var(--vio)">나</span>' : ''}</td><td class="r num">${fmt(n)}</td><td class="r num">${T}</td><td class="r num"><b>${A2}</b></td><td class="r num" style="color:var(--mint)">+${A2 - T}</td><td class="r num">${((1 - distOf(T)[0]) * 100).toFixed(1)}% → <b style="color:var(--vio)">${((1 - distOf(A2)[0]) * 100).toFixed(1)}%</b></td></tr>`).join('')}</tbody></table></div></section></div>
  <section class="panel" aria-labelledby="hDist"><div class="row between"><h2 class="h2" id="hDist">등급 분포</h2><span class="row hint" style="gap:12px;font-size:12px"><span><span style="color:#a8464f">■</span> Caution</span><span><span style="color:#b8902a">■</span> Standard</span><span><span style="color:#00a77a">■</span> Good</span></span></div>
    ${rows.map(([l, , T, A2]) => `<div style="display:grid;grid-template-columns:90px 44px 1fr;gap:6px 10px;align-items:center;font-size:13px"><b style="grid-row:span 2">${l}</b><span class="hint">기존</span>${stack3(distOf(T), l + ' 기존')}<span class="hint">대안</span>${stack3(distOf(A2), l + ' 대안')}</div>`).join('')}
    <p class="hint">등급 기준 Caution ≤664, Standard 665~779, Good ≥780 (예시). 분포는 집단 평균과 표준편차 75점으로 근사했습니다.</p></section>`;
}
function vAStats() { return adminShell('a-stats', statsBody(false)); }
/* 비교 분석 (사용자). 팀원 사본 UoQWBK…의 구성을 따르되 색은 우리 테마(초록 계열)로 맞춤 */
const CMP = {
  jobs: [['급여소득자', 'salary'], ['자영업자', 'self'], ['프리랜서', 'free']], ages: ['20대', '30대', '40대', '50대 이상'],
  cell: { salary: [[688, 1080], [717, 1840], [723, 1510], [714, 970]], self: [[670, 620], [694, 1130], [699, 1130], [687, 1020]], free: [[666, 1080], [690, 890], [693, 510], [679, 220]] },
  job: { salary: [5400, 674, 712], self: [3900, 636, 690], free: [2700, 602, 680] },
  age: [[2780, 598, 675], [3860, 648, 704], [3150, 666, 710], [2210, 672, 698]], all: [12000, 646, 698]
};
const ageIdx = (birth) => { const a = 2026 - N(birth); return a >= 50 ? 3 : a >= 40 ? 2 : a >= 30 ? 1 : 0; };
const topPct = (v, avg) => Math.max(1, Math.round((1 - phi((v - avg) / 60)) * 100));
function cellOf(jk, ai) { const [A, n] = CMP.cell[jk][ai]; const up = (CMP.job[jk][2] - CMP.job[jk][1]) + (CMP.age[ai][2] - CMP.age[ai][1]) - (CMP.all[2] - CMP.all[1]); return { A, n, T: A - up }; }
function vStats() {
  const u = me(), d = u.data, my = scoreOf(d).A, jk = d.job, ai = ageIdx(u.birth), jn = JOBS[jk], an = CMP.ages[ai];
  const C = UI.cmp || (UI.cmp = { view: 'grid', metric: 'A', sel: null }); const sel = C.sel || [jk, ai];
  const myCell = cellOf(jk, ai);
  const pos = (title, group, avg) => { const t = topPct(my, avg), x = clamp(100 - t, 2, 98); return `<div class="panel" data-nocard style="gap:6px"><span class="tag">${title}</span><div class="row between"><b>${group} 중</b><span class="hint num">평균 ${avg}점</span></div>
    <div class="row" style="gap:8px;align-items:baseline"><b class="mid" style="color:var(--mint)">상위 ${t}%</b><span class="hint num">평균보다 ${Math.abs(my - avg)}점 ${my >= avg ? '높음' : '낮음'}</span></div>
    <div class="ptrack" role="img" aria-label="${group} 안에서 상위 ${t}%"><i style="left:50%" class="avg"></i><b style="left:${x}%"></b></div><div class="row between hint" style="font-size:11.5px"><span>하위</span><span>평균</span><span>상위</span></div></div>`; };
  const kpis = `<div class="stack" style="gap:8px"><div style="font-size:14px;font-weight:600">내 위치 <span class="hint" style="font-weight:400">· 내 대안 점수 <b class="num">${my}점</b> 기준</span></div>
    <div class="lay">${pos('직군 안에서', jn, CMP.job[jk][2])}${pos('연령대 안에서', an, CMP.age[ai][2])}${pos('직군 + 연령', `${an} ${jn}`, myCell.A)}</div></div>`;
  const gd = (T, A2) => `<div class="stack" style="gap:6px"><div style="display:grid;grid-template-columns:34px 1fr;gap:6px;align-items:center;font-size:12px"><span class="hint">기존</span>${stack3(distOf(T), '기존')}<span class="hint">대안</span>${stack3(distOf(A2), '대안')}</div><span class="row hint" style="gap:10px;font-size:11.5px"><span><span style="color:#a8464f">■</span> Caution</span><span><span style="color:#b8902a">■</span> Standard</span><span><span style="color:#00a77a">■</span> Good</span></span></div>`;
  const std = (T, A2) => `${((1 - distOf(T)[0]) * 100).toFixed(0)}% → <b style="color:var(--mint)">${((1 - distOf(A2)[0]) * 100).toFixed(0)}%</b>`;
  let body;
  if (C.view === 'grid') {
    const all = CMP.jobs.flatMap(([, k]) => [0, 1, 2, 3].map((i) => cellOf(k, i)));
    const val = (c) => C.metric === 'A' ? c.A : C.metric === 'up' ? c.A - c.T : (1 - distOf(c.A)[0]) * 100;
    const vs = all.map(val), lo = Math.min(...vs), hi = Math.max(...vs);
    const txt = (c) => C.metric === 'A' ? `${c.A}점` : C.metric === 'up' ? `+${c.A - c.T}` : `${((1 - distOf(c.A)[0]) * 100).toFixed(0)}%`;
    const cellBtn = (k, i) => { const c = cellOf(k, i), t = (val(c) - lo) / Math.max(1, hi - lo), mine = k === jk && i === ai, on = sel[0] === k && sel[1] === i;
      return `<button class="hcell${on ? ' on' : ''}" data-a="cmpSel" data-x="${k}" data-i="${i}" style="--h:${Math.round(18 + t * 72)}%;${t > 0.55 ? 'color:#fff' : ''}" aria-pressed="${on}" aria-label="${CMP.ages[i]} ${JOBS[k]} ${txt(c)}, ${fmt(c.n)}명${mine ? ', 내 집단' : ''}">${mine ? '<span class="me">나</span>' : ''}<b class="num">${txt(c)}</b><span class="num">${fmt(c.n)}명</span></button>`; };
    const avgCell = (A2, n, T) => `<div class="hcell avg"><b class="num">${C.metric === 'A' ? A2 + '점' : C.metric === 'up' ? '+' + (A2 - T) : ((1 - distOf(A2)[0]) * 100).toFixed(0) + '%'}</b><span class="num">${fmt(n)}명</span></div>`;
    const sc = cellOf(sel[0], sel[1]), sj = CMP.job[sel[0]], sa = CMP.age[sel[1]], isMine = sel[0] === jk && sel[1] === ai;
    const dl = (k, v, good) => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="hint">${k}</span><b class="num" style="color:${good == null ? 'var(--fg)' : good ? 'var(--mint)' : 'var(--bad)'}">${v}</b></div>`;
    const dv = (v) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v)}점`;
    body = `<div class="lay">
      <section class="panel s2" aria-labelledby="hGrid"><div class="row between"><div><h2 class="h2" id="hGrid">직군 × 연령 한눈에 보기</h2><p class="hint">칸이 진할수록 값이 높습니다. 칸을 누르면 오른쪽에 자세한 내용이 나옵니다.</p></div></div>
        <div class="row" style="gap:8px"><span class="hint">칸에 표시할 값</span>${segBtns('cmp.metric', [['A', '대안 점수'], ['up', '상승폭'], ['std', 'Standard 이상']], '칸에 표시할 값')}</div>
        <div class="tblw"><div class="hgrid" role="grid" aria-label="직군과 연령대별 ${C.metric === 'A' ? '평균 대안 점수' : C.metric === 'up' ? '점수 상승폭' : 'Standard 이상 비율'}">
          <span></span>${CMP.ages.map((a) => `<span class="hh">${a}</span>`).join('')}<span class="hh">직군 평균</span>
          ${CMP.jobs.map(([l, k]) => `<span class="hr">${l}</span>${[0, 1, 2, 3].map((i) => cellBtn(k, i)).join('')}${avgCell(CMP.job[k][2], CMP.job[k][0], CMP.job[k][1])}`).join('')}
          <span class="hr">연령 평균</span>${CMP.age.map(([n, T, A2]) => avgCell(A2, n, T)).join('')}${avgCell(CMP.all[2], CMP.all[0], CMP.all[1])}
        </div></div>
        <div class="row between hint" style="font-size:12px"><span class="row" style="gap:8px"><span>낮음</span><i class="hscale"></i><span>높음</span><span style="margin-left:10px"><span class="me" style="position:static">나</span> 내 집단</span></span><span>점선 칸 = 평균(합산값)</span></div></section>
      <section class="panel" aria-labelledby="hSel"><span class="tag">선택한 집단</span><h2 class="h2" id="hSel">${CMP.ages[sel[1]]} ${JOBS[sel[0]]} ${isMine ? '<span class="chip" style="color:var(--mint);border-color:var(--mint)">내 집단</span>' : ''}</h2>
        <span class="hint num">${fmt(sc.n)}명 · 전체의 ${(sc.n / CMP.all[0] * 100).toFixed(1)}%</span>
        <div class="sunk stack" style="gap:2px"><span class="hint">평균 점수 기존 → 대안</span><b class="mid num">${sc.T} → <span style="color:var(--mint)">${sc.A}</span></b><span class="hint">대안 모형으로 ${sgn(sc.A - sc.T)}점</span></div>
        <div>${dl('전체 평균 대비', dv(sc.A - CMP.all[2]), sc.A >= CMP.all[2])}${dl(`${JOBS[sel[0]]} 평균 대비`, dv(sc.A - sj[2]), sc.A >= sj[2])}${dl(`${CMP.ages[sel[1]]} 평균 대비`, dv(sc.A - sa[2]), sc.A >= sa[2])}${dl('내 점수와 비교', `나 ${my}점 · ${Math.abs(my - sc.A)}점 ${my >= sc.A ? '높음' : '낮음'}`, my >= sc.A)}${dl('Standard 이상', std(sc.T, sc.A), null)}</div>
        <span class="lb">등급 분포</span>${gd(sc.T, sc.A)}</section></div>`;
  } else {
    const isJob = C.view === 'job';
    const rows = isJob ? CMP.jobs.map(([l, k]) => [l, ...CMP.job[k], k === jk]) : CMP.ages.map((a, i) => [a, ...CMP.age[i], i === ai]);
    const X0 = 560, X1 = 730, px = (v) => ((clamp(v, X0, X1) - X0) / (X1 - X0) * 100).toFixed(1);
    body = `<section class="panel" aria-labelledby="hDb"><h2 class="h2" id="hDb">${isJob ? '직군별' : '연령별'} 평균 점수</h2><p class="hint">회색 점이 기존 방식, 초록 점이 대안 모형입니다. 선이 길수록 대안 데이터 덕을 많이 본 집단입니다.</p>
      <div class="slegend hint"><span><i style="background:var(--mut2);border-radius:50%;width:10px;height:10px"></i>기존 방식</span><span><i style="background:var(--mint);border-radius:50%;width:10px;height:10px"></i>대안 모형</span><span><i style="background:var(--vio);width:3px;height:14px"></i>내 점수 ${my}</span></div>
      <div class="stack" style="gap:6px">${rows.map(([l, n, T, A2, mine]) => `<div class="dbrow${mine ? ' mine' : ''}"><span><b>${l}</b>${mine ? ' <span class="chip" style="color:var(--mint);border-color:var(--mint)">나</span>' : ''}<br><span class="hint num">${fmt(n)}명</span></span>
        <span class="dbtrack" aria-hidden="true"><i class="ln" style="left:${px(T)}%;width:${(px(A2) - px(T)).toFixed(1)}%"></i><i class="dt t" style="left:${px(T)}%"></i><i class="dt a" style="left:${px(A2)}%"></i><i class="my" style="left:${px(my)}%"></i></span>
        <span class="num" style="text-align:right">${T} → <b style="color:var(--mint)">${A2}</b> <span class="hint">+${A2 - T}</span></span></div>`).join('')}
        <div class="dbrow" style="padding-top:0"><span></span><span class="dbaxis num">${[560, 600, 640, 680, 720].map((t) => `<span style="left:${px(t)}%">${t}</span>`).join('')}</span><span></span></div></div></section>
      <div class="lay"><section class="panel s3" aria-labelledby="hSt"><h2 class="h2" id="hSt">${isJob ? '직군별' : '연령별'} 요약표</h2>
        <div class="tblw"><table class="tbl"><thead><tr><th>집단</th><th class="r">고객 수</th><th class="r">평균 기존</th><th class="r">평균 대안</th><th class="r">상승폭</th><th class="r">Standard 이상</th></tr></thead><tbody>
        ${rows.map(([l, n, T, A2, mine]) => `<tr ${mine ? 'style="background:var(--sel);font-weight:600"' : ''}><td>${l}${mine ? ' <span class="chip" style="color:var(--mint);border-color:var(--mint)">나</span>' : ''}</td><td class="r num">${fmt(n)}</td><td class="r num">${T}</td><td class="r num"><b>${A2}</b></td><td class="r num" style="color:var(--mint)">+${A2 - T}</td><td class="r num">${std(T, A2)}</td></tr>`).join('')}
        <tr class="hint"><td>전체</td><td class="r num">${fmt(CMP.all[0])}</td><td class="r num">${CMP.all[1]}</td><td class="r num">${CMP.all[2]}</td><td class="r num">+${CMP.all[2] - CMP.all[1]}</td><td class="r num">${std(CMP.all[1], CMP.all[2])}</td></tr></tbody></table></div></section>
      <section class="panel s3" aria-labelledby="hDist"><h2 class="h2" id="hDist">등급 분포</h2>
        <div class="g2" style="--min:460px;gap:18px 28px">${rows.map(([l, , T, A2]) => `<div style="display:grid;grid-template-columns:80px 1fr;gap:8px;align-items:center"><b style="font-size:13px">${l}</b>${gd(T, A2)}</div>`).join('')}</div></section></div>`;
  }
  return userShell('stats', `${head('비교 분석', '같은 직군·연령대 사람들과 내 점수를 비교합니다. 기준은 합성 데이터 12,000명입니다.', segBtns('cmp.view', [['grid', '직군 × 연령'], ['job', '직군별'], ['age', '연령별']], '보는 방식'))}
  ${kpis}${body}
  <p class="hint">등급 기준 Caution ≤664, Standard 665~779, Good ≥780 (예시). 등급 분포는 집단 평균과 표준편차 75점, 내 위치는 표준편차 60점으로 근사한 예시입니다.</p>`);
}
A.cmpSel = (x) => { UI.cmp.sel = [x.x, N(x.i)]; render(); };

/* ========== admin: accounts ========== */
const AUDIT_REASONS = ['신고 처리 중 작성자 확인', '점수 이의 문의 응대', '탈퇴 요청 본인 확인', '모형 검증용 표본 점검', '로그인 잠금 문의 확인'];
const recvReports = (id) => allTargets().filter((x) => x.t.author === id).reduce((a, x) => a + x.t.reports.length, 0);
function vAAcc() {
  const C = UI.acc, admin = me(), q = String(C.q || '').trim().toLowerCase();
  const list = S.users.filter((u) => (C.role === 'all' || u.role === C.role) && (C.st === 'all' || (C.st === 'locked') === !!u.locked) && (!q || u.id.toLowerCase().includes(q)));
  const lastA = (u) => u.history.length ? u.history[0].A : (u.lastA || null);
  const det = C.detail ? userOf(C.detail) : null;
  const tgt = (u) => `${maskName(u.name)} (${maskId(u.id)})`;
  return adminShell('a-accounts', `${head('계정·권한 관리', '회원 정보는 가려서 보여 줍니다. 자세히 보려면 사유를 남겨야 하고, 남긴 기록은 열람 감사 로그에 쌓입니다.')}
  <section class="panel row" aria-label="검색" style="flex-direction:row;align-items:flex-end;gap:12px">
    <div style="flex:2 1 220px">${fld('아이디 검색', 'acc.q', { live: true, ph: '예: spam' })}</div>
    <div style="flex:1 1 150px">${sel('권한', 'acc.role', [['all', '전체'], ['user', '일반'], ['admin', '관리자']])}</div>
    <div style="flex:1 1 150px">${sel('상태', 'acc.st', [['all', '전체'], ['ok', '정상'], ['locked', '잠김']])}</div>
    <span class="chip num">${list.length}명</span></section>
  <section class="panel" aria-labelledby="hAl"><h2 class="h2" id="hAl">회원 목록</h2>
    <div class="tblw"><table class="tbl"><thead><tr><th>아이디</th><th>이름</th><th>권한</th><th>직군</th><th class="r">최근 대안 점수</th><th>상태</th><th class="r">작성 글 신고</th><th>가입일</th><th>관리</th></tr></thead><tbody>
    ${list.map((u) => { const self = u.id === admin.id; const la = lastA(u); const rr = recvReports(u.id); return `<tr ${C.detail === u.id ? 'style="background:var(--sel)"' : ''}>
      <td class="num">${u.id}</td><td>${maskName(u.name)}</td><td>${u.role === 'admin' ? '<span class="chip" style="color:var(--vio2);border-color:var(--vio)">관리자</span>' : '일반'}</td><td>${u.data ? JOBS[u.data.job] : u.job ? JOBS[u.job] : '—'}</td>
      <td class="r num">${la || '—'}</td><td>${u.locked ? '<span class="chip" style="color:var(--bad);border-color:var(--bad)">잠김</span>' : '<span class="chip" style="color:var(--mint);border-color:var(--mint)">정상</span>'}</td>
      <td class="r num" style="color:${rr >= S.threshold ? 'var(--warn)' : 'inherit'}">${rr}</td><td class="num">${u.joined}</td>
      <td><div class="row" style="gap:6px;flex-wrap:nowrap">${u.role === 'user' ? `<button class="btn btn-s" data-a="accAsk" data-x="${u.id}">상세 보기</button>` : ''}${self ? '<span class="hint">본인</span>' : `<button class="btn btn-s${u.locked ? '' : ' btn-d'}" data-a="accLock" data-x="${u.id}">${u.locked ? '잠금 해제' : '잠금'}</button>`}</div></td></tr>
      ${C.reasonFor === u.id ? `<tr><td colspan="9"><div class="sunk row" style="gap:10px;align-items:flex-end"><div style="flex:1 1 260px">${sel('열람 사유', 'acc.reason', AUDIT_REASONS)}</div><button class="btn btn-p btn-s" data-a="accOpen" data-x="${u.id}">사유 남기고 열기</button><button class="btn btn-s" data-a="accAskCancel">취소</button><span class="hint">이 열람은 ${admin.id} 이름으로 감사 로그에 남습니다.</span></div></td></tr>` : ''}`; }).join('')}
    </tbody></table></div></section>
  <section class="panel" aria-labelledby="hNa"><div class="row between"><div><span class="tag">Admin only</span><h2 class="h2" id="hNa">관리자 계정 추가</h2></div><span class="chip">일반 회원을 관리자로 바꾸는 기능은 두지 않습니다</span></div>
    <p class="hint">관리자는 회원 가입이 아니라 이 화면에서만 만듭니다. 임시 비밀번호가 발급되고, 첫 로그인 때 비밀번호 변경과 2단계 인증 등록을 거칩니다.</p>
    <form class="g2" data-f="addAdmin" style="--min:200px;align-items:end">${fld('아이디', 'acc.nw.id', { ph: '예: admin_park', hint: '영문 소문자로 시작, 4~16자' })}${fld('이름', 'acc.nw.name', { ph: '예: 박관리' })}${fld('업무 이메일', 'acc.nw.email', { ph: 'name@avenue.example' })}<button class="btn btn-p" type="submit">관리자 계정 만들기</button></form>
    ${C.nwErr ? `<p class="err" role="alert">${C.nwErr}</p>` : ''}
    ${C.nwDone ? `<div class="okbox stack" style="gap:4px" role="status"><span><b>${C.nwDone.id}</b> 관리자 계정을 만들었습니다. 임시 비밀번호 <b class="num">${C.nwDone.pw}</b> (시연용으로 화면에 표시)</span><span>첫 로그인 때 새 비밀번호 설정과 2단계 인증 등록을 요구합니다. 생성 기록은 시스템 로그에 남았습니다.</span></div>` : ''}
  </section>
  ${det ? `<section class="panel" aria-labelledby="hAd"><div class="row between"><div><span class="tag">Member detail</span><h2 class="h2" id="hAd">${esc(det.name)} · ${det.id}</h2></div><div class="row"><span class="chip">열람 사유: ${esc(C.openReason)}</span><button class="btn btn-s" data-a="accClose">닫기</button></div></div>
    <dl class="g2" style="--min:170px;margin:0">${[['이름', det.name], ['이메일', det.email], ['휴대폰', det.phone || '등록 안 됨'], ['직군', det.data ? JOBS[det.data.job] : det.job ? JOBS[det.job] : '—'], ['가입일', det.joined], ['최근 로그인', det.last || '—'], ['로그인 실패', (det.fails || 0) + '회'], ['받은 신고', recvReports(det.id) + '건']].map(([k, v]) => `<div class="stack" style="gap:2px"><dt class="hint">${k}</dt><dd class="num" style="margin:0">${esc(v)}</dd></div>`).join('')}</dl>
    ${det.history.length ? `<div class="tblw"><table class="tbl"><thead><tr><th>산출 일시</th><th class="r">기존</th><th class="r">대안</th><th>등급</th></tr></thead><tbody>${det.history.slice(0, 5).map((h) => `<tr><td class="num">${h.at}</td><td class="r num">${h.T}</td><td class="r num">${h.A}</td><td>${gchip(h.A)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">이 데모에서 산출한 진단 내역이 없습니다.</p>'}
  </section>` : ''}`);
}
A.accAsk = (x) => { UI.acc.reasonFor = x.x; render(); };
A.accAskCancel = () => { UI.acc.reasonFor = null; render(); };
A.accOpen = (x) => { const u = userOf(x.x), C = UI.acc; audit(me().id, `${maskName(u.name)} (${maskId(u.id)})`, '회원 상세', C.reason); C.detail = u.id; C.openReason = C.reason; C.reasonFor = null; toast('열람 기록을 감사 로그에 남겼습니다.'); render(); };
A.accClose = () => { UI.acc.detail = null; render(); };
A.accLock = (x) => { const u = userOf(x.x); u.locked = !u.locked; if (!u.locked) u.fails = 0; log('AUTH', `관리자 ${me().id} · ${u.id} 계정 ${u.locked ? '잠금' : '잠금 해제'}`, 'admin'); toast(`${u.id} 계정을 ${u.locked ? '잠갔습니다' : '풀었습니다'}.`); render(); };
F.addAdmin = () => {
  const C = UI.acc, f = C.nw, id = String(f.id || '').trim(), nm = String(f.name || '').trim(), ml = String(f.email || '').trim();
  C.nwDone = null;
  if (!/^[a-z][a-z0-9_]{3,15}$/.test(id)) { C.nwErr = '아이디는 영문 소문자로 시작하는 4~16자(소문자·숫자·_)로 넣어 주세요.'; return render(); }
  if (userOf(id)) { C.nwErr = '이미 있는 아이디입니다.'; return render(); }
  if (!nm || !okMail(ml)) { C.nwErr = '이름과 업무 이메일을 확인해 주세요.'; return render(); }
  const pw = 'Tmp' + code6();
  S.users.push({ id, pw, name: nm, email: ml, phone: '', role: 'admin', birth: 1990, joined: now().slice(0, 10), last: '', locked: false, fails: 0, data: null, history: [], cards: [], invited: true });
  log('AUTH', `관리자 ${me().id} · 관리자 계정 생성 ${id}`, 'admin');
  C.nw = { id: '', name: '', email: '' }; C.nwErr = ''; C.nwDone = { id, pw }; toast(`${id} 관리자 계정을 만들었습니다.`); render();
};
A.accRoleAsk = (x) => { UI.acc.roleAsk = x.x; render(); };
A.accRoleCancel = () => { UI.acc.roleAsk = null; render(); };
A.accRole = (x) => { const u = userOf(x.x); u.role = u.role === 'admin' ? 'user' : 'admin'; if (u.role === 'admin' && !u.pw) u.pw = 'admin1234'; UI.acc.roleAsk = null; log('AUTH', `관리자 ${me().id} · ${u.id} 권한 변경 → ${u.role === 'admin' ? '관리자' : '일반'}`, 'admin'); toast(`${u.id} 권한을 ${u.role === 'admin' ? '관리자' : '일반'}로 바꿨습니다.`); render(); };

/* ========== admin: reports ========== */
const ST = { open: ['접수', 'var(--info)'], review: ['검토 중', 'var(--warn)'], done: ['처리 완료', 'var(--mint)'], reject: ['반려', 'var(--mut)'] };
const lastAt = (t) => t.reports.reduce((m, r) => (r.at > m ? r.at : m), '');
const daysAgo = (s) => (Date.now() - new Date(String(s).replace(' ', 'T')).getTime()) / 86400000;
function vARep() {
  const R = UI.rep; if (R.th == null) R.th = S.threshold;
  let items = allTargets().filter((x) => !(x.t.deleted && x.t.status !== 'done'));
  items = items.filter((x) => (R.st === '전체' || ST[x.t.status || 'open'][0] === R.st) && (R.rs === '전체' || x.t.reports.some((r) => r.reason === R.rs)) && (R.pd === '전체' || daysAgo(lastAt(x.t)) <= (R.pd === '최근 7일' ? 7 : 30)));
  const act = (x) => x.t.status === 'open' || x.t.status === 'review';
  items.sort((a, b) => (act(b) && b.t.hidden) - (act(a) && a.t.hidden) || act(b) - act(a) || (lastAt(b.t) > lastAt(a.t) ? 1 : -1));
  const cur = items.find((x) => x.key === R.sel) || null;
  const label = (x) => x.kind === '게시글' ? x.t.title : `댓글: "${x.t.body.slice(0, 24)}${x.t.body.length > 24 ? '…' : ''}"`;
  const stc = (t) => { const s = ST[t.status || 'open']; return `<span class="chip" style="color:${s[1]};border-color:${s[1]}">${t.hidden && act({ t }) ? '자동 숨김 · ' : ''}${s[0]}</span>`; };
  let det = '<section class="panel main"><p class="hint">왼쪽 목록에서 신고 대상을 고르세요.</p></section>';
  if (cur) {
    const t = cur.t; const cnt = {}; t.reports.forEach((r) => { cnt[r.reason] = (cnt[r.reason] || 0) + 1; }); const cmax = Math.max(...Object.values(cnt));
    det = `<section class="panel main" aria-labelledby="hRd"><div class="row between"><div><span class="tag">${t.rid} · ${cur.kind}</span><h2 class="h2" id="hRd">${esc(label(cur))}</h2></div>${stc(t)}</div>
      <div class="sunk stack" style="gap:6px"><span class="meta num"><span>원문 · 작성자 ${esc(t.nick || '—')}</span><span>${t.at}</span>${cur.kind === '댓글' ? `<span>글: ${esc(cur.post.title)}</span>` : ''}</span><p class="pre" style="color:var(--fg2)">${esc(t.body)}</p></div>
      <div class="g2" style="--min:240px">
        <div class="stack" style="gap:8px"><span class="lb">사유별 건수 · 누적 ${t.reports.length}건</span>${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="display:grid;grid-template-columns:96px 1fr 28px;gap:8px;align-items:center;font-size:13px"><span>${k}</span><div class="track"><i style="width:${(v / cmax * 100).toFixed(0)}%"></i></div><b class="num" style="text-align:right">${v}</b></div>`).join('')}</div>
        <div class="stack" style="gap:6px"><span class="lb">신고자 (가려서 표시)</span><p class="num" style="font-size:13px;color:var(--fg2)">${t.reports.map((r) => maskId(r.by)).join(', ')}</p>${t.autoAt ? `<span class="hint num">자동 숨김 ${t.autoAt} (기준 ${S.threshold}건)</span>` : ''}</div>
      </div>
      ${t.handler ? `<p class="okbox">처리 기록 · <b>${t.action}</b> · 처리자 ${t.handler} · ${t.handledAt}${t.memo ? ` · 메모: ${esc(t.memo)}` : ''}</p>` : ''}
      ${t.deleted ? '<p class="hint">삭제된 대상이라 더 처리할 수 없습니다.</p>' : `<div class="stack" style="border-top:1px solid var(--line);padding-top:14px"><span class="lb">처리 결과</span>
        <div class="g2" style="--min:160px">${[['숨김 유지', '일반 사용자에게 계속 숨김'], ['삭제', '글·댓글을 삭제'], ['반려', '숨김을 풀고 원래대로']].map(([l, d]) => `<label class="opt"><input type="radio" name="repAct" value="${l}" data-bind="rep.act" ${R.act === l ? 'checked' : ''}><span class="stack" style="gap:0"><b style="font-size:13.5px">${l}</b><span class="hint">${d}</span></span></label>`).join('')}</div>
        ${fld('처리 메모', 'rep.memo', { ph: '처리 근거를 남겨 주세요' })}
        <div class="row"><button class="btn btn-p" data-a="repSave">처리 결과 저장</button><button class="btn" data-a="repToAcc" data-x="${t.author}">작성자 계정 보기</button></div></div>`}
    </section>`;
  }
  return adminShell('a-reports', `${head('신고 접수 게시판', `같은 글·댓글에 들어온 신고를 묶어 보여 줍니다. 신고가 ${S.threshold}건 이상 쌓여 자동으로 숨겨진 대상이 먼저 나옵니다.`)}
  <section class="panel" aria-label="필터"><div class="filt5">
    ${sel('상태', 'rep.st', ['전체', '접수', '검토 중', '처리 완료', '반려'])}
    ${sel('사유', 'rep.rs', ['전체', ...REASONS])}
    ${sel('기간', 'rep.pd', ['최근 7일', '최근 30일', '전체'])}
    <div class="fld"><label class="lb" for="${fid('rep.th')}">자동 숨김 기준 (건)</label><div class="row" style="flex-wrap:nowrap;gap:8px"><input class="inp num" id="${fid('rep.th')}" type="number" data-bind="rep.th" data-num min="3" max="10" value="${esc(R.th)}"><button class="btn" data-a="thSave">저장</button></div></div>
    <div class="fld"><span class="lb">미처리</span><div class="inp num" style="display:flex;align-items:center;font-weight:700;background:var(--panel2)">${allTargets().filter(act).length}건</div></div>
  </div></section>
  <div class="cols">
    <section class="panel side" aria-label="신고 목록" style="padding:8px;gap:0">${items.length ? items.map((x) => `<button class="item" data-a="repPick" data-k="${x.key}" aria-pressed="${R.sel === x.key}">
      <span class="row between" style="width:100%;flex-wrap:nowrap"><span style="font-size:14px;font-weight:500">${esc(label(x))}</span>${stc(x.t)}</span>
      <span class="meta num"><span>${x.kind}</span><span>${x.t.rid}</span><span>누적 ${x.t.reports.length}건</span><span>${lastAt(x.t).slice(5)}</span></span></button>`).join('') : '<p class="hint" style="padding:12px">조건에 맞는 신고가 없습니다.</p>'}</section>
    ${det}
  </div>`);
}
A.repPick = (x) => { const R = UI.rep; R.sel = x.k; R.act = '숨김 유지'; R.memo = ''; const tg = getTarget(x.k); if (tg && (tg.t.status || 'open') === 'open') tg.t.status = 'review'; render(); };
A.repSave = () => {
  const R = UI.rep, tg = getTarget(R.sel); if (!tg) return; const t = tg.t, adm = me().id;
  if (R.act === '숨김 유지') { t.hidden = true; t.status = 'done'; }
  else if (R.act === '삭제') { t.hidden = true; t.deleted = true; t.status = 'done'; }
  else { t.hidden = false; t.status = 'reject'; }
  t.action = R.act; t.memo = String(R.memo || '').trim(); t.handler = adm; t.handledAt = now();
  log('INFO', `신고 처리 · ${t.rid} · ${R.act} · 처리자 ${adm}`, 'admin');
  const reporters = [...new Set(t.reports.map((r) => r.by))].filter((id) => userOf(id));
  reporters.forEach((id) => notify(id, `신고하신 ${tg.kind}을 처리했습니다 · ${R.act === '반려' ? '규정 위반이 아니어서 다시 보이게 했습니다' : R.act}`, 'board'));
  if (userOf(t.author) && R.act === '삭제') notify(t.author, `운영 정책 위반으로 내 ${tg.kind}이 삭제되었습니다.`, 'board');
  R.memo = ''; toast(`${t.rid} 처리 결과를 저장했습니다 · ${R.act}`); render();
};
A.repToAcc = (x) => { UI.acc.q = x.x; go('a-accounts'); };
A.thSave = () => { const v = clamp(Math.round(N(UI.rep.th)), 3, 10); S.threshold = v; UI.rep.th = v; log('INFO', `자동 숨김 기준 변경 · ${v}건 · 처리자 ${me().id}`, 'admin'); toast(`자동 숨김 기준을 ${v}건으로 바꿨습니다.`); render(); };

/* ========== admin: logs ========== */
function vALogs() {
  const L = UI.logs; const color = { AUTH: 'var(--vio)', INFO: 'var(--info)', WARN: 'var(--warn)' };
  const sys = S.logs.filter((l) => L.type === 'ALL' || l.type === L.type);
  const q = String(L.q || '').trim(); const aud = S.audit.filter((a) => !q || a.who.includes(q));
  const body = L.tab === 'sys' ? `<section class="panel" aria-labelledby="hSy"><div class="row between"><h2 class="h2" id="hSy">시스템 로그</h2>
      <div class="row" style="gap:6px">${['ALL', 'AUTH', 'INFO', 'WARN'].map((t) => `<button class="chip" data-a="setv" data-p="logs.type" data-v="${t}" aria-pressed="${L.type === t}" style="cursor:pointer;min-height:32px;background:${L.type === t ? 'var(--sel)' : 'transparent'};color:${L.type === t ? 'var(--fg)' : 'var(--mut)'};border-color:${L.type === t ? 'var(--vio)' : 'var(--line2)'}">${t === 'ALL' ? '전체' : t} <span class="num">${t === 'ALL' ? S.logs.length : S.logs.filter((l) => l.type === t).length}</span></button>`).join('')}</div></div>
      <div class="tblw"><table class="tbl"><thead><tr><th>시각</th><th>유형</th><th>내용</th><th>출처</th></tr></thead><tbody>${sys.slice(0, 60).map((l) => `<tr><td class="num" style="color:var(--mut);white-space:nowrap">${l.t}</td><td><span class="chip num" style="color:${color[l.type]};border-color:${color[l.type]}">${l.type}</span></td><td>${esc(l.msg)}</td><td class="num hint">${l.src}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">이 데모에서 로그인, 점수 산출, 신고, 계정 잠금을 하면 여기에 바로 쌓입니다.</p></section>`
    : `<section class="panel" aria-labelledby="hAu"><div class="row between"><h2 class="h2" id="hAu">열람 감사 로그</h2><span class="chip" style="color:var(--warn);border-color:var(--warn)">기록은 고치거나 지울 수 없습니다</span></div>
      <div style="max-width:320px">${fld('열람자 ID', 'logs.q', { live: true, ph: '예: admin_kim' })}</div>
      <div class="tblw"><table class="tbl"><thead><tr><th>열람 시각</th><th>열람자 ID</th><th>대상 회원</th><th>열람 화면</th><th>사유</th></tr></thead><tbody>${aud.map((a) => `<tr><td class="num" style="color:var(--mut);white-space:nowrap">${a.t}</td><td class="num">${a.who}</td><td class="num">${esc(a.target)}</td><td>${a.screen}</td><td>${esc(a.reason)}</td></tr>`).join('') || '<tr><td colspan="5" class="hint">기록이 없습니다.</td></tr>'}</tbody></table></div>
      <p class="hint">계정·권한 관리에서 회원 상세를 열면 사유와 함께 자동으로 남습니다.</p></section>`;
  return adminShell('a-logs', `${head('접근·감사 로그', '시스템 로그는 로그인·배치·오류 기록을, 열람 감사 로그는 관리자가 회원 정보를 열어 본 기록을 보여 줍니다.', segBtns('logs.tab', [['sys', '시스템 로그'], ['audit', '열람 감사 로그']], '로그 종류'))}${body}`);
}

/* ========== router ========== */
const ROUTES = { main: vMain, login: vLogin, stats: vStats, loans: vLoans, loan: vLoan, signup: vSignup, find: vFind, job: vJob, input: vInput, report: vReport, health: vHealth, stress: vStress, cash: vCash, area: vArea, sim: vSim, mypage: vMy, board: vBoard, 'a-model': vAModel, 'a-stats': vAStats, 'a-accounts': vAAcc, 'a-reports': vARep, 'a-logs': vALogs };
const PUBLIC = ['main', 'login', 'signup', 'find'];
const homeOf = (u) => u.role === 'admin' ? 'a-model' : !u.data ? 'job' : !u.history.length ? 'input' : 'report';
const route = () => (location.hash || '').replace('#', '') || 'main';
function resolve(r) {
  if (!ROUTES[r]) r = 'main';
  let u = me();
  if (u && u.locked) { S.session = null; u = null; toast('잠긴 계정이라 로그아웃했습니다.'); }
  if (PUBLIC.includes(r)) { if (u && r === 'login') return homeOf(u); return r; }
  if (!u) { toast('로그인이 필요합니다.'); return 'login'; }
  if (u.role === 'admin') return r.startsWith('a-') ? r : 'a-model';
  if (r.startsWith('a-')) return 'report';
  if (r === 'job' || r === 'board' || r === 'mypage' || r === 'stats' || r === 'loans' || r === 'loan') return r;
  if (r === 'input') return (u.data || UI.input.d) ? r : 'job';
  if (!u.data) return 'job';
  if (!u.history.length) return 'input';
  return r;
}
function render() {
  const r0 = route(), r = resolve(r0);
  if (r !== r0) { location.replace('#' + r); return; }
  const a = document.activeElement; const id = a && a.id; let ss = null, se = null; try { ss = a.selectionStart; se = a.selectionEnd; } catch (e) { /* ignore */ }
  const y = window.scrollY;
  document.documentElement.setAttribute('data-theme', S.theme === 'dark' ? 'dark' : 'light');
  let html = demoBar() + ROUTES[r]() + (UI.consent ? consentModal() : '') + themeFab();
  if (S.theme !== 'dark') html = html.replace(/#[0-9a-fA-F]{6}\b/g, (m) => LIGHT_HEX[m.toLowerCase()] || m);
  $('#app').innerHTML = html;
  decorateCards(r);
  if (r === 'sim' && UI.sim && UI.sim.focus) UI.sim.focus.forEach((k) => { const el = document.getElementById('f_sim_v_' + k); if (el) el.closest('.fld').classList.add('pulse'); });
  if (r === 'area') mountHeat();
  if (UI.lastRoute !== r) { window.scrollTo(0, 0); UI.lastRoute = r; } else window.scrollTo(0, y);
  if (id) { const el = document.getElementById(id); if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch (e) { /* ignore */ } } }
  save();
}
function go(r) { UI.bell = false; if (location.hash === '#' + r) render(); else location.hash = r; }

/* 밝은 테마: 화면 코드에 직접 적힌 어두운 색을 밝은 색으로 바꿔 끼운다 (SVG 차트 등) */
const LIGHT_HEX = { /* 피그마 왼쪽 열 맨 아래 프레임(3909:283) 색 */
  '#00e6a5': '#277b68', '#a78bfa': '#7954d4', '#c4b5fd': '#6a46c4', '#8a9bb4': '#726f67', '#a7b4c6': '#5c5951', '#eaf1fa': '#24221e',
  '#2d3e5c': '#c1bdb3', '#22314b': '#d6d2c8', '#4a5b78': '#aaa69c', '#fbbf24': '#8a6828', '#7c5cf0': '#877e6a', '#b8505a': '#c85061',
  '#2b2650': '#277b68', '#00a77a': '#277b68', '#3b3470': '#40376f', '#5b4bb0': '#9a8fd0', '#1d1838': '#e4dcf7',
  '#5a2a33': '#e3bcc0', '#5b4a1c': '#e6d7a8', '#0f4a3c': '#bde9dc', '#7a3a4f': '#dcb0b5', '#16314a': '#d9e8e2'
};
/* 상권 분석 탭 = 서울 상권 히트맵(별도 문서)을 iframe 으로 붙인다 */
function mountHeat() {
  const f = document.getElementById('heatFrame'); if (!f || f.dataset.on) return;
  const d = me() && me().data; const self = d && d.job === 'self'; const dong = self ? (d.bizDong || '서교동') : '', cat = (self && d.bizCat) || 'cafe';
  const light = S.theme !== 'dark';
  const css = `<style>.wrap>.top{display:none!important}.wrap{padding-top:4px!important}.main{flex-direction:column;align-items:stretch}.mapbox{flex:none!important;width:100%}#map{aspect-ratio:1.9/1}.side{flex:none!important;width:100%;flex-direction:row!important;flex-wrap:wrap;align-items:stretch}.side>section{flex:1 1 250px;min-width:0}${light ? ':root{color-scheme:light;--bg:#f0eee9;--panel:#ebe8de;--panel2:#e4e1d8;--line:#c1bdb3;--line2:#aaa69c;--sel:#dbeee6;--fg:#24221e;--fg2:#38352f;--mut:#5c5951;--mut2:#726f67;--accent:#277b68;--pri:#277b68;--land:#dcd8cc;--river:#a9c6dc;--gu-line:#4a4740}.inp,.btn,.seg{background:#faf9f6!important}.mchip{background:#faf9f6}.mchip[aria-pressed="true"]{background:#bde9dc}.mchip[aria-pressed="true"] span{color:#1b4e43}.tip{background:#faf9f6ee}.tbl tr.me td{background:#dbeee6}.back{background:#2b28204d}#map .gl{fill:#24221e;stroke:#ebe8decc}#map .d:hover,#map .d.hl{stroke:#24221e}.cchip{color:var(--fg2)}.cchip[aria-pressed="true"]{color:#fff}' : ''}</style>`;
  const boot = `<script>(function(){try{var AR=1.9;fitGu=function(name){var x,y,w,h,pad=0;if(name==='전체'){x=0;y=0;w=GEO.w;h=GEO.h;pad=10}else{var g=GEO.gu.find(function(q){return q.n===name});x=g.b[0];y=g.b[1];w=g.b[2];h=g.b[3];pad=30}var W=w+pad*2,H=h+pad*2;if(W/H>AR)H=W/AR;else W=H*AR;setVB([x+w/2-W/2,y+h/2-H/2,W,H])};(0,eval)('labels = '+labels.toString().replace('w < 420','w < 700'));fitGu('전체');S.c=${JSON.stringify(cat)};var d=DONGS.find(function(x){return x.n===${JSON.stringify(dong)}});if(d){S.gu=d.g;document.querySelector('#guSel').value=d.g;renderAll();fitGu(d.g);var el=document.querySelector('#map .d[data-i="'+d.i+'"]');if(el)el.classList.add('hl');var m=document.querySelector('#qMsg');if(m)m.textContent='내 사업장: '+d.g+' '+d.n+' · 동을 누르면 상세가 열립니다';}else{renderAll();}
  var post=function(){parent.postMessage({heatH:document.documentElement.scrollHeight},'*')};post();new ResizeObserver(post).observe(document.body);
  var bk=document.querySelector('#back');new MutationObserver(function(){if(!bk.hidden)parent.postMessage({heatModal:1},'*')}).observe(bk,{attributes:true});}catch(e){}})();<\/script>`;
  f.dataset.on = '1';
  f.srcdoc = HEAT_HTML.replace(/<\/body>\s*<\/html>\s*$/, css + boot + '</body></html>');
}
window.addEventListener('message', (e) => {
  const f = document.getElementById('heatFrame'); if (!f || !e.data) return;
  if (e.data.heatH) f.style.height = Math.max(900, e.data.heatH) + 'px';
  if (e.data.heatModal) { const y = f.getBoundingClientRect().top + window.scrollY - 8; if (window.scrollY > y || window.scrollY < y - 200) window.scrollTo({ top: y, behavior: 'smooth' }); }
});

/* 카드마다 접기·숨기기 (사용자 탭 전체). 숨긴 카드는 마이 페이지 > 화면 설정에서 다시 켠다 */
const CARD_ROUTES = { report: '신용 리포트', health: '자산·부채 건전성', stress: '시나리오 테스트', cash: '현금흐름·소득 변동성', area: '상권 분석', sim: '신용케어 시뮬레이터', stats: '비교 분석' };
/* 탭의 중심 시각화는 접을 수 없게 고정 */
const CARD_FIXED = ['report|hSc', 'report|hShap', 'stats|hGrid', 'stats|hSel', 'stats|hDb', 'health|hHr', 'stress|hSr', 'cash|hCc', 'area|hHeat', 'sim|hSv', 'sim|hSo', 'stats|hSt', 'stats|hDist'];
function decorateCards(r) {
  const u = me(); if (!u || u.role === 'admin' || !CARD_ROUTES[r]) return;
  const P = u.cardPref || (u.cardPref = {});
  document.querySelectorAll('#app .panel').forEach((p) => {
    if (p.closest('.modal') || p.hasAttribute('data-nocard')) return;
    const h = p.querySelector('.h2'); if (!h) return;
    const key = r + '|' + (h.id || h.textContent.trim());
    if (CARD_FIXED.includes(key)) return;
    if (!P[key] || P[key].s === 'hide') P[key] = { s: '', t: h.textContent.trim(), r };
    const title = P[key].t;
    let hd = h; while (hd.parentElement && hd.parentElement !== p) hd = hd.parentElement;
    let head = hd;
    if (!(hd.classList.contains('row') && hd.classList.contains('between'))) {
      const wrap = document.createElement('div'); wrap.className = 'row between';
      const prevTag = hd.previousElementSibling && hd.previousElementSibling.classList.contains('tag') ? hd.previousElementSibling : null;
      p.insertBefore(wrap, prevTag || hd); const left = document.createElement('div');
      if (prevTag) left.appendChild(prevTag); left.appendChild(hd); wrap.appendChild(left); head = wrap;
    }
    head.classList.add('chead');
    const st = P[key].s; const ctl = document.createElement('span'); ctl.className = 'cardctl';
    ctl.innerHTML = `<button type="button" class="cbtn" data-a="cardMin" data-k="${esc(key)}" aria-expanded="${st !== 'min'}" aria-label="${esc(title)} ${st === 'min' ? '펼치기' : '접기'}">${st === 'min' ? '▾ 펼치기' : '▴ 접기'}</button>`;
    head.appendChild(ctl);
    if (st === 'min') p.classList.add('card-min');
  });
}
A.cardMin = (x) => { const c = me().cardPref[x.k]; if (!c) return; c.s = c.s === 'min' ? '' : 'min'; render(); };
A.cardShow = (x) => { const c = me().cardPref[x.k]; if (c) c.s = ''; render(); };
A.cardShowAll = () => { Object.values(me().cardPref || {}).forEach((c) => { c.s = ''; }); toast('접은 카드를 모두 펼쳤습니다.'); render(); };

/* ========== global actions ========== */
A.toggleTheme = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; render(); };
A.setv = (x) => { setP(x.p, x.v); render(); };
A.reset = () => {
  if (!UI.resetAsk) { UI.resetAsk = true; render(); setTimeout(() => { if (UI.resetAsk) { UI.resetAsk = false; render(); } }, 4000); return; }
  S = seed(); UI = freshUI(); save(); toast('처음 상태로 되돌렸습니다.'); go('main');
};
A.bell = () => { UI.bell = !UI.bell; render(); };
A.readAll = () => { (S.notifs[me().id] || []).forEach((n) => { n.read = true; }); render(); };
A.openNotif = (x) => { const n = (S.notifs[me().id] || [])[N(x.i)]; if (!n) return; n.read = true; UI.bell = false; go(n.go || 'report'); };

/* ========== events ========== */
function bindVal(el) {
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num !== undefined && el.type !== 'checkbox') v = v === '' ? '' : Number(v);
  setP(el.dataset.bind, v);
  if (HOOK[el.dataset.bind]) HOOK[el.dataset.bind]();
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) { if (UI.bell && !e.target.closest('.bellp')) { UI.bell = false; render(); } return; }
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault(); if (UI.bell && el.dataset.a !== 'bell' && !el.closest('.bellp')) UI.bell = false;
  fn(el.dataset, el);
});
document.addEventListener('input', (e) => { const el = e.target; if (!el.dataset || !el.dataset.bind || el.type === 'checkbox' || el.type === 'radio') return; bindVal(el); if (el.dataset.live !== undefined && !e.isComposing) render(); });
document.addEventListener('change', (e) => { const el = e.target; if (!el.dataset || !el.dataset.bind) return; bindVal(el); if (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio' || el.dataset.commit !== undefined) render(); });
document.addEventListener('compositionend', (e) => { const el = e.target; if (el.dataset && el.dataset.bind) { bindVal(el); if (el.dataset.live !== undefined) render(); } });
document.addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; const fn = F[f.dataset.f]; if (fn) fn(f); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && UI.bell) { UI.bell = false; render(); } });
window.addEventListener('hashchange', () => { UI.bell = false; render(); });
render();
</script>
