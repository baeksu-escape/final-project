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
- **보기 유지(2차 보완) 🆕 11/26:** `hideAll()`을 요청 앞에서 성공 뒤(저장·화면 이동 직전)로 옮겼다. 실패하면 보기 상태가 그대로다(로그인·가입·재설정·마이페이지 3곳).
- **FP-259 MYPAGE-06 🆕 11/26:** `PasswordChangeForm`에서 칸을 고치면 그 칸 오류와 폼 오류를 지운다. 새 비밀번호를 고치면 확인 칸 오류, 현재 비밀번호를 고치면 "지금 쓰는 비밀번호와 같습니다"도 지운다.

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

## 3차 — 한글 입력 중 값 지워짐·선택 표시·비밀번호 눈 모양 (2026-11-26) 🆕 11/26
- **관련 N-ID:** N-01-1, N-02-1

### 원인
- **값 지워짐**
  - 한글 조합 중 `onChange`에서 걸러내기가 조합 글자를 빼고 값을 되돌렸다.
  - 그러면 Windows 한글 IME가 들고 있던 조합 범위와 칸 값이 어긋나 써 둔 글자를 덮어썼다.
  - 헤드리스 Edge(CDP)의 IME 흉내로는 지워지는 현상까지는 재현되지 않았다. 실제 IME에서만 생기는 것으로 본다.
- **선택이 안 되는 것처럼 보임**
  - 선택 자체는 된다. 드래그와 Shift+Home 모두 CDP로 범위가 잡히는 것을 확인했다.
  - 공통 `layout.css`의 `::selection { background: var(--sel) }`(`#e8f1fe`)가 흰 입력 칸(`--inp` `#ffffff`) 위에서 거의 보이지 않는다.
  - 가입·로그인·찾기·마이페이지 칸이 모두 같다. 공통 파일이라 고치지 않았다.

### 무엇을 바꿨나
- 새 `useImeSafeFilter`
  - 조합 중(compositionstart~compositionend)에는 값을 그대로 두고, compositionend에서 한 번 거른 뒤 커서를 제자리에 놓는다.
  - 공통 `TextInput`은 조합 이벤트를 넘기지 않아서 감싼 div가 받는다. `SplitEmailField`는 input에 직접 단다.
  - 적용 칸
    - 아이디: 로그인·가입·비밀번호 찾기
    - 이메일 앞부분·직접 입력 도메인: 가입·아이디 찾기·비밀번호 찾기
    - 마이페이지 이메일 변경
    - 이름: 가입·아이디 찾기·비밀번호 찾기
    - 닉네임: 가입·마이페이지
  - 걸러내기 규칙은 2차 그대로다.
