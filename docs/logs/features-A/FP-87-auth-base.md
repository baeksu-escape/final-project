# Spring 인증 공통 기반 — Security·JWT 필터, CORS, 공통 오류 응답, 개인정보 암호화, avenue.* 설정

- **날짜:** 2026-11-14
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-87-auth-base` (origin/develop 8303c69에서 만듦. PR A에 들어가고 따로 PR하지 않는다)
- **관련 N-ID:** N-01(로그인·권한), N-02-4(개인정보 암호화), N-04-1(가림 처리), N-27-2(관리자 권한)
- **관련 결정:** D-20(오류 응답 A팀 임시 형식), DDL v0.3.1 E1·E2(AES-256-GCM `v1:`, HMAC), DDL v0.3.2 W1(탈퇴 = 상태 변경)

## 무엇을, 왜 바꿨나
- Spring 구현이 하나도 없어서 우리 화면이 실제 서버로 돌 수 없었다. 작업 2부터 만들 API(인증·마이페이지·데이터 입력)가 함께 쓸 공통 기반을 먼저 만들었다.
- 공통 기반은 다음과 같다.
  - JWT 인증과 역할별 경로 권한, 탈퇴 회원 401
  - CORS
  - `{ code, message, fieldErrors }` 공통 오류
  - 더미 시드와 호환되는 개인정보 암호화·HMAC·가림 처리
  - `avenue.*` 설정
- develop 그대로에서도 `./mvnw test`가 실패했다. 기존 `contextLoads`가 DataSource를 찾지 못했기 때문이다. test 프로필과 메모리 DB(H2)로 실제 DB 없이 통과하게 했다(사용자 결정).

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/pom.xml` | **공유.** security, validation, jjwt 0.12.6(api·impl·jackson), test 범위 spring-security-test·h2를 추가했다. 기존 의존성은 그대로다 |
| `backend/src/main/resources/application.properties.example` | **공유.** 빈 파일에 DB(값 없음)·mybatis·`avenue.*` 이름과 기본값을 넣었다. 비밀값은 `${AVENUE_…}` 환경변수 자리로 두었다 |
| `backend/src/test/java/com/baeksuescape/BackendApplicationTests.java` | **공유.** `@ActiveProfiles("test")`와 import만 추가했다. 이유는 아래 "다음 사람" 참고 |
| `global/config/AvenueProperties.java` | `avenue.*` 설정 묶음. 시작할 때 키 형식·길이·AES≠HMAC·FIXED 코드를 검사한다(오류에 값은 넣지 않음) |
| `global/security/SecurityConfig.java` | STATELESS, CSRF 끔, 경로별 권한, CORS, BCrypt, 기본 사용자 끔 |
| `global/security/JwtTokenProvider.java` | JWT 발급·검증(subject = USER_ID, role 클레임, HS256) |
| `global/security/JwtAuthenticationFilter.java` | Bearer 토큰 검증 + 요청마다 계정 상태를 확인한다(WITHDRAWN은 인증 안 함, LOCKED는 통과) |
| `global/security/AuthUser.java` | `@AuthenticationPrincipal`로 받는 현재 사용자(userId, role) |
| `global/security/JsonErrorWriter.java` | 필터 단계의 401 `UNAUTHORIZED`·403 `FORBIDDEN`을 JSON으로 보낸다 |
| `global/exception/ErrorResponse.java`, `ApiException.java`, `GlobalExceptionHandler.java` | 공통 오류 모양, 업무 오류, `@Valid`→400 `INVALID_INPUT`, 404·405, 500 `INTERNAL_ERROR` |
| `global/util/PiiCrypto.java`, `PiiHmac.java`, `PiiMasking.java` | AES-256-GCM `v1:`, HMAC-SHA256(이메일 trim+소문자, 휴대폰 숫자만), 프론트 mock과 같은 가림 규칙 |
| `user/mapper/UserAccountMapper.java` + `resources/mapper/user/UserAccountMapper.xml` | 인증 필터용 `APP_USER.ACCOUNT_STATUS_CODE` 조회 1개 |
| `backend/README.md` (새 파일) | 실행 준비, 환경변수, 인증 사용법, 임시 개방 경로 빼는 방법 |
| `src/test/resources/application-test.properties` | test 프로필. H2 접속과 **공개 테스트 키**(dummy_db 테스트의 TEST_AES·TEST_HMAC, JWT는 같은 방식의 공개 값) |
| `src/test/java/…` 테스트 8개 + `TestKeys`, `SecurityTestController` | 아래 확인 참고. 테스트 컨트롤러는 src/test에만 있고 경로에 `__test`를 넣었다 |

