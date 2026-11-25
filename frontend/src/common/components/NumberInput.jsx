import { useId, useRef, useState } from 'react'
import FieldError from './FieldError.jsx'

// 숫자 입력(텍스트 칸, 스핀 버튼 없음) — 숫자만 받고, '-'는 min이 음수일 때만, '.'은 step이 소수일 때만 받는다. max를 넘는 입력은 받지 않는다. onChange에는 완성된 숫자를, 비우면 null을 넘긴다.
// 사용 예: <NumberInput label="재직 기간" unit="개월" value={months} onChange={setMonths} min={0} max={600} />
export default function NumberInput({ label, value, onChange, min, max, step, unit, error, name, disabled = false }) {
  const id = useId()
  const errorId = `${id}-error`
  const [text, setText] = useState(() => value == null ? '' : String(value))
  const selection = useRef({ start: 0, end: 0 })
  const incomplete = text === '-' || text === '.' || text === '-.' || text.endsWith('.')
  if (!incomplete && (text === '' ? value != null : Number(text) !== value)) setText(value == null ? '' : String(value))

  // 입력 전 선택 위치를 기억해 허용하지 않는 문자를 거부할 때 커서를 복원한다.
  function rememberSelection(event) {
    selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }
  }

  // 부호·소수점과 입력 범위를 확인하고 완성된 숫자만 부모에 전달한다.
  function handleChange(event) {
    const input = event.target
    const next = input.value
    const negative = Number(min) < 0
    const decimal = step != null && Number.isFinite(Number(step)) && !Number.isInteger(Number(step))
    const pattern = new RegExp(`^${negative ? '-?' : ''}\\d*${decimal ? '(?:\\.\\d*)?' : ''}$`)
    const complete = next !== '' && next !== '-' && next !== '.' && next !== '-.' && !next.endsWith('.')
    const number = Number(next)
    const outOfRange = complete && ((max != null && number > Number(max)) || (negative && number < Number(min)))
    if (!pattern.test(next) || outOfRange) {
      input.value = text
      input.setSelectionRange(selection.current.start, selection.current.end)
      return
    }
    setText(next)
    if (next === '') onChange(null)
    else if (complete) {
      if (Number.isFinite(number)) onChange(number)
    }
  }
  return (
    <div className="form-field number-input">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        className="number-input__control"
        value={text}
        onChange={handleChange}
        onBeforeInput={rememberSelection}
        onKeyDown={rememberSelection}
        onPaste={rememberSelection}
        onBlur={() => { if (incomplete) setText(value == null ? '' : String(value)) }}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {unit && <span className="number-input__unit">{unit}</span>}
      <FieldError id={errorId} message={error} />
    </div>
  )
}
