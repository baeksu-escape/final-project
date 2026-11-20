import { Link } from 'react-router-dom'
import { Button, Card } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'
import { formatSigned } from '../adapters/simulationAdapter.js'

// N-18-8 모델 계산에서 점수를 낮추는 쪽으로 계산된 요인 3개를 보여 준다. 재계산 응답(topReductionFactors)을 쓰며 원인을 뜻하지 않는다.
// deductions가 null이면 아직 계산 전이다. 예시 값 점수는 시연 계산이며 실제 개선 효과를 보장하지 않는다.
export default function DeductionList({ deductions, onFill }) {
  return (
    <Card title="내 점수를 가장 많이 깎은 요인 3가지" className="sim-deductions">
      <p className="sim-hint">모델 계산에서 점수를 낮추는 쪽으로 계산된 큰 순서입니다. 점수가 낮아진 원인을 뜻하지는 않습니다.{deductions?.some((item) => item.editable) && <> [예시 값 넣어 보기]를 누르면 아래 칸에 예시 값이 들어가고, 입력이 멈춘 뒤 자동으로 다시 계산합니다.<br /><span className="sim-neg">다른 항목까지 함께 계산해 카드 점수와 조금 다를 수 있습니다.</span></>}</p>
      {deductions === null ? <p className="sim-hint">재계산하면 감점 요인을 보여 드립니다. 아래에서 값을 바꾸면 자동으로 계산합니다.</p> : deductions.length === 0 ? <p className="sim-hint">감점 요인이 없습니다.</p> : (
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
              ) : !Number.isFinite(item.recoverScore) && (
                <span className="sim-hint">현재 조건에서 채울 수 있는 예시가 없습니다.<br /><Link to={PATHS[item.linkKey] ?? PATHS.REPORT}>{item.linkText ?? '신용 리포트에서 내용을 확인해 보세요.'}</Link></span>
              )}
              {Number.isFinite(item.recoverScore) && (
                <span className="sim-hint">이 항목을 가장 좋은 값으로 바꾸면 모델 계산상 최대 {formatSigned(item.recoverScore)}점이 회복됩니다(참고용 계산).</span>
              )}
            </li>
          ))}
        </ol>
      )}
      <Link to={PATHS.REPORT}>영역별 영향도 보러가기 ›</Link>
    </Card>
  )
}