- `PasswordField`
  - 글자 버튼 대신 칸 안 오른쪽에 눈 모양 아이콘 버튼(인라인 SVG)을 둔다.
  - `aria-pressed`는 그대로이고, `aria-label`은 상태에 따라 "비밀번호 보기"/"비밀번호 숨기기"로 바뀐다.
  - 칸 안에 버튼을 두려고 공통 클래스로 직접 그린다(`TextInput`과 같은 `useId`·`aria-describedby`). 부르는 화면 6곳은 그대로다.
  - 동작(값을 고쳐도 유지, 성공할 때만 가림)과 Edge 기본 눈 모양 숨김은 그대로다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/useImeSafeFilter.js` (새 파일) | 조합 중 거르지 않고 조합 끝에 한 번 거르기, 커서 유지 |
| `frontend/src/features/auth/pages/LoginPage.jsx`·`SignupPage.jsx`·`FindIdPage.jsx`·`FindPasswordPage.jsx` | 아이디·이름·닉네임 칸에 적용(로그인·찾기는 칸을 클래스 없는 div로 감쌈) |
| `frontend/src/features/auth/components/SplitEmailField.jsx`·`EmailChangeForm.jsx`·`NicknameChangeForm.jsx` | 이메일·닉네임 칸에 적용 |
| `frontend/src/features/auth/components/PasswordField.jsx` | 칸 안 눈 모양 버튼 |
| `frontend/src/features/auth/auth.css` | `.password-field__box`·`__toggle`, 입력 칸 오른쪽 여백(색은 토큰만) |
| `docs/ai/features.md` | N-01-1 눈 모양, N-02-1 조합 처리 |

### 확인
- 확인함
  - `npm run lint` 오류 0, `npm run build` 성공.
  - mock 개발 서버 + 헤드리스 Edge(CDP)로 확인했다.
    - 조합 중 값 유지, 조합 끝에 한글만 빠지고 커서가 제자리에 오는 것(로그인 아이디 가운데, 가입 아이디·이메일 앞부분, 이름은 한글 유지).
    - 눈 버튼이 입력 칸 안에 있고 오류 문구가 떠도 칸 안에 머무는 것.
    - 누르면 `type`·`aria-label`·`aria-pressed`가 바뀌는 것.
- 확인 못 함
  - 실제 Windows 한글 IME로 치는 것은 사람이 화면에서 본다.
- 팀 확인 필요
  - 입력 칸 선택 색: 공통 `::selection`(`--sel`)이 흰 칸에서 거의 안 보인다. 입력 칸 선택색을 진하게 하거나 `--sel` 조정이 필요하다(프론트 공통 담당).
  - 눈 버튼 모양·크기(UI 담당).

## 4차 — 눈 버튼 표시 조건·비밀번호 한글 막기·이름 자모 오류 (2026-11-26) 🆕 11/26
- **관련 N-ID:** N-01-1, N-02-1, N-03-1, N-03-2

### 무엇을 바꿨나
- **눈 버튼:** `PasswordField`는 값이 있을 때만 눈 버튼과 오른쪽 여백(`password-field--filled`)을 둔다. 보기 상태는 부모가 들고 있어서, 값을 지웠다 다시 치면 직전 상태로 나타난다.
- **비밀번호 한글 막기:** `validation.js`에 `filterPassword`를 추가했다.
  - ASCII 출력 문자와 공백만 남긴다. 공백은 지금 규칙이 막지 않아 남긴다.
  - `PasswordField` 안에서 `useImeSafeFilter`로 조합이 끝날 때·붙여넣을 때 거른다.
- **이름 자모 오류:** `validateName`이 자모가 남은 이름에 "이름을 완성해 입력해 주세요."(`NAME_INCOMPLETE_MESSAGE`)를 돌려준다. 가입·mock도 같은 함수를 쓴다.
  - `PhoneVerification`·`SplitEmailField`에 선택 속성 `beforeRequest`를 추가했다. 아이디·비밀번호 찾기에서는 [받기]·[확인]·[다음] 요청 전에 이름을 검사한다.
  - 이름 칸을 벗어날 때(값이 있을 때)도 검사한다. 가입 화면은 원래부터 칸을 벗어날 때·[가입하기] 때 검사한다.
- **이름 한글 2~5자: 보류(사용자 결정).** 이름 규칙(2~20자)·서버·시험·API 문서는 그대로다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/validation.js` | `filterPassword`, `NAME_INCOMPLETE_MESSAGE`, `validateName` 자모 문구 |
| `frontend/src/features/auth/components/PasswordField.jsx` | 값이 있을 때만 눈 버튼, 비밀번호 걸러내기 |
| `frontend/src/features/auth/auth.css` | 오른쪽 여백을 `.password-field--filled`일 때만 |
| `frontend/src/features/auth/components/PhoneVerification.jsx`·`SplitEmailField.jsx` | 선택 속성 `beforeRequest` |
| `frontend/src/features/auth/pages/FindIdPage.jsx`·`FindPasswordPage.jsx` | 요청 전·칸을 벗어날 때 이름 검사, 고치면 오류 지움 |
| `docs/ai/features.md` | N-01-1·N-02-1·N-03-1·N-03-2 |

