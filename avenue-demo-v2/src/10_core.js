<script>
'use strict';
/* ========== utils ========== */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = (x) => Number(x) || 0;
const fmt = (n) => Math.round(N(n)).toLocaleString('ko-KR');
const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(Math.round(n)).toLocaleString('ko-KR');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (a) => a.reduce((x, y) => x + N(y), 0);
const clone = (o) => JSON.parse(JSON.stringify(o));
const pad = (n) => String(n).padStart(2, '0');
const now = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const nowS = () => { const d = new Date(); return now() + ':' + pad(d.getSeconds()); };
const code6 = () => String(Math.floor(100000 + Math.random() * 900000));
const maskId = (id) => String(id).slice(0, 2) + '***' + (String(id).length > 6 ? String(id).slice(-2) : '');
const maskName = (n) => !n ? '—' : n.length <= 1 ? n : n.length === 2 ? n[0] + '*' : n[0] + '*'.repeat(n.length - 2) + n[n.length - 1];
const maskMail = (m) => { if (!m) return '—'; const [a, b] = m.split('@'); return a.slice(0, 2) + '***@' + (b || ''); };
const maskPhone = (p) => p ? p.replace(/^(\d{3})-(\d{4})-(\d{4})$/, '$1-****-$3') : '등록 안 됨';
const okMail = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m || '');
const okPw = (p) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p || '');
const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const MONTHS = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const JOBS = { salary: '급여소득자', self: '자영업자', free: '프리랜서' };
const TENURE = { salary: '현 직장 재직 기간', self: '사업 운영 기간', free: '프리랜서 활동 기간' };
const REASONS = ['욕설·비방', '광고·스팸', '개인정보 노출', '허위 정보', '기타'];
const BELL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

/* ========== sample data ========== */
function sample(job) {
  const base = { job, alt: { easy: true, telco: true, pension: true, health: true }, dq: 0, cash: 0, newl: 0, lender: 0 };
  if (job === 'free') return { ...base, bizYears: 2.5, salary: '', months: [520, 180, 610, 240, 90, 700, 450, 300, 660, 210, 380, 560], asset: 3000,
    loans: [{ type: '신용대출', amt: 1200, rate: 6.9, kind: '고정', months: 24, pay: 55 }], living: 140,
    fixed: [{ type: '할부', name: '노트북 할부금', amt: 12 }, { type: '정기결제', name: '디자인 툴 구독', amt: 4 }],
    limit: 500, use: 210, newl: 1, easyCnt: 52, telcoM: 30, pensionMiss: 2, healthMiss: 0 };
  if (job === 'salary') return { ...base, bizYears: 4, salary: 310, months: Array(12).fill(''), asset: 5000,
    loans: [{ type: '신용대출', amt: 1500, rate: 5.4, kind: '변동', months: 36, pay: 46 }], living: 150,
    fixed: [{ type: '정기결제', name: '음악·영상 구독', amt: 3 }], limit: 1000, use: 420, easyCnt: 30, telcoM: 36, pensionMiss: 0, healthMiss: 0 };
  return { ...base, bizYears: 3.4, salary: '', months: [380, 450, 290, 260, 340, 360, 410, 430, 470, 455, 360, 330], asset: 8000,
    loans: [{ type: '사업자 운전자금', amt: 3000, rate: 5.8, kind: '변동', months: 28, pay: 121 }, { type: '신용대출', amt: 800, rate: 7.2, kind: '고정', months: 14, pay: 62 }],
    living: 160, fixed: [{ type: '할부', name: '휴대폰 할부금', amt: 7 }, { type: '정기결제', name: '음악·영상 구독', amt: 3 }],
    limit: 800, use: 544, cash: 2, easyCnt: 38, telcoM: 24, pensionMiss: 1, healthMiss: 0 };
}
function blank(job) {
  return { job, bizYears: '', salary: '', months: Array(12).fill(''), asset: '', loans: [], living: '', fixed: [], limit: '', use: '', dq: 0, cash: 0, newl: 0, lender: 0,
    alt: { easy: false, telco: false, pension: false, health: false }, easyCnt: 0, telcoM: 0, pensionMiss: 0, healthMiss: 0 };
}
function norm(d) {
  const o = clone(d);
  ['bizYears', 'salary', 'asset', 'living', 'limit', 'use', 'dq', 'cash', 'newl', 'lender', 'easyCnt', 'telcoM', 'pensionMiss', 'healthMiss'].forEach((k) => { o[k] = N(o[k]); });
  o.months = o.months.map(N);
  if (o.job === 'salary') o.months = Array(12).fill(o.salary);
  o.loans = o.loans.map((l) => ({ ...l, amt: N(l.amt), rate: N(l.rate), months: N(l.months), pay: N(l.pay) }));
  o.fixed = o.fixed.map((x) => ({ ...x, amt: N(x.amt) }));
  return o;
}