## DB·API 변경
- **DB:** 없음. `APP_USER`를 읽기만 한다.
- **API:** 새 업무 API는 없다. 모든 API의 공통 규칙이 바뀌었다.
  - 인증·권한
  - 오류 응답 `{ code, message, fieldErrors }`
  - CORS: `http://localhost:5173`
- **영향을 받는 기능·팀원**
  - 다른 팀 경로: `/api/finance/**`(C팀 FP-152), `/api/diagnosis/**`(C팀 FP-183), `/api/simulation/**`(C팀 프론트 FP-176)는 `avenue.auth.temporary-open-paths`로 임시 개방해 막지 않았다.
  - `/api/commercial/**`, `/api/board/**`는 develop·원격 브랜치 어디에도 없어서 넣지 않았다.
  - 그 밖의 `/api/**`는 이제 로그인이 필요하다.

## 확인
- 확인함
  - `./mvnw test`: 43개 통과, 실패 0
    - BackendApplicationTests 1, AvenuePropertiesTest 6, GlobalExceptionHandlerTest 5, JwtTokenProviderTest 3, SecurityConfigTest 12, PiiCryptoTest 7, PiiHmacTest 5, PiiMaskingTest 4
  - develop 그대로에서는 DataSource 오류로 실패하던 상태다.
- 확인함: **Python 호환**
  - `build_db.encrypt_text`·`search_hmac`을 공개 테스트 키로 실행해 만든 암호문 3개(이름·이메일·휴대폰)와 HMAC 2개(이메일·휴대폰)를 테스트에 넣었다.
  - Java가 그 암호문을 복호화하고, 같은 HMAC을 내는 것을 확인했다.
- 확인함: 500 테스트의 예외 메시지(가짜 SQL·이메일)가 응답·테스트 로그에 나오지 않는다.
- 확인 못 함
  - 실제 Oracle과 팀 개발 키로 서버를 띄우는 것(작업 3 범위). 로컬 `application.properties`가 없다.
  - 프론트를 실제 서버 모드(`VITE_USE_MOCK=false`)로 붙여 보는 것. 아직 업무 API가 없다.

## 다음 사람이 알아야 할 것
- **공유 테스트 파일 수정 이유**
  - `BackendApplicationTests`에 `@ActiveProfiles("test")`를 붙였다.
  - 이제 키가 없으면 서버가 시작하지 않는다. 작업 2부터 MyBatis mapper가 생기면 DataSource가 없을 때 `contextLoads`가 다시 깨진다.
  - test 프로필은 H2와 공개 테스트 키로 컨텍스트를 띄운다. SQL을 실제로 검사하는 것은 Oracle에서 한다.
- **`.gitignore`**: 이름이 정확히 `application.properties`인 파일만 무시한다. `application-test.properties`는 커밋 대상이다. 여기에는 공개 테스트 값만 둔다.
- **mapper 위치**: `mybatis.mapper-locations=classpath:mapper/**/*.xml`을 로컬 `application.properties`에도 넣어야 XML mapper가 읽힌다.
- **JSON 오류 처리 파일**: 계획에서는 401·403 처리 클래스를 둘로 나누려 했다. 한 파일 `JsonErrorWriter`로 합쳤다(같은 일을 함).
- **API가 아닌 경로**(`/api/**` 밖, 예: 소셜 로그인 시작 주소)는 막지 않는다.
- **API 정의서와 다른 점**: 없음. 오류 형식은 정의서 1장의 A팀 임시 형식 그대로다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |

---

## 11/18 1차 시연 후속: 로그인·회원가입 화면 개편

