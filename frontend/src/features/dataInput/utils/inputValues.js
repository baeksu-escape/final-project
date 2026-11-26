import { withItemIds } from '../../../common/utils/listItems.js'
import { VALIDATION_LIMITS } from '../config/validationLimits.js'

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

// N-05-2 기준월 기본값 — 12개월을 받는 직군은 12줄의 끝 달(설정값, 지금은 지난달), 그 외 직군은 이번 달이다.
export function defaultBaseMonth(sections, date = new Date()) {
  if (!sections.some((section) => section.fixedMonths)) return currentMonth(date)
  return currentMonth(new Date(date.getFullYear(), date.getMonth() - VALIDATION_LIMITS.INCOME_END_MONTHS_AGO, 1))
}

// endMonth로 끝나는 count개월의 'YYYY-MM' 목록을 오래된 달부터 돌려준다.
function monthsEndingAt(endMonth, count) {
  const [year, month] = endMonth.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => currentMonth(new Date(year, month - count + index, 1)))
}

// N-05-2 기준월로 끝나는 달마다 한 줄씩 만든다. previousRows에 같은 달이 있으면 그 줄(입력한 금액)을 그대로 쓴다.
function createFixedMonthRows(section, endMonth, previousRows = []) {
  return withItemIds(
    monthsEndingAt(endMonth, section.fixedMonths).map(
      (month) => previousRows.find((row) => row.month === month) ?? { ...createEmptyRow(section), month },
    ),
  )
}

// N-05-7 저장 본문의 달이 범위 안의 서로 다른 달뿐이면 빈 달을 채워 줄로 되돌린다. 아니면 그대로 두어 검증 규칙(범위·중복·최대 줄 수)이 오류로 잡게 한다.
function restoreFixedMonthRows(section, endMonth, savedRows) {
  const rows = createFixedMonthRows(section, endMonth, savedRows)
  const months = savedRows.map((row) => row.month)
  const isInRange = months.every((month) => rows.some((row) => row.month === month))
  return isInRange && new Set(months).size === months.length ? rows : withItemIds(savedRows)
}

// N-05-2 기준월이 바뀌었을 때 달이 고정된 섹션의 줄을 새 기준월에 맞춘다. 겹치는 달의 금액은 유지한다.
export function withFixedMonthRows(values, sections) {
  const next = { ...values }
  for (const section of sections) {
    if (section.fixedMonths) next[section.key] = createFixedMonthRows(section, values.baseMonth, values[section.key])
  }
  return next
}

// 칸 섹션의 빈 값을 만든다.
function createEmptyFields(section) {
  return Object.fromEntries(section.fields.map((field) => [field.key, field.input === 'text' ? '' : null]))
}

// N-05 화면 입력값의 처음 상태 — { baseMonth, [섹션 key]: 칸 객체 | 줄 배열 }. 최소 줄 수가 있는 섹션은 빈 줄로 채워 둔다.
// 달이 고정된 섹션(N-05-2)은 기준월로 끝나는 달을 미리 채운 줄로 시작한다. noItems는 "대출 없음" 같은 체크 상태다(N-05-8).
export function createEmptyValues(sections, baseMonth = defaultBaseMonth(sections)) {
  const values = {
    baseMonth,
    noItems: Object.fromEntries(sections.filter((section) => section.noItemsLabel).map((section) => [section.key, false])),
  }
  for (const section of sections) {
    if (section.fixedMonths) {
      values[section.key] = createFixedMonthRows(section, baseMonth)
    } else {
      values[section.key] =
        section.kind === 'list'
          ? withItemIds(Array.from({ length: section.minItems ?? 0 }, () => createEmptyRow(section)))
          : createEmptyFields(section)
    }
  }
  return values
}