/* ========== scoring engine (example model, not final) ========== */
const annual = (d) => d.job === 'salary' ? N(d.salary) * 12 : sum(d.months);
const debtOf = (d) => sum(d.loans.map((l) => l.amt));
const payOf = (d) => sum(d.loans.map((l) => l.pay));
const fixedOf = (d) => sum(d.fixed.map((x) => x.amt));
function cvOf(d) {
  if (d.job === 'salary') return 0;
  const m = d.months.map(N); const avg = sum(m) / m.length;
  if (avg <= 0) return 1;
  return Math.sqrt(sum(m.map((x) => (x - avg) ** 2)) / m.length) / avg;
}
function factors(d) {
  const f = [];
  const add = (label, v, kind) => { v = Math.round(v); if (v !== 0) f.push({ label, v, kind }); };
  const util = N(d.limit) > 0 ? N(d.use) / N(d.limit) : (N(d.use) > 0 ? 1 : 0);
  add(`카드 사용 비율 ${Math.round(util * 100)}%`, clamp(20 - util * 53, -40, 20), 'model');
  const debt = debtOf(d);
  add(`${d.loans.some((l) => String(l.type).includes('사업자')) ? '사업자 ' : ''}대출 잔액 ${fmt(debt)}만원`, clamp(8 - debt / 200, -40, 8), 'model');
  add(`최근 1년 연체 ${N(d.dq)}회`, -14 * N(d.dq), 'model');
  const nl = d.loans.length; add(`보유 대출 ${nl}건`, -2 * Math.max(0, nl - 1), 'model');
  add(`${{ salary: '재직 기간', self: '사업 운영 기간', free: '프리랜서 활동 기간' }[d.job] || '근속 기간'} ${N(d.bizYears)}년`, Math.min(10, N(d.bizYears) * 1.8), 'model');
  add(`연소득 ${fmt(annual(d))}만원`, clamp((annual(d) - 3500) / 250, -10, 10), 'model');
  add(`현금서비스 이용 ${N(d.cash)}개월`, 5 - 2.5 * N(d.cash), 'model');
  add(`최근 3개월 신규 대출 ${N(d.newl)}건`, -6 * N(d.newl), 'model');
  if (N(d.lender) > 0) add('대부업 대출 이용', -(25 + N(d.lender) / 500), 'model');
  const a = d.alt || {};
  const cover = ['easy', 'telco', 'pension', 'health'].filter((k) => a[k]).length;
  add(`대안 데이터 ${cover}/4종 반영`, cover * 12.5, 'alt');
  if (a.telco) add(`통신비 성실 납부 ${N(d.telcoM)}개월`, 28 * Math.min(N(d.telcoM), 36) / 24, 'alt');
  if (a.easy) add('간편결제 꾸준한 이용', 0.5 * Math.min(N(d.easyCnt), 60), 'alt');
  if (a.health) add(N(d.healthMiss) ? `건강보험료 미납 ${N(d.healthMiss)}회` : '건강보험료 납부 지속', 14 - 7 * N(d.healthMiss), 'alt');
  if (a.pension) add(N(d.pensionMiss) ? `국민연금 미납 ${N(d.pensionMiss)}회` : '국민연금 꾸준한 납부', 6 - 6 * N(d.pensionMiss), 'alt');
  const cv = cvOf(d);
  add(cv > 0.12 ? '월별 소득 변동이 큼' : '소득이 꾸준함', 10 - cv * 188, 'alt');
  return f;
}
function scoreOf(d) {
  const f = factors(d);
  const model = sum(f.filter((x) => x.kind === 'model').map((x) => x.v));
  const alt = sum(f.filter((x) => x.kind === 'alt').map((x) => x.v));
  const T = clamp(639 + model, 300, 900), A = clamp(639 + model + alt, 300, 900);
  return { T, A, f, model, alt };
}
const gradeOf = (s) => s >= 780 ? 'Good' : s >= 665 ? 'Standard' : 'Caution';
const GC = { Good: 'var(--mint)', Standard: 'var(--warn)', Caution: 'var(--bad)' };
const gchip = (s) => { const g = gradeOf(s); return `<span class="chip" style="color:${GC[g]};border-color:${GC[g]}">${g}</span>`; };
const rateOf = (s) => clamp(16.5 - (s - 600) * 0.045, 4.9, 17.9);
const limitOf = (s) => Math.max(300, Math.round((s - 550) * 12 / 10) * 10);
/* 대출 상품 카탈로그 (전부 예시 · 실제 상품 아님). min = 대안 점수 기준 */
const LOANS = [
  { id: 'L01', d: '매출 흐름이 꾸준한 자영업자에게 우대 금리로 사업 자금을 빌려 주는 상품입니다.', n: '든든 사업자 우대 대출', p: '에비뉴은행(예시)', t: '사업 운영 1년 이상 자영업자', jobs: ['self'], rt: [4.9, 6.1], lm: 5000, term: '1~5년', way: '원리금균등', min: 780, feats: ['대안 점수 Good 등급 우대 금리', '중도상환수수료 면제(1년 후)', '매출 증빙으로 한도 산정'], docs: ['사업자등록증', '최근 6개월 매출 내역'] },
  { id: 'L02', d: '한도 안에서 필요할 때 꺼내 쓰고, 쓴 금액에만 이자가 붙는 통장형 대출입니다.', n: '새싹 마이너스통장', p: '새싹저축은행(예시)', t: '근속·운영 3년 이상', jobs: ['salary', 'self', 'free'], rt: [5.4, 6.8], lm: 3000, term: '1년(연장 가능)', way: '만기일시', min: 780, feats: ['쓴 만큼만 이자', '1년 단위 자동 연장'], docs: ['재직·사업 증빙', '소득 증빙'] },
  { id: 'L03', d: '급여가 들어오는 통장을 연결하면 금리를 깎아 주는 직장인 신용대출입니다.', n: '직장인 급여 연계 대출', p: '에비뉴은행(예시)', t: '재직 1년 이상 급여소득자', jobs: ['salary'], rt: [5.9, 7.8], lm: 4000, term: '1~5년', way: '원리금균등', min: 700, feats: ['급여 이체 시 금리 0.3%p 할인', '모바일로 바로 신청'], docs: ['재직증명서', '급여 이체 내역'] },
  { id: 'L04', d: '재료비·임대료처럼 가게 운영에 바로 드는 돈을 빌려 주는 소상공인 운전자금입니다.', n: '에비뉴 운전자금', p: '에비뉴은행(예시)', t: '소상공인', jobs: ['self'], rt: [6.8, 8.9], lm: 2500, term: '1~3년', way: '원리금균등', min: 665, feats: ['상권 분석 결과를 심사에 참고', '분할 상환 유예 3개월'], docs: ['사업자등록증', '부가세 신고 내역'] },
  { id: 'L05', d: '금융 이력이 짧아도 대안 신용점수로 심사해 주는 정책 연계 대출입니다.', n: '징검다리 정책연계 대출', p: '서민금융 연계(예시)', t: '대안 점수 Standard 이상', jobs: ['salary', 'self', 'free'], rt: [7.5, 9.0], lm: 2000, term: '1~5년', way: '원리금균등', min: 665, feats: ['금융 이력이 짧아도 대안 점수로 심사', '성실 상환 시 금리 인하'], docs: ['소득 증빙', '대안 데이터 연동 동의'] },
  { id: 'L06', d: '달마다 소득이 들쭉날쭉한 프리랜서를 위해 비수기 상환 부담을 줄여 주는 대출입니다.', n: '프리랜서 소득 안정 대출', p: '새싹저축은행(예시)', t: '활동 1년 이상 프리랜서', jobs: ['free'], rt: [7.9, 10.4], lm: 1200, term: '1~3년', way: '원리금균등', min: 665, feats: ['비수기 3개월 이자만 납부 가능', '계약서로 소득 인정'], docs: ['용역 계약서', '최근 12개월 입금 내역'] },
  { id: 'L07', d: '중신용 고객을 위한 금리 상한형 신용대출입니다.', n: '새싹 중금리 신용대출', p: '새싹저축은행(예시)', t: '중신용 고객', jobs: ['salary', 'self', 'free'], rt: [8.4, 11.2], lm: 1500, term: '1~5년', way: '원리금균등', min: 665, feats: ['중신용 대상 금리 상한 운영'], docs: ['신분 확인', '소득 증빙'] },
  { id: 'L08', d: '처음 대출을 받는 사람을 위한 소액 정책 대출입니다.', n: '징검다리 소액 정책대출', p: '서민금융 연계(예시)', t: '금융 이력 부족 고객', jobs: ['salary', 'self', 'free'], rt: [9.5, 12.0], lm: 1000, term: '1~3년', way: '원리금균등', min: 0, feats: ['첫 대출 고객 대상', '상환 교육 이수 시 금리 인하'], docs: ['신분 확인', '소득 증빙'] },
  { id: 'L09', d: '신용을 회복하는 중인 사람을 위한 소액·단기 대출입니다.', n: '새싹 소액 신용대출', p: '새싹저축은행(예시)', t: '신용 회복 중인 고객', jobs: ['salary', 'self', 'free'], rt: [11.9, 15.9], lm: 500, term: '1년', way: '원리금균등', min: 0, feats: ['소액·단기', '연체 없이 6개월 상환 시 한도 상향'], docs: ['신분 확인'] }
];
const loanOf = (id) => LOANS.find((l) => l.id === id);
const PROV = { '에비뉴은행(예시)': ['#2f6f5e', 'AV'], '새싹저축은행(예시)': ['#b8742a', '새싹'], '서민금융 연계(예시)': ['#3a5a9a', '서민'] };
const provOf = (l) => PROV[l.p] || ['#5c5951', l.p[0]];
const rateTxt = (l) => `연 ${l.rt[0].toFixed(1)}~${l.rt[1].toFixed(1)}%`;
function productsOf(s, job) { return LOANS.filter((l) => l.min <= s && (!job || l.jobs.includes(job))).sort((a, b) => b.min - a.min || a.rt[0] - b.rt[0]).slice(0, 3); }
const PEER = { self: 676, free: 668, salary: 702 };

