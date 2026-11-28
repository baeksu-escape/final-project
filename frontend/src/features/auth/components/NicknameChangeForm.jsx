import { useState } from 'react'
import { TextInput } from '../../../common/components/index.js'
import { checkNicknameAvailability } from '../api/authFeatureApi.js'
import { requestNicknameChange } from '../api/myPageApi.js'
import { AUTH_ERROR_CODES, SAME_NICKNAME_MESSAGE } from '../authConstants.js'
import useImeSafeFilter from '../useImeSafeFilter.js'
import { NICKNAME_MAX, filterNickname, validateNickname } from '../validation.js'

// FP-222 N-04-3 닉네임 변경 폼 — 규칙은 가입과 같고(validateNickname), [중복 확인](AUTH-13)에서 쓸 수 있다고 나온 닉네임만 저장한다(MEM-08).
// FP-259 12차 [중복 확인]은 가입 화면처럼 칸 오른쪽 같은 줄에 두고(좁으면 버튼만 아래 줄), 안내·오류는 줄 아래에, [닉네임 저장]·[취소]는 2칸 격자로 둔다.
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
  // FP-258 가입과 같은 filterNickname으로 거른다(한글 조합은 끝날 때, useImeSafeFilter).
  const nicknameInput = useImeSafeFilter()((value) => {
    setNickname(value)
    setError('')
  }, filterNickname)

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
      {/* FP-259 14차 안내·오류는 TextInput의 hint·error로 넘겨 칸에 빨간 테두리·aria-invalid를 붙인다. 격자 줄이라 버튼은 오류가 있어도 칸 옆에 있다. */}
      <div className="account-form__row account-form__row--grid">
        <div {...nicknameInput.compositionProps}>
          <TextInput
            label="새 닉네임"
            value={nickname}
            onChange={nicknameInput.onChange}
            maxLength={NICKNAME_MAX}
            autoComplete="nickname"
            hint={checked ? '사용할 수 있는 닉네임입니다.' : `한글·영문·숫자 2~${NICKNAME_MAX}자, 신용 라운지에 작성자로 보입니다`}
            error={formatError || (sameAsCurrent ? SAME_NICKNAME_MESSAGE : '') || error}
          />
        </div>
        <button
          type="button"
          className="account-form__check"
          onClick={handleCheck}
          disabled={pending || !text || formatError !== '' || sameAsCurrent || checked}
        >
          중복 확인
        </button>
      </div>
      <div className="nickname-change-form__actions">
        <button type="submit" className="account-form__submit" disabled={pending || !checked}>
          닉네임 저장
        </button>
        <button type="button" className="account-form__cancel" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  )
}
