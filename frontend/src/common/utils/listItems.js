let sequence = 0

// EditableList 항목에 붙일 고유 id를 만든다.
export function createItemId() {
  sequence += 1
  return `item-${Date.now()}-${sequence}`
}

// 서버에서 받은 목록처럼 id가 없는 항목에 id를 붙인다. 이미 id가 있으면 그대로 둔다.
export function withItemIds(items) {
  return (items ?? []).map((item) => (item.id ? item : { ...item, id: createItemId() }))
}
