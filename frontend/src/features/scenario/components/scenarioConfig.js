// N-17-2 시나리오 입력 설정 — 상황 버튼과 슬라이더·직접 입력 범위는 확정 UI 초안 값이다(시연 설정, 계산 규칙 아님).
export const BASE_PRESET = { id: 'base', label: '현재 상황으로 되돌리기', ratePctPoint: 0, incomePct: 0, expensePct: 0 }

export const WORSE_PRESETS = [
  { id: 'rate1', label: '금리 +1%p', ratePctPoint: 1, incomePct: 0, expensePct: 0 },
  { id: 'rate2', label: '금리 +2%p', ratePctPoint: 2, incomePct: 0, expensePct: 0 },
  { id: 'income-20', label: '소득 −20%', ratePctPoint: 0, incomePct: -20, expensePct: 0 },
  { id: 'worse', label: '악화 복합 (금리 +1%p · 소득 −20% · 지출 +10%)', ratePctPoint: 1, incomePct: -20, expensePct: 10 },
]

export const BETTER_PRESETS = [
  { id: 'rate-1', label: '금리 −1%p', ratePctPoint: -1, incomePct: 0, expensePct: 0 },
  { id: 'income10', label: '소득 +10%', ratePctPoint: 0, incomePct: 10, expensePct: 0 },
  { id: 'expense-10', label: '지출 −10%', ratePctPoint: 0, incomePct: 0, expensePct: -10 },
  { id: 'better', label: '호전 복합 (금리 −0.5%p · 소득 +10% · 지출 −10%)', ratePctPoint: -0.5, incomePct: 10, expensePct: -10 },
]

// 슬라이더 범위(slider*)와 직접 입력 범위(input*)는 다르다. 직접 입력은 더 넓게 받는다.
export const SCENARIO_FIELDS = [
  { key: 'ratePctPoint', label: '금리 변화', unit: '%p', sliderMin: -2, sliderMax: 3, step: 0.5, inputMin: -5, inputMax: 10 },
  { key: 'incomePct', label: '소득 변화', unit: '%', sliderMin: -50, sliderMax: 30, step: 5, inputMin: -100, inputMax: 100 },
  { key: 'expensePct', label: '지출 변화', unit: '%', sliderMin: -30, sliderMax: 30, step: 5, inputMin: -50, inputMax: 100 },
]

const KEYS = SCENARIO_FIELDS.map((field) => field.key)

// N-17-2 화면에서 막는 입력 검사(최종 검사는 서버가 한다). 문제가 없으면 빈 문자열.
export function scenarioInputError(scenario) {
  for (const field of SCENARIO_FIELDS) {
    const value = scenario[field.key]
    if (value === null || value === undefined) return `${field.label}을(를) 입력해 주세요.`
    if (!Number.isFinite(value) || value < field.inputMin || value > field.inputMax) {
      return `${field.label}은(는) ${field.inputMin}~${field.inputMax}${field.unit} 사이로 입력해 주세요.`
    }
  }
  return ''
}

export const presetValues = (preset) => Object.fromEntries(KEYS.map((key) => [key, preset[key]]))
