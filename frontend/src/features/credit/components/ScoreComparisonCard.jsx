import Card from '../../../common/components/Card.jsx'
import Chip from '../../../common/components/Chip.jsx'
import ScoreGauge from './ScoreGauge.jsx'

const GRADE_LABELS = { GOOD: 'Good', STANDARD: 'Standard', CAUTION: 'Caution' }

// 점수 차이의 부호를 유지해 화면에 표시한다.
function signedScore(value) {
  return `${value > 0 ? '+' : ''}${value}`
}

// 모델 한쪽의 점수와 해당 모델의 피처 목록을 표시한다.
function ModelScore({ title, model, bands, features, alternative, diff }) {
  const available = model?.scorableYn === 'Y' && model.score != null
  const showGrade = available && model.gradeBandCode != null
  const hasAlternativeFeatures = alternative && features?.some((feature) => feature.alternativeYn === 'Y')
  return (
    <div className="credit-model">
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
        <p className={diff < 0 ? 'credit-diff credit-diff--negative' : 'credit-diff'}>
          기존보다 {signedScore(diff)}점
        </p>
      )}
      {available ? (
        <ScoreGauge score={model.score} bands={bands} label={title} alternative={alternative} />
      ) : <p className="credit-unavailable">산정 불가</p>}
      {features?.length > 0 && (
        <div>
          <p className="credit-feature-title">이 모델이 보는 피처</p>
          <div className="credit-chips">
            {features.map((feature, index) => (
              <span className={alternative && feature.alternativeYn === 'Y' ? 'credit-chip--alternative' : ''} key={`${feature.name}-${index}`}>
                <Chip>{feature.name}</Chip>
              </span>
            ))}
          </div>
          {hasAlternativeFeatures && <p className="credit-hint">보라색 태그는 대안 모델에서 새로 더한 비금융 피처입니다.</p>}
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
      <div className="credit-models">
        <ModelScore title="기존 모델" model={report.traditional} bands={bands} features={report.modelFeatures?.traditional} />
        <ModelScore title="대안 모델" model={report.alternative} bands={bands} features={report.modelFeatures?.alternative} alternative diff={report.comparison?.scoreDiff} />
      </div>
    </Card>
  )
}
