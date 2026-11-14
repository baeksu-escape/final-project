import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, Card, Chip, Modal, Notice } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { matchesLoanScore, useLoanFavorites } from '../api/loanCatalog.js'
import { useLoanCatalog } from '../api/useLoanCatalog.js'
import '../styles/loans.css'

// N-37-2·N-37-3 선택 상품을 표시한다. 신청은 외부 전송 없이 안내 모달만 연다.
export default function LoanProductDetailPage() {
  const { productId } = useParams()
  const { user } = useAuth()
  const { products, score, gradeBandCode, loading, error, scoreNotice, scoreError, reload } = useLoanCatalog(user?.userId)
  const { favorites, toggleFavorite, available } = useLoanFavorites(user?.userId)
  const [applying, setApplying] = useState(false)
  const product = products.find((item) => item.productId === productId)
  if (loading) return <p role="status">상품을 불러오는 중입니다.</p>
  if (error) return <Notice type="warn">{error} <Button onClick={reload}>다시 시도</Button></Notice>
  if (!product) return <div className="loans-page"><h1>상품을 찾을 수 없습니다.</h1><Link to={PATHS.LOANS}>대출 상품 목록으로</Link></div>
  return <div className="loans-page">
    <Link to={PATHS.LOANS}>‹ 대출 상품 목록</Link>
    <header className={`loan-detail-banner loan-banner--${product.providerTheme}`}><span>{product.providerName} · 예시 상품</span><h1>{product.name}</h1><p>{product.description}</p></header>
    <Notice>더미 상품 · 실제 상품 아님. UI 시연용 임시 자료입니다. 금리·한도는 같은 점수대의 참고 정보이며 실제 심사·승인 결과가 아닙니다.</Notice>
    <div className="loan-detail-facts">
      <div><span>금리</span><strong>연 {product.rateMinPct.toFixed(1)}~{product.rateMaxPct.toFixed(1)}%</strong></div>
      <div><span>최대 한도</span><strong>{product.limitAmount.toLocaleString('ko-KR')}원</strong></div>
      <div><span>대출 기간</span><strong>{product.termText}</strong></div><div><span>상환 방식</span><strong>{product.repaymentMethod}</strong></div>
    </div>
    <Card title="상품 설명"><p>{product.description}</p></Card>
    <Card title="신청 조건과 특징"><dl className="loan-detail-conditions"><dt>대상</dt><dd>{product.eligibility}</dd><dt>점수 기준</dt><dd>{product.minScore ? `대안 ${product.minScore}점 이상` : '점수 조건 없음'}</dd><dt>직군</dt><dd>{product.workerTypeCodes.map((job) => JOB_TYPE_LABELS[job]).join(' · ')}</dd><dt>필요 서류 (시연 예시)</dt><dd>{product.requiredDocuments.join(', ')}</dd></dl><ul>{product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></Card>
    <Card title="내 점수로 보면">{gradeBandCode && <Chip>평가 당시 등급 · {({ GOOD: 'Good', STANDARD: 'Standard', CAUTION: 'Caution' })[gradeBandCode] ?? gradeBandCode}</Chip>}{scoreError ? <Notice type="warn">{scoreError} <Button onClick={reload}>점수 다시 불러오기</Button></Notice> : <p>{scoreNotice || (matchesLoanScore(product, score) ? `${score}점 · 점수 조건 충족` : `${score}점 · ${product.minScore - score}점 부족`)}</p>}<p>점수 외 대상·기간 등 조건은 별도이며, 점수 조건 충족은 대출 승인을 의미하지 않습니다.</p><Link to={PATHS.SIMULATOR}>신용케어 시뮬레이터에서 살펴보기 ›</Link></Card>
    <Card title="유의 사항"><p>모든 내용은 교육용 합성 예시입니다. 실제 상품을 조회하거나 신청하지 않으며 서류·개인정보도 수집하지 않습니다. 실제 서비스 연결 시 상품과 식별자는 별도 계약으로 교체해야 합니다.</p></Card>
    <div className="loan-actions"><Button disabled={!available} onClick={() => toggleFavorite(product.productId)}>{favorites.includes(product.productId) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}</Button><Button variant="primary" onClick={() => setApplying(true)}>신청하기</Button></div>
    <Modal open={applying} onClose={() => setApplying(false)} title="시연용 신청 안내"><p>이 상품은 더미 상품입니다. 실제 대출 신청이나 개인정보 전송은 이루어지지 않습니다.</p><Button onClick={() => setApplying(false)}>확인</Button></Modal>
  </div>
}
