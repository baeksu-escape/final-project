import { Button, Card, NumberInput, Select, Slider } from '../../../common/components/index.js'

const PAYMENT_OPTIONS = [{ value: 'ON_TIME', label: '제때 낸다' }, { value: 'DELAYED', label: '가끔 밀린다' }]
const MONTH_OPTIONS = [{ value: '3', label: '3개월' }, { value: '6', label: '6개월' }, { value: '12', label: '12개월' }]

// 자동 예측 상태 문구. 한 줄 자리에서 문구만 바뀐다.
function statusText(status, error, stale) {
  if (status === 'waiting') return '입력이 멈추면 0.5초 뒤 자동으로 다시 예측합니다.'
  if (status === 'loading') return '예측하는 중입니다. 지금 보이는 결과는 이전 조건 기준입니다.'
  if (status === 'invalid') return error
  if (status === 'error') return `예측하지 못했습니다. ${error}`
  return stale ? '지금 보이는 결과는 이전 조건 기준입니다.' : '현재 조건으로 예측한 결과입니다.'
}

// N-21-2 예측 조건 4개 — 값을 바꾸면 입력이 멈춘 뒤 자동으로 다시 예측한다.
// 상태 안내는 늘 같은 자리·같은 높이에 두어 문구가 바뀌어도 아래 화면이 움직이지 않게 한다.
export default function CashFlowConditions({ values, status, error, stale, canForecast, onChange, onRetry }) {
  const warn = status === 'invalid' || status === 'error'
  return (
    <Card title="예측 조건" className="cf-conditions">
      <Slider label="앞으로의 소득 변동 폭" min={0} max={200} step={10} value={values.incomeVariationPct}
        formatValue={(v) => `지난 1년의 ${v}%`} onChange={(v) => onChange('incomeVariationPct', v)} />
      <p className="cf-hint cf-row"><span>일정하게</span><span>2배로 출렁임</span></p>
      {/* 음수·소수를 그대로 받아 검사하도록 숫자 입력칸을 쓴다. 오류 문구는 아래 상태 줄 한 곳에만 보여 준다. */}
      <NumberInput label="월 고정 지출" value={values.fixedExpenseAmount} min={0} step={1} unit="원"
        onChange={(v) => onChange('fixedExpenseAmount', v)} />
      <Select label="카드값·대출 납부" options={PAYMENT_OPTIONS} value={values.paymentStatus} onChange={(v) => onChange('paymentStatus', v)} />
      <Select label="예측 기간" options={MONTH_OPTIONS} value={String(values.months)} onChange={(v) => onChange('months', Number(v))} />
      <div className={warn || !canForecast ? 'cf-status cf-status--warn' : 'cf-status'} role="status" aria-live="polite">
        <span className="cf-status__text">{canForecast ? statusText(status, error, stale) : '저장된 소득(최근 12개월)·기타 지출·월 상환액이 모두 있어야 예측할 수 있습니다. 데이터 입력 화면에서 빈 값을 채워 주세요.'}</span>
        {status === 'error' && canForecast && <Button size="sm" onClick={onRetry}>다시 시도</Button>}
      </div>
    </Card>
  )
}
