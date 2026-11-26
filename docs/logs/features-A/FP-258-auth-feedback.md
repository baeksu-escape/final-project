# 로그인·회원가입 1차 테스트 반영 — 단계적 로그인 제한·잠금 안내·아이디 찾기 본인 인증·비밀번호 찾기 이름 확인

- **날짜:** 2026-11-26
- **작성자:** JWC1226 / Claude Code
- **브랜치:** `feature-A/FP-258-auth-feedback` (develop `d7f5e5d`에서 시작)
- **관련 N-ID:** N-01-3, N-03-1, N-03-2
- **관련 결정:** 1차 테스트 피드백(Jira FP-258). 시험 번호 AUTH-07(단계적 잠금)·AUTH-17(아이디 찾기)·AUTH-18(비밀번호 찾기)·AUTH-19(잠긴 계정)는 API 번호와 다르다.

## 무엇을, 왜 바꿨나
- **단계적 로그인 제한(N-01-3, 시험 AUTH-07):** 5회 실패하면 바로 잠기던 것을 바꿨다.
  - 5회째 실패하면 그때부터 5분 동안 비밀번호와 상관없이 로그인을 거절한다(429 `LOGIN_TEMPORARILY_BLOCKED`, 문구에 남은 분).
  - 제한 중에는 실패 횟수를 올리지 않는다. 제한은 5회째에 한 번만 걸고(11/26 결정), 5분 뒤 6~9회째 실패는 401이다.
  - 누적 10회째에 잠근다(423). 마지막 실패 시각은 `APP_USER.UPDATED_AT`(로그인 실패가 고치는 열)을 쓴다.
- **잠금 안내(N-01-3):** 문구를 "잠긴 계정입니다. 비밀번호 찾기에서 이메일 인증 후 비밀번호를 재설정하면 풀립니다."로 바꾸고, 로그인 화면 안내 아래에 [비밀번호 찾기] 링크를 뒀다.
  - 잠긴 계정의 동작(틀린 비밀번호 401, 맞는 비밀번호 423)은 그대로다(시험 AUTH-19).
- **아이디 찾기 본인 인증(N-03-1, 시험 AUTH-17):** 이름·휴대폰만 맞으면 보여 주던 것을 바꿨다.
  - 이름 + [휴대폰 | 이메일] 중 하나의 인증코드(목적 `FIND_ID`)를 통과해야 찾고, 가리지 않은 아이디를 보여 준다.
  - 코드는 가입 여부와 상관없이 보낸다.