/* ========== seed state ========== */
function seed() {
  const hist = [['2026-10-30 14:12', 620, 709], ['2026-09-29 09:40', 608, 694], ['2026-08-31 21:03', 604, 688], ['2026-07-30 18:55', 601, 671], ['2026-06-28 11:20', 598, 662]];
  const NICK = { seoyun: '서교동바리스타', admin_kim: '운영자', admin_lee: '운영자2', ki_minsu: '프리한개발', le_sujin: '월급쟁이', ch_hoyoung: '카페사장', ju_ara: '디자인아라', ne_jiwon01: '지원이', op_jin33: '점수요정', an_hyuk88: '혁이', spam_9921: '대출상담' };
  const u = (id, name, extra) => ({ id, nick: NICK[id] || id, pw: 'demo1234', name, email: id.replace(/_/g, '.') + '@example.com', phone: '', role: 'user', birth: 1990, joined: '2026-07-01', last: '2026-11-01 10:00', locked: false, fails: 0, data: null, history: [], cards: [true, true, true, true, true, true], ...extra });
  const rp = (n, reason, at, pre = 'rp') => Array.from({ length: n }, (_, i) => ({ by: pre + '_' + (i + 11), reason: Array.isArray(reason) ? reason[i] : reason, at }));
  return {
    v: 1, seq: 200, threshold: 5, session: null, theme: 'light', cfg: {}, repDaily: 3, social: { seoyun: ['naver'] },
    users: [
      u('seoyun', '박서윤', { email: 'seoyun.park@example.com', phone: '010-2481-5678', birth: 1992, joined: '2026-06-28', last: '2026-10-30 14:10', data: sample('self'), history: hist.map(([at, T, A]) => ({ at, T, A, job: 'self' })) }),
      u('admin_kim', '김지훈', { pw: 'admin1234', role: 'admin', email: 'jihoon.kim@avenue.example', joined: '2026-06-01', last: '2026-11-03 09:02' }),
      u('admin_lee', '이도현', { pw: 'admin1234', role: 'admin', email: 'dohyun.lee@avenue.example', joined: '2026-06-01', last: '2026-11-02 18:24' }),
      u('ki_minsu', '김민수', { job: 'free', lastA: 684, lastT: 611, joined: '2026-07-14' }),
      u('le_sujin', '이수진', { job: 'salary', lastA: 731, lastT: 690, joined: '2026-07-20' }),
      u('ch_hoyoung', '최호영', { job: 'self', lastA: 655, lastT: 596, joined: '2026-08-02' }),
      u('ju_ara', '정아라', { job: 'free', lastA: 698, lastT: 640, joined: '2026-08-19' }),
      u('ne_jiwon01', '남지원', { job: 'salary', lastA: 702, lastT: 671, joined: '2026-09-05' }),
      u('op_jin33', '오진', { job: 'salary', lastA: 0, lastT: 0, joined: '2026-10-21' }),
      u('an_hyuk88', '안혁', { job: 'self', lastA: 0, lastT: 0, joined: '2026-10-11' }),
      u('spam_9921', '미확인', { locked: true, fails: 5, joined: '2026-10-30', last: '2026-11-03 21:12' })
    ],
    posts: [
      { id: 8, title: '여기 가입만 하면 누구나 점수 50점 오릅니다', body: '여기 가입만 하면 누구나 점수가 50점 이상 올라갑니다.\n저는 하루 만에 올랐어요. 지금 바로 가입하세요.', author: 'op_jin33', nick: 'op***33', at: '2026-11-02 08:15', comments: [], reports: rp(4, '허위 정보', '2026-11-02 12:30'), rid: 'R-1031', status: 'open', hidden: false },
      { id: 7, title: '"고수익 보장" 당일 대출 상담해 드립니다', body: '신용 상관없이 당일 대출 가능합니다.\n상담은 아래 메신저로 연락 주세요.', author: 'spam_9921', nick: 'sp***21', at: '2026-10-31 22:10', comments: [], reports: rp(7, ['광고·스팸', '광고·스팸', '광고·스팸', '광고·스팸', '광고·스팸', '광고·스팸', '허위 정보'], '2026-10-31 23:40'), rid: 'R-1029', status: 'open', hidden: true, autoAt: '2026-10-31 23:02' },
      { id: 6, title: '통신비 자동이체 등록하고 대안 점수가 올랐어요', body: '통신비를 자동이체로 바꾸고 2년 동안 한 번도 안 밀렸더니 대안 점수에 반영이 되네요.\n기존 점수는 그대로인데 대안 점수는 30점 가까이 올랐습니다.', author: 'ch_hoyoung', nick: '카페사장**', at: '2026-10-29 10:12',
        comments: [{ id: 601, author: 'ju_ara', nick: '디자인**', body: '저도 자동이체 걸어 두니 마음이 편하더라고요.', at: '2026-10-29 11:02', reports: [] }, { id: 602, author: 'le_sujin', nick: '월급쟁이**', body: '간편결제 내역도 꼭 불러오세요. 같이 반영돼요.', at: '2026-10-29 13:40', reports: [] }], reports: [] },
      { id: 5, title: '내 대출 계좌번호 공유합니다', body: '이 계좌로 이체하는 게 맞는지 봐 주세요.\n국민 1234-56-****', author: 'ne_jiwon01', nick: 'ne***01', at: '2026-10-29 13:44', comments: [], reports: rp(2, '개인정보 노출', '2026-10-29 15:10'), rid: 'R-1025', status: 'open', hidden: false },
      { id: 4, title: '프리랜서 소득 변동성, 비수기 대비 어떻게 하세요?', body: '여름에는 일이 몰리고 겨울에는 거의 없어서 소득 변동이 크게 잡혀요.\n비수기 대비로 따로 모아 두시는 분 계신가요?', author: 'ki_minsu', nick: '프리한개발**', at: '2026-10-28 21:30',
        comments: [{ id: 401, author: 'ju_ara', nick: '디자인**', body: '저는 성수기 수입의 30%를 따로 떼어 둬요.', at: '2026-10-28 22:05', reports: [] }], reports: [] },
      { id: 3, title: 'DSR 40% 넘으면 대출이 어렵나요?', body: '상환 부담률이 42%로 나왔는데, 이 정도면 추가 대출이 힘든 건지 궁금합니다.', author: 'le_sujin', nick: '월급쟁이**', at: '2026-10-26 09:20',
        comments: [{ id: 301, author: 'an_hyuk88', nick: 'an***88', body: '너 같은 사람이 연체하는 거지. 남 탓 그만해라.', at: '2026-10-30 19:02', reports: rp(5, '욕설·비방', '2026-10-30 20:15', 'cm'), rid: 'R-1027', status: 'open', hidden: true, autoAt: '2026-10-30 20:15' },
          { id: 302, author: 'ch_hoyoung', nick: '카페사장**', body: '40%가 은행에서 보는 기준이라 넘으면 한도가 줄어드는 경우가 많아요.', at: '2026-10-26 10:11', reports: [] }], reports: [] },
      { id: 2, title: '상권 분석에서 폐업률 보는 법 정리', body: '폐업률이 3.5%를 넘는 동네는 경쟁이 심하다는 뜻이라, 매출 추이랑 같이 보시는 걸 추천해요.', author: 'ch_hoyoung', nick: '카페사장**', at: '2026-10-25 16:44', comments: [], reports: [] },
      { id: 1, title: '국민연금 미납 한 번이 점수에 영향 있나요?', body: '작년에 한 달 밀린 적이 있는데 대안 점수에서 빠지는지 궁금합니다.', author: 'ju_ara', nick: '디자인**', at: '2026-10-24 12:03',
        comments: [{ id: 101, author: 'ki_minsu', nick: '프리한개발**', body: '다시 꾸준히 내면 대안 점수에 다시 반영된다고 나오더라고요.', at: '2026-10-24 13:30', reports: [] }], reports: [] }
    ].concat([
      ['카드 한도 올리면 사용 비율이 내려가나요?', 'le_sujin', '월급쟁**', '2026-10-23 09:14'], ['건강보험료 자동이체 바꾸는 법 공유', 'ch_hoyoung', '카페사장**', '2026-10-22 18:40'],
      ['자영업 2년 차인데 사업자 대출 어떻게 준비하세요?', 'an_hyuk88', 'an***88', '2026-10-21 12:02'], ['프리랜서 세금 신고 시즌 현금흐름 팁', 'ki_minsu', '프리한개발**', '2026-10-20 22:31'],
      ['대안 점수랑 기존 점수 차이가 너무 커요', 'ju_ara', '디자인**', '2026-10-19 08:55'], ['간편결제 이용 건수도 점수에 들어가나요?', 'le_sujin', '월급쟁**', '2026-10-18 15:20'],
      ['스트레스 테스트에서 소득 −20% 넣어 봤어요', 'ch_hoyoung', '카페사장**', '2026-10-17 21:44'], ['연체 1회 기록 언제 사라지나요?', 'ne_jiwon01', 'ne***01', '2026-10-16 10:08'],
      ['상권 히트맵에서 우리 동네 폐업률 확인했어요', 'ch_hoyoung', '카페사장**', '2026-10-15 13:26'], ['통신비 24개월 채우니 +28점', 'ju_ara', '디자인**', '2026-10-14 19:03'],
      ['현금서비스 한 번 쓴 것도 오래 남나요?', 'an_hyuk88', 'an***88', '2026-10-13 07:47'], ['마이너스통장 잔액도 대출로 잡히나요?', 'ki_minsu', '프리한개발**', '2026-10-12 16:15'],
      ['가입 첫 주 후기', 'le_sujin', '월급쟁**', '2026-10-11 11:30']
    ].map(([title, author, nick, at], i) => ({ id: 21 + i, title, body: title + '\n\n(시연용 예시 글입니다.)', author, nick, at, comments: [], reports: [] }))).sort((a, b) => (a.at < b.at ? 1 : -1)).map((p) => { p.nick = NICK[p.author] || p.nick; p.comments.forEach((c) => { c.nick = NICK[c.author] || c.nick; }); return p; }),
    logs: [
      ['2026-11-03 21:12:05', 'WARN', '사용자 spam_9921 로그인 5회 실패 · 계정 잠금', 'auth-service'],
      ['2026-11-03 09:02:44', 'AUTH', '관리자 admin_kim 로그인 · 2단계 인증 통과', 'auth-service'],
      ['2026-11-03 03:00:44', 'INFO', '야간 배치 점수 산출 완료 · 12,000명 · 4분 12초', 'scoring-batch'],
      ['2026-11-03 02:00:03', 'INFO', '상권 데이터 갱신 완료', 'etl'],
      ['2026-11-02 18:24:50', 'AUTH', '관리자 admin_lee 로그아웃', 'auth-service'],
      ['2026-11-02 16:03:17', 'WARN', '점수 산출 API 응답 지연 · 2.8초', 'scoring-api'],
      ['2026-10-31 23:02:11', 'WARN', '게시글 자동 숨김 · 신고 누적 5건 (R-1029)', 'board'],
      ['2026-10-30 20:15:40', 'WARN', '댓글 자동 숨김 · 신고 누적 5건 (R-1027)', 'board']
    ].map(([t, type, msg, src]) => ({ t, type, msg, src })),
    audit: [
      ['2026-11-02 17:51:09', 'admin_lee', '김*수 (ki***su)', '신용 리포트', '점수 이의 문의 응대'],
      ['2026-11-02 11:06:44', 'admin_lee', '이*진 (le***in)', '회원 상세', '탈퇴 요청 본인 확인'],
      ['2026-11-01 15:30:18', 'admin_kim', '최*영 (ch***ng)', '신용 리포트', '모형 검증용 표본 점검'],
      ['2026-10-31 10:12:55', 'admin_kim', '남*원 (ne***01)', '회원 상세', '개인정보 노출 신고 확인']
    ].map(([t, who, target, screen, reason]) => ({ t, who, target, screen, reason })),
    notifs: { seoyun: [
      { text: '새 점수가 나왔습니다 · 대안 709점 (Standard)', at: '2026-10-30 14:12', read: false, go: 'report' },
      { text: '게시판에 새 글: 통신비 자동이체 등록하고 대안 점수가 올랐어요', at: '2026-10-29 10:12', read: true, go: 'board' }
    ] }
  };
}

