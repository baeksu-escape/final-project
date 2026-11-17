import { useState } from 'react'
import { Button, TextInput } from '../../../common/components/index.js'
import { TITLE_MAX } from '../config/communityCodes.js'

// N-06-2 글쓰기 · N-06-5 내 글 수정 — 같은 폼을 쓴다. initial이 있으면 수정 모드다.
// onSubmit({ title, content })은 Promise를 돌려준다. 실패하면 서버 문구를 폼 아래에 보여 준다.
export default function PostForm({ initial, onSubmit, onCancel }) {
  const editing = Boolean(initial)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 넣어 주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ title: title.trim(), content: content.trim() })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="card lounge-form" onSubmit={handleSubmit} aria-labelledby="lounge-form-title">
      <h2 id="lounge-form-title" className="card__title">
        {editing ? '글 수정' : '글쓰기'}
      </h2>
      <TextInput label="제목" value={title} onChange={setTitle} placeholder="제목을 넣어 주세요" maxLength={TITLE_MAX} />
      <div className="form-field">
        <label htmlFor="lounge-form-content" className="form-field__label">
          내용
        </label>
        <textarea
          id="lounge-form-content"
          className="lounge-textarea"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="다른 사람의 개인정보나 계좌번호는 올리지 말아 주세요."
        />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="l-row">
        <Button type="submit" variant="primary" disabled={saving}>
          {editing ? '수정' : '등록'}
        </Button>
        <Button onClick={onCancel}>취소</Button>
      </div>
    </form>
  )
}
