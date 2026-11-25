import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { formatWithComma, parseDigits } from '../utils/number.js'
import FieldError from './FieldError.jsx'

// 금액 입력(원 단위) — 화면에는 천 단위 쉼표로 보이고, onChange에는 숫자(원)를, 비우면 null을 넘긴다. 숫자 외 문자는 무시하고 15자리를 넘는 입력은 받지 않는다. 막힌 입력은 칸 테두리를 잠깐 빨갛게 표시한다(이유는 화면 낭독기로 읽음).
// 사용 예: <MoneyInput label="월 소득" value={income} onChange={setIncome} error={errors.income} />
export default function MoneyInput({ label, value, onChange, error, name, placeholder, disabled = false }) {
  const id = useId()
  const errorId = `${id}-error`
  const blockedId = `${id}-blocked`
  const [blockedMessage, setBlockedMessage] = useState('')
  const timer = useRef(null)
  const inputRef = useRef(null)
  const cursorRef = useRef(null)
  const previousSelection = useRef({ start: 0, end: 0 })
  const pastedText = useRef(null)

  // 컴포넌트가 사라지면 막힌 입력 안내 타이머를 정리한다.
  useEffect(() => () => clearTimeout(timer.current), [])

  // 막힌 이유와 테두리 표시를 지우고 진행 중인 타이머도 취소한다.
  const clearBlocked = () => {
    clearTimeout(timer.current)
    setBlockedMessage('')
  }

  // 막힌 이유를 화면 낭독기에 알리고 1.5초 뒤 표시를 해제한다.
  const showBlocked = (message) => {
    clearTimeout(timer.current)
    setBlockedMessage(message)
    timer.current = setTimeout(() => setBlockedMessage(''), 1500)
  }

  // 입력 뒤 숫자 개수를 기준으로 쉼표가 바뀐 문자열에서도 커서를 원래 자리에 둔다.
  useLayoutEffect(() => {
    if (cursorRef.current === null || !inputRef.current) return
    restoreCursor(inputRef.current, cursorRef.current)
    cursorRef.current = null
  })

  // 숫자만 변환해 기존 숫자·null 계약으로 전달하고, 값이 같아 다시 그려지지 않아도 커서를 복원한다.
  const updateValue = (input, text, cursor, insertedText = null) => {
    if ((text.match(/\d/g) ?? []).length > 15) {
      input.value = formatWithComma(value)
      input.setSelectionRange(previousSelection.current.start, previousSelection.current.end)
      cursorRef.current = null
      showBlocked('15자리까지 입력할 수 있어요.')
      return
    }
    if (insertedText && !/\d/.test(insertedText)) {
      input.value = formatWithComma(value)
      input.setSelectionRange(previousSelection.current.start, previousSelection.current.end)
      cursorRef.current = null
      showBlocked('숫자만 입력할 수 있어요.')
      return
    }
    clearBlocked()
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
        onSelect={(event) => {
          previousSelection.current = { start: event.target.selectionStart, end: event.target.selectionEnd }
        }}
        onBeforeInput={(event) => {
          previousSelection.current = { start: event.target.selectionStart, end: event.target.selectionEnd }
        }}
        onPaste={(event) => {
          previousSelection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }
          pastedText.current = event.clipboardData.getData('text')
        }}
        onChange={(event) => {
          const input = event.target
          const previous = formatWithComma(value)
          const { start, end } = previousSelection.current
          const insertedText = pastedText.current ?? event.nativeEvent.data
            ?? input.value.slice(start, input.value.length - (previous.length - end))
          pastedText.current = null
          updateValue(input, input.value, input.selectionStart ?? 0, insertedText)
        }}
        onBlur={clearBlocked}
        onKeyDown={(event) => {
          const input = event.currentTarget
          const cursor = input.selectionStart
          previousSelection.current = { start: cursor, end: input.selectionEnd }
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
        aria-invalid={error || blockedMessage ? true : undefined}
        aria-describedby={[error && errorId, blockedMessage && blockedId].filter(Boolean).join(' ') || undefined}
      />
      <span className="money-input__unit">원</span>
      <FieldError id={errorId} message={error} />
      <span id={blockedId} className="sr-only" aria-live="polite">{blockedMessage}</span>
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
