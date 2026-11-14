# 회원·인증(AUTH-01~10)·마이페이지(MEM-01~05) Spring API

- **날짜:** 2026-11-14
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-87-birth-year` (PR A)
  - origin/develop 8303c69는 이미 들어 있어 새로 merge할 것이 없었다("Already up to date").
  - 작업 1 `feature-A/FP-87-auth-base`(4da59ed)는 merge 785eee3으로 반영했다.
- **관련 N-ID:** N-01-1·2·4·6, N-02-1~4, N-03-1~3, N-04-1~3, N-05-1
- **관련 결정:**
  - D-20(오류 형식 A팀 임시안)
  - 팀 결정 A안(출생연도 1930~올해−20)
  - 사용자 결정 11/14: 가입 동의 짝짓기, 직군 첫 선택만, 아이디 찾기는 이름+휴대폰
  - DDL v0.3.2

## 무엇을, 왜 바꿨나
- 우리 화면(로그인·가입·찾기·간편 로그인·마이페이지·직군 선택)이 부르는 API를 실제 Spring으로 만들었다.
  - 계약(경로·필드·상태·오류 code)은 프론트 `features/auth/api/*.js`와 mock 기준이다.
  - DB 규칙은 DDL v0.3.2를 따른다.
- 관리자 로그인은 2단계 인증(AUTH-11, 작업 7)이 준비될 때까지 막았다. 비밀번호가 맞아도 409 `ADMIN_2FA_NOT_READY`를 주고 토큰을 주지 않는다. 비밀번호만으로 관리자 토큰이 나가지 않게 하기 위해서다.
- 간편 로그인은 개발용 가짜 제공자(DEV)로 프론트 흐름이 끝까지 돌게 했다. 외부 호출은 없다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/pom.xml` | **공유.** `spring-boot-starter-mail` 추가(SMTP 모드) |
| `global/config/AvenueProperties.java` | `auth.email.from`, `auth.social.callback-url`(기본 `http://localhost:5173/oauth/callback`) 추가 |
| `global/config/ClockConfig.java` (새 파일) | 서비스가 쓰는 현재 시각(서울). 테스트에서 고정 시각으로 바꾼다 |
| `application.properties.example` | **공유.** 위 두 설정과 메일 환경변수 이름 안내(값 없음) |
| `backend/README.md` | 메일 모드·간편 로그인 DEV·프론트 실제 모드 연결 방법 |
| `user/controller/AuthController`, `SocialLoginController`, `MyPageController` | AUTH-01~10, MEM-01~05, 간편 로그인 시작 주소 `GET /oauth2/authorization/{provider}` |
| `user/service/AuthService`, `EmailVerificationService`, `VerificationTokenService`, `MyPageService`, `UserViewFactory`, `AccountRules`, `AuthErrors`, `EmailPurpose` | 로그인 잠금, 가입, 찾기·재설정, 이메일 인증, 마이페이지, 입력 규칙(프론트 validation.js와 같은 문구) |
| `user/service/email/*Sender` | `EmailCodeSender`와 LOG·FIXED·SMTP 구현(`@ConditionalOnProperty`) |
| `user/service/social/SocialProvider`, `DevSocialStore`, `SocialLoginService` | 간편 로그인 DEV(일회용 코드 5분·연결 키 10분, 메모리) |
| `user/dto/*` | `UserAccount`, `VerificationCode`, 요청·응답 record(필드 이름 = 프론트) |
| `user/mapper/*` + `resources/mapper/user/*.xml` | APP_USER(기존 `selectAccountStatus` 유지 + 조회·저장 추가), VERIFICATION_CODE, USER_CONSENT, USER_SOCIAL_ACCOUNT, ASSESSMENT(점수 있음 여부만 읽음) |
| `frontend/src/features/auth/authConstants.js` | `AUTH_ERROR_CODES.ADMIN_2FA_NOT_READY` 추가 |
| `frontend/src/features/auth/pages/LoginPage.jsx` | `ADMIN_2FA_NOT_READY`면 서버 문구를 보여 준다. 마크업·className은 그대로 |
| `src/test/…/user/**` | 서비스 단위 3개 + API 계약 1개(아래 확인) |

## DB·API 변경
- **DB:** 표·열 변경 없음. 읽고 쓰는 표는 APP_USER, USER_CONSENT, VERIFICATION_CODE, USER_SOCIAL_ACCOUNT이고, ASSESSMENT는 읽기만 한다.
  - VERIFICATION_CODE에 "사용함" 열이 없다. 그래서 확인한 뒤의 EXPIRES_AT을 인증 토큰 유효 시각(10분)으로 바꾸고, 한 번 쓰면 지금 시각으로 당긴다.
  - USER_CONSENT 가입 동의는 EXPIRES_AT을 비워 둔다. N-02-2 비고 "최대 1년"을 가입 동의에도 적용할지는 확인이 필요하다.
- **API:** 새로 만든 경로는 프론트 경로와 같다. 경로·필드는 바꾸지 않고 다음만 **추가**했다.
  - 요청 `signup.agreeMarketing`(선택)
  - 응답 `devMode`(간편 로그인)
  - 오류 code: `LOGIN_FAILED`, `ADMIN_2FA_NOT_READY`, `INVALID_VERIFICATION_CODE`, `EMAIL_VERIFICATION_REQUIRED`, `ACCOUNT_NOT_FOUND`, `INVALID_PASSWORD`, `SAME_EMAIL`, `JOB_TYPE_ALREADY_SELECTED`, `SOCIAL_ALREADY_LINKED`, `SOCIAL_MODE_NOT_SUPPORTED`
- **영향을 받는 기능·팀원**
  - 관리자 화면 담당: 실제 서버에서는 관리자 로그인이 작업 7 전까지 막힌다.
  - 프론트: 가입 화면 동의 체크박스 추가가 필요하다(아래).

## mock과 다른 점
- **user.name**: 원문 대신 **가린 값**(홍*동)을 보낸다. 응답에 개인정보 원문을 넣지 않는 규칙 때문이고, 화면은 `user.name`을 표시하지 않는다.
- **userId**: 숫자다. mock은 `'u-…'` 문자열이다.
- **관리자 로그인**: mock은 바로 로그인되고, 실제 서버는 409로 막는다(작업 7 전까지).
- **이메일 인증 목적 값**: 프론트 `RESET_PASSWORD`를 DB `FIND_PASSWORD`로 저장한다(DDL CHECK). API 값은 그대로다.
- **5회째 로그인 실패**: 그 순간 잠그고 423을 준다(mock에는 잠금 누적이 없음).
- **소셜 전용 계정**(비밀번호 없음)은 가림 해제·비밀번호 변경의 비밀번호 확인을 통과하지 못한다. mock은 데모 계정이 아무 비밀번호나 통과한다.
- **직군 선택**: 관리자는 보안 단계에서 403 `FORBIDDEN`('접근 권한이 없습니다.')이 된다. mock 문구는 '일반 사용자만 직군을 선택할 수 있습니다.'다.

## 실제 모드(`VITE_USE_MOCK=false`)에서 달라 보이는 것
- **화면이 부르는 API**: 모든 화면이 `common/api/client.js` → `${VITE_API_BASE_URL}/api/...`로 위 API를 부른다(코드로 확인). `VITE_API_BASE_URL=http://localhost:8080`이 필요하다. Vite 프록시가 없다.
- **인증코드 안내**: 가입·재설정·이메일 변경 화면의 "개발용 mock 인증코드: 123456" 안내는 mock에서만 보인다. 실제 모드에서는 LOG 모드 서버 로그나 FIXED 고정 코드로 코드를 확인해야 한다.
- **데모 계정**: mock 데모 계정(employee·self 등, 비밀번호 아무 값)은 실제 서버에 없다. 더미 시드의 `demo_employee`·`demo_self`·`demo_free`·`demo_admin`과 디스코드 공유 비밀번호를 쓴다(관리자는 작업 7 전까지 409).
- **간편 로그인 버튼**: `/oauth2/authorization/{provider}` → 프론트 `/oauth/callback?code=` → 교환으로 이어진다. 처음에는 연결 화면(LINK_REQUIRED)으로 가고, 가입 화면에 '개발용 Google'·`dev-google@example.com`이 미리 채워진다.

## 확인
- 확인함
  - `./mvnw test`: 90개 통과, 실패 0(작업 1의 43개 + 새 47개)
    - AuthServiceTest 16, EmailVerificationServiceTest 10, SocialAndMyPageServiceTest 9, UserApiContractTest 12
  - 테스트 출력에 원문 이메일·토큰이 없다(grep).
- 확인함: `npm run lint` 통과
- 확인 못 함
  - 실제 Oracle에서 SQL 실행(작업 3에서 확인)
    - `FETCH FIRST`, `useGeneratedKeys`(IDENTITY 열), null 파라미터 `jdbcType`
  - 실제 서버를 띄워 화면으로 누르는 확인(DB가 없어 작업 3)
  - SMTP 실제 발송

## 다음 사람이 알아야 할 것
- **가입 동의는 시연용 임시 처리다.**
  - 화면 체크 하나(`agreeCreditInfo`)로 TERMS_OF_SERVICE·PRIVACY_COLLECTION을 함께 Y로 기록하고, NOTIFICATION_MARKETING은 `agreeMarketing`(없으면 N)으로 기록한다.
  - **실제로 쓰기 전에 프론트가 필수 2개(이용약관·개인정보 수집·이용)와 선택 1개(점수 변동 알림·혜택 안내) 체크박스를 반드시 추가해야 한다**(N-02-2 ⚠️ UI). 화면 마크업은 프론트 담당 영역이라 고치지 않았다.
- **직군 변경(N-04-8)**은 우선순위 미정이라 첫 선택만 저장한다(이미 있으면 409). `MyPageService.selectJobType`에 TODO가 있다.
- **아이디 찾기**는 이름+휴대폰이다(프론트 기준). 휴대폰 없이 가입한 계정은 찾을 수 없다. 같은 이름·휴대폰이 여러 명이면 USER_ID가 가장 작은 계정을 보여 준다.
- **출생연도 상한**: DDL CHECK가 2006으로 고정이라 2027년부터 서버 규칙(올해−20)과 어긋난다. DB 담당과 맞춰야 한다.
- **간편 로그인 DEV의 한계**
  - 코드와 연결 키는 서버 메모리에만 있다(재시작하면 사라진다).
  - 제공자마다 가짜 사용자가 하나다.
  - REAL 모드: OAuth 시크릿은 나중에 환경변수로만 받는다(TODO).
- **PR 본문 "아직 안 된 것"에 적을 것**
  - 관리자 로그인은 PR C(작업 7·8)에서 열린다.
  - 가입 동의 체크박스 추가가 필요하다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
