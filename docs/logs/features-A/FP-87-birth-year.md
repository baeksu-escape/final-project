# 회원가입 연령대 선택을 출생연도 입력으로 변경, 올해 기준 20세 이상만 가입 (FP-87)

- **날짜:** 2026-11-12
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-87-birth-year` (`feature-A/FP-199-V3-UPDATE`에서 분기)
- **관련 N-ID:** N-02-1
- **관련 결정:** 팀 결정 A안(출생연도만 받고 "올해 20세가 되는 해까지" 가입), DDL v0.3.2 `APP_USER.BIRTH_YEAR`(1930~2006, 일반 회원 필수, 연령대는 이 값으로 계산)

## 무엇을, 왜 바꿨나
- 가입 화면의 '연령대' 선택을 '출생연도' 숫자 입력(공통 `TextInput`)으로 바꿨다.
  - 힌트: "연령대별 기준을 고르는 데 씁니다. 올해 기준 20세 이상({올해 − 20}년생까지) 가입할 수 있습니다."
- 검사 규칙: 4자리 정수이고 1930 ≤ 출생연도 ≤ (올해 − 20)
  - 올해는 `new Date().getFullYear()`로 구한다. 2026년이면 2006년생까지다.
  - 생일 경과는 따지지 않는다.
- 가입 요청에 `birthYear`를 추가했다. 기존 `ageGroup`은 지우지 않고 출생연도로 계산해 함께 보낸다.
- 가입 mock도 같은 규칙으로 검사한다. 어기면 400과 `fieldErrors [{ field: 'birthYear', message }]`를 돌려주고, 화면은 그 칸 옆에 보여 준다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/validation.js` | `BIRTH_YEAR_MIN`·`MIN_SIGNUP_AGE`·`getMaxBirthYear`·`validateBirthYear`, 가입 검사에서 연령대 대신 출생연도 검사 |
| `frontend/src/features/auth/authConstants.js` | `toAgeGroup(birthYear)` — 기존 연령대 값으로 계산(TODO: 백엔드 확정 시 제거) |
| `frontend/src/features/auth/pages/SignupPage.jsx` | 연령대 Select → 출생연도 TextInput, 요청에 birthYear·ageGroup, 서버 칸별 오류 표시 |
| `frontend/src/features/auth/api/authFeatureApi.js` | 가입 요청 본문 주석에 birthYear·fieldErrors |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | 가입 mock에서 출생연도 검사(400 fieldErrors)와 계정에 birthYear 저장 |

## DB·API 변경
- DB: 없음
- API: `POST /api/auth/signup`(경로 그대로)
  - 요청 본문에 `birthYear`(숫자)를 추가했다. `ageGroup`은 그대로 함께 보낸다.
  - 400 응답에 `fieldErrors`가 온다.
- 영향을 받는 기능·팀원: Spring 가입 API 담당(birthYear 검사·저장, ageGroup 제거 시점)

## 확인
- 확인함: `npm run lint` 통과, `npm run build` 통과
- 확인함: Node 스크립트로 화면 검사 함수와 가입 mock을 함께 확인해 32개 항목 통과

  | 입력 | 결과 |
  |---|---|
  | 빈칸 | "출생연도를 넣어 주세요." |
  | 1929 | 범위 오류 |
  | 올해−19 | 범위 오류 |
  | 올해−20 | 통과 |
  | 1990 | 통과 |
  | 1930 | 통과 |
  | 3자리·글자 섞임 | 범위 오류 |

  - mock이 같은 문구로 400을 돌려주는지 확인했다.
  - 연령대 계산이 맞는지 확인했다.
- 확인 못 함: 브라우저에서 가입 화면을 직접 입력해 보는 확인. `npm run dev`(VITE_USE_MOCK=true)로 확인해야 한다.

## 다음 사람이 알아야 할 것
- DDL `APP_USER.BIRTH_YEAR` CHECK 상한은 2006으로 고정돼 있다. 2027년부터는 화면 상한(올해 − 20)과 달라지므로 DB 담당과 맞춰야 한다(`validation.js` TODO).
- 연령대를 쓰는 다른 화면은 없다(검색 결과 가입 화면과 가입 mock뿐). 동작은 바꾸지 않았다.
  - 참고: 공통 차트 `HeatmapGrid`의 "연령대 4개"는 화면 열 이름 설명이고, 가입 연령대 값과는 상관없다.
  - 참고: 가입 연령대 값은 5개(20대~60대 이상)다. 명세의 비교용 연령 구간은 4개(20대·30대·40대·50대 이상)다. 백엔드가 출생연도로 계산하게 되면 이 차이는 사라진다.
- 비밀번호 규칙, 이메일 인증 등 다른 가입 흐름은 바꾸지 않았다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
