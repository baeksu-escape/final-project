import { Card } from '../../../common/components/index.js'
import { LOCKED_STEP_MESSAGE } from '../config/inputSteps.js'

// 저장 시각을 화면용 문자열로 바꾼다.
function formatDateTime(isoText) {
  return new Date(isoText).toLocaleString('ko-KR')
}

// 줄 하나의 클래스 — 완료(에메랄드 체크) · 지금 단계(딥 네이비 번호 뱃지 + 연한 바탕) · 미완료(연한 회색 번호). 끝낸 단계로 돌아가면 지금 단계 모양이 앞선다.
// FP-260 9차 warn: [점수 산출하기]를 막고 있는 단계(노란 주의 표시).
function itemClassName(done, isCurrent, warn) {
  return ['input-status__item', done && 'input-status__item--done', isCurrent && 'input-status__item--current', warn && 'input-status__item--warn']
    .filter(Boolean)
    .join(' ')
}

// N-05 입력 진행 단계 = 단계 리모컨(FP-227) — 7단계를 세로 타임라인(Vertical Stepper)으로 보여 주고, 누를 수 있는 줄을 누르면 그 단계로 간다.
// steps: [{ key, title, done, canJump, hint, warn }] (DataInputPage가 만든다)   currentStep: 지금 단계 번호(0부터)
// onSelect(index): 줄을 눌렀을 때   savedAt: 마지막 서버 저장 시각(없으면 저장 전)   draftNotice: 임시저장 안내(없으면 '')
// summary(선택): 완료 단계 수 문구(예: '입력 6단계 중 4단계 완료'). 없으면 전체 단계 수로 센다.
// 완료는 화면 낭독기에 '완료'로, 지금 단계는 aria-current="step"으로 알린다. 누를 수 없는 줄은 aria-disabled이고 이유를 title로 보여 준다.
export default function InputStatus({ steps, currentStep, onSelect, savedAt, draftNotice, summary }) {
  const doneCount = steps.filter((item) => item.done).length
  return (
    <Card title="입력 진행 단계" className="input-status">
      <p className="input-status__saved-at">{savedAt ? `마지막 저장: ${formatDateTime(savedAt)}` : '아직 저장한 입력이 없습니다.'}</p>
      {draftNotice && <p className="input-status__saved-at">{draftNotice}</p>}
      <p className="hint">{summary ?? `${steps.length}단계 중 ${doneCount}단계 완료`}</p>
      <ol className="input-status__list">
        {steps.map((item, index) => {
          const isCurrent = index === currentStep
          const locked = !isCurrent && !item.canJump
          return (
            <li key={item.key} className={itemClassName(item.done, isCurrent, item.warn)} style={{ '--i': index }}>
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
                <span className="input-status__marker" aria-hidden="true">
                  {item.done && !isCurrent ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="input-status__label">
                  <span className="sr-only">{index + 1}단계 </span>
                  {item.title}
                  {item.done && <span className="sr-only"> 완료</span>}
                  {item.warn && <span className="sr-only"> 점수 산출에 필요</span>}
                </span>
              </button>
              {item.hint && <span className="input-status__hint">{item.hint}</span>}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
