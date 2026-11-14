// N-37-1 승인된 UI 참고자료의 임시 상품 9종이다. 서비스 DB 상품과 자동 매핑하지 않는다.
const uiLoans = [
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
export const CATALOG_VERSION = 'ui-v2-1794641606-4f83'
const jobs = { salary: 'EMPLOYEE', self: 'SELF_EMPLOYED', free: 'FREELANCER' }
const providerThemes = { '에비뉴은행(예시)': 'bank', '새싹저축은행(예시)': 'savings', '서민금융 연계(예시)': 'policy' }
// N-37-1 UI 필드를 화면 전용 계약으로 옮긴다. 금액만 원 단위로 환산하며 서비스 시드 수치는 섞지 않는다.
export const MOCK_LOAN_PRODUCTS = uiLoans.map((item) => ({
  productId: item.id, dbProductId: null, idSource: 'ui-mock', catalogVersion: CATALOG_VERSION,
  name: item.n, providerName: item.p, providerTheme: providerThemes[item.p] ?? 'neutral', description: item.d, eligibility: item.t,
  minScore: item.min, maxScore: 1000,
  workerTypeCodes: item.jobs.map((job) => jobs[job]),
  interestRate: item.rt, rateMinPct: item.rt[0], rateMaxPct: item.rt[1],
  limitAmount: item.lm * 10000, termMonths: null, termText: item.term,
  repaymentMethod: item.way, features: item.feats, requiredDocuments: item.docs,
}))