### 확인
- 확인함
  - `npm run lint` 오류 0, `npm run build` 성공. 서버 파일은 바꾸지 않아 `mvnw test`는 생략했다.
  - mock 개발 서버 + 헤드리스 Edge(CDP)로 확인했다.
    - 빈 칸에는 눈 버튼이 없다.
    - 값을 지웠다 다시 치면 보기 상태가 유지된다.
    - 보기 상태에서 한글을 조합하면 확정 때 빠지고, 영문·숫자·기호는 남는다.
    - "홍길ㄷ"은 아이디 찾기·비밀번호 찾기·가입에서 칸을 벗어날 때 오류가 뜨고, [인증번호 받기]를 눌러도 요청 없이 오류만 뜬다.
- 확인 못 함
  - 실제 Windows 한글 IME로 보기 상태 비밀번호를 치는 것.
- 팀 확인 필요
  - **이름 2~5자 보류 사유:** 6자 이상 이름이 있다.
    - dummy_db 시드의 일반 회원 `합성회원000001` 형식(`tools/build_db.py`)과 관리자 `시연 관리자`.
    - 프론트 mock의 `데모 급여소득자`·`데모 자영업자`·`데모 프리랜서`·`데모 직군 미선택`·`데모 관리자`(`common/mocks/mockUsers.js`)와 `데모 잠긴 계정`(`authMockData.js`).
    - 서버 시험에는 없다.
  - **시드·mock 이름이 지금 규칙(한글 2~20자, 공백·숫자 불가)에도 맞지 않는다.** 그래서 2차 이후 이 계정들은 아이디 찾기·비밀번호 찾기에서 이름 형식 400에 걸린다. 새로 가입한 계정만 쓸 수 있다.
  - **관리자 계정 만들기 이름(`AdminAccountService`)은 50자 이하만 본다.** 회원 이름 규칙을 바꿔도 함께 바뀌지 않는다.
  - **서버 비밀번호 규칙(`AccountRules.isValidPassword`):** 8~64자에 영문·숫자가 하나씩만 있으면 통과라 한글 등 ASCII 밖 문자를 받는다.
    - Spring Security 6.2의 BCrypt는 72바이트 뒤를 조용히 버린다. 한글이 섞이면 64자 안에서도 잘릴 수 있다.
    - 화면에서만 막았다. ASCII 밖 문자가 든 비밀번호를 이미 쓰는 계정이 있다면, 그 계정은 로그인 칸에서 그 글자를 칠 수 없다.
  - **자모 문구 차이:** 서버 `nameError`는 자모가 남은 이름에도 `NAME_RULE_MESSAGE`를 돌려줘 화면 문구와 다르다.

## 5차 — 비밀번호 보기 상태의 한글 자판 입력을 영문 키로 (2026-11-26) 🆕 11/26
- **관련 N-ID:** N-01-1, N-02-1

