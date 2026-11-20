import { Card, ProgressBar } from '../../../common/components/index.js'
import { LOCKED_STEP_MESSAGE } from '../config/inputSteps.js'

// 저장 시각을 화면용 문자열로 바꾼다.
function formatDateTime(isoText) {
  return new Date(isoText).toLocaleString('ko-KR')
}

// 줄 하나의 클래스 — 완료(초록 동그라미) · 지금 단계(줄 강조) · 미완료(빈 동그라미). 끝낸 단계로 돌아가면 완료와 강조가 함께 붙는다.
function itemClassName(done, isCurrent) {
  return ['input-status__item', done && 'input-status__item--done', isCurrent && 'input-status__item--current']
    .filter(Boolean)
    .join(' ')
}

// N-05 입력 완료 현황 = 단계 리모컨(FP-227) — 7단계를 한 줄씩 보여 주고, 누를 수 있는 줄을 누르면 그 단계로 간다.
// steps: [{ key, title, done, canJump, hint }] (DataInputPage가 만든다)   currentStep: 지금 단계 번호(0부터)
// onSelect(index): 줄을 눌렀을 때   savedAt: 마지막 서버 저장 시각(없으면 저장 전)   draftNotice: 임시저장 안내(없으면 '')
// 완료는 화면 낭독기에 '완료'로, 지금 단계는 aria-current="step"으로 알린다. 누를 수 없는 줄은 aria-disabled이고 이유를 title로 보여 준다.
export default function InputStatus({ steps, currentStep, onSelect, savedAt, draftNotice }) {
  const doneCount = steps.filter((item) => item.done).length
  return (
    <Card title="입력 완료 현황" className="input-status">
      <p className="input-status__saved-at">{savedAt ? `마지막 저장: ${formatDateTime(savedAt)}` : '아직 저장한 입력이 없습니다.'}</p>
      {draftNotice && <p className="input-status__saved-at">{draftNotice}</p>}
      <ProgressBar label="입력 단계 진행" value={doneCount} max={steps.length} />
      <p className="hint">
        {steps.length}단계 중 {doneCount}단계 완료
      </p>
      <ol className="input-status__list">
        {steps.map((item, index) => {
          const isCurrent = index === currentStep
          const locked = !isCurrent && !item.canJump
          return (
            <li key={item.key} className={itemClassName(item.done, isCurrent)}>
              <button
                type="button"
                className="input-status__step"
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={locked || undefined}
                title={locked ? LOCKED_STEP_MESSAGE : undefined}
                onClick={() => {
                  if (item.canJump) onSelect(index)
                }}
              >
                {index + 1}. {item.title}
                {item.done && <span className="sr-only"> 완료</span>}
              </button>
              {item.hint && <span className="input-status__hint">{item.hint}</span>}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
