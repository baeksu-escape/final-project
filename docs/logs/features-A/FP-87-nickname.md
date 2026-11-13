# 회원가입 닉네임 입력 추가 (FP-87)

- **날짜:** 2026-11-13
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-87-birth-year` (출생연도 작업 위에 더함. 시작 전에 PR #45 검토 반영본 `feature-A/FP-199-V3-UPDATE`를 병합)
- **관련 N-ID:** N-02-1 (가입 후 표시 확인: N-04-1)
- **관련 결정:** DDL v0.3.2(develop `docs/spec/sql/avenue_ddl.sql`)
  - `APP_USER.NICKNAME VARCHAR2(12 CHAR) NOT NULL`
  - `UK_APU_NICKNAME`(중복 불가), `CK_APU_NICKNAME_LEN`(2~12자)
  - `CK_APU_PII_BY_STATUS`('탈퇴' 접두어는 탈퇴 회원 전용)

## 무엇을, 왜 바꿨나
- DDL에서 닉네임이 필수(NOT NULL)인데 가입 화면이 닉네임을 받지 않았다. 가입 화면에 닉네임 입력을 추가했다.
- **화면**
  - '닉네임' 칸을 이름 칸 바로 다음에 두었다. 공통 `TextInput`을 다시 썼고, 최대 12자다.
  - 힌트: "2~12자, 신용 라운지에 작성자로 보입니다"
- **검사**(`validateNickname`, 화면과 mock이 같은 함수). 앞뒤 공백을 뺀 값으로 검사한다.
  - 빈칸(공백만 포함): "닉네임을 넣어 주세요."
  - 2~12자가 아님: "닉네임은 2~12자로 넣어 주세요."
  - '탈퇴'로 시작: "쓸 수 없는 닉네임입니다."
- **API**: 가입 요청 본문에 `nickname`(앞뒤 공백을 뺀 값)을 추가했다. 기존 필드는 그대로다.
- **mock**(`POST /api/auth/signup`)
  - 같은 규칙을 어기면 400 `fieldErrors [{ field: 'nickname', message }]`를 돌려준다.
  - 이미 있는 닉네임이면 409 `{ code: 'DUPLICATE_NICKNAME', message: '이미 사용 중인 닉네임입니다.' }`를 돌려준다.
    - 가입 화면은 이 오류를 닉네임 칸 아래에 보여 준다. `DUPLICATE_LOGIN_ID` 처리 방식과 같다.
  - 계정에 `nickname`을 저장한다. `createdAt`은 PR #45 검토 반영(FP-199)에서 이미 저장한다.
  - 데모 계정 4개(employee·self·freelancer·newbie)에도 닉네임을 넣었다. 값은 `MY_PAGE_DEMO_PROFILES`와 같다.
- 마이페이지는 계정의 `nickname`을 먼저 읽는다(FP-199). 그래서 가입한 닉네임이 내 정보에 보인다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/validation.js` | `NICKNAME_MIN`·`NICKNAME_MAX`·`WITHDRAWN_NICKNAME_PREFIX`, `validateNickname`, `validateSignup`에 닉네임 검사 |
| `frontend/src/features/auth/authConstants.js` | `AUTH_ERROR_CODES.DUPLICATE_NICKNAME` 추가 |
| `frontend/src/features/auth/pages/SignupPage.jsx` | 닉네임 칸(이름 다음), 요청 본문 `nickname`, 409 중복 오류를 닉네임 칸에 표시 |
| `frontend/src/features/auth/api/authFeatureApi.js` | 가입 요청 주석에 `nickname`·400·409 추가 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | 가입 시 닉네임 검사(400)·중복(409)·저장 |
| `frontend/src/features/auth/mocks/authMockData.js` | 데모 계정 4개에 닉네임 추가 |

## DB·API 변경
- DB: 없음. DDL v0.3.2 규칙에 맞췄다.
- API: `POST /api/auth/signup`(경로 그대로)
  - 요청에 `nickname`을 추가했다.
  - 400 `fieldErrors`의 `field`에 `'nickname'`이 추가됐다.
  - 409 `code`에 `'DUPLICATE_NICKNAME'`이 추가됐다.
- 영향을 받는 기능·팀원
  - 가입 서버 담당: 닉네임 검사·중복 확인
  - 신용 라운지 담당: 작성자 표시에 쓰는 값

## 확인
- 확인함: `npm run lint` 통과, `npm run build` 통과
- 확인함: 기능 단위 모의 테스트 38개 항목 통과. 실제 `App`을 jsdom에 그려 입력·클릭으로 돌렸고, VITE_USE_MOCK 기본값(mock)이다.
  - 화면 검사
    - 닉네임 칸이 이름 바로 다음에 있고, 힌트 문구와 maxLength 12가 맞다.
    - 빈칸, 공백만, 1자, 13자, '탈퇴123'은 각각 맞는 문구가 나온다.
    - 앞뒤 공백이 붙은 2자와 12자는 통과한다.
  - 출생연도 화면 검사: 빈칸, 1929, 올해−19, 올해−20, 1990
  - mock 직접 호출
    - 빈칸, 값 없음, 1자, 13자, '탈퇴123'은 400 fieldErrors nickname
    - '데모직장인'은 409 DUPLICATE_NICKNAME
    - 앞뒤 공백을 뺀 값으로 저장되고, 같은 값으로 다시 가입하면 409
  - 화면에서 끝까지 가입
    - 중복 닉네임이면 닉네임 칸 아래에 "이미 사용 중인 닉네임입니다."가 나온다.
    - 닉네임을 고치면 그 오류가 지워지고, 다시 제출하면 가입 완료 화면으로 간다.
  - 새 계정으로 로그인
    - 직군 선택 화면이 나오고, 헤더 [마이 페이지]로 마이페이지가 열린다.
    - 닉네임은 가입한 값, 가입일은 오늘, 직군은 '직군 미선택'으로 보인다. 진단 내역은 0건 안내다.
- 확인함: 기존 점검을 다시 돌려 통과했다. 출생연도 32개(닉네임을 넣은 요청으로 갱신), 마이페이지 25개, 진단 내역 22개다.
- 확인 못 함
  - 실제 브라우저에서 보이는 모양(스타일)
  - 입력 칸의 maxLength 글자 자르기는 브라우저 동작이다. 속성 값만 확인했다.

## 다음 사람이 알아야 할 것
- admin·잠긴 계정은 `MY_PAGE_DEMO_PROFILES`에 없어서 데모 닉네임을 넣지 않았다. 일반 회원 가입의 중복 확인에는 영향이 없다.
- 글자 수는 JavaScript 문자열 길이로 센다. 이모지처럼 두 칸을 쓰는 글자는 2자로 셀 수 있다. 서버 검사 기준(Oracle `LENGTH`)과 맞출지 백엔드 담당과 확인이 필요하다.
- 닉네임 변경 기능은 명세(N-04-3: 이메일·비밀번호만 변경)에 없어 만들지 않았다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
