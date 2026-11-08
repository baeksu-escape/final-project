import { BASE_MONTH_FIELD } from '../config/inputSections.js'
import { currentMonth, isEmptyValue } from '../utils/inputValues.js'
import { findDuplicateRowIds } from './inputRules.js'

// 필수 칸이 비었을 때의 기본 문구.
export const REQUIRED_MESSAGE = '필수 입력 항목입니다.'

// ★ FP-86 상세 검증을 꽂는 자리 ① — 화면 전체를 보고 판단하는 규칙을 이 배열에 함수로 넣는다.
//   함수 모양: (values, sections) => ({ [오류 key]: '오류 문구' })   오류 key 규칙은 아래 errorKeyOf 참고.
//   예) FORM_VALIDATORS.push((values) => (중복된 달이 있으면 ? { income: '같은 달이 두 번 입력되었습니다.' } : {}))
// ★ 꽂는 자리 ② — 칸 하나만 보는 규칙은 config/inputSections.js의 칸 설정에 validate(value, { row, values, nowMonth })를 단다.
// FP-86에서 꽂은 규칙: checkListRules(줄 목록의 같은 값 중복·최대 줄 수)
export const FORM_VALIDATORS = [checkListRules]

// FP-86 줄 목록 규칙 — 섹션 설정에 uniqueField가 있으면 앞줄과 같은 값을, maxItems가 있으면 최대 줄 수 초과를 오류로 본다.
function checkListRules(values, sections) {
  const errors = {}
  for (const section of sections) {
    if (section.kind !== 'list') continue
    const rows = values[section.key]
    if (section.maxItems && rows.length > section.maxItems) {
      errors[errorKeyOf(section.key)] = section.maxItemsMessage
    }
    if (section.uniqueField) {
      for (const rowId of findDuplicateRowIds(rows, section.uniqueField)) {
        errors[errorKeyOf(section.key, section.uniqueField, rowId)] = section.duplicateMessage
      }
    }
  }
  return errors
}

// 오류 key를 만든다 — 칸 섹션은 '섹션.칸', 줄 섹션은 '섹션.줄id.칸', 섹션 전체 오류는 '섹션'.
export function errorKeyOf(sectionKey, fieldKey, rowId) {
  if (!fieldKey) return sectionKey
  return rowId ? `${sectionKey}.${rowId}.${fieldKey}` : `${sectionKey}.${fieldKey}`
}

// 칸 하나를 검사해 오류가 있으면 errors에 넣는다 — 필수 검사를 먼저 하고, 값이 있을 때만 칸의 validate를 부른다.
// checkRequired가 false면 필수 검사는 건너뛴다(첫 저장 전에는 빈 칸 오류를 보여 주지 않기 위해서).
function checkField(field, value, context, errors, key, checkRequired) {
  if (field.required && isEmptyValue(value)) {
    if (checkRequired) errors[key] = field.requiredMessage ?? REQUIRED_MESSAGE
    return
  }
  if (field.validate && !isEmptyValue(value)) {
    const message = field.validate(value, context)
    if (message) errors[key] = message
  }
}

// N-05 입력 검증 — 필수 항목(FP-85)과 상세 규칙(FP-86)을 검사한다. 오류가 없으면 빈 객체를 돌려준다.
// 실행 순서: ① 필수 검사 ② 칸 설정의 validate ③ FORM_VALIDATORS. 같은 key에 이미 오류가 있으면 앞의 오류를 남긴다.
// options.checkRequired: false면 빈 필수 칸·최소 줄 수 오류를 빼고 잘못된 값만 본다(기본 true).
// options.nowMonth: 미래 월 판단 기준 'YYYY-MM'(기본 이번 달).
export function validateFinancialInput(values, sections, { checkRequired = true, nowMonth = currentMonth() } = {}) {
  const errors = {}
  checkField(BASE_MONTH_FIELD, values.baseMonth, { values, nowMonth }, errors, BASE_MONTH_FIELD.key, checkRequired)

  for (const section of sections) {
    const value = values[section.key]
    if (section.kind === 'list') {
      if (checkRequired && section.minItems && value.length < section.minItems) {
        errors[errorKeyOf(section.key)] = section.minItemsMessage ?? REQUIRED_MESSAGE
      }
      for (const row of value) {
        for (const field of section.itemFields) {
          const key = errorKeyOf(section.key, field.key, row.id)
          checkField(field, row[field.key], { row, values, nowMonth }, errors, key, checkRequired)
        }
      }
    } else {
      for (const field of section.fields) {
        const key = errorKeyOf(section.key, field.key)
        checkField(field, value[field.key], { row: value, values, nowMonth }, errors, key, checkRequired)
      }
    }
  }

  for (const validator of FORM_VALIDATORS) {
    const extra = validator(values, sections) ?? {}
    for (const [key, message] of Object.entries(extra)) {
      if (!errors[key]) errors[key] = message
    }
  }
  return errors
}

// FP-86 N-05 입력 안내 — 섹션 설정에 notice(값)가 있으면 그 안내 문구를 { 섹션 key: 문구 }로 모은다.
// 오류가 아니므로 저장을 막지 않는다(예: 월별 소득 6개월 미만 '정보 부족').
export function getInputNotices(values, sections) {
  const notices = {}
  for (const section of sections) {
    const message = section.notice?.(values[section.key])
    if (message) notices[section.key] = message
  }
  return notices
}
