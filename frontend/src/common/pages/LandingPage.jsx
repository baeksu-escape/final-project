import { Link } from 'react-router-dom'
import { PATHS } from '../config/navigation.js'
import { LANDING_FEATURES, PROMO_AFTER, PROMO_BEFORE } from './landingExample.js'
import PromoTrendChart from './PromoTrendChart.jsx'
import './landing.css'

// N-10-1 전후 점수 카드 한 장 — 예시 점수·등급과 12개월 추이 그래프를 보여 준다.
function PromoCard({ example, tone }) {
  return (
    <div className={`card landing-page__promo-card landing-page__promo-card--${tone}`}>
      <span className="tag">{example.label}</span>
      <b>{example.title}</b>
      <span className="landing-page__promo-score">
        <b className="landing-page__promo-number num">{example.score}</b>
        <span className="hint">점 ·</span>
        <b className="landing-page__promo-grade">{example.grade}</b>
      </span>
      <span className="hint">{example.note}</span>
      <PromoTrendChart values={example.values} tone={tone} markIndex={example.markIndex} />
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
          {/* N-10-1·N-10-2 전후 점수 비교 — 화면 번호는 사용자에게 보이지 않게 주석에만 둔다 */}
          <span className="tag landing-page__eyebrow">서비스 효과 예시</span>
          <h2 className="landing-page__promo-title" id="landing-promo-title">
            성실하게 낸 기록이 점수를 바꿉니다
          </h2>
        </div>
        <div className="landing-page__promo-cards">
          <PromoCard example={PROMO_BEFORE} tone="before" />
          <PromoCard example={PROMO_AFTER} tone="after" />
        </div>
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
