// N-04-6 등급 코드 → 화면에 보일 이름. 값은 공통 등급 상수(common/config/grades.js)에 있고 여기서는 다시 내보내기만 한다.
export { GRADE_LABELS } from '../../common/config/grades.js'

// N-04-6 진단 내역이 0건일 때 보일 안내 문구.
export const EMPTY_HISTORY_MESSAGE = '아직 산출한 점수가 없습니다.'

// N-04-6 산출 불가(NOT_SCORABLE) 평가의 등급 칸 표기. 뒤에 사유 문구(common/config/scoreStatus.js, FP-86과 같은 문구)를 붙인다.
export const NOT_SCORABLE_LABEL = '산출 불가'
