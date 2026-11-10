// 칩 — 짧은 라벨이나 상태를 알약 모양으로 보여 준다. accent를 켜면 강조색 테두리로 표시한다.
// 사용 예: <Chip>급여소득자</Chip>   <Chip accent>대안 점수</Chip>
export default function Chip({ accent = false, children }) {
  return <span className={accent ? 'chip chip--accent' : 'chip'}>{children}</span>
}
