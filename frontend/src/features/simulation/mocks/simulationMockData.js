// N-18-7 더미 대출 상품 및 점수대별 추천 기준 데이터
// decisions.md D-12: 실제 상품 참고한 더미 상품, "더미 상품 · 실제 상품 아님" 표시

export const DUMMY_LOAN_PRODUCTS = [
  {
    productId: 1,
    productName: '청년 햇살론 유스',
    institutionName: '서민금융진흥원',
    minRate: 3.5,
    maxRate: 4.5,
    maxLimitAmount: 12000000,
    targetJobTypes: ['EMPLOYEE', 'FREELANCER'],
    description: '청년층·프리랜서의 금융 안정을 지원하는 정부지원 저금리 대출 상품',
    minScore: 550,
  },
  {
    productId: 2,
    productName: '소상공인 희망 대출',
    institutionName: '소상공인시장진흥공단',
    minRate: 2.8,
    maxRate: 4.0,
    maxLimitAmount: 30000000,
    targetJobTypes: ['SELF_EMPLOYED'],
    description: '성실 경영 자영업자를 위한 긴급 운영자금 특별 지원 상품',
    minScore: 580,
  },
  {
    productId: 3,
    productName: '안심 디딤돌 신용대출',
    institutionName: '가상 서민은행',
    minRate: 5.2,
    maxRate: 7.8,
    maxLimitAmount: 25000000,
    targetJobTypes: ['EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER'],
    description: '대안 신용평가를 통해 성실 납부자에게 우대금리를 제공하는 중금리 신용대출',
    minScore: 650,
  },
  {
    productId: 4,
    productName: '프리랜서 비상금 플러스',
    institutionName: '가상 협동조합',
    minRate: 6.0,
    maxRate: 8.5,
    maxLimitAmount: 10000000,
    targetJobTypes: ['FREELANCER'],
    description: '프로젝트 기반 정기 소득자를 위한 유연한 비상금 소액 대출',
    minScore: 620,
  },
  {
    productId: 5,
    productName: '성실상환자 환승 대출',
    institutionName: '가상 신용금융',
    minRate: 6.8,
    maxRate: 9.9,
    maxLimitAmount: 40000000,
    targetJobTypes: ['EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER'],
    description: '고금리 부채를 저금리로 통합하여 월 원리금 상환 부담을 줄여주는 대환 대출',
    minScore: 665,
  },
  {
    productId: 6,
    productName: '우량 직장인 맞춤 신용대출',
    institutionName: '가상 제1금융은행',
    minRate: 4.5,
    maxRate: 6.2,
    maxLimitAmount: 60000000,
    targetJobTypes: ['EMPLOYEE'],
    description: '우량 신용평점 보유 직장인을 위한 넉넉한 한도의 신용대출 상품',
    minScore: 780,
  },
]

// 점수대에 따른 기본 금리 및 한도 가이드 (Good: >=780, Standard: 665~779, Caution: <=664)
export function getScoreBandOffer(score = 680) {
  if (score >= 780) {
    return {
      gradeBand: 'GOOD',
      expectedMinRate: 4.2,
      expectedMaxRate: 6.5,
      expectedLimitAmount: 50000000,
    }
  }
  if (score >= 665) {
    return {
      gradeBand: 'STANDARD',
      expectedMinRate: 5.5,
      expectedMaxRate: 8.8,
      expectedLimitAmount: 30000000,
    }
  }
  return {
    gradeBand: 'CAUTION',
    expectedMinRate: 8.5,
    expectedMaxRate: 14.0,
    expectedLimitAmount: 15000000,
  }
}

