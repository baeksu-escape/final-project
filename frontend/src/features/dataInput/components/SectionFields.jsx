import { Card } from '../../../common/components/index.js'
import { errorKeyOf } from '../validation/inputValidation.js'
import FieldControl from './FieldControl.jsx'

// N-05 칸 묶음 섹션(월급, 기간, 자산, 월 고정 지출) — 설정의 fields를 차례로 그리고, summary가 있으면 요약 문구를 붙인다.
// onFieldChange(fieldKey, value)로 칸 하나의 값만 부모에 알린다. headerSlot은 설명 아래에 먼저 끼워 넣을 칸(예: 소득 카드 안의 기준월)이다.
// 체크 칸이 있는 섹션(카드·신용 이용)은 기존 부채 카드처럼 설명 → 체크 칸 → 안쪽 상자(panel-sunk)에 담은 입력 칸 순서로 그리고,
// 체크로 입력 칸이 모두 비활성화되면 기존 부채 카드가 목록을 숨기듯 상자를 숨긴다.
export default function SectionFields({ section, value, onFieldChange, errors, headerSlot }) {
  const renderField = (field) => (
    <FieldControl
      key={field.key}
      field={field}
      value={value[field.key]}
      onChange={(fieldValue) => onFieldChange(field.key, fieldValue)}
      error={errors[errorKeyOf(section.key, field.key)]}
      disabled={field.disabledWhen?.(value) ?? false}
    />
  )
  const checkboxFields = section.fields.filter((field) => field.input === 'checkbox')
  const inputFields = section.fields.filter((field) => field.input !== 'checkbox')

  return (
    <Card title={section.title} className={`input-section input-section--${section.key}`}>
      {section.description && <p className="input-section__description">{section.description}</p>}
      {headerSlot}
      {checkboxFields.length > 0 ? (
        <>
          {checkboxFields.map(renderField)}
          {!inputFields.every((field) => field.disabledWhen?.(value)) && (
            <div className="panel-sunk l-stack">{inputFields.map(renderField)}</div>
          )}
        </>
      ) : (
        section.fields.map(renderField)
      )}
      {section.summary && <p className="input-section__summary">{section.summary(value)}</p>}
    </Card>
  )
}
