import MyPositionSection from '../components/MyPositionSection.jsx'
import '../comparison.css'

// FP-253 N-13·N-26-5 비교 분석 화면 틀 — 제목 아래에 구역을 차례로 둔다. 구역마다 자기 데이터를 스스로 불러오고, 이 화면은 상태를 들지 않는다.
export default function ComparisonPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-head__title">비교 분석</h1>
          <p className="page-head__lead">같은 직군·연령대 회원들과 내 대안 점수를 비교합니다.</p>
        </div>
      </div>

      <MyPositionSection />

      {/* FP-164 N-26-5~7 직군 × 연령 격자·집단 비교 구역은 여기 아래에 둔다(광희). */}
    </>
  )
}
