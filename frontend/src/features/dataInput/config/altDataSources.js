// N-05-6 대안 데이터 모의 연동 설정(5종) — 실제 외부 기관은 호출하지 않고 [불러오기]로 더미 데이터를 가져온다.
//   apiSegment: 요청 경로의 일부(/api/members/me/alt-data/{apiSegment}/import)
//   columns: 결과 표의 열. format은 'money'(원) | 'count'(건) | 'paymentStatus'(납부 상태 코드 → 이름) | 없음(그대로)
//   consent: N-05-9 정보 제공 동의 창에 보일 내용. providerCode·itemCode는 DDL v0.3.2 USER_CONSENT 주석의 값이다.
//     제공 기관은 모두 가상 기관(목 서버)이다. 실제 기관과 연결하지 않는다.
export const ALT_DATA_SOURCES = Object.freeze([
  {
    key: 'easypay',
    label: '간편결제 이용 내역',
    apiSegment: 'easypay',
    columns: [
      { key: 'month', label: '월' },
      { key: 'paymentCount', label: '이용 건수', format: 'count' },
      { key: 'paymentAmount', label: '이용 금액', format: 'money' },
    ],
    consent: {
      providerCode: 'payment',
      itemCode: 'EASYPAY',
      providerName: '가상 간편결제사(모의)',
      itemsText: '월별 간편결제 이용 건수·이용 금액·이용일 수',
    },
  },
  {
    key: 'telecom',
    label: '통신비 납부 내역',
    apiSegment: 'telecom',
    columns: [
      { key: 'month', label: '월' },
      { key: 'billedAmount', label: '청구 금액', format: 'money' },
      { key: 'paymentStatus', label: '납부 상태' },
    ],
    consent: {
      providerCode: 'telecom',
      itemCode: 'TELECOM_BILL',
      providerName: '가상 통신사(모의)',
      itemsText: '월별 통신비 청구 금액·납부 기한·납부일·납부 상태',
    },
  },
  {
    key: 'nationalPension',
    label: '국민연금 납부 내역',
    apiSegment: 'national-pension',
    columns: [
      { key: 'month', label: '월' },
      { key: 'paidAmount', label: '납부 금액', format: 'money' },
      { key: 'paymentStatus', label: '납부 상태' },
    ],
    consent: {
      providerCode: 'public-insurance',
      itemCode: 'NATIONAL_PENSION',
      providerName: '가상 국민연금 기관(모의)',
      itemsText: '월별 국민연금 납부 금액·납부 기한·납부일·납부 상태',
    },
  },
  {
    key: 'healthInsurance',
    label: '건강보험료 납부 내역',
    apiSegment: 'health-insurance',
    columns: [
      { key: 'month', label: '월' },
      { key: 'paidAmount', label: '납부 금액', format: 'money' },
      { key: 'paymentStatus', label: '납부 상태' },
    ],
    consent: {
      providerCode: 'public-insurance',
      itemCode: 'HEALTH_INSURANCE',
      providerName: '가상 건강보험 기관(모의)',
      itemsText: '월별 건강보험료 납부 금액·납부 기한·납부일·납부 상태',
    },
  },
  // N-05-6 공과금(11/12 추가, DDL v0.3.1 U1) — 전기·가스·수도 합계를 월 1행으로 받는다. 열 이름은 DDL USER_UTILITY_PAYMENT 열을 camelCase로 쓴다.
  {
    key: 'utility',
    label: '공과금 납부 내역',
    apiSegment: 'utility',
    columns: [
      { key: 'billMonth', label: '청구 월' },
      { key: 'billedAmt', label: '청구 금액', format: 'money' },
      { key: 'dueDate', label: '납부 기한' },
      { key: 'paidDate', label: '납부일' },
      { key: 'paymentStatusCode', label: '납부 상태', format: 'paymentStatus' },
    ],
    consent: {
      providerCode: 'utility',
      itemCode: 'UTILITY_BILL',
      providerName: '가상 공과금 기관(모의, 전기·가스·수도)',
      itemsText: '월별 공과금(전기·가스·수도 합계) 청구 금액·납부 기한·납부일·납부 상태',
    },
  },
])

// 불러올 기간(기준월 포함 최근 개월 수). B팀 명세서 v0.2 기준 대안 데이터 기간은 기준월 −11 ~ 기준월이다.
export const ALT_DATA_MONTHS = 12

// N-05-9 대안 데이터 정보 제공 동의의 종류 코드(DDL USER_CONSENT.CONSENT_TYPE_CODE).
export const ALT_DATA_CONSENT_TYPE = 'ALT_DATA_PROVISION'

// N-05-9 동의 창에 모든 종류가 함께 보여 주는 이용 목적·보관 기간.
// TODO 보관 기간 문구는 DDL v0.3.2(USER_CONSENT.EXPIRES_AT 최대 1년, W1 동의 종료·탈퇴 시 불러온 데이터 삭제)를 근거로 쓴 안이다. 팀 확인이 필요하다.
export const ALT_DATA_CONSENT_TERMS = Object.freeze({
  purpose: '대안 신용점수 산출과 리포트 제공',
  retention: '동의일로부터 1년. [연결 해제]하거나 탈퇴하면 불러온 데이터를 바로 지웁니다.',
})

// 납부 상태 코드(DDL PAYMENT_STATUS_CODE) → 화면에 보일 이름. 공과금 표에 쓴다.
export const PAYMENT_STATUS_LABELS = Object.freeze({
  ON_TIME: '정시 납부',
  LATE: '연체',
  UNPAID: '미납',
})
