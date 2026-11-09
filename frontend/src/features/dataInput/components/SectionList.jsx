import { Card, EditableList, FieldError } from '../../../common/components/index.js'
import { createEmptyRow } from '../utils/inputValues.js'
import { errorKeyOf } from '../validation/inputValidation.js'
import FieldControl from './FieldControl.jsx'

// N-05-2 달이 고정된 줄(월별 소득 12개월) — 줄을 추가·삭제하지 않고, 달을 이름에 붙인 입력 칸만 그린다. 달 칸의 오류는 글로만 보여 준다.
function FixedMonthRows({ section, items, onChange, errors }) {
  const updateRow = (id, patch) => onChange(items.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  return (
    <ul className="input-section__month-rows">
      {items.map((item) => (
        <li key={item.id} className="input-section__month-row">
          {section.itemFields.map((field) => {
            const error = errors[errorKeyOf(section.key, field.key, item.id)]
            if (field.readOnly) return <FieldError key={field.key} message={error} />
            return (
              <FieldControl
                key={field.key}
                field={{ ...field, label: `${item.month} ${field.label}` }}
                value={item[field.key]}
                onChange={(fieldValue) => updateRow(item.id, { [field.key]: fieldValue })}
                error={error}
              />
            )
          })}
        </li>
      ))}
    </ul>
  )
}

// N-05 줄 추가·삭제 섹션(월별 소득, 대출, 할부·정기결제) — 공통 EditableList에 설정의 itemFields를 한 줄씩 그린다.
// onChange(items)로 바뀐 줄 목록 전체를 부모에 알린다. 섹션 전체 오류(최소 줄 수 등)는 목록 아래에 보여 준다.
// FP-86: 설정의 maxItems만큼 줄이 차면 추가 버튼이 막히고, notice(오류가 아닌 안내 문구)가 있으면 목록 아래에 보여 준다.
export default function SectionList({ section, items, onChange, errors, notice }) {
  return (
    <Card title={section.title} className={`input-section input-section--${section.key}`}>
      {section.description && <p className="input-section__description">{section.description}</p>}
      {section.fixedMonths ? (
        <FixedMonthRows section={section} items={items} onChange={onChange} errors={errors} />
      ) : (
        <EditableList
          items={items}
          onChange={onChange}
          createItem={() => createEmptyRow(section)}
          addLabel={section.addLabel}
          emptyMessage={section.emptyMessage}
          maxItems={section.maxItems}
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
      )}
      <FieldError message={errors[errorKeyOf(section.key)]} />
      {notice && (
        <p className="input-section__notice" role="status">
          {notice}
        </p>
      )}
    </Card>
  )
}
