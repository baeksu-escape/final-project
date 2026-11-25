import { useId, useLayoutEffect, useRef } from 'react'
import { formatWithComma, parseDigits } from '../utils/number.js'
import FieldError from './FieldError.jsx'

// 금액 입력(원 단위) — 화면에는 천 단위 쉼표로 보이고, onChange에는 숫자(원)를, 비우면 null을 넘긴다. 숫자 외 문자는 무시한다.
// 사용 예: <MoneyInput label="월 소득" value={income} onChange={setIncome} error={errors.income} />
export default function MoneyInput({ label, value, onChange, error, name, placeholder, disabled = false }) {
  const id = useId()
  const errorId = `${id}-error`
  const inputRef = useRef(null)
  const cursorRef = useRef(null)

  // 입력 뒤 숫자 개수를 기준으로 쉼표가 바뀐 문자열에서도 커서를 원래 자리에 둔다.
  useLayoutEffect(() => {
    if (cursorRef.current === null || !inputRef.current) return
    restoreCursor(inputRef.current, cursorRef.current)
    cursorRef.current = null
  })

  // 숫자만 변환해 기존 숫자·null 계약으로 전달하고, 값이 같아 다시 그려지지 않아도 커서를 복원한다.
  const updateValue = (input, text, cursor) => {
    const digitsBefore = (text.slice(0, cursor).match(/\d/g) ?? []).length
    const nextValue = parseDigits(text)
    cursorRef.current = digitsBefore
    onChange(nextValue)
    input.value = formatWithComma(nextValue)
    restoreCursor(input, digitsBefore)
    if (nextValue === value) cursorRef.current = null
  }
  return (
    <div className="form-field money-input">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="money-input__control"
        value={formatWithComma(value)}
        onChange={(event) => updateValue(event.target, event.target.value, event.target.selectionStart ?? 0)}
        onKeyDown={(event) => {
          const input = event.currentTarget
          const cursor = input.selectionStart
          if (event.key === 'Delete' && cursor !== null && cursor === input.selectionEnd && input.value[cursor] === ',') {
            event.preventDefault()
            updateValue(input, input.value.slice(0, cursor) + input.value.slice(cursor + 2), cursor)
            return
          }
          if (event.key !== 'Backspace' || cursor === null || cursor !== input.selectionEnd || input.value[cursor - 1] !== ',') return
          event.preventDefault()
          updateValue(input, input.value.slice(0, cursor - 2) + input.value.slice(cursor), cursor - 2)
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <span className="money-input__unit">원</span>
      <FieldError id={errorId} message={error} />
    </div>
  )
}

// 입력 위치 앞에 있던 숫자 수를 쉼표가 포함된 문자열의 커서 위치로 바꾼다.
function restoreCursor(input, digitCount) {
  let position = 0
  let digits = 0
  while (position < input.value.length && digits < digitCount) {
    if (/\d/.test(input.value[position])) digits += 1
    position += 1
  }
  input.setSelectionRange(position, position)
}
