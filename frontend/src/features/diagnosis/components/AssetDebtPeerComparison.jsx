import { Card, CompareBar } from '../../../common/components/index.js'

// 서버 PeerBenchmarkService.MIN_GROUP_SIZE와 같은 최소 인원 기준이다(응답에 기준 값이 없어 여기 한 곳에 둔다).
const MIN_PEER_COUNT = 5
const FIELDS = [{ key: 'totalAssetAmount', label: '총자산' }, { key: 'annualIncomeAmount', label: '연소득' }, { key: 'totalDebtAmount', label: '총부채' }]

// N-15-2·N-15-3 내 금액과 같은 직군·연령대 평균을 비교한다. 금액이 없거나 사용할 수 없는 이유를 행마다 안내한다.
export default function AssetDebtPeerComparison({ values, peer }) {
  const hasAverage = FIELDS.some(({ key }) => peer?.[key] != null || peer?.agePeer?.[key] != null)
  const averageSummary = hasAverage ? '입력한 회원의 평균입니다.' : !peer?.agePeerInvalid && '평균을 계산할 회원이 부족합니다.'
  return <Card title="같은 직군·연령대 평균과 비교" className="ad-peer">
    <p className="ad-hint">{peer?.peerFailed ? '직군·연령대 평균을 불러오지 못했어요.' : averageSummary}{hasAverage && !peer?.peerFailed && ' 단위: 원'}</p>
    <div className="ad-peer__items">{FIELDS.map(({ key, label }) => {
      const myValue = values?.[key]
      const valid = Number.isSafeInteger(myValue) && myValue >= 0
      // N-15-3 표본 부족·형식 오류 안내를 평균 종류별로 구체적으로 쓴다. 조회 실패는 기존 문구 그대로다.
      const lack = (group) => peer?.peerFailed ? '불러오기 실패' : `같은 ${group} 회원이 ${MIN_PEER_COUNT}명 미만이라 평균을 보여 드릴 수 없어요`
      const averages = [
        { label: '같은 직군 평균', value: peer?.[key] ?? null, unavailableText: lack('직군') },
        { label: '같은 연령대 평균', value: peer?.agePeer?.[key] ?? null,
          unavailableText: peer?.agePeerInvalid ? `같은 연령대 평균(${label})을 불러오지 못했어요` : lack('연령대') },
      ]
      return <CompareBar
        key={key}
        label={label}
        myValue={valid ? myValue : null}
        myUnavailableText={myValue == null ? '내 값이 미입력입니다.' : '값을 확인해 주세요.'}
        averages={averages}
        unit="원"
        formatValue={(value) => value.toLocaleString('ko-KR')}
      />
    })}</div>
  </Card>
}