### 무엇을, 왜 바꿨나
- 가린 비밀번호 칸(`type=password`)은 브라우저가 한글 IME를 꺼서, 한글 자판으로 쳐도 영문 키가 들어간다(ㅂ→q).
- 보기 상태(`type=text`)는 4차에서 한글을 빼서, 같은 키를 쳐도 두 상태의 값이 달랐다.
- `validation.js`에 `hangulToQwerty`(두벌식: 완성형 음절은 초·중·종성으로 나눠 키로, 낱자 자모·겹모음·겹받침도 표대로)를 추가했다.
- `useImeSafeFilter`는 조합이 끝날 때만 쓰는 변환 함수(선택 인자 `finish`)를 받는다. 다른 칸은 넘기지 않아 동작이 같다.
- `PasswordField`는 조합이 끝날 때 `filterPassword(hangulToQwerty(값))`를 쓰고, 커서를 늘어난 길이만큼 뒤로 둔다.
  - 붙여넣기와 조합 없는 입력은 지금처럼 `filterPassword`만 거친다. 그래서 한글은 빠진다.
  - 적용: 로그인, 가입 비밀번호·확인, 재설정 2칸, 마이페이지 3곳. 부르는 화면은 고치지 않았다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/validation.js` | `hangulToQwerty`와 두벌식 키 표 |
| `frontend/src/features/auth/useImeSafeFilter.js` | 조합이 끝날 때만 쓰는 선택 인자 `finish` |
| `frontend/src/features/auth/components/PasswordField.jsx` | 조합 끝에 영문 키로 바꾼 뒤 거르기 |
| `docs/ai/features.md` | N-01-1·N-02-1 |

### 확인
- 확인함
  - node로 `hangulToQwerty` 13건이 모두 기대값과 같았다.
    - ㅂㅈㄷㄱ→qwer, 가나다→rkskek, 값→rkqt, ㅃ→Q, 뷁→qnpfr, 의→dml, abc1!→abc1!
    - ㅘ→hk, ㄳ→rt, 힣→glg 등
  - `npm run lint` 오류 0, `npm run build` 성공. 서버 파일은 바꾸지 않았다.
  - mock 개발 서버 + 헤드리스 Edge(CDP)로 확인했다.
    - 로그인 보기 상태에서 `ab` 가운데에 "가"를 조합하면 `arkb`가 되고 커서는 3이다.
    - "뷁"을 조합하면 `qnpfr`가 붙는다.
    - 조합 없이 넣은 "값"은 빠진다.
    - 가입 비밀번호에서 "의"를 조합하면 `dml`이 된다.
    - 이름 칸 한글은 그대로 남고, 아이디 칸 한글은 그대로 빠진다.
- 확인 못 함
  - 실제 Windows 한글 IME로 연달아 칠 때. 음절이 넘어가는 순간에 조합이 끝나고 바로 다음 조합이 시작된다.

## 8차 — PR #164 검수 반영: 로그인 제한 시각, 기존 비밀번호 칸 거르지 않기 (2026-11-27) 🆕 11/27
- **관련 N-ID:** N-01-1, N-01-3, N-02-1, N-03-3, N-04-3

### 무엇을, 왜 바꿨나
- **로그인 5분 제한 시각(N-01-3):** 마지막 실패 시각을 `APP_USER.UPDATED_AT`으로 재서, 닉네임·이메일 변경 같은 다른 수정이 제한을 늘리거나 다시 시작시켰다.
  - 로그인 실패만 기록하는 시각 열이 없어 `LAST_LOGIN_FAIL_AT`(TIMESTAMP, NULL 허용, DDL C17)을 더했다.
  - 실패할 때마다 실패 횟수와 함께 이 시각을 지금으로 남긴다.
  - 실패 횟수를 0으로 돌리는 곳은 모두 이 시각도 비운다: 로그인 성공(관리자 포함), 비밀번호 재설정, 관리자 잠금 해제, 관리자 임시 비밀번호 재발급.
  - 제한 조건(정확히 5회째 실패에만, 11/26 결정 그대로), 10회 잠금(423) 등 다른 동작은 바꾸지 않았다.
  - mock도 맞췄다: 로그인 성공·재설정 때 시각을 비우고, 관리자 잠금 해제는 실패 횟수와 시각을 비운다.
- **기존 비밀번호 칸은 거르지 않음(N-01-1·N-02-1):** `PasswordField`가 모든 칸에서 입력을 거르고 한글을 영문 키로 바꿨다.
  - `rule="new"`일 때만 `filterPassword`와 `hangulToQwerty`를 쓴다. 붙이는 곳은 가입·재설정·비밀번호 변경의 새 비밀번호와 확인 칸이다.
  - 로그인, 현재 비밀번호(비밀번호 변경·내정보 확인), 탈퇴 비밀번호는 친 값을 그대로 보낸다.
  - 서버는 로그인·현재 비밀번호·탈퇴 비밀번호를 받은 그대로 `passwordEncoder.matches`에 넘긴다(확인만 함).
- `validation.js`에서 이 브랜치가 더한 함수 머리 주석에 세부 N-ID를 붙였다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `docs/spec/sql/alter_app_user_last_login_fail_at.sql` | 새 파일. 기존 DB에 `LAST_LOGIN_FAIL_AT` 추가(다시 실행 가능) |
| `docs/spec/sql/avenue_ddl.sql`, `dummy_db/01_create_tables.sql` | APP_USER 열·열 주석, 변경 이력 C17 |
| `docs/spec/sql/dummy_db/seed_report.json` | `ddl_sha256` 새 값 |
| `docs/spec/sql/README.md` | 기존 DB 적용 표에 alter 1행 |
| `backend/.../user/mapper/UserAccountMapper.xml`, `admin/AdminAccountMapper.xml` | 실패 때 시각 기록, 실패 횟수 0인 곳마다 시각 NULL |
| `backend/.../user/dto/UserAccount.java`, `user/mapper/UserAccountMapper.java` | `lastLoginFailAt`, 주석 |
| `backend/.../user/service/AuthService.java` | 제한 계산을 `lastLoginFailAt`으로 |
| `backend/src/test/.../user/service/AuthServiceTest.java` | 기존 2개를 새 시각으로, 다른 수정과 상관없음 1개 추가 |
| `backend/src/test/.../user/mapper/UserAccountMapperLoginFailXmlTest.java` | 새 파일. 매퍼 XML에서 시각 기록·비우기 확인(DB 없음) |
| `backend/src/test/.../user/mapper/UserAccountLoginFailIT.java` | 새 파일. 실제 DB 확인(`-Ddb.it=true`일 때만) |
| `frontend/src/features/auth/mocks/authMockHandlers.js`, `admin/mocks/adminMockHandlers.js` | 실패 시각 비우기, 잠금 해제 때 실패 횟수 0 |
| `frontend/src/features/auth/components/PasswordField.jsx` | `rule="new"`일 때만 걸러내기·영문 키 변환 |
| `SignupPage.jsx`, `FindPasswordPage.jsx`, `PasswordChangeForm.jsx` | 새 비밀번호·확인 칸에 `rule="new"` |
| `frontend/src/features/auth/validation.js` | 주석에 N-ID |
| `docs/ai/features.md`, `docs/ai/decisions.md` | N-01-1·N-01-3·N-02-1, '가입 입력' 줄 |

### DB·API 변경
- DB: `APP_USER.LAST_LOGIN_FAIL_AT TIMESTAMP` 추가(C17). 기존 DB는 `alter_app_user_last_login_fail_at.sql`로 추가하고, 이미 있는 행은 NULL이다.
  - **계정 조회 SQL이 이 열을 읽으므로, 열이 없는 DB에서 새 코드로 로그인하면 ORA-00904가 난다.** 공용 DB는 PR 작성자가 병합 직후 실행한다.
- API: 경로·필드·응답은 그대로다.

### 확인
- 확인함
  - `./mvnw test`(-s) 539개 통과. 새 테스트 3개 포함, IT는 `-Ddb.it` 없이 건너뜀.
  - `python -B -m unittest discover -s docs/spec/sql/dummy_db/tools/tests`: 54개 중 오류 1건(`No module named 'bcrypt'`, README에 적힌 PC 환경 문제), 그 밖은 통과.
  - `cmp`로 DDL 사본이 원본과 같음.
  - `npm run lint` 오류 0, `npm run build` 성공.
- 확인 못 함
  - 로컬 DB(avenue_local) alter 실행. 사용자가 SQL Developer에서 실행한다.
  - `UserAccountLoginFailIT` 실행(DB 필요).
  - 화면 동작(mock 개발 서버로 직접 확인 필요).

## 9차 — PR #164 2차 검수 반영 (2026-11-27, 기준 fdd9f45) 🆕 11/27
- **관련 N-ID:** N-01-3, N-01-6, N-02-1, N-03-1, N-03-2

### 무엇을, 왜 바꿨나
- **커서(검수 1·5, `useImeSafeFilter`):**
  - 한글 확정 직후 다음 조합 중에 커서가 앞으로 갔다. 이제 걸러낸 값이 같으면 커서를 건드리지 않고, 새 조합이 시작됐으면 커서 옮기기를 건너뛴다.
  - 조합이 아닌 입력에서 글자가 걸러지면 커서가 끝으로 갔다. 이제 "입력 위치 − 앞쪽에서 빠진 글자 수"로 되돌린다.
  - 새 비밀번호의 영문 키 변환 결과는 같다.
- **소셜 계정 연결 5분 제한(검수 2):**
  - 화면이 429 서버 문구(남은 분)를 그대로 보여 준다.
  - mock 연결도 로그인과 같은 확인 함수(`authenticateMockAccount`)를 쓴다. 실패 횟수·5분 제한·10회 잠금이 같다.
- **아이디 찾기 다시 하기(검수 3):** 아이디를 찾은 뒤와 토큰 오류(400) 뒤에는 인증을 비워 [받기]부터 다시 할 수 있다. 찾은 아이디는 그대로 보인다.
- **잠긴 관리자 안내(검수 4):** 잠긴 관리자가 맞는 비밀번호를 넣으면 423 `ADMIN_ACCOUNT_LOCKED`("잠긴 관리자 계정입니다. 다른 관리자에게 잠금 해제를 요청해 주세요.")다.
  - 로그인 화면은 [비밀번호 찾기] 링크를 숨긴다. 일반 회원의 `ACCOUNT_LOCKED`는 그대로다.
- **기존 이메일 허용(검수 6):** 새 이메일 규칙은 가입(AUTH-06·SIGNUP 인증)과 이메일 변경(MEM-03·CHANGE_EMAIL 인증)에만 쓴다.
  - 아이디·비밀번호 찾기의 인증(FIND_ID·RESET_PASSWORD)은 기본 형식만 본다. 화면 칸은 글자를 지우지 않는다(소문자·앞뒤 공백만, `SplitEmailField rule="existing"`).
  - 이 브랜치가 새 규칙으로 바꿔 버린 관리자 업무 이메일(ADM-07)도 develop처럼 기본 형식으로 되돌렸다.
- **옛 설명(검수 7):**
  - api_spec_a의 휴대폰 인증 목적을 `SIGNUP`·`FIND_ID`로 고쳤다.
  - `LOGIN_FAIL_COUNT` 열 주석을 "5회째 5분 제한, 누적 10회 잠금"으로 고쳤다(DDL·사본·지문, 기존 DB는 C17 alter 끝 한 줄).

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/useImeSafeFilter.js` | 커서 복원(값이 같으면 안 옮김, 새 조합 중이면 건너뜀, 일반 입력도 복원) |
| `frontend/src/features/auth/socialLoginConfig.js` | 429 서버 문구, `ADMIN_ACCOUNT_LOCKED` 문구 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | `authenticateMockAccount` 분리·관리자 잠금 code, 목적별 이메일 형식, 찾기 토큰 오류 code |
| `frontend/src/features/auth/mocks/socialLoginMockHandlers.js` | 연결이 `authenticateMockAccount`를 씀 |
| `frontend/src/features/auth/pages/FindIdPage.jsx` | 찾은 뒤·토큰 오류 뒤 인증 비우기, 이메일 `rule="existing"` |
| `frontend/src/features/auth/pages/FindPasswordPage.jsx` | 이메일 `rule="existing"` |
| `frontend/src/features/auth/components/SplitEmailField.jsx` | `rule="existing"`이면 소문자·앞뒤 공백만, 기본 형식 |
| `frontend/src/features/auth/validation.js` | `isBasicEmail`, `filterExistingEmail`, `validateEmailParts`의 `rule` |
| `frontend/src/features/auth/authConstants.js`, `pages/LoginPage.jsx` | `ADMIN_ACCOUNT_LOCKED` code·문구, 로그인 문구 분기 |
| `frontend/src/features/admin/mocks/adminMockHandlers.js` | 업무 이메일 기본 형식 |
| `backend/.../user/service/AuthErrors.java`, `AuthService.java` | `adminAccountLocked()`, 잠긴 관리자 분기 |
| `backend/.../user/service/AccountRules.java`, `EmailPurpose.java`, `EmailVerificationService.java` | `isBasicEmail`, `usesNewEmailRule()`, 목적별 형식 검사 |
| `backend/.../admin/service/AdminAccountService.java` | 업무 이메일 기본 형식 |
| `backend/src/test/.../AuthServiceTest.java`, `EmailVerificationServiceTest.java` | 잠긴 관리자 1개, 목적별 이메일 형식 1개 |
| `docs/spec/sql/avenue_ddl.sql`, 사본, `seed_report.json`, `alter_app_user_last_login_fail_at.sql`, sql `README.md` | `LOGIN_FAIL_COUNT` 주석 |
| `docs/spec/api/api_spec_a.md` | AUTH-01·07, 휴대폰 목적, 5장 `ADMIN_ACCOUNT_LOCKED` |
| `docs/ai/features.md`, `docs/ai/decisions.md` | N-01-3·N-02-1·N-03-1·N-03-2, 계정 잠금 줄 |

