import { Button, Card, Notice } from '../../../common/components/index.js'
import { useAuth } from '../../../common/auth/useAuth.js'
import CashFlowChart from '../components/CashFlowChart.jsx'
import CashFlowConditions from '../components/CashFlowConditions.jsx'
import CashFlowSummary from '../components/CashFlowSummary.jsx'
import IncomeVolatilitySection from '../components/IncomeVolatilitySection.jsx'
import { useCashFlowForecast } from '../components/useCashFlowForecast.js'
import '../styles/cashFlow.css'

// N-21·N-22 현금흐름 전망과 소득 변동성 진단을 각각 보여 준다.
export default function CashFlowPage() {
  const { user } = useAuth()
  const cf = useCashFlowForecast(user?.userId, user?.jobType)

  const result = cf.result
  return (
    <div className="cf-page">
      <header className="cf-heading">
        <h1>현금흐름·소득 변동성</h1>
        <p>달마다 들어오는 돈과 나가는 돈을 겹쳐 보고, 앞으로 몇 달을 예측합니다. 예측은 시연용 계산이며 실제 평가에 반영되지 않습니다.</p>
      </header>
      {!cf.loading && <IncomeVolatilitySection data={cf.baseline} />}
      {cf.loading ? <p role="status">현금흐름 자료를 불러오는 중입니다.</p> : cf.loadError ? <Notice type="warn">{cf.loadError} <Button size="sm" onClick={cf.reload}>다시 시도</Button></Notice> : <div className="cf-layout">
        <CashFlowConditions values={cf.values} status={cf.status} error={cf.error} stale={cf.stale || (cf.status === 'idle' && cf.canForecast)}
          baselineComplete={cf.baselineComplete} canForecast={cf.canForecast} canReset={cf.canReset} onChange={cf.setCondition} onForecast={cf.forecast} onRetry={cf.retry} onReset={cf.reset} />
        <Card title="월별 소득과 지출" className="cf-result">
          <p className="cf-legend">
            <span><i className="cf-swatch cf-swatch--act" /> 실제 소득</span>
            <span><i className="cf-swatch cf-swatch--deficit" /> 지출보다 적은 달</span>
            <span><i className="cf-swatch cf-swatch--forecast" /> 예측 소득(연한 색)</span>
            <span><i className="cf-swatch cf-swatch--expense" /> 월 지출</span>
          </p>
          {/* 다시 예측하는 동안에도 이전 결과를 그대로 두어 차트가 사라졌다 나타나지 않게 한다. 상태 안내는 왼쪽 조건 카드 한 곳에만 있다. */}
          {result ? (
            <>
              <div className={cf.stale ? 'cf-chart-wrap cf-chart-wrap--stale' : 'cf-chart-wrap'}>
                <CashFlowChart actualMonths={cf.baseline.months} forecastMonths={result.forecastMonths}
                  monthlyExpenseAmount={result.monthlyExpenseAmount} />
              </div>
              <CashFlowSummary result={result} baseline={cf.baseline} fixedExpenseAmount={cf.applied?.fixedExpenseAmount} stale={cf.stale} />
            </>
          ) : (
            <p className="cf-hint cf-placeholder">{cf.status === 'loading' ? '예측하는 중입니다.' : cf.baselineComplete ? '예측 조건을 확인해 주세요.' : '예측할 수 있는 자료가 아직 없습니다.'}</p>
          )}
        </Card>
      </div>}
    </div>
  )
}
