import { useState } from 'react'
import { Button, TextInput } from '../../../common/components/index.js'
import { checkNicknameAvailability } from '../api/authFeatureApi.js'
import { requestNicknameChange } from '../api/myPageApi.js'
import { AUTH_ERROR_CODES, SAME_NICKNAME_MESSAGE } from '../authConstants.js'
import { NICKNAME_MAX, validateNickname } from '../validation.js'

// FP-222 N-04-3 닉네임 바꾸기 폼 — 규칙은 가입과 같고(validateNickname), [중복 확인](AUTH-13)에서 쓸 수 있다고 나온 닉네임만 저장한다(MEM-08).
// 저장에 성공하면 onSaved(안내 문구)를 부르고, [취소]는 onCancel을 부른다. 서버가 같은 값·중복으로 막으면 칸 아래에 보여 준다.
export default function NicknameChangeForm({ currentNickname, onSaved, onCancel }) {
  const [nickname, setNickname] = useState('')
  // 중복 확인 결과 { nickname, available } — 닉네임을 고치면 nickname이 달라져 확인이 풀린 것으로 본다(가입 화면과 같음).
  const [check, setCheck] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const text = nickname.trim()
  const formatError = text ? validateNickname(text) : ''
  const sameAsCurrent = text !== '' && text === currentNickname
  const checked = check?.nickname === text && check.available

  // 칸 값을 바꾸면 지난 안내를 지운다.
  const handleChange = (value) => {
    setNickname(value)
    setError('')
  }

  // 형식이 맞고 지금 닉네임과 다른 값만 서버에 묻는다.
  const handleCheck = async () => {
    setPending(true)
    setError('')
    try {
      const { available } = await checkNicknameAvailability(text)
      setCheck({ nickname: text, available })
      if (!available) setError('이미 사용 중인 닉네임입니다.')
    } catch (checkError) {
      setCheck(null)
      setError(checkError.message)
    } finally {
      setPending(false)
    }
  }

  // 중복 확인을 마친 닉네임을 저장한다. 서버 오류(같은 값·중복·형식)는 칸 아래 문구로 보여 준다.
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!checked) {
      setError('[중복 확인]을 먼저 해 주세요.')
      return
    }
    setPending(true)
    try {
      await requestNicknameChange(text)
      onSaved('닉네임을 바꿨습니다.')
    } catch (saveError) {
      if (saveError.data?.code === AUTH_ERROR_CODES.SAME_NICKNAME) setError(SAME_NICKNAME_MESSAGE)
      else setError(saveError.data?.fieldErrors?.[0]?.message ?? saveError.message)
      setCheck(null)
      setPending(false)
    }
  }

  return (
    <form className="account-form nickname-change-form" onSubmit={handleSubmit} noValidate>
      <TextInput
        label="새 닉네임"
        value={nickname}
        onChange={handleChange}
        error={formatError || (sameAsCurrent ? SAME_NICKNAME_MESSAGE : '') || error}
        hint={checked ? '사용할 수 있는 닉네임입니다.' : `한글·영문·숫자 2~${NICKNAME_MAX}자, 신용 라운지에 작성자로 보입니다`}
        maxLength={NICKNAME_MAX}
        autoComplete="nickname"
      />
      <Button onClick={handleCheck} disabled={pending || !text || formatError !== '' || sameAsCurrent || checked}>
        중복 확인
      </Button>
      <Button variant="primary" type="submit" disabled={pending || !checked}>
        닉네임 저장
      </Button>
      <Button onClick={onCancel}>취소</Button>
    </form>
  )
}
