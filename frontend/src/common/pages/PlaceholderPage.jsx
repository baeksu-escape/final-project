// 다른 팀이 만들 화면의 빈 자리. 담당 팀은 AppRoutes.jsx에서 이 컴포넌트를 자기 화면으로 바꾼다.
// 사용 예: <PlaceholderPage title="신용 리포트" nId="N-12" />
//   headingLevel: 다른 화면 안에 들어가면 2로 준다(기본 1).
export default function PlaceholderPage({ title, nId, headingLevel = 1 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h1'
  return (
    <section className="placeholder-page">
      <Heading className="placeholder-page__title">{title}</Heading>
      {nId && <p className="placeholder-page__nid">기능 번호: {nId}</p>}
      <p className="placeholder-page__message">준비 중인 화면입니다.</p>
    </section>
  )
}
