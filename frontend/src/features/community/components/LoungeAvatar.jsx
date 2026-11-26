// 닉네임 첫 글자로 만든 동그란 얼굴 — 닉네임마다 색이 고정된다(실제 사진·개인정보 아님). 글 목록·내가 쓴 댓글 목록이 함께 쓴다.
const AVATAR_TONES = ['var(--c-blue)', 'var(--c-green)', 'var(--c-violet)', 'var(--c-orange)', 'var(--c-sky)', 'var(--c-pink)']
export default function LoungeAvatar({ name = '?' }) {
  const code = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return <span className="lounge-avatar" style={{ '--tone': AVATAR_TONES[code % AVATAR_TONES.length] }} aria-hidden="true">{name.slice(0, 1)}</span>
}
