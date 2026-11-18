// N-06·N-33·N-34 mock 데이터 — 'Avenue 기능 데모 v2'의 예시 글·댓글·신고를 옮긴 합성 데이터다(실제 사용자 아님).
// authorId·reporterId는 mock 로그인 아이디다. employee·self·freelancer는 데모 계정이라 '내 글'·신고 흐름을 직접 시험할 수 있다.

// 자동 숨김 기준(ADM-14)과 하루 신고 횟수 — 서버 APP_SETTING 기본값과 같다
export const mockSettings = { REPORT_AUTO_HIDE_COUNT: 5, REPORT_DAILY_LIMIT: 3 }

// 화면에 보이는 닉네임 (데모 v2 seed의 NICK)
const NICK = {
  employee: '데모직장인',
  self: '데모사장님',
  freelancer: '데모프리랜서',
  ki_minsu: '프리한개발',
  le_sujin: '월급쟁이',
  ch_hoyoung: '카페사장',
  ju_ara: '디자인아라',
  ne_jiwon01: '지원이',
  op_jin33: '점수요정',
  an_hyuk88: '혁이',
  spam_9921: '대출상담',
  rp_dami: '다미네가게',
  rp_haneul: '하늘색통장',
  rp_sora: '소라빵사장',
  rp_baram: '바람개발자',
  rp_daeun: '다은맘',
  rp_gaon: '가온프리',
  rp_yujin: '유진월급',
}
// 예시 신고에 쓰는 신고자 (글 작성자와 겹치지 않는다)
const REPORTERS = ['rp_dami', 'rp_haneul', 'rp_sora', 'rp_baram', 'rp_daeun', 'rp_gaon', 'rp_yujin']
export const nicknameOf = (loginId) => NICK[loginId] ?? loginId

// 날짜 '2026-10-29 10:12' → 서버 LocalDateTime 모양 '2026-10-29T10:12:00'
const at = (text) => `${text.replace(' ', 'T')}:00`

// status: VISIBLE | HIDDEN_BY_REPORT | DELETED (DDL BOARD_POST.STATUS_CODE)
export const mockPosts = [
  { postId: 8, authorId: 'op_jin33', title: '여기 가입만 하면 누구나 점수 50점 오릅니다', content: '여기 가입만 하면 누구나 점수가 50점 이상 올라갑니다.\n저는 하루 만에 올랐어요. 지금 바로 가입하세요.', createdAt: at('2026-11-02 08:15'), status: 'VISIBLE' },
  { postId: 7, authorId: 'spam_9921', title: '"고수익 보장" 당일 대출 상담해 드립니다', content: '신용 상관없이 당일 대출 가능합니다.\n상담은 아래 메신저로 연락 주세요.', createdAt: at('2026-10-31 22:10'), status: 'HIDDEN_BY_REPORT' },
  { postId: 6, authorId: 'ch_hoyoung', title: '통신비 자동이체 등록하고 대안 점수가 올랐어요', content: '통신비를 자동이체로 바꾸고 2년 동안 한 번도 안 밀렸더니 대안 점수에 반영이 되네요.\n기존 점수는 그대로인데 대안 점수는 30점 가까이 올랐습니다.', createdAt: at('2026-10-29 10:12'), status: 'VISIBLE' },
  { postId: 5, authorId: 'ne_jiwon01', title: '내 대출 계좌번호 공유합니다', content: '이 계좌로 이체하는 게 맞는지 봐 주세요.\n국민 1234-56-****', createdAt: at('2026-10-29 13:44'), status: 'VISIBLE' },
  { postId: 4, authorId: 'ki_minsu', title: '프리랜서 소득 변동성, 비수기 대비 어떻게 하세요?', content: '여름에는 일이 몰리고 겨울에는 거의 없어서 소득 변동이 크게 잡혀요.\n비수기 대비로 따로 모아 두시는 분 계신가요?', createdAt: at('2026-10-28 21:30'), status: 'VISIBLE' },
  { postId: 3, authorId: 'le_sujin', title: 'DSR 40% 넘으면 대출이 어렵나요?', content: '상환 부담률이 42%로 나왔는데, 이 정도면 추가 대출이 힘든 건지 궁금합니다.', createdAt: at('2026-10-26 09:20'), status: 'VISIBLE' },
  { postId: 2, authorId: 'ch_hoyoung', title: '상권 분석에서 폐업률 보는 법 정리', content: '폐업률이 3.5%를 넘는 동네는 경쟁이 심하다는 뜻이라, 매출 추이랑 같이 보시는 걸 추천해요.', createdAt: at('2026-10-25 16:44'), status: 'VISIBLE' },
  { postId: 1, authorId: 'employee', title: '국민연금 미납 한 번이 점수에 영향 있나요?', content: '작년에 한 달 밀린 적이 있는데 대안 점수에서 빠지는지 궁금합니다.', createdAt: at('2026-10-24 12:03'), status: 'VISIBLE' },
  ...[
    ['카드 한도 올리면 사용 비율이 내려가나요?', 'le_sujin', '2026-10-23 09:14'],
    ['건강보험료 자동이체 바꾸는 법 공유', 'ch_hoyoung', '2026-10-22 18:40'],
    ['자영업 2년 차인데 사업자 대출 어떻게 준비하세요?', 'an_hyuk88', '2026-10-21 12:02'],
    ['프리랜서 세금 신고 시즌 현금흐름 팁', 'ki_minsu', '2026-10-20 22:31'],
    ['대안 점수랑 기존 점수 차이가 너무 커요', 'ju_ara', '2026-10-19 08:55'],
    ['간편결제 이용 건수도 점수에 들어가나요?', 'le_sujin', '2026-10-18 15:20'],
    ['스트레스 테스트에서 소득 −20% 넣어 봤어요', 'ch_hoyoung', '2026-10-17 21:44'],
    ['연체 1회 기록 언제 사라지나요?', 'ne_jiwon01', '2026-10-16 10:08'],
    ['상권 히트맵에서 우리 동네 폐업률 확인했어요', 'ch_hoyoung', '2026-10-15 13:26'],
    ['통신비 12개월 납부 이력을 채웠더니 점수가 올랐어요', 'ju_ara', '2026-10-14 19:03'],
    ['현금서비스 한 번 쓴 것도 오래 남나요?', 'an_hyuk88', '2026-10-13 07:47'],
    ['마이너스통장 잔액도 대출로 잡히나요?', 'ki_minsu', '2026-10-12 16:15'],
    ['가입 첫 주 후기', 'le_sujin', '2026-10-11 11:30'],
  ].map(([title, authorId, time], index) => ({ postId: 21 + index, authorId, title, content: `${title}\n\n(시연용 예시 글입니다.)`, createdAt: at(time), status: 'VISIBLE' })),
].map((post) => ({ ...post, updatedAt: null }))

