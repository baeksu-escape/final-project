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

// (시안) 쉬운 화면용 상황 버튼 5개 — 값은 위 프리셋 그대로 쓰고 이름만 쉬운 말로 바꾼다.
export const EASY_PRESETS = [
  { ...BASE_PRESET, label: '지금으로' },
  { ...WORSE_PRESETS[0], label: '금리 오름 (+1%p)' },
  { ...WORSE_PRESETS[2], label: '소득 줄어듦 (−20%)' },
  { ...WORSE_PRESETS[3], label: '모두 나빠짐' },
  { ...BETTER_PRESETS[3], label: '좋아짐' },
]

// 슬라이더 범위(slider*)와 직접 입력 범위(input*)는 다르다. 직접 입력은 더 넓게 받는다.
// (시안) label은 쉬운 이름, help는 칸 아래 한 줄 설명이다.
export const SCENARIO_FIELDS = [
  { key: 'ratePctPoint', label: '대출 금리', help: '+1이면 연 5% → 6%처럼 1%p 올라요', unit: '%p', sliderMin: -2, sliderMax: 3, step: 0.5, inputMin: -5, inputMax: 10 },
  // (시안 2차) baseKey가 있으면 화면은 지금 금액을 기준으로 금액(원)을 직접 입력받고 퍼센트로 바꿔 보낸다.
  { key: 'incomePct', label: '월 소득', baseKey: 'monthlyIncomeAmount', help: '−20이면 월 소득이 20% 줄어요', unit: '%', sliderMin: -50, sliderMax: 30, step: 5, inputMin: -100, inputMax: 100 },
  { key: 'expensePct', label: '월 지출', baseKey: 'monthlyExpenseAmount', help: '+10이면 월 지출이 10% 늘어요', unit: '%', sliderMin: -30, sliderMax: 30, step: 5, inputMin: -50, inputMax: 100 },
]

const KEYS = SCENARIO_FIELDS.map((field) => field.key)

// (시안 2차) 금액 칸을 쓸 수 있는 항목이면 지금 금액(원), 아니면 null.
export const baseAmountOf = (field, baseline) => {
  const amount = field.baseKey ? baseline?.[field.baseKey] : null
  return Number.isFinite(amount) && amount > 0 ? amount : null
}
// 퍼센트 ↔ 금액 변환. 금액은 원 단위 반올림. 퍼센트는 반올림하지 않는다 — 반올림하면 입력 중인 작은 금액(예: '1')이
// −100%로 바뀌어 칸에 0이 보이므로, 입력한 금액이 그대로 돌아오게 그대로 둔다(서버는 소수 퍼센트를 받는다).
export const amountFromPct = (base, pct) => Math.round(base * (1 + pct / 100))
export const pctFromAmount = (base, amount) => (amount / base - 1) * 100
// 허용 금액 범위 — 퍼센트 입력 범위(inputMin~inputMax)를 지금 금액에 적용한 값이다.
export const amountRange = (field, base) => [amountFromPct(base, field.inputMin), amountFromPct(base, field.inputMax)]

// N-17-2 화면에서 막는 입력 검사(최종 검사는 서버가 한다). 문제가 없으면 빈 문자열.
// (시안 2차) baseline을 주면 금액 칸을 쓰는 항목은 범위를 원으로 안내한다.
export function scenarioInputError(scenario, baseline = null) {
  for (const field of SCENARIO_FIELDS) {
    const value = scenario[field.key]
    if (value === null || value === undefined) return `${field.label}을(를) 입력해 주세요.`
    if (!Number.isFinite(value) || value < field.inputMin || value > field.inputMax) {
      const base = baseAmountOf(field, baseline)
      if (base) {
        const [min, max] = amountRange(field, base)
        return `${field.label}은(는) ${min.toLocaleString('ko-KR')}~${max.toLocaleString('ko-KR')}원 사이로 입력해 주세요.`
      }
      return `${field.label}은(는) ${field.inputMin}~${field.inputMax}${field.unit} 사이로 입력해 주세요.`
    }
  }
  return ''
}

export const presetValues = (preset) => Object.fromEntries(KEYS.map((key) => [key, preset[key]]))
