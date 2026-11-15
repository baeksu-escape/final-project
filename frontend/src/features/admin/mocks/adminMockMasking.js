// FP-80 관리자 mock이 회원 정보를 가릴 때 쓰는 함수. 실제 서버는 작업 7이 같은 규칙으로 가린 값을 보낸다.

// 이름 가운데를 가린다. 예) 박서윤 → 박*윤, 오진 → 오*
export function maskName(name) {
  const text = String(name ?? '')
  if (text.length <= 1) return '*'
  if (text.length === 2) return `${text[0]}*`
  return text[0] + '*'.repeat(text.length - 2) + text[text.length - 1]
}

// 아이디 앞 3자만 남긴다. 예) seoyun → seo***
export function maskLoginId(loginId) {
  const text = String(loginId ?? '')
  const visible = Math.min(3, Math.max(1, text.length - 2))
  return text.slice(0, visible) + '*'.repeat(text.length - visible)
}

// 이메일 아이디 부분의 앞 2자만 남기고 나머지 글자 수만큼 가린다(백엔드 PiiMasking.email과 같음). 예) admin01@example.com → ad*****@example.com
export function maskEmail(email) {
  const [local = '', domain = ''] = String(email ?? '').split('@')
  const visible = Math.max(0, Math.min(2, local.length - 1))
  return `${local.slice(0, visible)}${'*'.repeat(local.length - visible)}@${domain}`
}

// 시스템 로그용 아이디 — 앞 2자 + '***'(백엔드 SystemLogService.maskLoginId와 같음). 예) admin01 → ad***
export function maskLogLoginId(loginId) {
  const text = String(loginId ?? '')
  return text ? `${text.slice(0, 2)}***` : '***'
}

// 휴대폰 가운데를 가린다(숫자만 받는다). 예) 01012345678 → 010-****-5678. 없으면 null.
export function maskPhone(phone) {
  if (!phone) return null
  return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`
}
