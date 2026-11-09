import { Card } from '../../../common/components/index.js'
import { getCompletionItems } from '../config/completionItems.js'

// 저장 시각을 화면용 문자열로 바꾼다.
function formatDateTime(isoText) {
  return new Date(isoText).toLocaleString('ko-KR')
}

// N-05-8 입력 완료 현황 — 소득·기간·자산·카드/부채·지출·대안 데이터 6개 항목의 완료 여부를 목록으로 보여 준다.
// status: 서버가 준 { sections: { key: boolean }, altData: { key: boolean } }   savedAt: 마지막 저장 시각(없으면 아직 저장 전)
// notices: { 항목 key: 안내 문구 } — 미완료 항목 옆에 보여 준다(N-05-7 월별 소득의 남은 달 수).
export default function InputStatus({ status, savedAt, notices }) {
  if (!status) return null
  return (
    <Card title="입력 완료 현황" className="input-status">
      <p className="input-status__saved-at">{savedAt ? `마지막 저장: ${formatDateTime(savedAt)}` : '아직 저장한 입력이 없습니다.'}</p>
      <ul className="input-status__list">
        {getCompletionItems(status).map((item) => (
          <li key={item.key} className={item.done ? 'input-status__item input-status__item--done' : 'input-status__item'}>
            {item.label}: {item.done ? '완료' : '미완료'}
            {!item.done && notices?.[item.key] && <span className="input-status__hint"> {notices[item.key]}</span>}
          </li>
        ))}
      </ul>
    </Card>
  )
}