### DB·API 변경
- DB: 열·데이터는 그대로이고, `LOGIN_FAIL_COUNT` 열 주석만 바뀐다. 기존 DB는 C17 alter를 다시 실행하면 된다(이미 실행했어도 다시 실행 가능).
- API
  - AUTH-01·05: 잠긴 관리자 + 맞는 비밀번호 → 423 `ADMIN_ACCOUNT_LOCKED`(새 code).
  - AUTH-07: `FIND_ID`·`RESET_PASSWORD`는 기본 이메일 형식만 본다. ADM-07 업무 이메일도 기본 형식이다.

### 확인
- 확인함
  - `./mvnw test`(-s) 541개 통과.
  - DB 도구 unittest는 오류 1건(`bcrypt`, PC 환경)뿐이다. `cmp`로 DDL 사본이 같음을 확인했다.
  - `npm run lint` 오류 0, `npm run build` 성공.
  - mock 개발 서버와 헤드리스 Edge로 고치기 전·후를 재현했다(`Input.imeSetComposition`·`insertText`).
    - 이름 "홍" 확정 직후 "ㄱ" 조합: 커서 1 → 2
    - 가입 아이디 ab|cd + XY: `abxcdy` → `abxycd`(커서 4)
    - 로그인 아이디 ab|cd + `#`: 커서 4 → 2
    - 새 비밀번호 보기 a|b + 가: `arkb`(커서 3), 전·후 같음
    - 소셜 연결 5회째: 401 문구 → "로그인 시도가 너무 많습니다. 5분 뒤에 다시 시도해 주세요."
    - 잠긴 관리자: 회원 문구 + 링크 → 관리자 문구, 링크 없음(잠긴 회원은 그대로)
    - 아이디 찾기를 찾은 뒤: [받기]가 사라지고 다시 찾으면 오류 → [받기]가 다시 보이고 다시 인증해 찾을 수 있다(결과는 남음)
    - 비밀번호 찾기 이메일 "Ab+C" → `ab+c`, 가입 이메일 "Ab+C" → `abc`
  - 끝난 뒤 5199 개발 서버·헤드리스 Edge가 남지 않았다.
