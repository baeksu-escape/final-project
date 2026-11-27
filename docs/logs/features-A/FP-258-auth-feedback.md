# 로그인·회원가입·찾기 피드백 반영 — 단계적 로그인 제한, 입력 규칙, 본인 확인, 인증 보안 고도화

- **날짜:** 2026-11-26 ~ 2026-11-27
- **작성자:** JWC1226 / Claude Code
- **브랜치:** `feature-A/FP-258-auth-feedback` (develop `d7f5e5d`에서 시작, 마지막 develop 반영 `f1f8d48`)
- **관련 N-ID:** N-01-1, N-01-3, N-01-6, N-02-1, N-02-2, N-02-3, N-02-4, N-03-1, N-03-2, N-04-3
- **관련 결정:** 1차 테스트 피드백(Jira FP-258), 멘토링 반영(FP-290·FP-294·FP-295·FP-296 일부), PR #164·#173 검수. 시험 번호 AUTH-07·17·18·19는 API 번호와 다르다.

## 무엇을, 왜 바꿨나
### 로그인(N-01-1·N-01-3·N-01-6)
- **단계적 제한:** 5회째 실패하면 5분 동안 비밀번호와 상관없이 429 `LOGIN_TEMPORARILY_BLOCKED`(남은 분 문구, 제한 중 횟수 그대로)이고, 누적 10회째에 잠근다(423). 5분 제한은 정확히 5회째에 한 번만 건다(11/26 결정).
  - 기준 시각은 새 열 `APP_USER.LAST_LOGIN_FAIL_AT`이다. 처음에는 `UPDATED_AT`을 썼는데, 닉네임 변경 같은 다른 수정이 제한을 늘려 바꿨다(PR #164 검수).
  - 실패 횟수를 0으로 돌리는 곳(로그인 성공, 재설정, 관리자 잠금 해제·임시 비밀번호)은 이 시각도 비운다.
- **잠금 안내:** 회원은 "잠긴 계정입니다. 비밀번호 찾기에서 이메일 인증 후 비밀번호를 재설정하면 풀립니다."와 [비밀번호 찾기] 링크를 본다. 관리자는 423 `ADMIN_ACCOUNT_LOCKED`(다른 관리자에게 해제 요청)를 보고 링크는 없다. 관리자 안내는 잠긴 상태에서 맞는 비밀번호, 10회째 잠금, 2단계 인증 중 잠금에 모두 해당한다.
- 간편 로그인 연결(AUTH-05)도 같은 `authenticate`를 거쳐 같은 제한을 받고, 화면은 429 서버 문구를 그대로 보인다.
- **비밀번호 보기:** 칸 안 눈 버튼(`PasswordField`, 값이 있을 때만)을 둔다. 보기 상태는 칸마다 따로이고(`usePasswordReveal`), 요청이 성공했을 때만 가린다.

### 입력 규칙(N-02-1·N-02-4)
- 칸마다 허용하지 않는 글자를 입력·붙여넣기 때 지운다(`validation.js` filter 함수들). 판정 규칙은 따로 둔다.
- 한글 조합 중에는 거르지 않고 조합이 끝날 때 한 번 거른다(`useImeSafeFilter`). 조합 중에 값을 바꾸면 Windows 한글 IME가 써 둔 글자를 덮어썼기 때문이다. 커서는 "입력 위치 − 앞쪽에서 빠진 글자 수"로 되돌린다.
- **이메일:** 새 규칙(앞부분 `a-z0-9._-`, 도메인 덩어리 규칙, 소문자로 저장)은 가입·이메일 변경에만 쓴다. 아이디·비밀번호 찾기는 기존 이메일도 찾도록 기본 형식만 본다(칸은 공백·@만 지움). 관리자 업무 이메일(ADM-07)은 develop처럼 기본 형식이다.
- **새 비밀번호:** 영문·숫자를 섞어 8~64자, ASCII 출력 문자만(서버도 같음, BCrypt 72바이트 안). 64자를 넘으면 자르지 않고 "비밀번호는 64자 이하로 입력해 주세요."로 막는다. 보기 상태에서 친 한글은 두벌식 영문 키로 바꾼다(`hangulToQwerty`). 로그인·현재 비밀번호·탈퇴 칸은 거르지 않는다.
- **이름:** 자모가 남으면 "이름을 완성해 입력해 주세요."이다(화면만, 서버는 `NAME_RULE_MESSAGE`).
- **가입 아이디 [중복 확인]:** AUTH-16 `POST /api/auth/login-id/check`를 새로 만들었다. 아이디·닉네임을 모두 확인해야 [다음]이 켜진다.

### 가입 동의·인증코드(N-02-2·N-02-3)
- 1단계는 [전체 동의] + 필수 2(이용약관, 개인정보 수집·이용) + 선택 1(점수 변동 알림·혜택 안내)이다.
  - 서버는 `agreeTerms`·`agreePrivacy`가 각각 true여야 하고, 빠진 칸마다 400이다. 예전 `agreeCreditInfo`는 읽지 않는다(PR #173 검수).
  - `USER_CONSENT`는 develop과 같게 늘 3행이다. 선택 동의를 안 했으면 `N`이고 동의 시각이 없다.
- 같은 이메일·휴대폰으로 하루(0시부터) 10회까지 보낸다(429 `CODE_SEND_DAILY_LIMIT`, 목적 무관, 관리자 번호 제외).
- 같은 접속지(IP) 반복 시도 제한(`ClientRateLimiter`, 서버 메모리):
  - 로그인·연결 실패: 10분 20회
  - 닉네임·아이디 확인: 1분 30회
  - 이메일·휴대폰 발송: 1시간 20회

### 찾기(N-03-1·N-03-2)
- **아이디 찾기:** 이름 + [휴대폰 | 이메일] 인증(목적 `FIND_ID`)을 마쳐야 하고, 가리지 않은 아이디를 보여 준다.
  - 코드는 가입 여부와 상관없이 보낸다.
  - 찾은 뒤와 토큰 오류 뒤에는 인증을 비워 다시 인증할 수 있다.
- **비밀번호 찾기:** 인증코드 확인과 재설정 모두 아이디·이름·이메일이 같은 계정만 통과한다(다르면 같은 404).
  - 재설정 중 토큰이 만료되면(400 `EMAIL_VERIFICATION_REQUIRED`) 인증 단계로 돌아가 안내한다.
- 두 화면 모두 이름을 가입과 같은 규칙으로 요청 전·칸을 벗어날 때 본다. 휴대폰·이메일 묶음은 벗어날 때 검사한다(`useBlurCheck`).

## 원인이 있던 버그와 고친 방법
- **동시 로그인 실패 횟수가 덜 오름(FP-290)**
  - 처음 원인: 같은 계정의 동시 요청이 같은 횟수를 읽었다. → `lockUser`(FOR UPDATE)로 잠근 뒤 다시 읽게 했다. SQL `+1`은 5를 건너뛸 수 있어 쓰지 않았다.
  - 그래도 로컬 DB에서는 동시 5회에 횟수가 1만 올랐다. MyBatis 1차 캐시가 잠근 뒤 다시 읽는 조회에 잠그기 전 값을 돌려줬기 때문이다. → `lockUser`에 `flushCache="true"`를 붙였다(단위 시험은 가짜 매퍼라 잡지 못했다).
- **로그인 실패 로그가 커넥션 풀을 바닥냄(PR #173)**
  - 원인: 잠근 트랜잭션 안의 `systemLog.record`(REQUIRES_NEW)가 커넥션을 하나 더 요청했다. 같은 아이디로 풀 크기(10) 이상 몰리면 서로 기다리며 막혔다.
  - 고친 방법: `LoginAttemptService.attempt`가 자기 트랜잭션에서 조회·잠금·갱신만 하고 결과를 돌려준다. `authenticate`는 트랜잭션 없이 받은 뒤 로그를 남기고 오류를 던진다. `login`·`SocialLoginService.link`의 `@Transactional`은 뺐고, `AdminAuthService.startLogin`에는 달았다.
- **인증코드 하루 상한을 동시 요청으로 넘김(PR #173)**
  - 원인: 같은 트랜잭션 안에서 "세기 → 비교 → 기록"을 해서 동시 요청이 같은 수를 읽었다.
  - 고친 방법: `CodeSendGuard`(서버 메모리 잠금 64개)가 대상(채널 + HMAC) 잠금을 트랜잭션 밖에서 잡는다. `TransactionTemplate`으로 세기 → 비교 → 기록 → 발송 → 커밋을 끝낸 뒤 푼다.
- **IP 로그인 실패 20회 제한을 동시 요청으로 넘김(PR #173):** 요청 전에 `compute`로 한 자리를 원자적으로 잡고, 401로 끝나지 않으면 돌려준다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../user/service/AuthService.java` | 단계적 제한 결과 처리·로그, AUTH-16, 아이디 찾기 방법별 토큰, 찾기·재설정 이름 확인, 동의 각각 검사 |
| `backend/.../user/service/LoginAttemptService.java`·`CodeSendGuard.java`·`ClientRateLimiter.java` (새 파일) | 로그인 시도 트랜잭션, 발송 잠금, IP 반복 시도 제한 |
| `backend/.../user/service/AccountRules.java`·`AuthErrors.java` | 이메일 규칙 2종·정리, 새 비밀번호 규칙·64자 문구, 이름 비교, 잠금·제한·상한 오류 |
| `backend/.../user/service/EmailVerificationService.java`·`PhoneVerificationService.java`·`EmailPurpose.java`·`PhonePurpose.java` | `FIND_ID`, 목적별 이메일 형식, 하루 상한(잠금 안) |
| `backend/.../user/service/MyPageService.java`, `social/SocialLoginService.java`, `admin/service/AdminAuthService.java`·`AdminAccountService.java` | 이메일 소문자·비밀번호 문구, 트랜잭션 경계, 관리자 잠금 안내, 업무 이메일 기본 형식 |
| `backend/.../user/controller/AuthController.java`·`SocialLoginController.java`, `global/security/SecurityConfig.java` | IP 제한 적용, AUTH-16 경로 |
| `backend/.../user/dto/*`, `user/mapper/*`·`resources/mapper/user/*.xml`·`admin/AdminAccountMapper.xml` | 요청·응답 필드, `LAST_LOGIN_FAIL_AT`, `lockUser` `flushCache`, `countSentSince`, `selectUserByEmailHmac` |
| `backend/src/test/.../user/**` | 단위 시험 추가, 통합 시험(db.it) 4개 클래스 |
| `frontend/src/features/auth/validation.js`·`authConstants.js` | 걸러내기·판정·문구·상수 |
| `frontend/src/features/auth/useImeSafeFilter.js`·`usePasswordReveal.js`·`useBlurCheck.js`, `components/PasswordField.jsx` (새 파일) | 한글 조합 안전 걸러내기, 보기 상태, 묶음 검사, 비밀번호 칸 |
| `frontend/src/features/auth/pages/*`, `components/*` | 로그인·가입·찾기·마이페이지 화면에 위 규칙 적용 |
| `frontend/src/features/auth/mocks/*`, `admin/mocks/adminLoginChallenges.js`·`adminMockHandlers.js` | 서버와 같은 순서·응답, `authMockRateLimits.js`(새 파일) |
| `frontend/src/features/auth/auth.css` | 눈 버튼, 동의 화면, 이메일 직접 입력 줄바꿈, 묶음 오류 테두리 |
| `docs/spec/sql/*` | C17·C18, alter 2개, README, `seed_report.json` 지문 |
| `docs/ai/features.md`·`decisions.md`, `docs/spec/api/api_spec_a.md`·`api_definition.md` | 구현 현황·정책·API 설명 |

## DB·API 변경
- **DB (실행 순서)**
  1. C17 `alter_verification_code_find_id.sql`: `CK_VCD_PURPOSE`에 `'FIND_ID'`를 넣는다. 없으면 아이디 찾기 발송이 ORA-02290으로 실패한다.
  2. C18 `alter_app_user_last_login_fail_at.sql`: `APP_USER.LAST_LOGIN_FAIL_AT`과 열 주석(`LOGIN_FAIL_COUNT`·`ACCOUNT_STATUS_CODE`)을 바꾼다. 다시 실행해도 된다. **열이 없는 DB에서는 로그인이 ORA-00904로 실패**한다.
  - 공용 DB는 PR 작성자가 병합 직후 실행하고, 로컬은 각자 실행한다. 처음에는 C16·C17이었는데, develop #171이 C16을 먼저 써서 번호를 옮겼다(내용 같음).
- **API**
  - AUTH-01·05: 429 `LOGIN_TEMPORARILY_BLOCKED`, 423은 10회째, 423 `ADMIN_ACCOUNT_LOCKED`
  - AUTH-06: `agreeTerms`·`agreePrivacy`·`agreeMarketing`(`agreeCreditInfo`는 읽지 않음), 새 비밀번호 64자·ASCII
  - AUTH-07·14: `purpose` `FIND_ID`, 목적별 이메일 형식
  - AUTH-08·10: `name`
  - AUTH-09: `{ method, name, phone|email, verificationToken }` → `{ maskedLoginId, loginId }`
  - AUTH-16: 새로 만듦
  - 새 오류 code: 429 `TOO_MANY_REQUESTS`, 429 `CODE_SEND_DAILY_LIMIT`
  - 기존 필드는 지우지 않았다.
- **영향을 받는 기능·팀원:** 로그인한 뒤 잠긴 계정의 401 `ACCOUNT_LOCKED`(JWT 필터)도 새 문구다. 관리자 화면 잠금 문구(`admin/adminConstants.js`)는 그대로다.

## 확인 (최신, 2026-11-27)
- 확인함
  - `./mvnw test`(-s, 시험 힙 512MB) 589개 통과.
  - `-Ddb.it=true` 통합 시험 4개 클래스 6건 통과(로컬 Oracle C##AVENUE_LOCAL).
    - `UserAccountLoginFailIT`
    - `UserAccountLoginFailConcurrencyIT`: 동시 5회 → 횟수 5. 고치기 전에는 1이었다.
    - `LoginFailPoolIT`: 15개 동시 → 1.1초. 고치기 전에는 5개가 커넥션을 못 받았다(5.6초).
    - `CodeSendDailyLimitConcurrencyIT`: 9건 + 동시 5회 → 1건 성공. 고치기 전에는 이메일 4건, 휴대폰 5건이 성공했다.
  - fastapi_server unittest 278개 통과(1개 건너뜀, seed_report 지문 포함). `cmp`로 DDL 사본이 같다.
  - `npm run lint` 오류 0, `npm run build` 성공.
  - 백엔드 LOG 모드 HTTP: `agreeCreditInfo`만 보낸 가입은 400, 하루 상한 동시 5회는 200 한 건, 동시 15회 틀린 로그인은 0.95초.
  - mock 헤드리스 Edge: 가입 5단계 끝까지, 커서·한글 조합, 5분 제한·잠금 안내(관리자 포함), 찾기 다시 인증, o'brien 유지, 72자 비밀번호 오류, 재설정 토큰 만료 → 인증 단계.
- 확인 못 함
  - 실제 Windows 한글 IME(사람이 확인)
  - `+`가 든 기존 이메일을 가진 DB 회원으로 찾기·재설정
- 로컬 DB 시험 데이터: qa1127e·qa1127g 계정이 있고, qa1127h@test.local에 오늘 발송 기록 10건이 남아 있다.

## 다음 사람이 알아야 할 것 (팀 결정 대기)
- 시드·mock 회원 이름(`합성회원000001`, "데모 급여소득자" 등)이 이름 규칙(한글만)에 걸려 아이디·비밀번호 찾기를 할 수 없다. 이름 2~5자 안도 보류다.
- 다른 사람이 내 이메일·휴대폰의 하루 인증코드 한도(10회)를 다 써 버릴 수 있다.
- 새 정책 값(IP 제한 숫자, 하루 10회, 64자, 5분·10회)을 `decisions.md`에 기록하는 일과 조장 동의
- `WithdrawalService.withdraw`는 회원 행을 잠근 트랜잭션 안에서 `systemLog.record`를 부른다(풀 고갈 가능, 점검만 함). 잠금 안에서 로그를 남기는 곳은 여기 하나다.
- 관리자가 수동으로 잠근 회원도 비밀번호 재설정으로 풀린다(원래부터).
- IP 제한은 서버 메모리라 재시작하면 초기화되고, 서버가 여러 대면 대마다 따로 센다. 프록시 뒤라면 `server.forward-headers-strategy` 같은 설정이 필요하다.
- 약관 전문·버전, 일반 인증코드의 같은 대상 1분 1회 제한(없음), 공통 `TextInput`의 `autoCapitalize`·`spellCheck`, 입력 칸 선택색(`--sel`)은 각 담당 확인이 필요하다.

## 간결화 (2026-11-27, 동작 변경 없음)
- 작업 로그를 이 양식으로 줄였다(회차별 기록 → 기능별 요약). features.md는 N-ID마다 구현 현황을 1~2줄로 합쳤다. 코드 주석의 회차 표시("12차"·"13차"·"PR #173" 등)는 지웠다.
- 중복을 모았다.
  - 프론트: `useAvailabilityCheck`(가입 아이디·닉네임 [중복 확인]), `useFindNameField`·`useExistingEmailParts`(아이디·비밀번호 찾기 이름·이메일 칸), `validation.js` 걸러내기 공통 함수, `passwordTooLongError`, mock 오류 도우미
  - 서버: `AuthErrors.invalidField`, `AuthService` 로그 한 줄 도우미
  - 시험: db.it 시험 계정 도우미 `QaItAccounts`
- 확인
  - `./mvnw test` 589개 통과, db.it 4개 클래스 6건 통과, `npm run lint` 오류 0, `npm run build` 성공
  - 걸러내기 함수 252개 입력이 전과 같은 결과
  - mock 헤드리스 확인 스크립트 3개를 HEAD 사본과 고친 뒤에 각각 돌려 출력이 같았다(전환 중 테두리 색 2줄만 다름)

## PR 검수 반영 — 성공 처리 잠금, 5분 제한 먼저 확인·429 IP 집계, 관리자 이메일·잠금 안내 (2026-11-27)
- **[A] 성공 처리가 잠금 밖이었음:** 비밀번호 확인은 행 잠금 안에서 하고, 성공 처리(실패 0)는 잠금을 푼 뒤 따로 했다. 그래서 실패 9회 계정에 다른 요청이 10회째로 잠근 직후 성공 쪽이 0으로 만들고 토큰도 받았다.
  - 고친 방법: 일반 회원 로그인은 `LoginAttemptService.attempt`가 같은 잠금 안에서 성공 처리까지 한다.
  - 간편 로그인(교환·연결)과 관리자 2단계 인증 완료(번호 확인·첫 비밀번호 설정)는 `recordSuccess(userId)`가 처리한다. 잠그고 다시 읽어 잠겼으면 423(관리자는 `ADMIN_ACCOUNT_LOCKED`)이다.
  - 그 경로들(`SocialLoginService.exchange`, `AdminAuthService.verifyLogin`·`setupPassword`)은 트랜잭션을 빼서 로그가 잠금 밖에 남게 했다.
  - 시험: 새 `LoginSuccessFailureRaceIT`(30라운드)가 고치기 전에는 1라운드부터 "성공 200 + 최종 0회 LOCKED"로 실패했고, 고친 뒤에는 통과한다.
- **[B] 5분 제한 중에도 BCrypt를 돌리고, 그 429는 IP 실패 횟수에 들어가지 않았음:** 잠기지 않은 계정은 다시 읽은 뒤 제한부터 보고, 제한 중이면 BCrypt 없이 막는다(잠긴 계정은 지금처럼 BCrypt 먼저).
  - IP 집계(`ClientRateLimiter.countFailures`, mock 포함)는 계정 5분 제한 429(`LOGIN_TEMPORARILY_BLOCKED`, 5회째 포함)도 401처럼 센다.
  - 시험: `LoginFailPoolIT`에 제한 중 계정으로 동시 15개 요청을 보내는 경우를 더했다. 고치기 전에는 BCrypt가 15번 불렸고, 고친 뒤에는 0번이며 모두 429다(0.18초).
  - 단위 시험 `LoginAttemptServiceTest`, `ClientRateLimiterTest`도 더했다.
- **[C] 관리자 추가 화면의 업무 이메일이 새 가입 규칙을 썼음:** `AddAdminForm`을 기본 형식(`isBasicEmail`)으로 바꿨다. 서버·mock과 같아 `ops+admin@avenue.example`이 통과한다(node로 확인).
- **[D] 잠긴 관리자 토큰에 회원 안내(비밀번호 찾기)가 나갔음:** `JwtAuthenticationFilter`가 잠금 표시와 함께 역할을 요청 속성으로 넘기고, `JsonErrorWriter`가 관리자면 401 `ADMIN_ACCOUNT_LOCKED`와 관리자 안내를 보낸다.
  - 프론트 `client.js`는 `STEP_UP_REQUIRED` 말고는 401이면 code와 상관없이 로그아웃하므로, 관리자도 처리가 같다.
  - 시험: `LockedAccountTokenTest`, `SecurityConfigTest`

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
