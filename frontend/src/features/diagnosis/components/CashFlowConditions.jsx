import { Button, Card, MoneyInput, Select, Slider } from '../../../common/components/index.js'

const MONTH_OPTIONS = [{ value: '3', label: '3개월' }, { value: '6', label: '6개월' }, { value: '12', label: '12개월' }]

// 예측 상태 문구를 고정된 자리에 표시한다.
function statusText(status, error, stale) {
  if (status === 'loading') return '예측하는 중입니다. 지금 보이는 결과는 이전 조건 기준입니다.'
  if (status === 'invalid') return error
  if (status === 'error') return `예측하지 못했습니다. ${error}`
  return stale ? '조건이 바뀌었습니다. [예측 다시 하기]를 눌러 주세요.' : '현재 조건으로 예측한 결과입니다.'
}

// N-21-2 예측 조건 3개(소득 변동 폭·월 고정 지출·예측 기간)를 바꾸고 버튼으로 다시 예측한다. 납부 상태 입력은 11/25 팀 결정으로 뺐다.
// 상태 안내는 늘 같은 자리·같은 높이에 두어 문구가 바뀌어도 아래 화면이 움직이지 않게 한다.
export default function CashFlowConditions({ values, status, error, stale, baselineComplete, canForecast, canReset, onChange, onForecast, onRetry, onReset }) {
  const warn = status === 'invalid' || status === 'error' || (status === 'idle' && stale)
  return (
    <Card title="예측 조건" className="cf-conditions">
      <Slider label="앞으로의 소득 변동 폭" min={0} max={200} step={10} value={values.incomeVariationPct}
        formatValue={(v) => `지난 1년의 ${v}%`} onChange={(v) => onChange('incomeVariationPct', v)} />
      <p className="cf-hint cf-row"><span>일정하게</span><span>2배로 출렁임</span></p>
      {/* 오류 문구는 아래 상태 줄 한 곳에만 보여 준다. */}
      <MoneyInput label="월 고정 지출" value={values.fixedExpenseAmount}
        onChange={(v) => onChange('fixedExpenseAmount', v)} />
      <Select label="예측 기간" options={MONTH_OPTIONS} value={String(values.months)} onChange={(v) => onChange('months', Number(v))} />
      <div className={warn || !baselineComplete ? 'cf-status cf-status--warn' : 'cf-status'} role="status" aria-live="polite">
        <span className="cf-status__text">{baselineComplete ? statusText(status, error, stale) : '저장된 소득(최근 12개월)·기타 지출·월 상환액이 모두 있어야 예측할 수 있습니다. 데이터 입력 화면에서 빈 값을 채워 주세요.'}</span>
        {status === 'error' && baselineComplete && <Button size="sm" onClick={onRetry}>다시 시도</Button>}
      </div>
      <Button variant="primary" onClick={onForecast} disabled={!canForecast}>예측 다시 하기</Button>
      {/* C-17 조건을 처음 값(저장된 기준값)으로 되돌린다. 바뀐 조건이 없으면 비활성이라 자리는 늘 유지된다. */}
      <Button variant="primary" size="sm" onClick={onReset} disabled={!canReset}>내 현재 값으로 되돌리기</Button>
    </Card>
  )
}
