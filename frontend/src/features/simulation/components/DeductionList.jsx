import { Link } from 'react-router-dom'
import { Button, Card } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'
import { formatSigned } from '../adapters/simulationAdapter.js'

// N-18-8 감점이 큰 요인 3개와 바꿔 볼 예시 값을 보여 준다. 예시 값 점수는 시연 계산이며 실제 개선 효과를 보장하지 않는다.
export default function DeductionList({ deductions, onFill }) {
  return (
    <Card title="내 점수를 가장 많이 깎은 요인 3가지" className="sim-deductions">
      <p className="sim-hint">신용 리포트 영향도(SHAP)에서 감점이 큰 순서입니다. [예시 값 넣어 보기]를 누르면 아래 칸에 예시 값이 들어가고, 입력이 멈춘 뒤 자동으로 다시 계산합니다.</p>
      {deductions.length === 0 ? <p className="sim-hint">감점 요인이 없습니다.</p> : (
        <ol className="sim-deduction-grid">
          {deductions.map((item, index) => (
            <li key={item.featureCode} className="sim-deduction">
              <div className="sim-row"><strong>{index + 1}. {item.label}</strong><strong className="sim-neg">{item.shapScore}점</strong></div>
              {item.editable ? (
                <>
                  <span className="sim-hint">바꿀 조건: {item.condition}</span>
                  <span>예시: {item.exampleText}{Number.isInteger(item.exampleScoreChange) && <> → 시연 예시 기준 <strong>{formatSigned(item.exampleScoreChange)}점</strong></>}</span>
                  <div><Button size="sm" variant="primary" onClick={() => onFill(item.example)}>예시 값 넣어 보기</Button></div>
                </>
              ) : (
                <span className="sim-hint">이 시뮬레이터에서 바로 바꿀 수 없는 항목입니다. <Link to={item.linkKey ? `${PATHS.DIAGNOSIS}/${item.linkKey}` : PATHS.REPORT}>{item.linkText ?? '신용 리포트에서 내용을 확인해 보세요.'}</Link></span>
              )}
            </li>
          ))}
        </ol>
      )}
      <Link to={PATHS.REPORT}>영향도 자세히 보기 ›</Link>
    </Card>
  )
}
