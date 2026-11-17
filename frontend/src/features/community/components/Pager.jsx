// N-06-1 페이지 번호 — ‹ 1 2 3 › . 지금 쪽은 aria-current로 표시한다.
// 사용 예: <Pager page={2} totalPages={5} onChange={setPage} />
export default function Pager({ page, totalPages, onChange }) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  return (
    <nav className="lounge-pager" aria-label="페이지">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="이전 페이지">
        ‹
      </button>
      {pages.map((number) => (
        <button key={number} type="button" onClick={() => onChange(number)} aria-current={number === page ? 'page' : undefined}>
          {number}
        </button>
      ))}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="다음 페이지">
        ›
      </button>
    </nav>
  )
}
