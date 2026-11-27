import { CountUp } from '../components/viz.jsx'
import './landingPhone.css'

// N-10 메인·서비스 소개 페이지의 폰 — 코드로 만든 입체 폰(금속 테두리·측면 버튼·두께·유리 반사)과 그 안의 앱 화면.
// 앱 화면은 실제 서비스 화면과 같은 항목·이름(두 모델 점수, 시뮬레이터, 상환 부담률 등)을 작은 카드로 담은 광고용 예시 값이다.
// 화면 속 카드는 3D 공간에 있어, focus된 카드가 폰 앞으로 튀어나온다(조상 요소에 overflow·filter를 두지 않는다).

const SCORE = { before: 640, after: 690 }

function StatusBar() {
  return (
    <div className="app-status" aria-hidden="true">
      <b className="num">9:41</b>
      <span className="app-status__icons"><i /><i /><i /></span>
    </div>
  )
}

function CreditCard() {
  return (
    <>
      <p className="app-card__label">내 대안 신용점수</p>
      <div className="app-score">
        {/* 화면이 나타날 때마다 0부터 올라간다 */}
        <b className="num"><CountUp value={SCORE.after} duration={900} /></b><span>점</span>
        <em className="app-pill app-pill--standard">보통</em>
      </div>
      <div className="app-compare">
        <div><span>기존 모델</span><i style={{ '--w': `${SCORE.before / 10}%` }} /><b className="num"><CountUp value={SCORE.before} duration={900} /></b></div>
        <div><span>대안 모델</span><i className="is-alt" style={{ '--w': `${SCORE.after / 10}%` }} /><b className="num"><CountUp value={SCORE.after} duration={900} /></b></div>
      </div>
    </>
  )
}

function SimulatorCard() {
  return (
    <>
      <p className="app-card__label">신용케어 시뮬레이터</p>
      <div className="app-row"><span>카드 한도 사용률</span><b className="num">90% → 30%</b></div>
      <div className="app-slider"><i /></div>
      <div className="app-row app-row--strong"><span>예상 대안 점수</span><b className="num">701 → 716 <em className="is-up">+15</em></b></div>
    </>
  )
}

const RATIOS = [['상환 부담률(DSR)', 28, 80, 'safe'], ['자산 대비 부채', 46, 120, 'safe'], ['순자산 대비 부채', 85, 200, 'caution']]
function AssetDebtCard() {
  return (
    <>
      <p className="app-card__label">자산·부채 건전성 <em className="app-pill app-pill--caution">종합 주의</em></p>
      {RATIOS.map(([name, value, max, tone]) => (
        <div key={name} className="app-ratio">
          <span>{name}</span>
          <i className={`is-${tone}`} style={{ '--w': `${(value / max) * 100}%` }} />
          <b className="num">{value}%</b>
        </div>
      ))}
    </>
  )
}

// 대안 데이터 재료 — 5종 납부·이용 기록(광고용 예시 값)
const ALT_ROWS = [['통신비', '18개월 연속 정상 납부'], ['공과금', '최근 1년 미납 0회'], ['국민연금', '48개월 납부'], ['건강보험', '정시 납부율 100%'], ['간편결제', '월 평균 12회 이용']]
// detail: 서비스 미리보기(카드 하나를 크게)면 5종 모두, 앱 첫 화면이면 2종만(폰 화면 안에 다 들어가게)
function AltDataCard({ detail = false }) {
  return (
    <>
      <p className="app-card__label">대안 데이터 재료 <em className="app-pill app-pill--good">5종 연동</em></p>
      {(detail ? ALT_ROWS : ALT_ROWS.slice(0, 2)).map(([name, text]) => (
        <div key={name} className="app-row"><span>{name}</span><b className="is-up">{text}</b></div>
      ))}
    </>
  )
}

// 앱 첫 화면에 보이는 카드(서비스 소개 페이지·메인 목록의 서비스 key와 같다)
const CARDS = { 'credit-report': CreditCard, simulator: SimulatorCard, 'asset-debt': AssetDebtCard, 'alt-data': AltDataCard }

// 앱 첫 화면 — 서비스 카드 4개. focus가 있으면 그 카드만 앞으로 나오고 나머지는 흐려진다.
export function AppHome({ focus }) {
  return (
    <div className={`app${focus ? ' has-focus' : ''}`}>
      <StatusBar />
      <div className="app-top">
        <span className="app-top__logo" aria-hidden="true">A</span><b>Avenue</b>
        <span className="app-top__bell" aria-hidden="true" />
      </div>
      {Object.entries(CARDS).map(([key, Card]) => (
        <section key={key} className={`app-card${focus === key ? ' is-focus' : ''}`}>
          <Card />
        </section>
      ))}
    </div>
  )
}

// 서비스 소개 페이지의 폰 화면 — 뒤로 가기 머리말 + 그 서비스 카드 하나를 크게.
export function ServiceScreen({ serviceKey, label }) {
  const Card = CARDS[serviceKey]
  return (
    <div className="app app--detail">
      <StatusBar />
      <div className="app-top app-top--back"><span aria-hidden="true">‹</span><b>{label}</b></div>
      {Card && <section className="app-card app-card--lg"><Card detail /></section>}
      <p className="app-note">화면의 숫자는 예시예요</p>
    </div>
  )
}

// 입체 폰 틀. tilt면 기울일 수 있는 모습(메인 아래 구간이 --t로 기울기를 정한다), 아니면 정면.
export function Phone3D({ children, tilt = false, className = '' }) {
  return (
    <div className={`phone3d${tilt ? ' phone3d--tilt' : ''} ${className}`}>
      <span className="phone3d__edge phone3d__edge--3" aria-hidden="true" />
      <span className="phone3d__edge phone3d__edge--2" aria-hidden="true" />
      <span className="phone3d__edge phone3d__edge--1" aria-hidden="true" />
      <div className="phone3d__body">
        <div className="phone3d__glass">
          <span className="phone3d__island" aria-hidden="true" />
          <div className="phone3d__screen">{children}</div>
          <span className="phone3d__shine" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
