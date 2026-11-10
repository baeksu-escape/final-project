// N-05-6 대안 데이터 모의 연동 설정(4종) — 실제 외부 기관은 호출하지 않고 [불러오기]로 더미 데이터를 가져온다.
//   apiSegment: 요청 경로의 일부(/api/members/me/alt-data/{apiSegment}/import)
//   columns: 결과 표의 열. format은 'money'(원) | 'count'(건) | 없음(그대로)
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
  },
])

// 불러올 기간(기준월 포함 최근 개월 수). TODO 팀 확정 전 임시값.
export const ALT_DATA_MONTHS = 6
