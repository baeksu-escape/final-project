import { BASE_MONTH_FIELD } from '../config/inputSections.js'
import { isEmptyValue } from '../utils/inputValues.js'

// 필수 칸이 비었을 때의 기본 문구.
export const REQUIRED_MESSAGE = '필수 입력 항목입니다.'

// ★ FP-86 상세 검증을 꽂는 자리 ① — 화면 전체를 보고 판단하는 규칙을 이 배열에 함수로 넣는다.
//   함수 모양: (values, sections) => ({ [오류 key]: '오류 문구' })   오류 key 규칙은 아래 errorKeyOf 참고.
//   예) FORM_VALIDATORS.push((values) => (중복된 달이 있으면 ? { income: '같은 달이 두 번 입력되었습니다.' } : {}))
// ★ 꽂는 자리 ② — 칸 하나만 보는 규칙은 config/inputSections.js의 칸 설정에 validate(value, { row, values })를 단다.
export const FORM_VALIDATORS = []

// 오류 key를 만든다 — 칸 섹션은 '섹션.칸', 줄 섹션은 '섹션.줄id.칸', 섹션 전체 오류는 '섹션'.
export function errorKeyOf(sectionKey, fieldKey, rowId) {
  if (!fieldKey) return sectionKey
  return rowId ? `${sectionKey}.${rowId}.${fieldKey}` : `${sectionKey}.${fieldKey}`
}

// 칸 하나를 검사해 오류가 있으면 errors에 넣는다 — 필수 검사를 먼저 하고, 값이 있을 때만 칸의 validate를 부른다.
function checkField(field, value, context, errors, key) {
  if (field.required && isEmptyValue(value)) {
    errors[key] = field.requiredMessage ?? REQUIRED_MESSAGE
    return
  }
  if (field.validate && !isEmptyValue(value)) {
    const message = field.validate(value, context)
    if (message) errors[key] = message
  }
}

// N-05 입력 검증 — 이번 이슈는 필수 항목이 비었는지만 본다. 오류가 없으면 빈 객체를 돌려준다.
// 실행 순서: ① 필수 검사 ② 칸 설정의 validate ③ FORM_VALIDATORS. 같은 key에 이미 오류가 있으면 앞의 오류를 남긴다.
export function validateFinancialInput(values, sections) {
  const errors = {}
  checkField(BASE_MONTH_FIELD, values.baseMonth, { values }, errors, BASE_MONTH_FIELD.key)

  for (const section of sections) {
    const value = values[section.key]
    if (section.kind === 'list') {
      if (section.minItems && value.length < section.minItems) {
        errors[errorKeyOf(section.key)] = section.minItemsMessage ?? REQUIRED_MESSAGE
      }
      for (const row of value) {
        for (const field of section.itemFields) {
          checkField(field, row[field.key], { row, values }, errors, errorKeyOf(section.key, field.key, row.id))
        }
      }
    } else {
      for (const field of section.fields) {
        checkField(field, value[field.key], { row: value, values }, errors, errorKeyOf(section.key, field.key))
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
