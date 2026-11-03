import { Card } from '../../../common/components/index.js'
import { ALT_DATA_SOURCES } from '../config/altDataSources.js'

// 저장 시각을 화면용 문자열로 바꾼다.
function formatDateTime(isoText) {
  return new Date(isoText).toLocaleString('ko-KR')
}

// N-05 입력 완료 현황 — 섹션별 입력 여부와 대안 데이터 불러옴 여부를 목록으로 보여 준다.
// status: 서버가 준 { sections: { key: boolean }, altData: { key: boolean } }   savedAt: 마지막 저장 시각(없으면 아직 저장 전)
export default function InputStatus({ sections, status, savedAt }) {
  if (!status) return null
  return (
    <Card title="입력 완료 현황" className="input-status">
      <p className="input-status__saved-at">{savedAt ? `마지막 저장: ${formatDateTime(savedAt)}` : '아직 저장한 입력이 없습니다.'}</p>
      <ul className="input-status__list">
        {sections.map((section) => {
          const filled = Boolean(status.sections?.[section.key])
          return (
            <li key={section.key} className={filled ? 'input-status__item input-status__item--done' : 'input-status__item'}>
              {section.title}: {filled ? '입력함' : '미입력'}
            </li>
          )
        })}
        {ALT_DATA_SOURCES.map((source) => {
          const imported = Boolean(status.altData?.[source.key])
          return (
            <li key={source.key} className={imported ? 'input-status__item input-status__item--done' : 'input-status__item'}>
              {source.label}: {imported ? '불러옴' : '불러오지 않음'}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
