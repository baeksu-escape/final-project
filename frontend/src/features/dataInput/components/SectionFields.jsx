import { Card } from '../../../common/components/index.js'
import { errorKeyOf } from '../validation/inputValidation.js'
import FieldControl from './FieldControl.jsx'

// N-05 칸 묶음 섹션(월급, 기간, 자산, 월 고정 지출) — 설정의 fields를 차례로 그리고, summary가 있으면 요약 문구를 붙인다.
// onFieldChange(fieldKey, value)로 칸 하나의 값만 부모에 알린다.
export default function SectionFields({ section, value, onFieldChange, errors }) {
  return (
    <Card title={section.title} className={`input-section input-section--${section.key}`}>
      {section.description && <p className="input-section__description">{section.description}</p>}
      {section.fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={value[field.key]}
          onChange={(fieldValue) => onFieldChange(field.key, fieldValue)}
          error={errors[errorKeyOf(section.key, field.key)]}
        />
      ))}
      {section.summary && <p className="input-section__summary">{section.summary(value)}</p>}
    </Card>
  )
}
