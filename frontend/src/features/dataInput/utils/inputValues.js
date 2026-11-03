import { withItemIds } from '../../../common/utils/listItems.js'

// 이번 달을 'YYYY-MM' 문자열로 돌려준다(기준월 기본값).
export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// 값이 비었는지 본다. null·undefined·공백 문자열이면 빈 값이다(0은 입력한 값으로 본다).
export function isEmptyValue(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

// 줄 섹션의 빈 줄 하나를 만든다(id는 EditableList가 붙인다).
export function createEmptyRow(section) {
  return Object.fromEntries(section.itemFields.map((field) => [field.key, field.input === 'text' ? '' : null]))
}

// 칸 섹션의 빈 값을 만든다.
function createEmptyFields(section) {
  return Object.fromEntries(section.fields.map((field) => [field.key, field.input === 'text' ? '' : null]))
}

// N-05 화면 입력값의 처음 상태 — { baseMonth, [섹션 key]: 칸 객체 | 줄 배열 }. 최소 줄 수가 있는 섹션은 빈 줄로 채워 둔다.
export function createEmptyValues(sections, baseMonth = currentMonth()) {
  const values = { baseMonth }
  for (const section of sections) {
    values[section.key] =
      section.kind === 'list'
        ? withItemIds(Array.from({ length: section.minItems ?? 0 }, () => createEmptyRow(section)))
        : createEmptyFields(section)
  }
  return values
}

// 서버에 저장된 요청 본문을 화면 입력값으로 되돌린다(불러온 줄에는 id를 붙인다).
export function toValues(input, sections) {
  const values = createEmptyValues(sections, input?.baseMonth ?? currentMonth())
  for (const section of sections) {
    const saved = input?.[section.key]
    if (!saved) continue
    if (section.kind === 'list') {
      values[section.key] = withItemIds(saved.items ?? [])
    } else {
      for (const field of section.fields) values[section.key][field.key] = saved[field.key] ?? values[section.key][field.key]
    }
  }
  return values
}

// 줄에서 화면용 id를 뺀다.
function withoutId(row) {
  const copy = { ...row }
  delete copy.id
  return copy
}

// N-05 화면 입력값을 요청 본문으로 바꾼다. 모든 섹션에 기준월(baseMonth)을 함께 넣는다. 연소득은 받지 않는다.
export function buildPayload(values, sections, jobType) {
  const payload = { jobType, baseMonth: values.baseMonth }
  for (const section of sections) {
    const value = values[section.key]
    const body = { baseMonth: values.baseMonth, ...section.payloadExtra }
    if (section.kind === 'list') {
      body.items = value.map(withoutId)
    } else {
      for (const field of section.fields) body[field.key] = value[field.key]
      Object.assign(body, section.derive?.(value))
    }
    payload[section.key] = body
  }
  return payload
}

// 저장된 요청 본문 기준으로 섹션별 입력 여부를 돌려준다 — 줄 섹션은 한 줄 이상, 칸 섹션은 한 칸 이상이면 입력함.
export function getSectionStatus(input, sections) {
  return Object.fromEntries(
    sections.map((section) => {
      const saved = input?.[section.key]
      const filled =
        section.kind === 'list'
          ? (saved?.items?.length ?? 0) > 0
          : section.fields.some((field) => !isEmptyValue(saved?.[field.key]))
      return [section.key, filled]
    }),
  )
}
