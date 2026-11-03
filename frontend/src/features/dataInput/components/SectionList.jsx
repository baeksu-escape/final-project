import { Card, EditableList, FieldError } from '../../../common/components/index.js'
import { createEmptyRow } from '../utils/inputValues.js'
import { errorKeyOf } from '../validation/inputValidation.js'
import FieldControl from './FieldControl.jsx'

// N-05 줄 추가·삭제 섹션(월별 소득, 대출, 기타 지출) — 공통 EditableList에 설정의 itemFields를 한 줄씩 그린다.
// onChange(items)로 바뀐 줄 목록 전체를 부모에 알린다. 섹션 전체 오류(최소 줄 수 등)는 목록 아래에 보여 준다.
export default function SectionList({ section, items, onChange, errors }) {
  return (
    <Card title={section.title} className={`input-section input-section--${section.key}`}>
      {section.description && <p className="input-section__description">{section.description}</p>}
      <EditableList
        items={items}
        onChange={onChange}
        createItem={() => createEmptyRow(section)}
        addLabel={section.addLabel}
        emptyMessage={section.emptyMessage}
        renderItem={(item, update) =>
          section.itemFields.map((field) => (
            <FieldControl
              key={field.key}
              field={field}
              value={item[field.key]}
              onChange={(fieldValue) => update({ [field.key]: fieldValue })}
              error={errors[errorKeyOf(section.key, field.key, item.id)]}
            />
          ))
        }
      />
      <FieldError message={errors[errorKeyOf(section.key)]} />
    </Card>
  )
}
