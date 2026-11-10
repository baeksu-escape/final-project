// 안내 박스 — type으로 info(참고)·warn(주의)·success(완료)를 고른다. warn은 화면 낭독기가 바로 읽도록 role="alert"를 쓴다.
// 사용 예: <Notice type="warn">대출 상품·금리·한도는 더미 데이터입니다.</Notice>
export default function Notice({ type = 'info', children }) {
  return (
    <div className={`notice notice--${type}`} role={type === 'warn' ? 'alert' : 'note'}>
      {children}
    </div>
  )
}
