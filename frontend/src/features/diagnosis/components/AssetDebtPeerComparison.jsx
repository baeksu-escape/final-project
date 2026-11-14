import { Card, CompareBar } from '../../../common/components/index.js'

const FIELDS = [{ key: 'annualIncomeAmount', label: '연소득' }, { key: 'totalAssetAmount', label: '총자산' }, { key: 'totalDebtAmount', label: '총부채' }]

// N-16-1 UI 범위의 같은 직군 시연 평균을 비교한다. 공통 막대가 NULL을 0으로 바꾸지 않도록 유효한 쌍만 전달한다.
export default function AssetDebtPeerComparison({ values, peer, workerLabel }) {
  return <Card title="같은 직군 평균과 비교" className="ad-peer">
    <p className="ad-hint">{workerLabel} 평균은 실제 통계 조회가 아닌 시연용 가정입니다. 단위: 원</p>
    <div className="ad-peer__items">{FIELDS.map(({ key, label }) => {
      const myValue = values?.[key]
      const avgValue = peer?.[key]
      const valid = Number.isSafeInteger(myValue) && myValue >= 0 && Number.isSafeInteger(avgValue) && avgValue >= 0
      return valid ? <CompareBar key={key} label={label} myValue={myValue} avgValue={avgValue} unit="원" avgLabel="직군 평균" formatValue={(value) => value.toLocaleString('ko-KR')} />
        : <p key={key} className="ad-unavailable">{label}: {myValue == null ? '내 값이 미입력입니다.' : '값을 확인해 주세요.'} 비교할 수 없습니다.</p>
    })}</div>
  </Card>
}
