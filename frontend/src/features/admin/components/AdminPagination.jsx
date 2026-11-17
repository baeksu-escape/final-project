import { Button } from '../../../common/components/index.js'
import { ADMIN_FIRST_PAGE } from '../adminConstants.js'

// FP-80 관리자 목록 쪽 넘기기 — [이전] "현재 / 전체 쪽" [다음]. page는 서버 쪽 번호(ADMIN_FIRST_PAGE부터)이고, 화면에는 1부터 보인다.
// 사용 예: <AdminPagination page={data.page} size={data.size} totalCount={data.totalCount} onChange={setPage} />
export default function AdminPagination({ page, size, totalCount, onChange }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / size))
  const current = page - ADMIN_FIRST_PAGE + 1
  return (
    <nav aria-label="쪽 넘기기">
      <Button size="sm" disabled={current <= 1} onClick={() => onChange(page - 1)}>
        이전
      </Button>
      <span>
        {' '}
        {current} / {totalPages}쪽 (총 {totalCount}건){' '}
      </span>
      <Button size="sm" disabled={current >= totalPages} onClick={() => onChange(page + 1)}>
        다음
      </Button>
    </nav>
  )
}