- **날짜:** 2026-11-18
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-87-signup-form-v2` (develop `5ff443c`에서 만듦)
- **관련 N-ID:** N-01(로그인 전 헤더·로그인 화면), N-02(회원가입), N-02-1(닉네임·생일), N-02-3(이메일 인증)
- **관련 결정:** 11/18 1차 시연 수정 요청, 팀 결정 A안(올해 20세가 되는 해까지 가입)

### 무엇을, 왜 바꿨나
1차 시연에서 로그인 전 화면에 수정 요청이 나왔다.
- **헤더:** [로그인]·[회원가입] 두 버튼을 [로그인 / 회원가입] 하나로 합쳤다. 어느 로그인 전 화면에서 눌러도 로그인 화면으로 간다.
- **로그인 화면**
  - [로그인] 아래에 [회원가입] 보조 버튼을 두었다.
  - 아래 링크 줄에서는 [회원가입]을 뺐다. `AuthLinks`에 선택 속성 `exclude`를 추가했고, 다른 화면의 링크는 그대로다.
- **회원가입 화면**
  - **실시간 검사:** 칸마다 한 번 입력했거나 칸을 벗어난 뒤부터 입력할 때마다 검사해 칸 아래에 바로 보여 준다. 손대지 않은 칸에는 빈 값 오류를 미리 띄우지 않는다.
    - "중복 확인을 해 주세요", "인증을 완료해 주세요"는 [가입하기]를 누른 뒤에만 보인다.
    - [가입하기]에서 오류가 있으면 첫 오류 칸으로 스크롤하고 포커스를 옮긴다.
  - **이름:** 완성형 한글 2~20자만 받는다(`^[가-힣]{2,20}$`). 서버도 같은 규칙으로 검사한다.
  - **닉네임:** [중복 확인] 버튼을 두었다. 확인을 마친 닉네임만 가입할 수 있고, 가입할 때 서버의 중복 검사(409)는 그대로다.
  - **휴대폰:** `010 - [4자리] - [4자리]` 칸에 인증을 붙였다. 인증을 마쳐야 가입할 수 있다. 실제 문자는 보내지 않고, 개발 서버는 로그에 코드를 남긴다.
  - **이메일:** `[앞부분] @ [naver.com|gmail.com|직접 입력] [인증코드 받기]` 한 줄로 받는다.
    - 가입 화면 전용 `SignupEmailField`를 새로 만들었다. 비밀번호 찾기·마이 페이지의 `EmailVerification`은 바꾸지 않았다.
  - **생일:** 출생연도 칸을 브라우저 달력(`<input type="date">`)으로 바꿨다.
    - 고를 수 있는 범위는 1930-01-01부터 (올해 − 20)-12-31까지다.
    - 서버에는 지금처럼 연도(`birthYear`)와 `ageGroup`만 보낸다. 월·일은 저장하지 않는다.
- **mock 모드**(`VITE_USE_MOCK=true`)에서도 같은 흐름이 돈다. 닉네임 확인, 휴대폰 발송·확인 mock을 추가했고, 가입 mock이 휴대폰 토큰을 검사한다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/layout/PublicLayout.jsx` | 헤더 링크 2개 → [로그인 / 회원가입] 1개(로그인 화면으로) |
| `frontend/src/features/auth/components/AuthLinks.jsx` | 선택 속성 `exclude`(뺄 경로 목록) |
| `frontend/src/features/auth/pages/LoginPage.jsx` | [회원가입] 보조 버튼, 링크 줄에서 회원가입 제외 |
| `frontend/src/features/auth/pages/SignupPage.jsx` | 칸 구조화·실시간 검사·첫 오류 칸 이동·닉네임 확인·생일 달력 |
| `frontend/src/features/auth/components/PhoneVerification.jsx` | (새 파일) 휴대폰 `010-[ ]-[ ]` 입력과 인증 |
| `frontend/src/features/auth/components/SignupEmailField.jsx` | (새 파일) 이메일 한 줄 입력과 인증(가입 전용) |
| `frontend/src/features/auth/emailParts.js` | (새 파일) 도메인 선택지, 이메일 나누기·합치기 |
| `frontend/src/features/auth/validation.js` | 칸별 검사 함수 추가, `validateSignup` 새 폼 모양으로(기존 export 유지) |
| `frontend/src/features/auth/authConstants.js` | `PHONE_PURPOSES` |
| `frontend/src/features/auth/api/authFeatureApi.js` | 닉네임 확인·휴대폰 발송·확인 함수, 가입 요청 주석 |
| `frontend/src/features/auth/mocks/authMockData.js` | `MOCK_PHONE_CODE`·유효 시간 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | 새 API 3개 mock, 가입 mock 이름·휴대폰 토큰 검사, 탈퇴 시 휴대폰 인증 기록 삭제 |
| `frontend/src/features/auth/auth.css` | 새 클래스만 추가(아래 표) |
| `backend/.../user/controller/AuthController.java` | 새 경로 3개 |
| `backend/.../user/dto/AuthRequests.java` | `NicknameCheck`·`PhoneSend`·`PhoneVerify`, `Signup.phoneVerificationToken` |
| `backend/.../user/dto/AuthResponses.java` | `NicknameAvailability`·`PhoneSent`·`PhoneVerified` |
| `backend/.../user/service/AuthService.java` | `checkNickname`, 가입: 이름 규칙·휴대폰 필수·휴대폰 토큰 사용 |
| `backend/.../user/service/AccountRules.java` | `nameError`(한글 2~20자) |
| `backend/.../user/service/PhonePurpose.java` | (새 파일) 휴대폰 인증 목적(SIGNUP) |
| `backend/.../user/service/PhoneVerificationService.java` | (새 파일) 휴대폰 발송·확인·토큰 사용 |
| `backend/.../user/service/VerificationTokenService.java` | `issuePhone`·`parsePhone`(종류 `phone-verification`), 기존 메서드 그대로 |
| `backend/.../user/service/phone/*.java` | (새 파일) `PhoneCodeSender`, `LogPhoneCodeSender`(기본), `FixedPhoneCodeSender` |
| `backend/.../global/config/AvenueProperties.java` | `avenue.auth.phone.mode`·`fixed-code` |
| `backend/.../global/security/SecurityConfig.java` | 공개 POST 경로 2개 추가 |
| `backend/src/test/...` | `PhoneVerificationServiceTest`(새), `AuthServiceTest`·`UserApiContractTest`·`WithdrawalApiTest`·`SocialAndMyPageServiceTest` 맞춤 |

