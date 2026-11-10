// 스위치 — 켜기/끄기 토글. onChange에는 true/false를 넘긴다.
// 사용 예: <Switch label="알림 받기" checked={notify} onChange={setNotify} />
export default function Switch({ label, checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__track" aria-hidden="true" />
      <span className="switch__label">{label}</span>
    </button>
  )
}
