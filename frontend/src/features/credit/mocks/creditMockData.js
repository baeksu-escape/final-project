// N-12-6 화면을 확인할 합성 리포트다. 점수와 구간은 실제 평가 결과가 아니다.
export const scoredReport = {
  requestId: '3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c',
  assessedAt: '2026-11-12T14:30:00+09:00',
  inputBaseMonth: '2026-10',
  workerTypeCode: 'SELF_EMPLOYED',
  gradeStatusCode: 'SCORED',
  notScorableReasonCode: null,
  traditional: { scorableYn: 'Y', score: 612, gradeBandCode: 'CAUTION', defaultProb: 0.183421 },
  alternative: { scorableYn: 'Y', score: 701, gradeBandCode: 'STANDARD', defaultProb: 0.092115 },
  comparison: { scoreDiff: 89, gradeChanged: true },
  gradeBands: { cutoffVersion: 'CUT-0.1', bands: [
    { gradeBandCode: 'CAUTION', minScore: 0, maxScore: 664 },
    { gradeBandCode: 'STANDARD', minScore: 665, maxScore: 779 },
    { gradeBandCode: 'GOOD', minScore: 780, maxScore: 1000 },
  ] },
  shap: { baseScore: 639, factors: [
    { rank: 1, featureCode: 'telecom_on_time_streak', featureName: '통신비 연속 정시 납부', unitName: '개월', featureValue: '18', shapScore: 31, alternativeYn: 'Y', simulatableYn: 'Y' },
    { rank: 2, featureCode: 'income_cv', featureName: '소득 변동 정도', unitName: null, featureValue: '0.27', shapScore: -17, alternativeYn: 'N', simulatableYn: 'N' },
    { rank: 3, featureCode: 'utility_on_time_streak', featureName: '공과금 연속 정시 납부', unitName: '개월', featureValue: '12', shapScore: 16, alternativeYn: 'Y', simulatableYn: 'Y' },
    { rank: 4, featureCode: 'national_pension_payment_months', featureName: '국민연금 납부 기간', unitName: '개월', featureValue: '48', shapScore: 12, alternativeYn: 'Y', simulatableYn: 'N' },
    { rank: 5, featureCode: 'health_insurance_on_time_months', featureName: '건강보험료 정시 납부', unitName: '개월', featureValue: '12', shapScore: 9, alternativeYn: 'Y', simulatableYn: 'Y' },
    { rank: 6, featureCode: 'easypay_active_months', featureName: '간편결제 이용 기간', unitName: '개월', featureValue: '10', shapScore: 7, alternativeYn: 'Y', simulatableYn: 'N' },
    { rank: 7, featureCode: 'credit_history_years', featureName: '신용 거래 기간', unitName: '년', featureValue: '4', shapScore: 5, alternativeYn: 'N', simulatableYn: 'N' },
    { rank: 8, featureCode: 'card_util_pct', featureName: '카드 사용률', unitName: '%', featureValue: '45', shapScore: -4, alternativeYn: 'N', simulatableYn: 'Y' },
    { rank: 9, featureCode: 'loan_count', featureName: '보유 대출 수', unitName: '건', featureValue: '1', shapScore: 2, alternativeYn: 'N', simulatableYn: 'Y' },
    { rank: 10, featureCode: 'recent_loan_count', featureName: '최근 신규 대출 수', unitName: '건', featureValue: '0', shapScore: 1, alternativeYn: 'N', simulatableYn: 'N' },
  ] },
  aiSummary: null,
  modelVersion: 'DEV-DUMMY',
  // TODO(RPT-02 미정) 모델별 전체 피처 목록과 지난 평가 대비 변화의 필드명·제공 방식을 협의한다.
  modelFeatures: {
    traditional: [{ name: '대출', alternativeYn: 'N' }, { name: '카드', alternativeYn: 'N' }],
    alternative: [{ name: '대출', alternativeYn: 'N' }, { name: '카드', alternativeYn: 'N' }, { name: '통신비 납부', alternativeYn: 'Y' }],
  },
  previousScoreDiff: 12,
}
