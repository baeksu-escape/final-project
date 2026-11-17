import { Checkbox, MoneyInput, NumberInput, Select, TextInput } from '../../../common/components/index.js'

// 설정의 칸 하나를 input 종류에 맞는 공통 컴포넌트로 그린다. 필수 칸은 이름 뒤에 '(필수)'를 붙인다.
// disabled: 칸을 비활성화한다(FP-86 '카드·신용 이용'의 "신용 이력이 없어요" 체크). 'checkbox'는 공통 Checkbox로 그린다.
// 사용 예: <FieldControl field={{ key: 'amount', label: '소득 금액', input: 'money', required: true }} value={v} onChange={setV} error={e} />
export default function FieldControl({ field, value, onChange, error, disabled = false }) {
  const label = field.required ? `${field.label} (필수)` : field.label
  switch (field.input) {
    case 'money':
      return <MoneyInput label={label} value={value} onChange={onChange} error={error} disabled={disabled} />
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