**새 CSS 클래스** (`auth.css`, 프론트 담당 확인 대상)
| 클래스 | 용도 |
|---|---|
| `signup-form__row` | 칸 + 버튼 한 줄(닉네임·휴대폰·이메일), 좁으면 두 줄 |
| `signup-form__fixed` | `010`·`-`·`@` 고정 글자 |
| `signup-form__part` | 휴대폰 4자리 칸 너비 |
| `signup-form__grow` | 이메일 앞부분·직접 입력 도메인 칸 |
| `signup-form__check` | [중복 확인]·[인증번호 받기]·[확인] 보조 버튼 |
| `signup-form__ok` | 성공 안내(사용할 수 있는 닉네임·비밀번호 일치) |
| `signup-email` | 이메일 묶음(선택 상자 너비 포함) |
| `phone-verification`, `phone-verification__done`, `phone-verification__notice` | 휴대폰 인증 묶음·완료·안내 |

### DB·API 변경
- **DB:** 없음(DDL 그대로).
  - 휴대폰 인증 기록은 기존 `VERIFICATION_CODE`에 `CHANNEL_CODE='PHONE'`, `PURPOSE_CODE='SIGNUP'`으로 저장한다(`CK_VCD_CHANNEL`·`CK_VCD_PURPOSE`가 이미 허용).
  - 번호는 HMAC으로만, 코드는 BCrypt 해시로만 저장한다.
- **API:** 새 경로 3개, 그리고 가입 요청 필드 1개 추가와 검사 강화(아래 명세 반영 제안).
- **설정:** 새 키 `avenue.auth.phone.mode`(기본 `LOG`, 또는 `FIXED`)와 `avenue.auth.phone.fixed-code`(기본 없음, FIXED일 때 필요). 기본값이 코드에 있어서 `application.properties`를 고치지 않아도 된다.
- **영향을 받는 기능·팀원:** 가입 API를 부르는 곳은 휴대폰 인증 토큰을 보내야 한다. 지금은 우리 가입 화면뿐이다.

### 명세 반영 제안
(문서 담당이 API 명세에 따로 반영한다)
- `POST /api/auth/nickname/check`
  - 요청 `{ nickname }`, 응답 `{ available: boolean }`. 공개 경로다.
  - 형식 오류(2~12자 아님, '탈퇴'로 시작)는 400 `INVALID_INPUT`과 `fieldErrors[{ field: 'nickname' }]`
