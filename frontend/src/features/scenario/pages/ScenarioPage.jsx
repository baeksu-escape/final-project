import { Button, Card, Notice } from '../../../common/components/index.js'
import { useAuth } from '../../../common/auth/useAuth.js'
import ScenarioControls from '../components/ScenarioControls.jsx'
import ScenarioResult from '../components/ScenarioResult.jsx'
import { useScenario } from '../components/useScenario.js'
import '../styles/scenario.css'

// N-17 시나리오 테스트 — 금리·소득·지출이 나빠지거나 좋아질 때 매달 남는 돈이 어떻게 바뀌는지 미리 본다. 점수는 예측하지 않는다.
export default function ScenarioPage() {
  const { user } = useAuth()
  const sc = useScenario(user?.userId, user?.jobType)

  if (sc.loading) return <p role="status">시나리오 자료를 불러오는 중입니다.</p>
  if (sc.loadError) return <Notice type="warn">{sc.loadError} <Button size="sm" onClick={sc.reload}>다시 시도</Button></Notice>

  return (
    <div className="sc-page">
      <header className="sc-heading">
        <h1>시나리오 테스트</h1>
        <p>금리·소득·지출이 나빠지거나 좋아질 때 매달 남는 돈이 어떻게 바뀌는지 미리 봅니다. 값을 바꾸면 바로 다시 계산합니다.</p>
      </header>
      <div className="sc-layout">
        <ScenarioControls values={sc.values} presetId={sc.presetId} inputError={sc.inputError || sc.calcError} variableLoanBalanceAmount={sc.baseline?.variableLoanBalanceAmount ?? null}
          onChange={sc.setValue} onSelect={sc.selectPreset} />
        {sc.result ? <ScenarioResult result={sc.result} />
          : <Card title="결과" className="sc-result"><Notice type="warn">{sc.calcError || '시나리오를 계산하고 있습니다.'}</Notice></Card>}
      </div>
    </div>
  )
}