- 확인 못 함
  - 실제 Windows 한글 IME(사용자가 확인)
  - `+`가 든 기존 이메일을 가진 DB 회원으로 찾기·재설정(로컬 DB)

### 남은 것 (이번에 고치지 않음)
- 시드·시연 회원 이름(예: 합성회원000001, mock "데모 급여소득자")이 이름 규칙(한글만)에 걸려 아이디·비밀번호 찾기를 할 수 없다. 팀 결정을 기다린다. 이름 규칙·시드·`build_db.py`는 그대로다.
- 로그인을 동시에 보내면 실패 횟수가 덜 오른다. 기존부터 있던 문제이고 2차 개발로 넘긴다.
- 관리자가 수동으로 잠근 회원도 비밀번호 재설정으로 풀린다. 기존부터 그렇고, 팀 확인이 필요하다.
- 관리자 계정의 10회째 실패 자동 잠금 423과 2단계 인증 중 잠금(AdminAuthService)은 아직 회원과 같은 `ACCOUNT_LOCKED` 문구다. 이번 범위(잠긴 상태 + 맞는 비밀번호) 밖이다.
- DDL `ACCOUNT_STATUS_CODE` 열 주석의 "LOCKED=비밀번호 5회 실패"도 옛 설명이다. 이번 지시 범위 밖이라 그대로 두었다.

