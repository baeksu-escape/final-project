import { PATHS } from '../../common/config/navigation.js'

// N-05 데이터 입력 화면 경로. 값은 공통 PATHS에 두고 여기서는 가리키기만 한다(직군 선택 경로는 PATHS.SELECT_JOB).
export const DATA_INPUT_PATHS = Object.freeze({
  DATA_INPUT: PATHS.DATA_INPUT,
})

// FP-227 데이터 입력 1단계 [이전]으로 직군 선택에 갈 때 넘기는 표시(location.state.from). 직군 선택 화면은 이때만 직군이 있는 사용자를 머물게 한다.
export const FROM_DATA_INPUT = 'data-input'