- `POST /api/auth/phone/send`
  - 요청 `{ phone, purpose: 'SIGNUP' }`, 응답 `{ expiresInSeconds }`(이메일 발송과 같은 모양). 공개 경로다.
  - 번호 형식 오류는 400 `fieldErrors[{ field: 'phone' }]`
- `POST /api/auth/phone/verify`
  - 요청 `{ phone, code, purpose }`, 응답 `{ verificationToken }`(이메일 확인과 같은 모양). 공개 경로다.
  - 틀림·만료·5회 초과는 400 `INVALID_VERIFICATION_CODE`
  - 지시서 초안은 `{ verificationId, expiresAt }` / `{ verificationId, code }`였다. 담당자(JWC)가 이메일과 같은 모양으로 정했다.
- **가입(AUTH-06)**
  - 요청에 `phoneVerificationToken`(필수)을 추가한다.
  - 휴대폰은 필수다. 토큰이 없거나 다른 번호·이메일 토큰이면 400 `fieldErrors[{ field: 'phone', message: '휴대폰 인증을 완료해 주세요.' }]`
- **이름 규칙:** 완성형 한글 2~20자(`^[가-힣]{2,20}$`). 오류는 `이름은 한글 2~20자로 입력해 주세요. (숫자·영문·기호 불가)`
  - 지시서의 DTO `@Pattern` 대신 가입 검사(`validateSignup`)에 넣었다. 같은 400·같은 칸별 오류가 나오게 하려는 것이다.
- **생일:** 화면은 날짜를 받지만 서버로는 지금처럼 `birthYear`(그 연도)와 `ageGroup`만 보낸다.

### 확인
- 확인함
  - `npm run lint` 오류 0, `npm run build` 성공
  - `mvnw test`: 342개 통과, 실패 0
    - 새 `PhoneVerificationServiceTest` 10개: 발송 시 PHONE 행·HMAC·해시만 저장, 응답·로그에 번호·코드 원문 없음(LOG 모드 개발용 줄은 가린 번호), 틀린 코드·만료·5회·이메일 행 거절, 다른 번호·이메일 토큰·깨진 토큰 거절
    - `AuthServiceTest`: 휴대폰 없음·토큰 없음·토큰 거절 시 가입 안 함, 이름 `홍길동` 통과 / `hong`·`홍길동1`·`홍 길동`·`ㄱㄴ` 거절, 닉네임 확인(쓸 수 있음·이미 있음·형식 오류 400)
    - `UserApiContractTest`: 새 3개 경로를 토큰 없이 부르고 JSON 키가 mock과 같음
  - 탈퇴의 휴대폰 HMAC 인증 기록 삭제는 기존 `WithdrawalServiceTest`로 그대로 통과한다.
  - 헤드리스 Chrome(mock 모드) 화면 점검 68건 통과(저장소 밖 스크립트)
    - 헤더 버튼 → 로그인 화면, 로그인 화면 버튼 2개
    - 칸별 실시간 문구, 닉네임 확인, 휴대폰 자동 이동·Backspace·인증, 이메일 한 줄·직접 입력
    - 생일 범위, 첫 오류 칸 포커스, 가입 → 새 계정 로그인, 간편 로그인 가입 미리 채움
- 확인 못 함
  - 실제 Spring 서버에 curl로 닉네임 확인을 부르는 것. 작업할 때 8080 서버가 꺼져 있어서 시험 결과로 갈음했다.
  - 실제 Oracle에 휴대폰 인증 행 저장

### 사람 확인 필요
- **생일 전체 저장·만 나이 판단:** `APP_USER`에 생일 칸을 추가하는 DDL 변경과 팀 승인이 필요하다. 이번에는 연도만 저장한다.
- **실제 문자 발송 업체 연동:** 업체·계정·발송 키·비용을 팀이 정해야 한다. `PhoneCodeSender` 구현을 하나 추가하면 된다.
- **새 CSS 클래스:** 위 표. 프론트 담당 확인이 필요하다.
- **이름 한글 제한:** 외국인 이름(영문 등)은 가입할 수 없게 된다. 팀 확인이 필요하다.
- **휴대폰 중복 가입:** 같은 번호로 여러 계정을 만드는 것은 막지 않았다(지시서에 없음, `PHONE_HMAC`은 UNIQUE가 아님). 막을지 팀이 정해야 한다.