// FP-227 화면에 보일 최소 줄 맞추기 — 설정에 minRows가 있는 줄 섹션(대출)은 "없음" 체크가 풀려 있고 줄이 모자라면 빈 줄을 채운다.
// 처음 값·서버 저장본·임시저장본·[삭제]·체크 해제가 모두 이 함수를 지나므로 같은 규칙이 된다(DataInputPage가 화면 값을 바꿀 때마다 부른다).
// 채운 줄은 id와 함께 값에 들어가 다음 그리기에서도 같은 줄이다. 바꿀 것이 없으면 받은 값을 그대로 돌려준다.
// 요청 본문(buildPayload)·mock 서버 검사(toValues)에는 쓰지 않으므로 본문 모양은 바뀌지 않는다.
export function withMinimumRows(values, sections) {
  let next = values
  for (const section of sections) {
    if (section.kind !== 'list' || !section.minRows) continue
    if (section.noItemsLabel && values.noItems?.[section.key]) continue
    const rows = values[section.key] ?? []
    if (rows.length >= section.minRows) continue
    const added = withItemIds(Array.from({ length: section.minRows - rows.length }, () => createEmptyRow(section)))
    next = { ...next, [section.key]: [...rows, ...added] }
  }
  return next
}

// 서버에 저장된 요청 본문을 화면 입력값으로 되돌린다(불러온 줄에는 id를 붙인다).
export function toValues(input, sections) {
  const values = createEmptyValues(sections, input?.baseMonth ?? defaultBaseMonth(sections))
  for (const section of sections) {
    const saved = input?.[section.key]
    if (!saved) continue
    if (section.fixedMonths) {
      values[section.key] = restoreFixedMonthRows(section, values.baseMonth, saved.items ?? [])
    } else if (section.kind === 'list') {
      values[section.key] = withItemIds(saved.items ?? [])
      if (section.noItemsLabel) values.noItems[section.key] = saved.noItems === true
    } else if (section.restore) {
      // FP-260 저장 모양과 화면 칸이 다른 섹션(기간: periodMonths → 년·개월 두 칸)은 섹션 설정의 restore로 되돌린다.
      Object.assign(values[section.key], section.restore(saved))
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
      // FP-227 "없음" 체크면 잠가 둔 줄은 보내지 않는다(체크하면 줄을 지우던 때와 같은 본문: items: [], noItems: true).
      const noItems = section.noItemsLabel ? values.noItems[section.key] : false
      body.items = noItems ? [] : value.map(withoutId)
      if (section.noItemsLabel) body.noItems = noItems
    } else {
      // FP-86 체크 칸은 true/false로, 비활성 칸(disabledWhen)은 null로 보낸다.
      for (const field of section.fields) {
        // FP-260 화면 전용 칸(localOnly)은 본문에 넣지 않는다. 보낼 값은 아래 derive가 만든다.
        if (field.localOnly) continue
        if (field.input === 'checkbox') body[field.key] = value[field.key] === true
        else body[field.key] = field.disabledWhen?.(value) ? null : value[field.key]
      }
      Object.assign(body, section.derive?.(value))
    }
    payload[section.key] = body
  }
  return payload
}

// 저장된 요청 본문 기준으로 섹션별 입력 여부를 돌려준다 — 줄 섹션은 한 줄 이상이거나 "없음" 체크, 칸 섹션은 한 칸 이상이면 입력함.
// 섹션 설정에 isComplete가 있으면 그 조건을 쓴다(N-05-8 월별 소득은 12개월을 모두 입력해야 완료).
export function getSectionStatus(input, sections) {
  return Object.fromEntries(
    sections.map((section) => {
      const saved = input?.[section.key]
      if (section.isComplete) return [section.key, section.isComplete(saved)]
      const filled =
        section.kind === 'list'
          ? (saved?.items?.length ?? 0) > 0 || saved?.noItems === true
          : section.fields.some((field) =>
              field.input === 'checkbox' ? saved?.[field.key] === true : !isEmptyValue(saved?.[field.key]),
            )
      return [section.key, filled]
    }),
  )
}
