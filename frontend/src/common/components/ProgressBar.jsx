// 진행률 막대 — value(0~max)만큼 채워서 보여 준다. label은 화면 낭독기가 읽는 이름이다.
// 사용 예: <ProgressBar label="입력 완료율" value={60} />
export default function ProgressBar({ label, value, max = 100 }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="progress-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
