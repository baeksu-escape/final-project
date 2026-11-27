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
//   itemLabel: 카드 머리말 이름(예: '대출' → '대출 1'). 카드 오른쪽 위에는 늘 [초기화](그 카드 칸만 비움)가 있고,
//   항목이 2개 이상이면 카드 오른쪽 아래 맨 밑에 [삭제]가 붙는다(1개뿐일 때는 지울 수 없다).
export default function EditableList({
  label,
  items,
  onChange,
  createItem,
  renderItem,
  addLabel = '항목 추가',
  removeLabel = '삭제',
  resetLabel = '초기화',
  itemLabel = '항목',
  emptyMessage = '추가된 항목이 없습니다.',
  maxItems,
}) {
  const canAdd = maxItems === undefined || items.length < maxItems

  // 항목 추가·삭제·수정 — 항상 바뀐 새 목록을 만들어 부모에 넘긴다.
  const handleAdd = () => onChange([...items, { ...createItem(), id: createItemId() }])
  const handleRemove = (id) => onChange(items.filter((item) => item.id !== id))
  const handleUpdate = (id, patch) => onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  // [초기화] — 지우지 않고 같은 id로 빈 칸만 되돌린다. [삭제]는 2개 이상일 때만(카드가 모두 사라져 입력할 곳이 없어지지 않게)
  const canRemove = items.length > 1
  const handleReset = (id) => onChange(items.map((item) => (item.id === id ? { ...createItem(), id } : item)))

  return (
    <fieldset className="editable-list">
      {label && <legend className="editable-list__label">{label}</legend>}
      {items.length === 0 ? (
        <p className="editable-list__empty">{emptyMessage}</p>
      ) : (
        <ul className="editable-list__items">
          {items.map((item, index) => (
            <li key={item.id} className="editable-list__item">
              <div className="editable-list__item-head">
                <span>{itemLabel} {index + 1}</span>
                <button
                  type="button"
                  className="editable-list__remove editable-list__remove--reset"
                  onClick={() => handleReset(item.id)}
                  aria-label={`${itemLabel} ${index + 1} ${resetLabel}`}
                >
                  {resetLabel}
                </button>
              </div>
              {renderItem(item, (patch) => handleUpdate(item.id, patch), index)}
              {canRemove && (
                <button
                  type="button"
                  className="editable-list__remove editable-list__remove--bottom"
                  onClick={() => handleRemove(item.id)}
                  aria-label={`${itemLabel} ${index + 1} ${removeLabel}`}
                >
                  {removeLabel}
                </button>
              )}
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
