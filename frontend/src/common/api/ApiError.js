// API 호출 실패를 나타내는 오류. status 0은 서버에 연결하지 못한 경우다.
export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}