/* ========== store ========== */
const KEY = 'avenue-demo-v2b';
function load() { try { const t = localStorage.getItem(KEY); if (t) { const o = JSON.parse(t); if (o && o.v === 1) { o.theme = o.theme || 'light'; o.cfg = o.cfg || {}; o.social = o.social || {}; return o; } } } catch (e) { /* ignore */ } return seed(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
function freshUI() {
  return {
    bell: false, resetAsk: false, lastRoute: null,
    login: { id: '', pw: '', err: '' }, tfa: null, social: null,
    signup: { f: { id: '', pw: '', pw2: '', name: '', nick: '', birth: '', email: '', code: '', t1: false, t2: false, t3: false, tAll: false }, dup: null, sent: false, code: '', verified: false, codeErr: '', errs: {} },
    find: { tab: 'id', id: { f: { name: '', email: '', code: '' }, sent: false, code: '', verified: false, codeErr: '', err: '', result: null }, pw: { idOk: null, f: { id: '', name: '', email: '', code: '', pw: '', pw2: '' }, sent: false, code: '', verified: false, codeErr: '', err: '', errs: {} } },
    guest: { job: 'self', age: '30대', income: 4500, debt: 3800, util: 68, telco: 24, dq: 0, easy: true, health: true, pension: false },
    job: null, input: { d: null, dl: { type: '신용대출', amt: '', rate: '', kind: '고정', months: '', pay: '' }, dx: { type: '정기결제', name: '', amt: '' }, errs: [] },
    loans: { f: 'all', sel: null }, consent: null, cmp: { view: 'grid', metric: 'A', sel: null },
    report: { alert: true, easy: false, qi: -1, left: 10, q: '', ans: '' }, help: false,
    health: null, stress: { rate: 0, inc: -20, exp: 0, preset: 'inc' }, cash: null, area: { dong: '서교동', metric: 'sales' }, sim: null,
    my: { masked: true, askPw: false, pw: '', pwErr: '', mail: null, pwc: null, bye: null },
    board: { sel: null, q: '', mode: 'view', rep: null, cmt: '', w: { title: '', body: '' }, delAsk: null, wErr: '' },
    model: { group: '전체', cut: 650 }, stats: { dim: 'job' },
    acc: { q: '', role: 'all', st: 'all', reasonFor: null, reason: '신고 처리 중 작성자 확인', detail: null, nw: { id: '', name: '', email: '' }, nwErr: '', nwDone: null },
    rep: { st: '전체', rs: '전체', pd: '최근 7일', sel: null, act: '숨김 유지', memo: '', th: null, saved: '' },
    logs: { tab: 'sys', type: 'ALL', q: '' }
  };
}
let S = load();
let UI = freshUI();
const me = () => S.session ? S.users.find((x) => x.id === S.session.uid) || null : null;
const userOf = (id) => S.users.find((x) => x.id === id);
function log(type, msg, src) { S.logs.unshift({ t: nowS(), type, msg, src }); }
function audit(who, target, screen, reason) { S.audit.unshift({ t: nowS(), who, target, screen, reason }); }
function notify(uid, text, go) { (S.notifs[uid] = S.notifs[uid] || []).unshift({ text, at: now(), read: false, go }); }
let toastTimer = null;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200); }

