import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { ROLES } from '../../../common/config/roles.js'

// FP-80 관리자 화면 mock 합성 데이터. 실제 개인정보가 아니다. 화면에는 가린 값만 나간다.

// 로그인 mock 계정(employee·self·freelancer·newbie·admin·locked)에 더해 목록을 채울 회원·관리자 계정.
// 비밀번호(password)가 null이면 아무 값으로나 로그인된다. admin_park은 초대만 된 관리자라 첫 로그인 때 비밀번호를 새로 정해야 한다.
export const EXTRA_ACCOUNTS = Object.freeze([
  { loginId: 'admin_lee', email: 'admin_lee@avenue.example', phone: null, createdAt: '2026-06-01T09:00:00', user: { name: '이관리', role: ROLES.ADMIN, jobType: null } },
  { loginId: 'admin_park', email: 'admin_park@avenue.example', phone: null, createdAt: '2026-11-12T10:00:00', passwordChangeRequired: true, user: { name: '박관리', role: ROLES.ADMIN, jobType: null } },
  { loginId: 'ki_minsu', email: 'ki_minsu@example.com', phone: '01000000011', nickname: '민수프리', createdAt: '2026-07-14T11:20:00', user: { name: '김민수', role: ROLES.USER, jobType: JOB_TYPES.FREELANCER } },
  { loginId: 'le_sujin', email: 'le_sujin@example.com', phone: '01000000012', nickname: '수진직장', createdAt: '2026-07-20T08:40:00', user: { name: '이수진', role: ROLES.USER, jobType: JOB_TYPES.EMPLOYEE } },
  { loginId: 'ch_hoyoung', email: 'ch_hoyoung@example.com', phone: '01000000013', nickname: '호영사장', createdAt: '2026-08-02T15:05:00', user: { name: '최호영', role: ROLES.USER, jobType: JOB_TYPES.SELF_EMPLOYED } },
  { loginId: 'ne_jiwon01', email: 'ne_jiwon01@example.com', phone: '01000000014', nickname: '지원01', createdAt: '2026-09-05T19:30:00', user: { name: '남지원', role: ROLES.USER, jobType: JOB_TYPES.EMPLOYEE } },
  // 이름 복호화에 실패한 행 확인용 — 목록에 "(복호화 불가)"로 나온다.
  { loginId: 'op_jin33', email: 'op_jin33@example.com', phone: '01000000015', nickname: '진33', createdAt: '2026-10-21T13:10:00', decryptFailed: true, user: { name: '오진', role: ROLES.USER, jobType: JOB_TYPES.EMPLOYEE } },
  { loginId: 'spam_9921', email: 'spam_9921@example.com', phone: '01000000016', nickname: '스팸9921', createdAt: '2026-10-30T02:15:00', locked: true, user: { name: '미인증', role: ROLES.USER, jobType: null } },
  // 탈퇴 회원 — 행은 남고 개인정보 칸은 표시값으로 덮여 있다(DDL W1).
  { loginId: 'wd_u-old01', email: 'WITHDRAWN', phone: null, nickname: '탈퇴u-old01', createdAt: '2026-06-15T10:00:00', accountStatus: 'WITHDRAWN', user: { name: 'WITHDRAWN', role: ROLES.USER, jobType: JOB_TYPES.SELF_EMPLOYED } },
])

// 이름을 복호화하지 못했을 때 서버가 maskedName에 넣는 값(계약).
export const DECRYPT_FAILED_NAME = '(복호화 불가)'

