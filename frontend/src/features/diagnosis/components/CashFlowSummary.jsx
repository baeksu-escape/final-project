import { OTHER_EXPENSE_CATEGORY_OPTIONS } from '../../dataInput/config/inputOptions.js'

// N-21-9 예측 결과 요약 — 예측 기간 누적 여유 자금, 가장 빠듯한 달, 월 지출 구성(CASH-04). 예상 점수 카드는 11/25 팀 결정으로 뺐다.
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v)).toLocaleString('ko-KR')}`
const monthLabel = (baseMonth) => `${Number(String(baseMonth).slice(5, 7))}월`

const won = (v) => (Number.isFinite(v) ? `${Math.round(v).toLocaleString('ko-KR')}원` : '—')

// N-21-5 월 지출 구성 — 월 고정 지출(조건 값)·월 원리금(대출 상환)·할부·정기결제(기타 지출 기준값)와 합계를 보여 준다. 간편결제는 합계에 넣지 않는다.
// 월 고정 지출은 마지막으로 예측에 적용된 조건의 값이다. 서버 baseOtherExpenseAmount는 "월 지출 합계 − 고정지출(할부·정기결제·기타)"이라 할부·정기결제·기타 칸에 쓴다. 값이 하나라도 없으면 합계는 "—"이다. 조건이 바뀌어 결과가 이전 조건 기준이면 그래프처럼 흐리게 보인다.
// N-21-5 월 지출 구성의 항목 한 줄 — 목록이 있으면 접힌 줄(합계 줄 문구 그대로)을 펼쳐 항목을 보여 주고, 없으면 금액만 보여 준다.
function BreakdownRow({ label, amount, items }) {
  const summary = <>{label} <b className="num">{won(amount)}</b></>
  if (!items?.length) return <span className="cf-hint">{summary}</span>
  return <details className="cf-hint"><summary>{summary}</summary><ul>{items.map((item, index) => <li key={index}>{item.text}</li>)}</ul></details>
}

// N-21-3 할부·정기결제·기타 항목 이름 — 분류가 코드면 OTHER_EXPENSE_CATEGORY_OPTIONS 라벨, 서버가 한글 이름(예: "의료비")으로 저장했으면 그대로, 비어 있으면 그룹 라벨 → "기타". 설명이 비어 있으면 괄호를 붙이지 않는다.
// 서버가 정한 순서(금액 큰 순)를 그대로 쓰며 화면에서 다시 정렬하지 않는다.
const GROUP_LABELS = { INSTALLMENT: '할부', SUBSCRIPTION: '정기결제', OTHER: '기타' }
const otherItemText = (item) => {
  const category = item.category?.trim()
  const name = OTHER_EXPENSE_CATEGORY_OPTIONS.find((option) => option.value === category)?.label || category || GROUP_LABELS[item.groupCode] || '기타'
  const description = item.description?.trim()
  return `${name}${description ? `(${description})` : ''} ${won(item.monthlyAmount)}`
}

// N-21-3 대출 항목 이름 — 이름이 없으면 "대출"이고, 같은 이름이 둘 이상이면 받은 순서대로 번호를 붙인다("신용대출 1 320,000원"). 순서는 서버(LOAN_ID 순) 그대로다.
const loanItemTexts = (items) => {
  const names = items.map((item) => item.loanTypeName?.trim() || '대출')
  const seen = {}
  return items.map((item, index) => {
    const name = names[index]
    seen[name] = (seen[name] ?? 0) + 1
    const numbered = names.filter((other) => other === name).length > 1 ? `${name} ${seen[name]}` : name
    return { text: `${numbered} ${won(item.monthlyPaymentAmount)}` }
  })
}

function ExpenseBreakdown({ baseline, fixedExpenseAmount, stale }) {
  const parts = [fixedExpenseAmount, baseline?.monthlyPaymentAmount, baseline?.otherExpenseAmount]
  const total = parts.every(Number.isFinite) ? parts.reduce((sum, v) => sum + v, 0) : null
  return (
    <div className={stale ? 'cf-summary__item cf-summary__item--wide cf-chart-wrap--stale' : 'cf-summary__item cf-summary__item--wide'}>
      <span className="cf-hint">월 지출 구성</span>
      <strong className="cf-big">{won(total)}</strong>
      <div className="cf-breakdown">
        <span className="cf-hint">월 고정 지출 <b className="num">{won(fixedExpenseAmount)}</b></span>
        <BreakdownRow label="월 원리금(대출 상환)" amount={baseline?.monthlyPaymentAmount}
          items={baseline?.loanPaymentItems ? loanItemTexts(baseline.loanPaymentItems) : []} />
        <BreakdownRow label="할부·정기결제·기타" amount={baseline?.otherExpenseAmount}
          items={baseline?.otherExpenseItems?.map((item) => ({ text: otherItemText(item) }))} />
      </div>
    </div>
  )
}

export default function CashFlowSummary({ result, baseline, fixedExpenseAmount, stale }) {
  const { cumulativeSurplusAmount, tightestMonth } = result
  const deficit = baseline?.pastDeficitMonthsCount
  return (
    <div className="cf-summary">
      <div className="cf-summary__item">
        <span className="cf-hint">예측 기간 누적 여유 자금</span>
        <strong className={cumulativeSurplusAmount < 0 ? 'cf-big cf-neg' : 'cf-big cf-pos'}>{signed(cumulativeSurplusAmount)}원</strong>
      </div>
      <div className="cf-summary__item">
        <span className="cf-hint">가장 빠듯한 달</span>
        <strong className="cf-big">{tightestMonth ? `${monthLabel(tightestMonth.baseMonth)} ${signed(tightestMonth.netAmount)}원` : '—'}</strong>
      </div>
      <ExpenseBreakdown baseline={baseline} fixedExpenseAmount={fixedExpenseAmount} stale={stale} />
      {/* N-21-6 서버가 대출 원리금을 뺀 월 지출로 센 값이라 위 지출 구성 합계와 기준이 다르다. 줄은 값이 없어도 자리를 유지한다. */}
      <span className="cf-hint cf-summary__item--wide">최근 12개월 중 소득이 월 지출(대출 상환 제외)보다 적었던 달 {Number.isFinite(deficit) ? `${deficit}개월` : '—'}</span>
    </div>
  )
}
