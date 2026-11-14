import { Link } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'
import { matchesLoanScore, useLoanFavorites } from '../api/loanCatalog.js'
import '../styles/loans.css'

// N-37-1·N-37-3 목록과 추천에서 함께 쓰는 카드다. 점수 조건과 회원별 즐겨찾기만 표시한다.
export default function LoanProductCard({ product, score, workerTypeCode }) {
  const { user } = useAuth()
  const { favorites, toggleFavorite, available } = useLoanFavorites(user?.userId)
  const hasScore = typeof score === 'number' && Number.isFinite(score)
  const eligible = matchesLoanScore(product, score)
  return <article className="loan-card" aria-label={product.name}>
    <div className={`loan-banner loan-banner--${product.providerTheme}`}>
      <span>{product.providerName}</span><span className="loan-ribbon">예시 상품</span><h2>{product.name}</h2>
    </div>
    <div className="loan-card__body">
      <p>{product.description}</p>
      <div className="loan-card__numbers"><span>금리 <strong>연 {product.rateMinPct.toFixed(1)}~{product.rateMaxPct.toFixed(1)}%</strong></span><span>한도 <strong>최대 {product.limitAmount.toLocaleString('ko-KR')}원</strong></span></div>
      <p className="loan-hint">대상 {product.eligibility} · {product.minScore ? `대안 ${product.minScore}점 이상` : '점수 조건 없음'}</p>
      <p className={eligible ? 'loan-score loan-score--met' : 'loan-score'}>{!hasScore ? '점수 조건 확인 불가' : eligible ? '점수 조건 충족' : `${product.minScore - score}점 부족`}{workerTypeCode && !product.workerTypeCodes.includes(workerTypeCode) ? ' · 내 직군 대상 아님' : ''}</p>
      <div className="loan-actions"><Link className="button button--primary" to={`${PATHS.LOANS}/${encodeURIComponent(product.productId)}`}>상세 보기 ›</Link>
        <Button disabled={!available} onClick={() => toggleFavorite(product.productId)}>{favorites.includes(product.productId) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}</Button></div>
    </div>
  </article>
}
