import { Card, CompareBar } from '../../../common/components/index.js'

const FIELDS = [{ key: 'totalAssetAmount', label: '총자산' }, { key: 'annualIncomeAmount', label: '연소득' }, { key: 'totalDebtAmount', label: '총부채' }]

// N-15-2·N-15-3 내 금액과 같은 직군·연령대 평균을 항목별로 비교한다. 평균 조회 실패와 표본 부족을 구분한다.
export default function AssetDebtPeerComparison({ values, peer }) {
  const hasAverage = FIELDS.some(({ key }) => peer?.[key] != null || peer?.agePeer?.[key] != null)
  return <Card title="같은 직군·연령대 평균과 비교" className="ad-peer">
    <p className="ad-hint">{peer?.peerFailed ? '직군·연령대 평균을 불러오지 못했어요.' : hasAverage ? '입력한 회원의 평균입니다.' : '평균을 계산할 회원이 부족합니다.'} 단위: 원</p>
    <div className="ad-peer__items">{FIELDS.map(({ key, label }) => {
      const myValue = values?.[key]
      const valid = Number.isSafeInteger(myValue) && myValue >= 0
      const unavailableText = peer?.peerFailed ? '불러오기 실패' : '비교 회원 부족'
      const averages = [
        { label: '같은 직군 평균', value: peer?.[key] ?? null, unavailableText },
        { label: '같은 연령대 평균', value: peer?.agePeer?.[key] ?? null, unavailableText },
      ]
      return <CompareBar key={key} label={label} myValue={valid ? myValue : null} averages={averages} unit="원" formatValue={(value) => value.toLocaleString('ko-KR')} />
    })}</div>
  </Card>
}
