import { useState } from 'react'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, Notice, SegmentedControl } from '../../../common/components/index.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { matchesLoanScore, useLoanFavorites } from '../api/loanCatalog.js'
import { useLoanCatalog } from '../api/useLoanCatalog.js'
import LoanProductCard from '../components/LoanProductCard.jsx'
import '../styles/loans.css'

// N-37-1 네 가지 필터로 UI 전용 더미 상품을 조회한다. 실제 승인 가능성은 판단하지 않는다.
export default function LoanProductsPage() {
  const { user } = useAuth()
  const { products, score, loading, error, scoreNotice, scoreError, reload } = useLoanCatalog(user?.userId)
  const { favorites } = useLoanFavorites(user?.userId)
  const [filter, setFilter] = useState('all')
  const filtered = products.filter((product) => filter === 'score' ? matchesLoanScore(product, score)
    : filter === 'job' ? product.workerTypeCodes.includes(user?.jobType)
      : filter === 'favorites' ? favorites.includes(product.productId) : true)
  // N-37-1 필터 결과의 복사본만 정렬한다. 즐겨찾기 우선·같은 그룹은 점수 조건 충족 우선이며 동률은 카탈로그 순서를 유지한다.
  const shown = [...filtered].sort((left, right) =>
    Number(favorites.includes(right.productId)) - Number(favorites.includes(left.productId))
    || Number(matchesLoanScore(right, score)) - Number(matchesLoanScore(left, score)))
  return <div className="loans-page">
    <header className="loans-heading"><div><h1>대출 상품</h1><p>{score == null ? '내 점수 조건을 확인하고 참고 상품을 살펴보세요.' : `내 대안 점수 ${score}점으로 살펴보는 참고 상품입니다.`}</p></div></header>
    <Notice>더미 상품 · 실제 상품 아님. UI 시연용 임시 자료이며 금리·한도는 같은 점수대의 참고 정보입니다. 점수 조건 충족은 대출 승인을 뜻하지 않습니다.</Notice>
    <SegmentedControl label="상품 거르기" value={filter} onChange={setFilter} options={[
      { value: 'all', label: `전체 ${products.length}` }, { value: 'score', label: '점수 조건 충족' },
      { value: 'job', label: `${JOB_TYPE_LABELS[user?.jobType] ?? '내 직군'} 대상` },
      { value: 'favorites', label: `즐겨찾기 ${favorites.length}` },
    ]} />
    {loading ? <p role="status">상품을 불러오는 중입니다.</p> : error ? <Notice type="warn">{error} <Button onClick={reload}>다시 시도</Button></Notice> : <>
      {scoreError && <Notice type="warn">{scoreError} <Button onClick={reload}>점수 다시 불러오기</Button></Notice>}
      {scoreNotice && <Notice>{scoreNotice}</Notice>}
      {shown.length ? <div className="loan-grid">{shown.map((product) => <LoanProductCard key={product.productId} product={product} score={score} workerTypeCode={user?.jobType} />)}</div>
        : <p className="loan-empty">{filter === 'favorites' ? '즐겨찾기한 상품이 없습니다. 상품 카드의 ☆을 눌러 모아 보세요.' : '조건에 맞는 상품이 없습니다.'}</p>}
    </>}
  </div>
}
