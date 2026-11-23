import { Fragment, useState } from 'react'
import Button from '../../../common/components/Button.jsx'
import Card from '../../../common/components/Card.jsx'
import { formatWithComma } from '../../../common/utils/number.js'
import '../credit.css'

// N-12 SHAP 값 표시 — 단위에 맞춰 보여 준다. 0/1은 없음·있음, 비율은 ×100 %, 원은 콤마, 그 밖은 값 뒤에 단위를 붙인다.
function formatShapValue(value, unitName) {
  if (unitName === '코드') return ''
  const number = Number(value)
  if (unitName === '0/1' && (number === 0 || number === 1)) return number === 1 ? '있음' : '없음'
  if (unitName === '비율' && value !== '' && Number.isFinite(number)) return `${(number * 100).toFixed(1)}%`
  if (unitName === '원') return `${formatWithComma(value) || value}원`
  return `${value}${unitName ?? ''}`
}

// N-12 SHAP 감점 항목 설명 — 피처 코드(와 값)가 맞는 감점 행 아래에 작은 안내를 붙인다. 점수·순위로는 조건을 걸지 않는다.
function getShapNote(factor) {
  if (!(factor.shapScore < 0)) return null
  if (factor.featureCode === 'debt_balance_krw' && Number(factor.featureValue) === 0 && factor.featureValue != null) {
    return '대출 이력이 적어 모델이 판단할 근거가 부족한 경우예요. 대출이 없다는 것 자체로 감점된다는 뜻은 아니에요.'
  }
  if (factor.featureCode === 'dp_active_months' || factor.featureCode === 'dp_payment_amount_12m_krw') {
    return "간편결제를 쓴 달 수가 적으면 감점으로 나타날 수 있어요. 합성 데이터에 '꾸준히 쓰는지'를 반영해 만든 방향이에요."
  }
  return null
}

// N-14-2·N-14-3·N-14-4 항목별 점수 기여도를 정렬해 표시한다.
export default function ShapFactorsCard({ shap, alternativeScore }) {
  const [showAll, setShowAll] = useState(false)
  const factors = [...(shap?.factors ?? [])].sort((a, b) => {
    const group = (score) => score > 0 ? 0 : score < 0 ? 1 : 2
    return group(a.shapScore) - group(b.shapScore)
      || Math.abs(b.shapScore) - Math.abs(a.shapScore)
      || a.rank - b.rank
  })
  const topFactors = [
    ...factors.filter((factor) => factor.shapScore > 0).slice(0, 5),
    ...factors.filter((factor) => factor.shapScore < 0).slice(0, 5),
  ]
  const visibleFactors = showAll ? factors : topFactors
  const maxScore = Math.max(30, ...factors.map((factor) => Math.abs(factor.shapScore)))
  const scoreDifference = shap?.baseScore == null || alternativeScore == null
    ? null
    : alternativeScore - shap.baseScore

  return (
    <Card title="영역별 영향도 (SHAP)">
      {factors.length === 0 ? <p>표시할 항목이 없습니다.</p> : (
        <div className="l-stack">
          <div className="shap-summary-row">
            <p className="shap-summary">전체 회원 평균 <span className="num">{shap.baseScore}</span>점 → 항목 영향 합 <span className="num">{scoreDifference == null ? '' : scoreDifference > 0 ? '+' : ''}{scoreDifference}</span>점 → 내 점수 <span className="num">{alternativeScore}</span>점</p>
            {factors.length > topFactors.length && (
              <Button size="sm" onClick={() => setShowAll((current) => !current)}>
                {showAll ? '간단히 보기' : '자세히 보기'}
              </Button>
            )}
          </div>
          <div className="shap-legend">
            <span><i className="shap-swatch shap-positive" />점수를 올리는 쪽으로 작용</span>
            <span><i className="shap-swatch shap-negative" />점수를 내리는 쪽으로 작용</span>
            <span><b className="shap-tag">대안</b> 대안 데이터 항목</span>
            <span>모델이 점수를 계산할 때 각 항목이 쓰인 정도이며, 그 항목 때문에 점수가 바뀌었다는 뜻(원인·결과)은 아니에요. 점수는 합성 데이터로 만든 교육용 예시예요.</span>
          </div>
          <div className="l-stack">
            {visibleFactors.map((factor) => {
              const width = Math.abs(factor.shapScore) / maxScore * 50
              const direction = factor.shapScore > 0 ? 'shap-positive' : factor.shapScore < 0 ? 'shap-negative' : 'shap-neutral'
              const note = getShapNote(factor)
              return (
                <Fragment key={factor.featureCode}>
                <div className="shap-row">
                  <span className="shap-label">
                    {factor.alternativeYn === 'Y' && <b className="shap-tag">대안</b>}
                    {factor.featureName}{factor.featureValue != null && factor.unitName !== '코드' && <> ({formatShapValue(factor.featureValue, factor.unitName)})</>}
                  </span>
                  <span className="shap-bar" aria-hidden="true">
                    <span className="shap-midpoint" />
                    <span className={`shap-fill ${direction}`} style={{ left: `${factor.shapScore >= 0 ? 50 : 50 - width}%`, width: `${width}%` }} />
                  </span>
                  <b className={`shap-score num ${direction}`}>{factor.shapScore > 0 ? '+' : ''}{factor.shapScore}</b>
                </div>
                {note && <p className="hint">{note}</p>}
                </Fragment>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
