// 가입 여정 진행률 — 1단계 본인 인증·계정 정보(회원가입) → 2단계 직군 선택 → 3단계 기초 데이터 입력.
// 위쪽 얇은 진행 막대와 단계 이름. current는 0부터 센다.
// 사용 예: <JourneySteps current={1} />
const STEPS = ['본인 인증·계정 정보', '직군 선택', '기초 데이터 입력']

export default function JourneySteps({ current }) {
  return (
    <div className="journey">
      <div
        className="journey__bar"
        data-step={current + 1}
        role="progressbar"
        aria-label="가입 진행률"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={current + 1}
        aria-valuetext={`${current + 1}단계 ${STEPS[current]}`}
      >
        {/* 막대 길이는 finForm.css가 data-step(1~3)으로 정한다 */}
        <span />
      </div>
      <ol className="journey__steps">
        {STEPS.map((step, index) => (
          <li key={step} className={index === current ? 'is-on' : index < current ? 'is-done' : ''}>
            <b>{index + 1}단계</b> {step}
          </li>
        ))}
      </ol>
    </div>
  )
}