- **비밀번호 찾기 이름 확인(N-03-2, 시험 AUTH-18):** 인증코드 확인과 재설정 모두 아이디·이름·이메일이 같은 계정만 통과한다. [아이디 확인] 버튼은 만들지 않았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../user/service/AuthService.java` | `authenticate` 단계적 제한(상수 5회·5분·10회, 주입 Clock), `findId` 방법별 토큰 소비 + 이름 비교 + `loginId`, `resetPassword` 이름 비교 |
| `backend/.../user/service/AuthErrors.java` | 잠금 문구 변경, `loginTemporarilyBlocked(minutes)` 429 추가 |
| `backend/.../user/service/EmailVerificationService.java` | 재설정 목적 확인에서 이름 비교(`PiiCrypto` 주입) |
| `backend/.../user/service/AccountRules.java` | 이름 비교 `nameMatches` |
| `backend/.../user/service/EmailPurpose.java`, `PhonePurpose.java` | `FIND_ID` 추가 |
| `backend/.../user/dto/AuthRequests.java` | `FindId`에 `method`·`email`·`verificationToken`(`phone` 필수 해제), `EmailVerify`·`PasswordReset`에 `name` |
| `backend/.../user/dto/AuthResponses.java` | `FoundId`에 `loginId` |
| `backend/.../user/dto/UserAccount.java` | `updatedAt` 필드 |
| `backend/.../user/mapper/UserAccountMapper.java`·`.xml` | 조회 열에 `UPDATED_AT`, `selectUserByEmailHmac` 추가, 잠금 사유 '비밀번호 10회 실패' |
| `backend/src/test/.../AuthServiceTest.java` 등 시험 5개 | 단계적 제한·아이디 찾기·이름 확인 시험 추가, 바뀐 문구·생성자 반영 |
| `frontend/src/features/auth/authConstants.js` | 잠금 문구, 제한 상수·문구, `LOGIN_TEMPORARILY_BLOCKED`, `FIND_ID_METHODS`, 인증 목적 `FIND_ID` |
| `frontend/src/features/auth/pages/LoginPage.jsx` | 잠금 안내 아래 [비밀번호 찾기] 글자 링크(`text-link`) |
| `frontend/src/features/auth/pages/FindIdPage.jsx` | 공통 `SegmentedControl` [휴대폰 \| 이메일], `PhoneVerification`·`SplitEmailField`(FIND_ID), 결과는 가리지 않은 아이디 |
| `frontend/src/features/auth/pages/FindPasswordPage.jsx` | 이름 칸, 인증·재설정 요청에 `name` |
| `frontend/src/features/auth/api/authFeatureApi.js`, `components/PhoneVerification.jsx` | 주석만 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | 서버와 같은 순서·응답(실패 횟수·5분 제한·10회 잠금, `FIND_ID`, 이름 비교, 재설정 시 잠금 해제) |
| `docs/spec/sql/avenue_ddl.sql`, `dummy_db/01_create_tables.sql` | `CK_VCD_PURPOSE`에 `'FIND_ID'`, 변경 기록 C16 |
| `docs/spec/sql/alter_verification_code_find_id.sql` (새 파일) | 기존 DB의 제약 다시 만들기 + 확인 조회 |
| `docs/spec/sql/README.md` | 기존 DB 변경 표 한 줄 |
| `docs/ai/features.md`, `docs/spec/api/api_definition.md`, `docs/spec/api/api_spec_a.md` | 해당 줄 `🆕 11/26` |

## DB·API 변경
- **DB (DDL C16):** `VERIFICATION_CODE.CK_VCD_PURPOSE`에 `'FIND_ID'`를 추가했다. 열·표 수는 그대로다.
  - 기존 DB는 `alter_verification_code_find_id.sql`로 고친다. **PR 작성자가 병합 후 공용 DB에 실행**하고, 로컬은 각자 실행한다.
  - 이 제약이 없는 DB에서는 아이디 찾기 인증번호 발송이 ORA-02290으로 실패한다.
- **API**
  - AUTH-01·05: 429 `LOGIN_TEMPORARILY_BLOCKED` 추가, 423은 10회째.
  - AUTH-07·14: `purpose`에 `FIND_ID`.
  - AUTH-08: `name`(재설정 목적).
  - AUTH-09: 요청 `{ method, name, phone|email, verificationToken }`, 응답 `{ maskedLoginId, loginId }`. 토큰이 없으면 400.
  - AUTH-10: `name`.
  - 기존 필드는 지우지 않았다.
- **문서:** `api_spec_a.md`와 정의서 1-1 오류 표(429 줄, 423 설명)·2-1 해당 줄을 고쳤다. 정의서 1장은 범영 님 확인을 요청한다. 정의서 맨 위 「최근 변경」 블록은 고치지 않았다.
- **영향을 받는 기능·팀원**
  - 간편 로그인 연결(AUTH-05)과 관리자 로그인도 같은 `authenticate`를 거쳐 같은 제한을 받는다.
  - 로그인한 뒤 잠긴 계정의 401 `ACCOUNT_LOCKED`(JWT 필터)도 같은 새 문구를 쓴다.
  - 관리자 화면의 잠금 문구(`admin/adminConstants.js`)는 관리자가 비밀번호 찾기를 쓸 수 없어 그대로 뒀다.

## 확인
- 확인함
  - `mvnw clean test`(`-Xmx512m -XX:+UseSerialGC` 등 이 PC 옵션) 525건 통과, 실패·오류 0.
  - `npm run lint` 오류 0, `npm run build` 성공.
  - SQL은 어느 DB에도 실행하지 않았다.
- 확인 못 함
  - 화면은 직접 열어 보지 않았다. mock으로 확인할 때 데모 계정은 비밀번호를 비교하지 않으므로, 로그인 제한은 새로 가입한 계정으로 본다.
- 팀 확인 필요
  - 5분 제한의 시작 시각으로 쓰는 `UPDATED_AT`은 다른 변경(예: 다른 곳에서 로그인한 상태로 닉네임 변경)에도 바뀐다. 제한 중에 그런 변경이 있으면 제한이 그만큼 늦게 끝난다.
  - 비밀번호 재설정은 원래부터 사유와 상관없이 잠금을 푼다(관리자가 수동으로 잠근 계정 포함). 새 안내 문구가 이를 사용자에게 알린다.

## 2차 — 입력 규칙 통일·비밀번호 보기 (2026-11-26, b505caf 위에서 이어서)
- **관련 N-ID:** N-01-1, N-02-1, N-03-1, N-03-2, N-04-3

### 무엇을, 왜 바꿨나
- **입력 규칙:** 칸마다 허용 글자가 화면마다 달랐고, 대문자·한글 이메일이 통과·저장됐다.
  - `validation.js`에 칸별 걸러내기 함수를 두고, 가입·로그인·찾기·마이페이지가 입력과 붙여넣기 모두 같은 함수를 거친다.
  - 판정(`isValidLoginId`·`NAME_PATTERN`·`NICKNAME_PATTERN`)은 그대로다.
- **이메일 규칙**
  - 앞부분: `a-z0-9._-`, 처음·끝은 영문·숫자, 점 연속 불가, 64자.
  - 도메인: 덩어리마다 영문·숫자로 시작·끝, 마지막은 영문 2자 이상.
  - 서버 `AccountRules.isValidEmail`(이름 유지)도 같은 규칙이다. 소문자로 바꾼 값으로 판정하므로 대문자 때문에 거절하지는 않는다.
  - 가입·이메일 변경·인증코드 발송·확인·아이디 찾기·재설정은 이메일을 strip + 소문자로 바꿔 쓰고, `EMAIL_ENC`도 소문자로 저장한다. HMAC은 원래부터 소문자 기준이었다.
- **이름 확인:** 아이디 찾기·비밀번호 찾기(코드 확인·재설정)의 이름은 가입과 같은 규칙으로 먼저 검사한다(`AuthErrors.requireValidName`).
  - 틀리면 400 `INVALID_INPUT`(`name` 칸). 형식은 맞는데 계정이 없으면 지금처럼 같은 404다.
- **로그인 아이디:** strip + 소문자로 바꿔 조회한다(`AccountRules.normalizeLoginId`, 재설정 조회도 같음).
- **비밀번호 보기:** Edge 기본 눈 모양은 값을 고치면 사라졌다.
  - 새 `PasswordField`([보기]/[숨기기], `aria-pressed`)와 `usePasswordReveal`(요청 직전 `hideAll`)을 만들었다.
  - `auth.css`에는 `.password-field`의 `::-ms-reveal` 숨김 한 줄만 넣었다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../user/service/AccountRules.java` | 이메일 앞부분·도메인 규칙, `normalizeEmail`·`normalizeLoginId` |
