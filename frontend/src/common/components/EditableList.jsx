import { createItemId } from '../utils/listItems.js'

// 항목을 추가·삭제할 수 있는 입력 목록(예: 기타 지출, 대출 목록). 항목 모양과 입력 칸은 쓰는 쪽이 정한다.
// 각 항목에는 id가 붙어 있어야 한다. 서버에서 받은 목록은 utils/listItems.js의 withItemIds()로 id를 붙여 넣는다.
// 사용 예:
//   <EditableList
//     label="기타 지출"
//     items={expenses}
//     onChange={setExpenses}
//     createItem={() => ({ category: null, memo: '', amount: null })}
//     renderItem={(item, update) => (
//       <MoneyInput label="월 금액" value={item.amount} onChange={(amount) => update({ amount })} />
//     )}
//     addLabel="기타 지출 추가"
//   />
//   renderItem(item, update, index): update(patch)로 그 항목의 일부 값만 바꾼다.
//   maxItems: 최대 개수(없으면 제한 없음).
export default function EditableList({
  label,
  items,
  onChange,
  createItem,
  renderItem,
  addLabel = '항목 추가',
  removeLabel = '삭제',
  emptyMessage = '추가된 항목이 없습니다.',
  maxItems,
}) {
  const canAdd = maxItems === undefined || items.length < maxItems

  const handleAdd = () => onChange([...items, { ...createItem(), id: createItemId() }])
  const handleRemove = (id) => onChange(items.filter((item) => item.id !== id))
  const handleUpdate = (id, patch) => onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  return (
    <fieldset className="editable-list">
      {label && <legend className="editable-list__label">{label}</legend>}
      {items.length === 0 ? (
        <p className="editable-list__empty">{emptyMessage}</p>
      ) : (
        <ul className="editable-list__items">
          {items.map((item, index) => (
            <li key={item.id} className="editable-list__item">
              {renderItem(item, (patch) => handleUpdate(item.id, patch), index)}
              <button
                type="button"
                className="editable-list__remove"
                onClick={() => handleRemove(item.id)}
                aria-label={`${index + 1}번째 항목 ${removeLabel}`}
              >
                {removeLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="editable-list__add" onClick={handleAdd} disabled={!canAdd}>
        {addLabel}
      </button>
    </fieldset>
  )
}
