import { useId, useRef } from 'react'
import FieldError from './FieldError.jsx'

const PARTS = { y: { unit: '년', size: 4, name: '연도' }, m: { unit: '월', size: 2, name: '월' }, d: { unit: '일', size: 2, name: '일' } }
const digits = (text, size) => text.replace(/\D/g, '').slice(0, size)
const two = (n) => String(n).padStart(2, '0')
// 그 달의 마지막 날 — 연·월이 아직 덜 찼으면 가장 넉넉한 값(2월은 윤년 29일, 나머지 달은 그 달 기준)으로 본다
const daysIn = (y, m) => (m < 1 || m > 12 ? 31 : new Date(y.length === 4 ? Number(y) : 2000, m, 0).getDate())

// 연·월(·일)을 숫자로 직접 입력한다(숫자 외 글자는 지우고, 칸마다 자릿수를 제한한다). 각 칸 오른쪽에 '년·월·일'을 붙인다.
// - 월은 1~12, 일은 그 달의 마지막 날까지만 들어간다(넘으면 최댓값으로 맞춘다).
// - 연도 4자리를 채우면 월 칸으로, 월 2자리를 채우면 일 칸으로 커서가 넘어간다. 월·일은 첫 숫자만으로 두 자리가 정해지면(예: 월 '2'→'02') 바로 넘어간다.
// 값은 지금까지와 같은 글자 형식('YYYY-MM' 또는 'YYYY-MM-DD')이라 검사·저장 코드는 그대로 쓴다. 모두 비우면 ''를 넘긴다.
// 사용 예: <DateSelect label="생일" parts="ymd" value="1998-04-05" onChange={setBirth} />   parts: 'ym'(연·월) | 'ymd'(연·월·일)
export default function DateSelect({ label, value, onChange, parts = 'ym', error, hint, disabled = false }) {
  const id = useId()
  const keys = parts === 'ymd' ? ['y', 'm', 'd'] : ['y', 'm']
  const raw = String(value ?? '').split('-')
  const current = Object.fromEntries(keys.map((key, index) => [key, raw[index] ?? '']))
  const inputs = useRef({})

  const emit = (next) => onChange(keys.every((key) => !next[key]) ? '' : keys.map((key) => next[key]).join('-'))
  const focusNext = (key) => inputs.current[keys[keys.indexOf(key) + 1]]?.focus()

  const handleChange = (key, text) => {
    let v = digits(text, PARTS[key].size)
    let advance = false
    if (key === 'y') advance = v.length === 4
    if (key === 'm') {
      if (v.length === 1 && Number(v) >= 2) v = `0${v}` // 2~9월은 한 자리만으로 정해진다
      if (v.length === 2) v = two(Math.min(12, Math.max(1, Number(v))))
      advance = v.length === 2
    }
    const next = { ...current, [key]: v }
    if (parts === 'ymd') {
      const max = daysIn(next.y, Number(next.m))
      if (key === 'd') {
        if (v.length === 1 && Number(v) * 10 > max) v = `0${v}` // 첫 숫자만으로 두 자리가 정해지면(4~9, 또는 2월의 3)
        if (v.length === 2) v = two(Math.min(max, Math.max(1, Number(v))))
        next.d = v
      } else if (next.d.length === 2 && Number(next.d) > max) {
        next.d = two(max) // 월을 바꿔 그 달에 없는 일이 되면 마지막 날로 맞춘다
      }
    }
    emit(next)
    if (advance && key !== keys[keys.length - 1]) focusNext(key)
  }
  // 칸을 벗어나면 한 자리 월·일을 두 자리로. 자동으로 다음 칸에 넘어가는 순간에도 blur가 불리므로, 지난 값(current)이 아니라 칸의 지금 글자로 판단한다
  const pad = (key, text) => {
    if (key !== 'y' && text.length === 1) emit({ ...current, [key]: text.padStart(2, '0') })
  }

  return (
    <fieldset className="form-field date-select" disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="form-field__label">{label}</legend>
      <div className="date-select__row">
        {keys.map((key) => (
          <label key={key} className={`date-select__part date-select__part--${key}`}>
            <input
              ref={(el) => { inputs.current[key] = el }}
              type="text"
              inputMode="numeric"
              className="text-input__control"
              aria-label={`${label} ${PARTS[key].name}`}
              placeholder={key === 'y' ? 'YYYY' : key === 'm' ? 'MM' : 'DD'}
              maxLength={PARTS[key].size}
              value={current[key]}
              onChange={(event) => handleChange(key, event.target.value)}
              onBlur={(event) => pad(key, event.target.value)}
              aria-invalid={error ? true : undefined}
            />
            <span aria-hidden="true">{PARTS[key].unit}</span>
          </label>
        ))}
      </div>
      {hint && <p id={`${id}-hint`} className="form-field__hint">{hint}</p>}
      <FieldError message={error} />
    </fieldset>
  )
}