| `backend/.../user/service/AuthErrors.java` | `requireValidName`(400 `name` 칸) |
| `backend/.../user/service/AuthService.java` | 로그인 아이디 소문자 조회, 가입·찾기·재설정 이메일 소문자, 찾기·재설정 이름 형식 검사 |
| `backend/.../user/service/EmailVerificationService.java` | 발송·확인·토큰 사용 이메일 소문자, 재설정 확인 이름 형식 검사·아이디 소문자 |
| `backend/.../user/service/MyPageService.java` | 이메일 변경 소문자 판정·저장 |
| `backend/src/test/.../AuthServiceTest.java`, `EmailVerificationServiceTest.java`, `SocialAndMyPageServiceTest.java` | 시험 8건 추가, 가입 이메일 소문자·이름 없음 400으로 기대값 수정 |
| `frontend/src/features/auth/validation.js` | 걸러내기 함수 7개, 이메일 판정(`isValidEmailLocal`·`isValidEmailDomain`), mock용 `normalizeEmail`·`normalizeLoginId` |
| `frontend/src/features/auth/components/PasswordField.jsx`, `usePasswordReveal.js` (새 파일) | 비밀번호 보기 칸과 상태 |
| `frontend/src/features/auth/pages/LoginPage.jsx`·`SignupPage.jsx`·`FindIdPage.jsx`·`FindPasswordPage.jsx` | 걸러내기 적용, 비밀번호 칸 교체, 요청 직전 가림. 아이디 찾기는 이름 검사와 서버 `name` 칸 오류 표시 |
| `frontend/src/features/auth/components/SplitEmailField.jsx`·`EmailChangeForm.jsx`·`NicknameChangeForm.jsx` | 이메일·닉네임 걸러내기, 이메일 칸 `autoCapitalize`·`spellCheck`·`inputMode` |
| `frontend/src/features/auth/components/PasswordChangeForm.jsx`·`ProfileUnlockCard.jsx`·`WithdrawalCard.jsx` | 비밀번호 칸 교체, 요청 직전 가림 |
| `frontend/src/features/auth/auth.css` | `.password-field input::-ms-reveal` 숨김 |
| `frontend/src/features/auth/mocks/authMockHandlers.js`·`myPageMockHandlers.js` | 서버와 같은 정리(소문자)·이름 형식 400 순서 |
| `docs/ai/features.md`, `docs/spec/api/api_spec_a.md` | 해당 줄 `🆕 11/26` |

