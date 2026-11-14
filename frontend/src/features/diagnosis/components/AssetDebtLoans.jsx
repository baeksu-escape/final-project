import { Link } from 'react-router-dom'
import { Card, Chip } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'

// N-16-4 보유 대출은 저장된 시연 목록 그대로 보여 준다. 위 금액을 바꿔도 개별 대출 행을 수정하지 않는다.
export default function AssetDebtLoans({ loans }) {
  const rows = Array.isArray(loans) ? loans : []
  const hasVariable = rows.some((loan) => loan.rateTypeCode === 'VARIABLE')
  return <Card title="보유 대출" className="ad-loans">
    {rows.length ? <div className="ad-table-wrap"><table className="ad-table"><caption>저장된 시연 대출 목록 · 금액 단위 원</caption>
      <thead><tr><th scope="col">종류</th><th scope="col">잔액</th><th scope="col">금리</th><th scope="col">방식</th><th scope="col">월 상환</th></tr></thead>
      <tbody>{rows.map((loan, index) => <tr key={loan.loanId ?? index}>
        <td>{loan.loanTypeName ?? '미입력'}</td><td>{formatAmount(loan.balanceAmount)}</td>
        <td>{Number.isFinite(loan.annualRatePct) ? `${loan.annualRatePct.toFixed(1)}%` : '—'}</td>
        <td>{loan.rateTypeCode === 'VARIABLE' ? <Chip>변동</Chip> : loan.rateTypeCode === 'FIXED' ? '고정' : '미확인'}</td>
        <td>{formatAmount(loan.monthlyPaymentAmount)}</td>
      </tr>)}</tbody>
    </table></div> : <p className="ad-hint">등록한 대출이 없습니다.</p>}
    {hasVariable && <p className="ad-hint">변동금리 대출은 금리 변화에 따라 상환 부담이 달라질 수 있습니다.</p>}
    <Link to={PATHS.SCENARIO}>시나리오 테스트에서 확인하기 ›</Link>
  </Card>
}

// N-16-4 미확인 금액을 0원과 구분한다.
function formatAmount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? `${value.toLocaleString('ko-KR')}원` : '—'
}
