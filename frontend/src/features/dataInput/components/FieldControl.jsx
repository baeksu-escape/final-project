import { Checkbox, MoneyInput, NumberInput, Select, TextInput } from '../../../common/components/index.js'

// FP-227 잠긴 칸(“없음”·“신용 이력이 없어요” 체크)에 값 대신 보여 줄 안내 글자.
const LOCKED_PLACEHOLDER = '해당 없음'

// 설정의 칸 하나를 input 종류에 맞는 공통 컴포넌트로 그린다. 필수 칸은 이름 뒤에 '(필수)'를 붙인다.
// disabled: 칸을 잠근다(FP-86 '카드·신용 이용'의 "신용 이력이 없어요", FP-227 대출의 "보유한 대출이 없습니다." 체크). 'checkbox'는 공통 Checkbox로 그린다.
//   FP-227 잠긴 칸은 값을 지우지 않고(부모가 보관) 빈 칸과 '해당 없음'만 보여 준다. 공통 NumberInput은 안내 글자를 받지 않아,
//   잠긴 숫자 칸은 같은 이름의 TextInput(빈 값·안내 글자)으로 그린다.
// 사용 예: <FieldControl field={{ key: 'amount', label: '소득 금액', input: 'money', required: true }} value={v} onChange={setV} error={e} />
export default function FieldControl({ field, value, onChange, error, disabled = false }) {
  const label = field.required ? `${field.label} (필수)` : field.label
  if (disabled && field.input !== 'checkbox') {
    switch (field.input) {
      case 'money':
        return <MoneyInput label={label} value={null} onChange={onChange} placeholder={LOCKED_PLACEHOLDER} disabled />
      case 'select':
        return <Select label={label} value={null} onChange={onChange} options={field.options} placeholder={LOCKED_PLACEHOLDER} disabled />
      default:
        return <TextInput label={label} value="" onChange={onChange} placeholder={LOCKED_PLACEHOLDER} disabled />
    }
  }
  switch (field.input) {
    case 'money':
      // FP-260 멘토링 8 빈 칸에 "0"을 안내 글자로만 보여 준다. 값은 채우지 않는다(빈 칸 = null) — 0을 채우면 자산 완료(TOTAL_ASSET_AMT IS NOT NULL)가 먼저 켜진다.
      return <MoneyInput label={label} value={value} onChange={onChange} error={error} placeholder="0" disabled={disabled} />
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
      return <TextInput label={label} type="month" value={value} onChange={onChange} error={error} hint={field.hint} disabled={disabled} />
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
          maxLength={field.maxLength}
          disabled={disabled}
        />
      )
  }
}