### DB·API 변경
- **DB:** 없음(DDL 그대로). 기존 행의 `EMAIL_ENC`는 대소문자가 섞여 있을 수 있지만 그대로 둔다. 조회는 HMAC이라 영향이 없다.
- **API:** 필드는 그대로다. 바뀐 동작은 아래와 같다(`api_spec_a.md` 반영, 정의서는 고치지 않음).
  - 이메일은 소문자로 저장한다.
  - 규칙에 맞지 않는 이메일은 400이다.
  - AUTH-08(재설정)·09·10은 이름 형식이 틀리면 400 `name` 칸이다.
  - AUTH-01은 아이디를 소문자로 조회한다.
- **영향을 받는 기능·팀원:** 관리자 계정 만들기(`AdminAccountService`, 프론트 `AddAdminForm`)도 같은 `isValidEmail`을 써서, 업무 이메일에 `+` 같은 기호를 쓸 수 없게 됐다(코드는 고치지 않음).

### 확인
- 확인함
  - `mvnw clean test`(이 PC 옵션) 533건 통과, 실패·오류 0.
  - `npm run lint` 오류 0, `npm run build` 성공.
  - 걸러내기·이메일 판정 함수는 node로 예시 값을 넣어 확인했다.
- 확인 못 함
  - 화면을 직접 열어 보지 않았다(한글 조합 유지, 보기 버튼, Edge 눈 모양).
  - 공통 `TextInput`이 `autoCapitalize`·`spellCheck`를 받지 못해 아이디 칸과 마이페이지 이메일 칸에는 넣지 못했다(공통 컴포넌트는 고치지 않음).
- 팀 확인 필요
  - 공통 `TextInput`에 `autoCapitalize`·`spellCheck` 속성 추가(프론트 공통 담당).
  - 관리자 업무 이메일 규칙을 일반 회원과 같게 둘지.
  - [보기] 버튼 모양·위치(UI 담당).

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
