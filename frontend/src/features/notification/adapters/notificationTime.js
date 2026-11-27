// D-23 알림 목록에서 시각을 읽기 쉬운 상대 시간으로 표시한다.
export function relativeTime(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}
