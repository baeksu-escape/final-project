import { useEffect, useId, useRef, useState } from 'react'
import FieldError from './FieldError.jsx'

// 숫자 입력(텍스트 칸, 스핀 버튼 없음) — 숫자만 받고, '-'는 min이 음수일 때만, '.'은 step이 소수이거나 지금 값이 소수일 때만 받는다. max를 넘는 입력은 받지 않고 칸 테두리를 잠깐 빨갛게 표시한다(이유는 화면 낭독기로 읽음). 휴대폰에서는 숫자 키패드(음수 칸 제외)를 띄우고, 칸을 벗어나면 앞자리 0을 정리한다. onChange에는 완성된 숫자를, 비우면 null을 넘긴다.
// 사용 예: <NumberInput label="재직 기간" unit="개월" value={months} onChange={setMonths} min={0} max={600} />
// ref: 입력 칸에 단다(React 19는 ref를 props로 받는다). 예) 재직기간 년 칸을 다 채우면 개월 칸으로 포커스를 옮길 때
// placeholder: 비었을 때 흐리게 보일 글자(예: '0')
export default function NumberInput({ label, value, onChange, min, max, step, unit, error, name, placeholder, disabled = false, ref }) {
  const id = useId()
  const errorId = `${id}-error`
  const blockedId = `${id}-blocked`
  const [text, setText] = useState(() => value == null ? '' : String(value))
  const [blockedMessage, setBlockedMessage] = useState('')
  const [blocked, setBlocked] = useState(false)
  const timer = useRef(null)
  const selection = useRef({ start: 0, end: 0 })
  const incomplete = text === '-' || text === '.' || text === '-.' || text.endsWith('.')
  // 외부 값이 유한한 숫자이거나 비어 있을 때만 입력 표시를 맞춘다.
  const numericValue = value == null ? null : Number(value)
  const canSync = numericValue === null || Number.isFinite(numericValue)
  const syncedText = numericValue === null ? '' : String(numericValue)
  const negative = Number(min) < 0
  const decimal = (step != null && Number.isFinite(Number(step)) && !Number.isInteger(Number(step)))
    || (numericValue !== null && Number.isFinite(numericValue) && !Number.isInteger(numericValue))
  if (!incomplete && canSync && (numericValue === null ? text !== '' : text === '' || Number(text) !== numericValue)) setText(syncedText)

  // 컴포넌트가 사라질 때 일시적인 테두리 표시 타이머를 정리한다.
  useEffect(() => () => clearTimeout(timer.current), [])

  // 입력 전 선택 위치를 기억해 허용하지 않는 문자를 거부할 때 커서를 복원한다.
  function rememberSelection(event) {
    selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }
  }

  // 부호·소수점과 입력 범위 또는 자릿수를 확인하고 완성된 숫자만 부모에 전달한다.
  function handleChange(event) {
    const input = event.target
    const next = input.value
    const pattern = new RegExp(`^${negative ? '-?' : ''}\\d*${decimal ? '(?:\\.\\d*)?' : ''}$`)
    const complete = next !== '' && next !== '-' && next !== '.' && next !== '-.' && !next.endsWith('.')
    const number = Number(next)
    const outOfRange = complete && ((max != null && number > Number(max)) || (negative && number < Number(min)))
    const tooManyDigits = max == null && (next.match(/\d/g) ?? []).length > 15
    if (!pattern.test(next) || outOfRange || tooManyDigits) {
      input.value = text
      input.setSelectionRange(selection.current.start, selection.current.end)
      setBlockedMessage(!pattern.test(next) ? '숫자만 입력할 수 있어요.' : outOfRange && max == null
        ? `${min}${unit ?? ''} 이상 입력할 수 있어요.`
        : tooManyDigits ? '15자리까지 입력할 수 있어요.' : `${min ?? 0}~${max}${unit ?? ''}까지 입력할 수 있어요.`)
      clearTimeout(timer.current)
      setBlocked(true)
      timer.current = setTimeout(() => setBlocked(false), 1500)
      return
    }
    setBlockedMessage('')
    setText(next)
    if (next === '') onChange(null)
    else if (complete) {
      if (Number.isFinite(number)) onChange(number)
    }
  }

  // 포커스를 벗어나면 안내를 지우고 미완성 입력이나 앞자리 0을 정리한다.
  function handleBlur() {
    setBlockedMessage('')
    if (incomplete && canSync) setText(syncedText)
    else if (!incomplete && text !== '' && Number.isFinite(Number(text))) setText(String(Number(text)))
  }
  return (
    <div className="form-field number-input" data-unit-len={unit ? unit.length : undefined}>
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        name={name}
        type="text"
        inputMode={negative ? undefined : decimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        placeholder={placeholder}
        className="number-input__control"
        value={text}
        onChange={handleChange}
        onBeforeInput={rememberSelection}
        onKeyDown={rememberSelection}
        onPaste={rememberSelection}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={error || blocked ? true : undefined}
        aria-describedby={[error && errorId, blockedMessage && blockedId].filter(Boolean).join(' ') || undefined}
      />
      {unit && <span className="number-input__unit">{unit}</span>}
      <FieldError id={errorId} message={error} />
      <span id={blockedId} className="sr-only" aria-live="polite">{blockedMessage}</span>
    </div>
  )
}
