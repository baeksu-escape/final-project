// 카드 — 관련 내용을 묶는 단순 컨테이너. title이 있으면 제목(h2)을 붙인다.
// 사용 예: <Card title="총자산" className="asset-summary-card">...</Card>
//   className: 화면별 의미 있는 이름을 덧붙일 때만 쓴다(기본 'card').
export default function Card({ title, className, children }) {
  return (
    <section className={className ? `card ${className}` : 'card'}>
      {title && <h2 className="card__title">{title}</h2>}
      <div className="card__body">{children}</div>
    </section>
  )
}
