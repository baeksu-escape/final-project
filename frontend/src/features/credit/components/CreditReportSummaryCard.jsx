import { Link } from 'react-router-dom'
import BarChart from '../../../common/components/BarChart.jsx'
import Card from '../../../common/components/Card.jsx'
import { PATHS } from '../../../common/config/navigation.js'

// N-12-8 SHAP 상위 상승·하락 요인을 요약하고 시뮬레이터로 연결한다.
export default function CreditReportSummaryCard({ factors = [] }) {
  const positive = factors
    .filter((factor) => factor.shapScore > 0)
    .sort((a, b) => b.shapScore - a.shapScore || a.rank - b.rank)
    .slice(0, 3)
  const negative = factors
    .filter((factor) => factor.shapScore < 0)
    .sort((a, b) => a.shapScore - b.shapScore || a.rank - b.rank)
    .slice(0, 3)
  const shortLabels = {
    '통신비 정시 납부 기간': '통신비',
    '가장 어려웠던 달의 남은 돈': '잔액',
    '건강보험 정시 납부 개월': '건보',
    '간편결제 이용 개월': '결제개월',
    '간편결제 이용 금액(12개월)': '결제금액',
  }
  const chartData = [...positive, ...negative].map((factor) => ({
    label: shortLabels[factor.featureName] ?? factor.featureName,
    value: factor.shapScore,
    tag: factor.alternativeYn === 'Y' ? '대안' : undefined,
  }))

  return (
    <Card>
      <div className="l-stack">
        <div className="credit-summary-card__header">
          <div>
            <span className="tag">SUMMARY</span>
            <h2>한눈에 보는 요약</h2>
          </div>
        </div>
        <div className="credit-summary-card__legend">
          <span><i className="shap-swatch shap-positive" />점수를 크게 올린 항목</span>
          <span><i className="shap-swatch shap-negative" />점수를 크게 내린 항목</span>
        </div>
        <BarChart data={chartData} height={240} ariaLabel="점수에 영향을 준 상승·하락 요인 상위 3개" />
        <div className="credit-summary-card__action panel-sunk">
          <p className="hint">조건을 바꾸면 점수가 어떻게 달라지는지 시뮬레이터에서 미리 확인해 보세요.</p>
          <Link className="button button--primary" to={PATHS.SIMULATOR}>신용케어 시뮬레이터로 가기</Link>
        </div>
      </div>
    </Card>
  )
}
