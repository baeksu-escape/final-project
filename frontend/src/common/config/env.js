// 환경 변수 읽기 — .env의 VITE_USE_MOCK가 'false'일 때만 실제 API를 호출한다(백엔드 준비 전 기본값은 mock).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

// 실제 API 주소. 비어 있으면 같은 주소(상대 경로)로 요청한다.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
