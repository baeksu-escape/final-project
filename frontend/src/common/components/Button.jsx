// 버튼 — variant로 모양(default·primary·danger)을, size로 크기(md·sm)를 고른다. type 기본값은 'button'이라 폼 안에서 실수로 제출되지 않는다.
// 사용 예: <Button variant="primary" onClick={handleSave}>저장</Button>
//   제출 버튼은 type="submit"을 직접 준다.
export default function Button({ variant = 'default', size = 'md', type = 'button', disabled = false, onClick, children }) {
  const classes = ['button']
  if (variant !== 'default') classes.push(`button--${variant}`)
  if (size === 'sm') classes.push('button--sm')
  return (
    <button type={type} className={classes.join(' ')} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