## 10차 — develop(#166 UI 개편) 반영 충돌 정리 (2026-11-27) 🆕 11/27
- **관련 N-ID:** N-01-1, N-01-3, N-02-1
- 병합 명령은 사용자가 실행했다(`git merge origin/develop`, #166 = FP-276·262: 단계형 가입, `AuthSplitLayout`).

### 충돌 파일과 해결 원칙
- 충돌은 `LoginPage.jsx` 3곳, `SignupPage.jsx` 5곳이다. `auth.css`·`validation.js`는 자동으로 합쳐졌다.
- 화면 구조·배치·문구·디자인은 develop(#166)을 따랐다. 입력 검사·걸러내기·비밀번호 칸 동작은 이 브랜치를 그 위에 다시 얹었다.
- #166이 새로 만든 동작은 그대로 두었다. 가입 직후 자동 로그인 → 직군 선택, 회원가입 전환은 분할 틀 탭이다.
- 로그인
  - 아이디 칸: 걸러내기(`useImeSafeFilter`·`filterLoginId`) + develop placeholder "아이디 입력"
  - 비밀번호 칸: `PasswordField`(거르지 않음) + develop placeholder "비밀번호 입력"
  - 잠금 안내 아래 [비밀번호 찾기] 링크는 남겼다. 주석은 develop의 분할 틀 탭 주석을 썼다.
- 가입: 단계(`SIGNUP_STEPS`)·단계 머리·[이전]/[다음]·`DateSelect`·자동 로그인은 develop 그대로다. 단계별 칸(`renderField`)에 다음을 다시 얹었다.
  - 아이디·이름·닉네임 걸러내기
  - 비밀번호·확인 칸 `PasswordField rule="new"` + `usePasswordReveal`(칸마다 따로 보기)
  - 가입 성공 시 자동 로그인 전 `hideAll()`
- 지운 코드
  - `SignupPage`의 `PasswordEye`·`showPassword`(두 칸이 함께 바뀌던 보기)
  - 옛 생일 달력 칸과 `getBirthDateRange` import
  - `LoginPage`의 `useNavigate` import와 옛 [회원가입] 버튼 주석
- `auth.css`: `.fin-form` 안의 `PasswordField` 눈 버튼을 #166 모양(둥근 34px, `--mut2`, 오른쪽 7px, 칸 오른쪽 여백 52px)에 맞췄다.
  - 마이페이지처럼 `.fin-form` 밖의 칸은 그대로다.
  - 쓰지 않게 된 `.signup-form__eye` 규칙 3개는 공통 CSS(`common/styles/finForm.css`)에 있어 지우지 않았다(프론트 담당 결정).

### 확인
- `npm run lint` 오류 0, `npm run build` 성공, `./mvnw test`(-s) 541개 통과. 하나씩 돌렸다.
- mock 개발 서버와 헤드리스 Edge로 가입 5단계를 끝까지 진행했다.
  - 이름 "홍ㄱ" → 칸을 벗어나면 "이름을 완성해 입력해 주세요."
  - 자모가 남으면 [다음]이 꺼진다(develop `stepReady`). 스크립트로 버튼을 켜고 눌러도 2단계에 머물고 같은 안내가 나온다.
  - 아이디 `newid` + 한글 "무" → `newid` 유지
  - 닉네임 "새별!" → `새별`
  - 비밀번호 보기 + "ㅂ" → `q`. 확인 칸은 가린 채 그대로다(따로 보기).
  - 눈 버튼: 34px·둥근 모양, 칸 가운데
  - [가입하기] → `/select-job`
- 로그인
  - placeholder 2개
  - 5회째 실패 → "로그인 시도가 너무 많습니다. 5분 뒤에 다시 시도해 주세요."
  - 잠긴 회원 → 잠금 안내 + [비밀번호 찾기] 링크
  - 비밀번호 칸 한글은 거르지 않음
- 끝난 뒤 개발 서버·헤드리스 Edge가 남지 않았다.
- 확인 못 함: 실제 Windows 한글 IME, 화면 모양의 눈 비교(수치만 봄)

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
