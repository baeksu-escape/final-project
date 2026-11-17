// 공통 푸터 — 모든 화면 아래에 교육용 프로토타입이라는 고지를 한 줄로 보여 준다(AGENTS 5: 실제 신용평가·대출 심사가 아님을 표시).
export default function AppFooter() {
  return (
    <footer className="app-footer">
      Avenue · 교육용 프로토타입입니다. 점수·금리·한도·대출 상품은 합성 데이터로 만든 예시이며 실제 신용평가·대출 심사 결과가 아닙니다.
    </footer>
  )
}
