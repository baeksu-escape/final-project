import { Card, Checkbox, EditableList, FieldError } from '../../../common/components/index.js'
import { createEmptyRow } from '../utils/inputValues.js'
import { errorKeyOf } from '../validation/inputValidation.js'
import FieldControl from './FieldControl.jsx'

// N-05-2 달이 고정된 줄(월별 소득 12개월) — 줄을 추가·삭제하지 않고, 달을 이름에 붙인 입력 칸만 그린다. 달 칸의 오류는 글로만 보여 준다.
function FixedMonthRows({ section, items, onChange, errors }) {
  // 고친 줄만 바꾼 새 목록을 부모에 넘긴다.
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

// FP-227 "없음" 체크로 잠긴 줄 목록 — 공통 EditableList와 같은 마크업(클래스)으로 줄을 그리되, fieldset disabled로 칸·[삭제]·[추가]를 모두 잠근다.
// 칸에는 값 대신 '해당 없음'이 보이고, 줄 값은 부모가 그대로 보관한다. 줄이 없으면 잠긴 빈 줄 하나를 모양으로만 그린다(값에는 넣지 않는다).
function LockedRows({ section, items }) {
  const rows = items.length > 0 ? items : [{ ...createEmptyRow(section), id: 'locked-placeholder' }]
  return (
    <fieldset className="editable-list input-section__locked" disabled>
      <ul className="editable-list__items">
        {rows.map((item, index) => (
          <li key={item.id} className="editable-list__item">
            {section.itemFields.map((field) => (
              <FieldControl key={field.key} field={field} value={item[field.key]} onChange={() => {}} disabled />
            ))}
            <button type="button" className="editable-list__remove" aria-label={`${index + 1}번째 항목 삭제`}>
              삭제
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="editable-list__add">
        {section.addLabel}
      </button>
    </fieldset>
  )
}

// N-05 줄 추가·삭제 섹션(월별 소득, 대출, 할부·정기결제) — 공통 EditableList에 설정의 itemFields를 한 줄씩 그린다.
// onChange(items)로 바뀐 줄 목록 전체를 부모에 알린다. 섹션 전체 오류(최소 줄 수 등)는 목록 아래에 보여 준다.
// FP-86: 설정의 maxItems만큼 줄이 차면 추가 버튼이 막힌다.
// N-05-8: 설정에 noItemsLabel이 있으면 "없음" 체크를 보여 준다. FP-227: 체크하면 줄을 숨기지 않고 잠근다(LockedRows).
// headerSlot은 설명 아래에 먼저 끼워 넣을 칸(예: 월별 소득 카드 안의 기준월)이다.
export default function SectionList({ section, items, onChange, errors, noItems = false, onNoItemsChange, headerSlot }) {
  return (
    <Card title={section.title} className={`input-section input-section--${section.key}`}>
      {section.description && <p className="input-section__description">{section.description}</p>}
      {headerSlot}
      {section.noItemsLabel && <Checkbox label={section.noItemsLabel} checked={noItems} onChange={onNoItemsChange} />}
      {section.fixedMonths ? (
        <FixedMonthRows section={section} items={items} onChange={onChange} errors={errors} />
      ) : noItems ? (
        <LockedRows section={section} items={items} />
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
    </Card>
  )
}
