import { Link } from 'react-router-dom'
import Card from '../components/Card.jsx'
import Chip from '../components/Chip.jsx'
import { PATHS } from '../config/navigation.js'
import ScoreGauge from '../../features/credit/components/ScoreGauge.jsx'
// 게이지·등급 배지·영역 태그 모양(credit-·shap- 접두어 규칙만 있어 메인의 다른 요소에는 영향이 없다)
import '../../features/credit/credit.css'
import { LANDING_FEATURES, PROMO_AFTER, PROMO_BEFORE, PROMO_GRADE_BANDS } from './landingExample.js'
import './landing.css'

// 등급 배지 글자 — 신용 리포트 ScoreComparisonCard의 GRADE_LABELS와 같은 값
const PROMO_GRADE_LABELS = { GOOD: 'Good', STANDARD: 'Standard', CAUTION: 'Caution' }

// N-10-1 모델 한쪽의 예시 점수 — 신용 리포트 [점수 비교]의 ModelScore와 같은 마크업(제목·등급 배지, 점수 차이, 반원 게이지, 보는 영역 태그)이다.
// alternative면 대안 모델로 보고 점수 차이(diff)와 새로 더한 비금융 영역(보라색 태그)을 함께 보인다.
function PromoModelScore({ example, alternative = false, diff }) {
  return (
    <div className="panel-sunk">
      <div className="credit-model__header">
        <div>
          <h3>{example.title}</h3>
          <p>{example.description}</p>
        </div>
        <span className={`credit-grade credit-grade--${example.gradeBandCode.toLowerCase()}`}>
          {PROMO_GRADE_LABELS[example.gradeBandCode]}
        </span>
      </div>
      {alternative && <p className="credit-diff num">기존보다 {`${diff > 0 ? '+' : ''}${diff}`}점</p>}
      <ScoreGauge score={example.score} bands={PROMO_GRADE_BANDS} label={example.title} alternative={alternative} />
      <div>
        <p className="hint">이 모델이 보는 영역</p>
        <div className="credit-chips">
          {example.areas.map((area) => (
            <span key={area}>
              <Chip>{area}</Chip>
            </span>
          ))}
          {alternative &&
            example.alternativeAreas.map((area) => (
              <span key={area} className="credit-chip--alternative">
                <Chip>{area}</Chip>
              </span>
            ))}
        </div>
        {alternative && <p className="hint">보라색 태그는 대안 모델에서 새로 더한 비금융 영역입니다.</p>}
      </div>
    </div>
  )
}

// N-10 메인(홍보) 페이지 — 로그인 전 첫 화면('/'). 서비스 소개 문구, 전후 점수 예시, 주요 기능을 보여 준다(데모 v2 vMain).
// 로그인한 사람은 GuestOnlyRoute가 자기 첫 화면으로 보내므로 이 화면을 보지 않는다.
export default function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-page__hero">
        <span className="tag landing-page__eyebrow">연령·직군별 대안 신용평가</span>
        <h1 className="landing-page__title">꾸준한 일상, 새로운 신용</h1>
        <p className="landing-page__lead">
          대출 기록이 적어도 괜찮습니다. 통신비, 간편결제, 건강보험료, 국민연금처럼 매달 성실하게 낸 기록을 함께 보고 점수를
          다시 매깁니다.
        </p>
        <div>
          <Link to={PATHS.LOGIN} className="button button--primary landing-page__cta">
            로그인하고 내 점수 보기
          </Link>
        </div>
      </section>

      <section className="landing-page__promo" aria-labelledby="landing-promo-title">
        <div className="landing-page__promo-head">
          {/* N-10-1·N-10-2 전후 점수 비교 — 신용 리포트 [점수 비교]와 같은 게이지 구조(FP-226). 화면 번호는 사용자에게 보이지 않게 주석에만 둔다 */}
          <span className="tag landing-page__eyebrow">서비스 효과 예시</span>
          <h2 className="landing-page__promo-title" id="landing-promo-title">
            성실하게 낸 기록이 점수를 바꿉니다
          </h2>
        </div>
        {/* 리포트처럼 카드 한 장 안에 두 모델을 나란히 둔다(l-g2, 좁으면 위아래). */}
        <Card title="같은 가상 고객, 두 모델의 평가" className="landing-page__promo-cards">
          <div className="l-g2">
            <PromoModelScore example={PROMO_BEFORE} />
            <PromoModelScore example={PROMO_AFTER} alternative diff={PROMO_AFTER.score - PROMO_BEFORE.score} />
          </div>
        </Card>
        <p className="hint">
          광고용 예시 시나리오입니다. 금융 이력이 부족한 가상 고객을 가정했으며 실제 고객 결과가 아닙니다. 교육용 합성 데이터로
          학습한 시연 화면입니다.
        </p>
      </section>

      <section className="landing-page__features" aria-label="주요 기능">
        {LANDING_FEATURES.map((feature) => (
          <article key={feature.title} className="card landing-page__feature">
            <h3 className="landing-page__feature-title">{feature.title}</h3>
            <p className="hint landing-page__feature-text">{feature.description}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