/* ========== binding helpers ========== */
const gp = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), UI);
function setP(p, v) { const ks = p.split('.'); let o = UI; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
const fid = (p) => 'f_' + p.replace(/[^A-Za-z0-9]/g, '_');
function fld(label, p, o = {}) {
  const id = fid(p), v = gp(p);
  const attrs = [o.num ? 'data-num inputmode="decimal"' : '', o.live ? 'data-live' : '', o.ph ? `placeholder="${esc(o.ph)}"` : '', o.min != null ? `min="${o.min}"` : '', o.max != null ? `max="${o.max}"` : '', o.step != null ? `step="${o.step}"` : '', o.auto ? `autocomplete="${o.auto}"` : '', o.err ? 'aria-invalid="true"' : '', o.dis ? 'disabled' : ''].join(' ');
  const input = o.area ? `<textarea class="inp" id="${id}" data-bind="${p}" ${attrs}>${esc(v ?? '')}</textarea>`
    : `<input class="inp${o.num ? ' num' : ''}" id="${id}" type="${o.type || (o.num ? 'number' : 'text')}" data-bind="${p}" value="${esc(v ?? '')}" ${attrs}>`;
  const after = o.err ? `<span class="err" role="alert">${o.err}</span>` : o.ok ? `<span class="hint okt">${o.ok}</span>` : o.hint ? `<span class="hint">${o.hint}</span>` : '';
  return `<div class="fld"${o.style ? ` style="${o.style}"` : ''}><label class="lb" for="${id}"><span>${label}</span>${o.unit ? `<span>${o.unit}</span>` : ''}</label>${o.btn ? `<div class="row" style="flex-wrap:nowrap;gap:8px">${input}${o.btn}</div>` : input}${after}</div>`;
}
function sel(label, p, opts, o = {}) {
  const id = fid(p), v = gp(p);
  return `<div class="fld"${o.style ? ` style="${o.style}"` : ''}><label class="lb" for="${id}">${label}</label><select class="inp" id="${id}" data-bind="${p}" ${o.num ? 'data-num' : ''} data-live>${opts.map((x) => { const [val, lab] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select></div>`;
}
function range(label, p, min, max, step, text, o = {}) {
  const id = fid(p);
  return `<div class="fld"><label class="lb" for="${id}"><span>${label}</span><b class="num" style="color:var(--fg)">${text}</b></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${esc(gp(p))}" data-bind="${p}" data-num data-live>${o.ends ? `<span class="hint row between"><span>${o.ends[0]}</span><span>${o.ends[1]}</span></span>` : ''}</div>`;
}
const chk = (label, p) => `<label class="check"><input type="checkbox" id="${fid(p)}" data-bind="${p}" ${gp(p) ? 'checked' : ''}><span>${label}</span></label>`;
const segBtns = (p, opts, label) => `<div class="seg" role="group" aria-label="${esc(label)}">${opts.map((x) => { const [val, lab] = Array.isArray(x) ? x : [x, x]; return `<button type="button" data-a="setv" data-p="${p}" data-v="${esc(val)}" aria-pressed="${String(gp(p)) === String(val)}">${esc(lab)}</button>`; }).join('')}</div>`;
const sw = (label, on, act, extra = '') => `<button type="button" class="sw" data-a="${act}" ${extra} aria-pressed="${!!on}"><i aria-hidden="true"></i><span>${label}</span></button>`;
const HOOK = {
  'signup.f.tAll': () => { const f = UI.signup.f; f.t1 = f.t2 = f.t3 = f.tAll; },
  'signup.f.t1': () => { const f = UI.signup.f; f.tAll = f.t1 && f.t2 && f.t3; }, 'signup.f.t2': () => HOOK['signup.f.t1'](), 'signup.f.t3': () => HOOK['signup.f.t1'](),
  'rep.th': () => {},
  'stress.rate': () => { UI.stress.preset = ''; }, 'stress.inc': () => { UI.stress.preset = ''; }, 'stress.exp': () => { UI.stress.preset = ''; }
};

/* ========== shells ========== */
function demoBar() {
  return `<div class="demo"><div class="demo-in"><span><b>시연용 데모</b> · 모든 숫자는 예시이며, 입력한 내용은 이 브라우저에만 저장됩니다.</span>
  <span class="row" style="gap:8px"><span>사용자 <b class="num">seoyun / demo1234</b> · 관리자 <b class="num">admin_kim / admin1234</b></span>
  <button class="btn btn-s" data-a="reset" style="min-height:30px">${UI.resetAsk ? '한 번 더 누르면 처음 상태로 돌아갑니다' : '처음 상태로 되돌리기'}</button></span></div></div>`;
}
const themeBtn = () => '';
const themeFab = () => `<button class="themefab" data-a="toggleTheme" aria-label="화면 테마 바꾸기, 지금 ${S.theme === 'dark' ? '블랙' : '기본(화이트)'}">${S.theme === 'dark' ? '☾ 블랙' : '☀ 화이트'}</button>`;
const brandUser = () => `<a class="brand" href="#main"><span class="logo">AV</span><span><b>Avenue</b><small>ALTERNATIVE CREDIT</small></span></a>`;
function bellPanel(ns) {
  return `<div class="bellp" role="dialog" aria-label="알림"><div class="row between" style="padding:6px 8px"><b style="font-size:13px">알림</b>${ns.some((n) => !n.read) ? '<button class="linkbtn" data-a="readAll">모두 읽음</button>' : ''}</div>
  ${ns.length ? ns.slice(0, 8).map((n, i) => `<button class="item" data-a="openNotif" data-i="${i}" style="padding:10px 8px"><span style="font-size:13px;color:${n.read ? 'var(--mut)' : 'var(--fg)'}">${n.read ? '' : '<span style="color:var(--mint)">● </span>'}${esc(n.text)}</span><span class="hint num">${n.at}</span></button>`).join('') : '<p class="hint" style="padding:8px">새 알림이 없습니다.</p>'}</div>`;
}
function userShell(active, body) {
  const u = me(); const ns = S.notifs[u.id] || []; const unread = ns.filter((n) => !n.read).length;
  const cur = active === 'loan' ? 'loans' : active;
  /* 11/06: '직군별 재무 진단' 묶음을 없애고 안의 4개 기능을 주 메뉴로 올림 */
  const tabs = [['report', '신용 리포트'], ['health', '자산·부채 건전성'], ['stress', '시나리오 테스트'], ['cash', '현금흐름·소득 변동성'], ['area', '상권 분석'], ['sim', '신용케어 시뮬레이터'], ['loans', '대출 상품'], ['stats', '비교 분석'], ['board', '신용 라운지']];
  const ready = u.data && u.history.length;
  return `<div class="wrap" style="--acc:var(--mint)">
  <header class="top">${brandUser()}
    <div class="row" style="gap:8px">
      <div style="position:relative"><button class="btn btn-s" data-a="bell" aria-expanded="${UI.bell}" aria-label="알림, 읽지 않음 ${unread}개">${BELL}${unread ? `<span class="dot num">${unread}</span>` : ''}</button>${UI.bell ? bellPanel(ns) : ''}</div>
      <a class="btn btn-s" href="#mypage" ${active === 'mypage' ? 'aria-current="page" style="border-color:var(--mint);color:var(--fg)"' : ''}>마이 페이지</a>
      ${themeBtn()}<button class="btn btn-s" data-a="logout">로그아웃</button>
    </div></header>
  ${ready ? `<nav class="nav" aria-label="주 메뉴">${tabs.map(([r, l]) => `<a href="#${r}" ${cur === r ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>` : ''}
  ${body}</div>
  ${ready ? (UI.help ? `<div class="helpdock">${helpCard()}</div>` : '<button class="helpfab" data-a="helpToggle" aria-label="금융 용어 도우미 열기">? 용어 도우미</button>') : ''}`;
}
function finSub(active) {
  return '';
  const j = me().data.job;
  /* 직군과 상관없이 모든 탭을 보여 준다 (11/06 결정). 직군은 기본 표시값·안내 문구에만 쓴다 */
  const t = [['health', '자산·부채 건전성'], ['stress', '시나리오 테스트'], ['cash', '현금흐름·소득 변동성'], ['area', '상권 분석']];
  return `<nav class="sub" aria-label="재무 진단 메뉴">${t.map(([r, l]) => `<a href="#${r}" ${r === active ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
}
function adminShell(active, body) {
  const u = me();
  const t = [['a-model', '모형 성능 비교'], ['a-stats', '직군·연령별 통계'], ['a-accounts', '계정·권한 관리'], ['a-reports', '신고 접수'], ['a-logs', '접근·감사 로그']];
  const open = allTargets().filter((x) => x.t.status === 'open' || x.t.status === 'review').length;
  return `<div class="wrap" style="--acc:var(--vio)">
  <header class="top"><a class="brand" href="#main"><span class="logo">AV</span><span><b>Avenue Admin</b><small>RISK CONSOLE</small></span></a>
    <div class="row" style="gap:8px"><span class="chip" style="border-color:var(--vio);color:var(--vio2)">관리자</span>${themeBtn()}<button class="btn btn-s" data-a="logout">로그아웃</button></div></header>
  <nav class="nav" aria-label="관리자 메뉴">${t.map(([r, l]) => `<a href="#${r}" ${active === r ? 'aria-current="page"' : ''}>${l}${r === 'a-reports' && open ? ` <span class="dot num" style="background:var(--warn)">${open}</span>` : ''}</a>`).join('')}</nav>
  ${body}</div>`;
}
const head = (title, desc, right = '') => `<div class="row between" style="align-items:flex-end;gap:12px"><div class="stack" style="gap:4px"><h1 class="h1">${title}</h1>${desc ? `<p class="lead">${desc}</p>` : ''}</div>${right}</div>`;
