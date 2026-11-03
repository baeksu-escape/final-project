// 입력 오류 표시 — message가 있을 때만 그린다. 입력 칸의 aria-describedby에 같은 id를 넣으면 화면 낭독기가 함께 읽는다.
// 사용 예: <FieldError id={errorId} message={errors.amount} />
export default function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  )
}