## 11/18 FP-219 화면 확인 결과 수정 (로그인 버튼·비밀번호 찾기 이메일·닉네임 규칙·인증 상태)

### 무엇을, 왜
로컬 DB로 FP-219 화면을 확인하다 나온 6가지를 고쳤다(브랜치 `feature-A/FP-219-login-signup-ui`).
- ① 로그인 화면: [로그인]·[회원가입]을 좌우 한 줄(`login-form__actions`)로 놓는다. 360px 미만에서만 위아래로 쌓인다.
- ② 비밀번호 찾기: 이메일을 회원가입과 같은 한 줄 칸으로 받는다. `SignupEmailField`의 이름을 `SplitEmailField`로 바꿔 두 화면이 함께 쓴다(`purpose`·`extraBody`·`disabled` 속성).
- ③ 닉네임 규칙: **한글·영문·숫자 2~7자**(`^[A-Za-z0-9가-힣]{2,7}$`)이고, '탈퇴'로 시작하면 거절한다.
  - 화면(`validation.js`), mock, 서버(`AccountRules.nicknameError`)가 같은 규칙과 문구를 쓴다.
  - 서버에서는 닉네임 확인 API와 가입 검사 두 곳에 함께 적용된다.
  - DDL(2~12자)보다 좁게 막는 것이라 DDL은 바꾸지 않았다. 기존 회원 닉네임과 관리자 자동 닉네임에는 적용하지 않는다.
- ④ 휴대폰 placeholder를 `0000`·`0000`으로 바꿨다.
- ⑤ 휴대폰·이메일 인증 상태 꼬임(A 인증 → B 틀린 코드 → A로 돌아가면 완료·실패 문구가 함께 보임)을 고쳤다.
  - 원인: 실패 문구(`actionError`)를 완료 분기 밖에서 늘 그렸고, 값이 바뀌어도 지우지 않았다.
  - 고친 방법: 발송·확인 상태를 하나(`{ target, status, message, codeOpen }`)로 합쳤다. 값이 바뀌면 이 상태를 비운다. 완료면 완료 문구만, 그 밖에는 문구 하나만 보인다.
  - 가입할 때 서버가 휴대폰·이메일 칸 오류를 주면(토큰 만료 등) 그 인증 결과를 비워 다시 인증하게 한다.
  - 마이 페이지 이메일 변경(`EmailVerification`)은 이 순서로 재현되지 않아 고치지 않았다.
- ⑥ 성공·안내 문구를 공통 `.field-error`와 같은 모양(`auth-message`, `--success`)으로 맞췄다. 색만 다르다.

### 바뀐 API 검사 규칙(명세 반영 제안 — 문서 담당)
- `POST /api/auth/nickname/check`와 가입(AUTH-06)의 `nickname`: 한글·영문·숫자 2~7자다.
  - 어기면 400 `INVALID_INPUT` `fieldErrors[{ field: 'nickname', message: '닉네임은 한글·영문·숫자 2~7자로 입력해 주세요.' }]`
- 경로와 요청·응답 필드는 바뀌지 않았다. `docs/spec/api/api_spec_a.md`에 반영이 필요하다(이번 작업에서는 고치지 않음).

### 확인
- `npm run lint` 오류 0, `npm run build` 성공
- `mvnw test`: 344개 통과, 실패 0(지난번 342 + 닉네임 시험 2개). 기존 닉네임 시험 2개는 7자 기준으로 고쳤다.
- 헤드리스 Chrome(mock 모드) 화면 점검: 기존 68건 + 이번 50건 = 118건 모두 통과(저장소 밖 스크립트)

### 사람 확인 필요
- 새 CSS 클래스 `auth-message`·`auth-message--success`·`auth-field`·`login-form__actions`. 쓰지 않게 된 `signup-form__ok`·`phone-verification__done` 규칙은 지웠다. 프론트 담당 확인이 필요하다.
- 마이 페이지 이메일 변경도 한 줄 칸으로 바꿀지(이번에는 안 바꿈)

### 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
