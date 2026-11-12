import { BASE_MONTH_FIELD } from '../config/inputSections.js'
import { errorKeyOf } from './inputValidation.js'

// FP-86 N-05 서버 입력 오류 변환 — 서버(또는 mock)가 400으로 돌려준 칸별 오류를 화면 오류 key로, 또는 그 반대로 바꾼다.
// TODO(D-20) 응답 형식 임시안: { code: 'INVALID_INPUT', message, fieldErrors: [{ field, message }] }
//   field 모양(Spring 검증 오류의 필드 경로와 같은 꼴):
//     'baseMonth'                       기준월
//     'income.monthlySalary'            칸 섹션의 칸
//     'loans.items[0].balanceAmount'    줄 섹션의 0번째 줄 칸(화면은 줄 순서로 줄 id를 찾는다)
//     'income.items'                    줄 섹션 전체(최소·최대 줄 수 등)

// 서버가 입력값 오류를 알려 줄 때의 코드(error.data.code).
export const INPUT_ERROR_CODE = 'INVALID_INPUT'

// N-05-8 [점수 산출하기]가 409로 막힐 때의 코드(error.data.code). Avenue API 명세서 B팀 v0.2 3-1 기준.
//   INPUT_INCOMPLETE: 입력 완료 현황이 덜 참 / JOB_TYPE_REQUIRED: 직군 미선택 / REQUEST_ID_CONFLICT: 이미 쓰인 requestId
export const SCORE_ERROR_CODES = Object.freeze({
  INPUT_INCOMPLETE: 'INPUT_INCOMPLETE',
  JOB_TYPE_REQUIRED: 'JOB_TYPE_REQUIRED',
  REQUEST_ID_CONFLICT: 'REQUEST_ID_CONFLICT',
})

const ROW_FIELD_PATH = /^(\w+)\.items\[(\d+)\]\.(\w+)$/
const LIST_PATH = /^(\w+)\.items$/
const SECTION_FIELD_PATH = /^(\w+)\.(\w+)$/

// 서버 필드 경로 하나를 화면 오류 key로 바꾼다. 지금 화면에 없는 섹션·줄·칸이면 null.
function toErrorKey(path, values) {
  const row = ROW_FIELD_PATH.exec(path)
  if (row) {
    const [, sectionKey, index, fieldKey] = row
    const item = Array.isArray(values[sectionKey]) ? values[sectionKey][Number(index)] : undefined
    return item ? errorKeyOf(sectionKey, fieldKey, item.id) : null
  }
  const list = LIST_PATH.exec(path)
  if (list) return Array.isArray(values[list[1]]) ? errorKeyOf(list[1]) : null
  const field = SECTION_FIELD_PATH.exec(path)
  if (field) {
    const section = values[field[1]]
    return section && !Array.isArray(section) && field[2] in section ? errorKeyOf(field[1], field[2]) : null
  }
  return path === BASE_MONTH_FIELD.key ? path : null
}

// 서버 fieldErrors를 화면 오류로 바꾼다 → { errors: { 화면 오류 key: 문구 }, unmatched: [화면에서 칸을 찾지 못한 문구] }
// TODO(D-20) fieldErrors는 팀 공통 형식이 정해지지 않은 임시 형식이다.
export function fromServerFieldErrors(fieldErrors, values) {
  const errors = {}
  const unmatched = []
  for (const { field, message } of fieldErrors ?? []) {
    const key = toErrorKey(field, values)
    if (key) errors[key] = message
    else unmatched.push(message)
  }
  return { errors, unmatched }
}

// 화면 오류 key 하나를 서버 필드 경로로 바꾼다. 줄 id는 그 줄의 순서(index)로 바꾼다.
function toFieldPath(key, values) {
  const [sectionKey, second, third] = key.split('.')
  if (third) return `${sectionKey}.items[${values[sectionKey].findIndex((row) => row.id === second)}].${third}`
  if (second) return `${sectionKey}.${second}`
  return Array.isArray(values[sectionKey]) ? `${sectionKey}.items` : sectionKey
}

// 화면 오류를 서버 fieldErrors 모양으로 바꾼다 — mock이 실제 서버처럼 400 응답을 만들 때 쓴다.
export function toServerFieldErrors(errors, values) {
  return Object.entries(errors).map(([key, message]) => ({ field: toFieldPath(key, values), message }))
}
