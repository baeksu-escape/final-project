import { useRef } from 'react'
import { Checkbox, DateSelect, FieldError, MoneyInput, NumberInput, Select, TextInput } from '../../../common/components/index.js'
import { VALIDATION_LIMITS } from '../config/validationLimits.js'
import { toKoreanWon } from '../../../common/utils/number.js'

// FP-227 잠긴 칸(“없음”·“신용 이력이 없어요” 체크)에 값 대신 보여 줄 안내 글자.
const LOCKED_PLACEHOLDER = '해당 없음'


// N-05-7 기간 — 화면은 년·개월 두 칸으로 받고, 값은 지금처럼 개월 수 하나로 넘긴다(서버·검사·임시저장은 그대로).
// 두 칸이 모두 비면 null(값 없음), 한 칸만 채우면 빈 칸은 0으로 본다. 개월 칸에 12 이상을 넣으면 년으로 올려 보여 준다.
function PeriodInput({ label, value, onChange, error, disabled }) {
  // 0년·0개월은 빈 칸으로 보여 준다(0이 남아 있으면 이어 친 숫자가 '012'처럼 붙는다). 값 계산에서 빈 칸은 0이다.
  const years = value == null ? null : Math.floor(value / 12) || null
  const months = value == null ? null : value % 12 || null
  const monthsRef = useRef(null)
  const emit = (y, m) => onChange(y == null && m == null ? null : (y ?? 0) * 12 + (m ?? 0))
  // 년을 두 자리로 채웠고 한도(최대 50년 = 600개월) 안이면 개월 칸으로 넘어간다
  const changeYears = (y) => {
    emit(y, months)
    if (y >= 10 && y * 12 <= VALIDATION_LIMITS.WORK_PERIOD_MONTHS_MAX) monthsRef.current?.focus()
  }
  return (
    <fieldset className="period-input" disabled={disabled}>
      <legend className="form-field__label">{label}</legend>
      <div className="period-input__row">
        <NumberInput label={`${label} 년`} unit="년" value={years} onChange={changeYears} min={0} max={50} step={1} />
        <NumberInput ref={monthsRef} label={`${label} 개월`} unit="개월" placeholder="0" value={months} onChange={(m) => emit(years, m)} min={0} max={11} step={1} />
      </div>
      <FieldError message={error} />
    </fieldset>
  )
}

// 설정의 칸 하나를 input 종류에 맞는 공통 컴포넌트로 그린다. 필수 칸은 이름 뒤에 '(필수)'를 붙인다.
// disabled: 칸을 잠근다(FP-86 '카드·신용 이용'의 "신용 이력이 없어요", FP-227 대출의 "보유한 대출이 없습니다." 체크). 'checkbox'는 공통 Checkbox로 그린다.
//   FP-227 잠긴 칸은 값을 지우지 않고(부모가 보관) 빈 칸과 '해당 없음'만 보여 준다. 공통 NumberInput은 안내 글자를 받지 않아,
//   잠긴 숫자 칸은 같은 이름의 TextInput(빈 값·안내 글자)으로 그린다.
// 사용 예: <FieldControl field={{ key: 'amount', label: '소득 금액', input: 'money', required: true }} value={v} onChange={setV} error={e} />
export default function FieldControl({ field, value, onChange, error, disabled = false }) {
  const label = field.required ? `${field.label} (필수)` : field.label
  if (disabled && field.input !== 'checkbox') {
    switch (field.input) {
      case 'money': {
        const locked = <MoneyInput label={label} value={null} onChange={onChange} placeholder={LOCKED_PLACEHOLDER} disabled />
        if (!field.quickAdd) return locked
        // FP-260 빠른 입력 칩이 있는 칸은 잠겨도 한글 금액 줄·칩 줄 자리를 그대로 남긴다("없음" 체크 전후로 폼 높이가 같게).
        // 칩은 자리만 차지하고 보이지 않는다(money-quick--locked, dataInput.css).
        return (
          <div className={`${field.wide ? 'money-quick is-wide' : 'money-quick'} money-quick--locked`}>
            {locked}
            <span className="money-quick__korean" aria-hidden="true" />
            <div className="money-quick__chips" aria-hidden="true">
              {field.quickAdd.map((amount) => (
                <button key={amount} type="button" className="money-quick__chip" tabIndex={-1} disabled>
                  +{toKoreanWon(amount).replace(' 원', '')}
                </button>
              ))}
            </div>
          </div>
        )
      }
      case 'select':
        return <Select label={label} value={null} onChange={onChange} options={field.options} placeholder={LOCKED_PLACEHOLDER} disabled />
      default:
        return <TextInput label={label} value="" onChange={onChange} placeholder={LOCKED_PLACEHOLDER} disabled />
    }
  }
  switch (field.input) {
    // 금액 칸은 흐린 글자로 0을 보여 준다. 처음 값은 inputValues.js initialValueOf가 정한다 —
    // 필수가 아닌 금액 칸(자산 4종·월 고정 지출 등)은 처음부터 0원, 필수 금액 칸(월급·대출 잔액 등)은 빈 칸(값 없음)이다.
    case 'money':
      // 설정에 quickAdd가 있으면 칸 아래에 [+100만] 같은 빠른 입력 칩과 한글 금액(예: 1,200만 원)을 함께 보여 준다
      if (field.quickAdd) {
        return (
          <div className={field.wide ? 'money-quick is-wide' : 'money-quick'}>
            <MoneyInput label={label} value={value} onChange={onChange} error={error} placeholder="0" disabled={disabled} />
            {/* 칸 바로 아래 오른쪽 끝에 한글 금액 한 줄, 그 아래 줄에 빠른 입력 칩(줄바꿈 없이 한 줄) */}
            <span className="money-quick__korean" aria-live="polite">{toKoreanWon(value)}</span>
            <div className="money-quick__chips">
              {field.quickAdd.map((amount) => (
                <button key={amount} type="button" className="money-quick__chip" onClick={() => onChange((value ?? 0) + amount)} disabled={disabled}>
                  +{toKoreanWon(amount).replace(' 원', '')}
                </button>
              ))}
            </div>
          </div>
        )
      }
      return <MoneyInput label={label} value={value} onChange={onChange} error={error} placeholder="0" disabled={disabled} />
    case 'period':
      return <PeriodInput label={label} value={value} onChange={onChange} error={error} disabled={disabled} />
    case 'number':
      return (
        <NumberInput
          label={label}
          value={value}
          onChange={onChange}
          error={error}
          unit={field.unit}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
        />
      )
    case 'select':
      return (
        <Select
          label={label}
          value={value}
          onChange={onChange}
          error={error}
          options={field.options}
          placeholder="선택하세요"
          disabled={disabled}
        />
      )
    case 'month':
      return <DateSelect label={label} parts="ym" value={value} onChange={onChange} error={error} hint={field.hint} disabled={disabled} />
    case 'checkbox':
      return <Checkbox label={label} checked={value === true} onChange={onChange} error={error} disabled={disabled} />
    default:
      return (
        <TextInput
          label={label}
          value={value}
          onChange={onChange}
          error={error}
          hint={field.hint}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          disabled={disabled}
        />
      )
  }
}
