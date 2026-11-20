import { Card, CompareBar } from '../../../common/components/index.js'

const FIELDS = [{ key: 'annualIncomeAmount', label: '연소득' }, { key: 'totalAssetAmount', label: '총자산' }, { key: 'totalDebtAmount', label: '총부채' }]

// N-15-3 같은 직군 회원 평균을 비교한다. 공통 막대에는 유효한 값만 전달한다.
export default function AssetDebtPeerComparison({ values, peer }) {
  return <Card title="같은 직군 평균과 비교" className="ad-peer">
    <p className="ad-hint">{peer?.memberCount ? '같은 직군 회원 중 입력한 회원의 평균입니다.' : '같은 직군 평균을 계산할 회원이 부족합니다.'} 단위: 원</p>
    <div className="ad-peer__items">{FIELDS.map(({ key, label }) => {
      const myValue = values?.[key]
      const avgValue = peer?.[key]
      const valid = Number.isSafeInteger(myValue) && myValue >= 0 && Number.isSafeInteger(avgValue) && avgValue >= 0
      return valid ? <CompareBar key={key} label={label} myValue={myValue} avgValue={avgValue} unit="원" avgLabel="직군 평균" formatValue={(value) => value.toLocaleString('ko-KR')} />
        : <p key={key} className="ad-unavailable">{label}: {myValue == null ? '내 값이 미입력입니다.' : '값을 확인해 주세요.'} 비교할 수 없습니다.</p>
    })}</div>
  </Card>
}