export const mockComments = [
  { commentId: 601, postId: 6, authorId: 'ju_ara', content: '저도 자동이체 걸어 두니 마음이 편하더라고요.', createdAt: at('2026-10-29 11:02'), status: 'VISIBLE' },
  { commentId: 602, postId: 6, authorId: 'le_sujin', content: '간편결제 내역도 꼭 불러오세요. 같이 반영돼요.', createdAt: at('2026-10-29 13:40'), status: 'VISIBLE' },
  { commentId: 401, postId: 4, authorId: 'ju_ara', content: '저는 성수기 수입의 30%를 따로 떼어 둬요.', createdAt: at('2026-10-28 22:05'), status: 'VISIBLE' },
  { commentId: 301, postId: 3, authorId: 'an_hyuk88', content: '너 같은 사람이 연체하는 거지. 남 탓 그만해라.', createdAt: at('2026-10-30 19:02'), status: 'HIDDEN_BY_REPORT' },
  { commentId: 302, postId: 3, authorId: 'ch_hoyoung', content: '40%가 은행에서 보는 기준이라 넘으면 한도가 줄어드는 경우가 많아요.', createdAt: at('2026-10-26 10:11'), status: 'VISIBLE' },
  { commentId: 101, postId: 1, authorId: 'ki_minsu', content: '다시 꾸준히 내면 대안 점수에 다시 반영된다고 나오더라고요.', createdAt: at('2026-10-24 13:30'), status: 'VISIBLE' },
]

// 오늘 기준 n일 전 날짜·시각 — 관리자 화면 기본 필터(최근 7일)에서도 예시 신고가 보이도록 신고 시각은 오늘에서 거꾸로 센다
export function daysAgo(days, hhmm) {
  const date = new Date(Date.now() - days * 86400000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hhmm}`
}

// 같은 대상에 여러 명이 신고한 묶음을 만든다. statusCode: RECEIVED | IN_REVIEW | DONE | REJECTED
let nextReportId = 1001
function reportsOn(targetType, targetId, reasons, time) {
  return reasons.map((reasonCode, index) => ({
    reportId: nextReportId++,
    targetType,
    targetId,
    reporterId: REPORTERS[index % REPORTERS.length],
    reasonCode,
    detailText: null,
    statusCode: 'RECEIVED',
    resultCode: null,
    handlerMemo: null,
    reportedAt: at(time),
    handledAt: null,
  }))
}

export const mockReports = [
  ...reportsOn('POST', 8, ['FALSE_INFO', 'FALSE_INFO', 'FALSE_INFO', 'FALSE_INFO'], daysAgo(1, '12:30')),
  ...reportsOn('POST', 7, ['SPAM', 'SPAM', 'SPAM', 'SPAM', 'SPAM', 'SPAM', 'FALSE_INFO'], daysAgo(2, '23:40')),
  ...reportsOn('POST', 5, ['PRIVACY_EXPOSURE', 'PRIVACY_EXPOSURE'], daysAgo(10, '15:10')),
  ...reportsOn('COMMENT', 301, ['ABUSE', 'ABUSE', 'ABUSE', 'ABUSE', 'ABUSE'], daysAgo(3, '20:15')),
]

// 새로 만드는 글·댓글·신고 번호
export const mockSeq = { post: 100, comment: 1000, report: nextReportId }
