import { Link } from 'react-router-dom'
import Card from '../../../common/components/Card.jsx'
import { PATHS } from '../../../common/config/navigation.js'
import '../styles/shapFactors.css'

// N-14-2·N-14-3·N-14-4·N-14-5 항목별 점수 기여도를 정렬하고 개선할 수 있는 항목을 연결한다.
export default function ShapFactorsCard({ shap, alternativeScore }) {
  const factors = [...(shap?.factors ?? [])].sort((a, b) => {
    const group = (score) => score > 0 ? 0 : score < 0 ? 1 : 2
    return group(a.shapScore) - group(b.shapScore)
      || Math.abs(b.shapScore) - Math.abs(a.shapScore)
      || a.rank - b.rank
  })
  const maxScore = Math.max(30, ...factors.map((factor) => Math.abs(factor.shapScore)))

  return (
    <Card title="영역별 영향도 (SHAP)">
      {factors.length === 0 ? <p>표시할 항목이 없습니다.</p> : (
        <div className="shap-content">
          <p className="shap-summary">기준점 {shap.baseScore} → 모델 점수 {alternativeScore}</p>
          <div className="shap-legend">
            <span><i className="shap-swatch shap-positive" />점수를 올리는 쪽으로 작용</span>
            <span><i className="shap-swatch shap-negative" />점수를 내리는 쪽으로 작용</span>
            <span><b className="shap-tag">대안</b> 대안 데이터 항목</span>
            <span>작용한 정도이며 원인을 뜻하지 않습니다.</span>
          </div>
          <div className="shap-rows">
            {factors.map((factor) => {
              const width = Math.abs(factor.shapScore) / maxScore * 50
              const direction = factor.shapScore > 0 ? 'shap-positive' : factor.shapScore < 0 ? 'shap-negative' : 'shap-neutral'
              return (
                <div className="shap-row" key={factor.featureCode}>
                  <span className="shap-label">
                    {factor.alternativeYn === 'Y' && <b className="shap-tag">대안</b>}
                    {factor.featureName}{factor.featureValue != null && <> ({factor.featureValue}{factor.unitName ?? ''})</>}
                    {/* TODO(FS-V1): 피처 목록이 정해지면 시뮬레이터 입력 강조 여부를 정한다. */}
                    {factor.shapScore < 0 && factor.simulatableYn === 'Y' && <Link to={PATHS.SIMULATOR}>개선해 보기</Link>}
                  </span>
                  <span className="shap-bar" aria-hidden="true">
                    <span className="shap-midpoint" />
                    <span className={`shap-fill ${direction}`} style={{ left: `${factor.shapScore >= 0 ? 50 : 50 - width}%`, width: `${width}%` }} />
                  </span>
                  <b className={`shap-score ${direction}`}>{factor.shapScore > 0 ? '+' : ''}{factor.shapScore}</b>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