// 아이디별 목록·상세 보조 값(최근 대안 점수, 받은 신고, 가입·접속 시각, 최근 평가, 카드·신용 6개 값, 대안 데이터 개월 수).
// 여기 없는 계정은 점수·평가가 없는 것으로 본다.
export const ADMIN_VIEW_EXTRAS = Object.freeze({
  employee: {
    createdAt: '2026-06-28T10:12:00',
    lastLoginAt: '2026-11-14T09:20:00',
    reportedPostCount: 0,
    assessment: { requestId: '7d1f3c2a-6b4e-4f8a-9c10-2e5d7a9b1c01', tradScore: 642, altScore: 709, altGradeBandCode: 'STANDARD', assessedAt: '2026-11-10T14:30:00' },
    creditProfile: { delinqCount12m: 0, cashAdvanceMonths: 0, newLoanCount3m: 1, privateLenderLoanBalanceAmt: 0, cardLimitAmt: 5000000, cardMonthlySpendAmt: 1200000 },
    altDataSummary: { telecom: 12, utility: 12, easypay: 6, nationalPension: 24, healthInsurance: 24 },
  },
  admin: { createdAt: '2026-06-01T09:00:00', lastLoginAt: '2026-11-15T08:55:00', reportedPostCount: 0 },
  admin_lee: { lastLoginAt: '2026-11-02T18:00:00', reportedPostCount: 0 },
  ki_minsu: {
    lastLoginAt: '2026-11-13T21:02:00',
    reportedPostCount: 0,
    assessment: { requestId: '0b8e2f41-93c7-4d2a-8e55-6f1a2c3d4e02', tradScore: 598, altScore: 684, altGradeBandCode: 'STANDARD', assessedAt: '2026-11-08T10:05:00' },
    creditProfile: { delinqCount12m: 1, cashAdvanceMonths: 2, newLoanCount3m: 0, privateLenderLoanBalanceAmt: 0, cardLimitAmt: 3000000, cardMonthlySpendAmt: 900000 },
    altDataSummary: { telecom: 12, utility: 6, easypay: 12, nationalPension: 10, healthInsurance: 18 },
  },
  le_sujin: {
    lastLoginAt: '2026-11-12T07:45:00',
    reportedPostCount: 0,
    assessment: { requestId: '5c3a9e10-2d7b-4b61-a0f4-8e9d0c1b2a03', tradScore: 701, altScore: 731, altGradeBandCode: 'STANDARD', assessedAt: '2026-11-05T19:40:00' },
    creditProfile: { delinqCount12m: 0, cashAdvanceMonths: 0, newLoanCount3m: 0, privateLenderLoanBalanceAmt: 0, cardLimitAmt: 8000000, cardMonthlySpendAmt: 1500000 },
    altDataSummary: { telecom: 24, utility: 24, easypay: 12, nationalPension: 36, healthInsurance: 36 },
  },
  ch_hoyoung: {
    lastLoginAt: '2026-11-11T12:30:00',
    reportedPostCount: 0,
    assessment: { requestId: 'a41d7c5e-8f20-4e9b-b3c6-1d2e3f4a5b04', tradScore: 680, altScore: 655, altGradeBandCode: 'CAUTION', assessedAt: '2026-11-03T16:20:00' },
    creditProfile: { delinqCount12m: 2, cashAdvanceMonths: 3, newLoanCount3m: 2, privateLenderLoanBalanceAmt: 3000000, cardLimitAmt: 4000000, cardMonthlySpendAmt: 2100000 },
    altDataSummary: { telecom: 12, utility: 12, easypay: 18, nationalPension: 8, healthInsurance: 12 },
  },
  ne_jiwon01: { lastLoginAt: '2026-11-09T22:10:00', reportedPostCount: 2 },
  op_jin33: { lastLoginAt: '2026-11-01T10:00:00', reportedPostCount: 4 },
  spam_9921: { lastLoginAt: '2026-11-03T21:12:00', reportedPostCount: 7 },
})

// 대안 데이터를 하나도 불러오지 않은 회원의 개월 수.
export const EMPTY_ALT_DATA_SUMMARY = Object.freeze({ telecom: 0, utility: 0, easypay: 0, nationalPension: 0, healthInsurance: 0 })

// 시스템 로그 초기값(N-28). 내용에는 이름·연락처 원문을 넣지 않는다(DDL W6).
export const SEED_SYSTEM_LOGS = Object.freeze([
  { createdAt: '2026-11-03T21:12:05', type: 'WARN', source: 'auth-service', message: '사용자 spam_9921 로그인 5회 실패 · 계정 잠금' },
  { createdAt: '2026-11-03T09:02:44', type: 'AUTH', source: 'auth-service', message: '관리자 admin 로그인 · 2단계 인증 통과' },
  { createdAt: '2026-11-03T03:00:44', type: 'INFO', source: 'scoring-batch', message: '야간 배치 점수 산출 완료 · 12,000명 · 4분 12초' },
  { createdAt: '2026-11-03T02:00:03', type: 'INFO', source: 'etl', message: '상권 데이터 갱신 완료' },
  { createdAt: '2026-11-02T18:24:50', type: 'AUTH', source: 'auth-service', message: '관리자 admin_lee 로그아웃' },
  { createdAt: '2026-11-02T16:03:17', type: 'WARN', source: 'scoring-api', message: '점수 산출 API 응답 지연 · 2.8초' },
  { createdAt: '2026-10-31T23:02:11', type: 'WARN', source: 'board', message: '게시글 자동 숨김 · 신고 누적 5건 (R-1029)' },
  { createdAt: '2026-10-30T20:15:40', type: 'WARN', source: 'board', message: '댓글 자동 숨김 · 신고 누적 5건 (R-1031)' },
  { createdAt: '2026-10-30T09:10:00', type: 'AUTH', source: 'auth-service', message: '사용자 employee 로그인' },
])

// 열람 감사 로그 초기값(N-35-2). 대상 회원은 가린 이름·아이디로만 남긴다.
export const SEED_ACCESS_LOGS = Object.freeze([
  { accessedAt: '2026-11-04T10:15:00', viewerLoginId: 'admin', targetLabel: '최*영 (ch_*******)', reason: '점수 이의 문의 응대', resource: 'CREDIT_DATA' },
  { accessedAt: '2026-11-01T14:02:00', viewerLoginId: 'admin_lee', targetLabel: '김*수 (ki_*****)', reason: '모형 검증용 표본 점검', resource: 'CREDIT_DATA' },
])
