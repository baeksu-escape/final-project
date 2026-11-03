// 직군 3분류 (decisions.md 확정). 값은 백엔드와 같은 코드 문자열을 쓴다.
export const JOB_TYPES = Object.freeze({
  EMPLOYEE: 'EMPLOYEE',
  SELF_EMPLOYED: 'SELF_EMPLOYED',
  FREELANCER: 'FREELANCER',
})

// 직군 코드 → 화면에 보일 한국어 이름.
export const JOB_TYPE_LABELS = Object.freeze({
  [JOB_TYPES.EMPLOYEE]: '급여소득자',
  [JOB_TYPES.SELF_EMPLOYED]: '자영업자',
  [JOB_TYPES.FREELANCER]: '프리랜서',
})

// 선택 상자 등에 바로 넘길 수 있는 목록 형태.
export const JOB_TYPE_OPTIONS = Object.values(JOB_TYPES).map((value) => ({
  value,
  label: JOB_TYPE_LABELS[value],
}))
