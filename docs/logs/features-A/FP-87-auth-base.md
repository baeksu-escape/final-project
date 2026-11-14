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
