import Card from '../../../common/components/Card.jsx'
import Chip from '../../../common/components/Chip.jsx'
import ScoreGauge from './ScoreGauge.jsx'

const GRADE_LABELS = { GOOD: 'Good', STANDARD: 'Standard', CAUTION: 'Caution' }

const FEATURE_GROUPS = [
  { label: '소득·현금흐름', featureCodes: ['income_svc_12m_krw', 'income_cv_svc_12m', 'zero_income_months_svc_12m', 'expense_avg_month_krw', 'debt_service_current_krw', 'expense_ratio_svc_12m', 'dsr_svc_12m', 'deficit_months_svc_12m', 'worst_month_net_cash_svc_12m_krw'] },
  { label: '대출', featureCodes: ['debt_balance_krw', 'L00000001', 'LRZ021201', 'L22000900', 'LA0099212'] },
  { label: '카드·현금서비스', featureCodes: ['CF1231605', 'CL0631905'] },
  { label: '연체', featureCodes: ['DQ1200001'] },
  { label: '직군·연령', featureCodes: ['segment', 'age'] },
  { label: '통신비', featureCodes: ['telecom_late_months', 'telecom_on_time_streak'] },
  { label: '공과금', featureCodes: ['utility_late_months'] },
  { label: '간편결제', featureCodes: ['dp_ever_used', 'dp_active_months', 'dp_payment_count_12m', 'dp_payment_amount_12m_krw'] },
  { label: '국민연금', featureCodes: ['np_coverage_status', 'np_payer_type', 'np_due_months', 'np_on_time_months', 'np_arrears_months', 'np_on_time_rate'] },
  { label: '건강보험', featureCodes: ['hi_coverage_status', 'hi_payer_type', 'hi_due_months', 'hi_on_time_months', 'hi_arrears_months', 'hi_on_time_rate'] },
  { label: '사회보험 미납', featureCodes: ['si_arrears_any'] },
]

// N-12-6 피처별 응답을 화면의 요약 영역으로 묶는다.
function groupModelFeatures(features = []) {
  const grouped = new Map()
  features.forEach((feature) => {
    const groups = FEATURE_GROUPS.filter((item) => item.featureCodes.includes(feature.featureCode))
    if (groups.length === 0) groups.push({ label: feature.name, key: `feature:${feature.featureCode ?? feature.name}` })
    groups.forEach((group) => {
      const key = group.key ?? group.label
      if (!grouped.has(key)) grouped.set(key, { label: group.label, features: [] })
      grouped.get(key).features.push(feature)
    })
  })
  return [...grouped.values()]
}

// 점수 차이의 부호를 유지해 화면에 표시한다.
function signedScore(value) {
  return `${value > 0 ? '+' : ''}${value}`
}

// 모델 한쪽의 점수와 해당 모델의 피처 목록을 표시한다.
function ModelScore({ title, model, bands, features, alternative, diff }) {
  const available = model?.scorableYn === 'Y' && model.score != null
  const showGrade = available && model.gradeBandCode != null
  const hasAlternativeFeatures = alternative && features?.some((feature) => feature.alternativeYn === 'Y')
  const featureGroups = groupModelFeatures(features)
  return (
    <div className="panel-sunk">
      <div className="credit-model__header">
        <div>
          <h3>{title}</h3>
          <p>{alternative ? '금융 이력 + 비금융 납부 이력' : '금융 이력 중심 (대출·카드·연체)'}</p>
        </div>
        {showGrade && (
          <span className={`credit-grade credit-grade--${model.gradeBandCode.toLowerCase()}`}>
            {GRADE_LABELS[model.gradeBandCode] ?? model.gradeBandCode}
          </span>
        )}
      </div>
      {alternative && diff != null && (
        <p className={diff < 0 ? 'credit-diff credit-diff--negative num' : 'credit-diff num'}>
          기존보다 {signedScore(diff)}점
        </p>
      )}
      {available ? (
        <ScoreGauge score={model.score} bands={bands} label={title} alternative={alternative} />
      ) : <p className="credit-unavailable">산정 불가</p>}
      {featureGroups.length > 0 && (
        <div>
          <p className="hint">이 모델이 보는 영역</p>
          <div className="credit-chips">
            {featureGroups.map((group) => (
              <span
                aria-label={`${group.label}: ${group.features.map((feature) => feature.name).join(', ')}`}
                className={alternative && group.features.some((feature) => feature.alternativeYn === 'Y') ? 'credit-chip--alternative' : ''}
                key={group.label}
                title={group.features.map((feature) => feature.name).join(', ')}
              >
                <Chip>{group.label}</Chip>
              </span>
            ))}
          </div>
          {hasAlternativeFeatures && <p className="hint">보라색 태그는 대안 모델에서 새로 더한 비금융 피처입니다.</p>}
        </div>
      )}
    </div>
  )
}

// N-12-6 두 모델의 점수와 등급을 비교한다.
export default function ScoreComparisonCard({ report }) {
  const bands = report.gradeBands?.bands ?? []
  return (
    <Card title="점수 비교">
      <div className="l-g2" style={{ '--min': '300px' }}>
        <ModelScore title="기존 모델" model={report.traditional} bands={bands} features={report.modelFeatures?.traditional} />
        <ModelScore title="대안 모델" model={report.alternative} bands={bands} features={report.modelFeatures?.alternative} alternative diff={report.comparison?.scoreDiff} />
      </div>
    </Card>
  )
}
