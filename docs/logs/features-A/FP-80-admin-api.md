# 관리자 Spring API — 로그인 2단계 인증, 계정·권한, 열람 감사, 시스템 로그 (FP-80)

- **날짜:** 2026-11-15
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-80-admin` (`feature-A/FP-85-86-93-bundle` 6ee8bf2를 merge한 위에서 작업, PR C)
- **관련 N-ID:** N-01-1(관리자 2단계 인증), N-27-1·3·4, N-28-1·2, N-35-1·2 (함께 고친 곳: N-04-7 탈퇴 기록)
- **관련 결정:** decisions.md 1-2(역할·잠금·2단계 인증), 11/14 "관리자는 1차에도 이중 보안", 11/06 "회원 → 관리자 변경 없음"

## 무엇을, 왜 바꿨나
- 작업 2가 남긴 `ADMIN_2FA_NOT_READY`(409) 자리를 관리자 2단계 인증으로 바꿨다.
  - 관리자가 AUTH-01에서 비밀번호를 맞히면 토큰을 주지 않는다. 업무 이메일로 6자리 번호를 보내고 `{ twoFactorRequired, challengeToken, maskedEmail }`을 준다.
  - AUTH-11에서 번호를 확인하면 ACCESS 토큰을 준다.
  - 임시 비밀번호 상태면 ACCESS 대신 비밀번호 설정 토큰을 주고, 비밀번호를 바꾼 뒤에야 ACCESS 토큰을 준다.
- 민감한 작업(관리자 추가, 내 비밀번호 변경, 임시 비밀번호 재발급)은 6자리 재확인(step-up) 토큰을 헤더 `X-Step-Up-Token`으로 받아야 동작한다.
- JWT에 `scope` 클레임을 넣었다(ACCESS, ADMIN_LOGIN_CHALLENGE, ADMIN_PASSWORD_SETUP, ADMIN_STEP_UP).
  - JWT 필터는 ACCESS만 로그인으로 받는다.
  - 짧은 토큰은 jti를 서버 메모리(`OneTimeTokenStore`)에 두고 한 번만 쓰게 한다.
- 시스템 로그(`global/log/SystemLogService`)를 만들어 아래 이벤트를 `SYSTEM_LOG`에 남긴다. 별도 트랜잭션으로 쓰고, 실패해도 본 요청은 성공한다.
  - 로그인 성공·실패(n/5회)·자동 잠금
  - 관리자 2단계 인증 통과·실패, 재확인 통과
  - 관리자의 잠금·해제, 관리자 추가, 임시 비밀번호 재발급, 비밀번호 변경
  - 회원 탈퇴
- 관리자 계정 목록·잠금·추가(ADM-05·06·07), 회원 정보 열람(ADM-08, 감사 로그를 먼저 저장), 로그 조회(ADM-09·10)를 만들었다.
- `/api/admin/**`: 비밀번호 변경이 필요한 관리자(PASSWORD_CHANGE_REQUIRED_YN='Y')는 403 `PASSWORD_CHANGE_REQUIRED`를 받는다(인터셉터).
- 복호화 실패에 견딘다. 다른 키로 암호화된 행(팀 키 시드 회원)은 그 칸만 "(복호화 불가)"로 보이고, 서버 로그에는 USER_ID만 남긴다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `global/security/JwtTokenProvider.java` | scope 클레임, `issueScoped`·`parseScoped`, `parse`는 ACCESS만 |
| `global/security/TokenScope.java` | 새 파일. 토큰 종류 4개 |
| `global/security/SecurityConfig.java` | 인증 없음 경로에 `/api/auth/admin/password-setup`, CORS 허용 헤더에 `X-Step-Up-Token` |
| `global/log/SystemLogService.java`·`SystemLogMapper.java`·`mapper/admin/SystemLogMapper.xml` | 새 파일. 시스템 로그 기록(REQUIRES_NEW, 실패 삼킴) |
| `admin/controller/*` | 새 파일. AdminLoginController(AUTH-11·비밀번호 설정), AdminMeController(재확인·내 비밀번호), AdminAccountController(ADM-05~08), AdminLogController(ADM-09·10), 비밀번호 변경 필요 인터셉터·설정 |
| `admin/service/*` | 새 파일. AdminAuthService, AdminAccountService, AdminMemberService, AdminLogQueryService, AdminPii, OneTimeTokenStore |
| `admin/dto/*`, `admin/mapper/*`, `mapper/admin/*.xml` | 새 파일. 요청·응답, 행, SQL |
| `user/service/AuthService.java` | 관리자 분기 → 2단계 인증, 로그인 성공·실패·잠금 시스템 로그 |
| `user/service/WithdrawalService.java` | 회원 탈퇴 시스템 로그(INFO) |
| `user/controller/AuthController.java`, `user/dto/AuthResponses.java` | AUTH-01 응답 종류(`LoginResult`: Login·AdminChallenge) |
| `user/dto/UserAccount.java`, `mapper/user/UserAccountMapper.xml` | `PASSWORD_CHANGE_REQUIRED_YN`·`LAST_LOGIN_AT` 읽기 |
| `backend/README.md` | 시스템 로그 사용법 3줄, scope 규칙 1줄 |
| 테스트 | AdminAuthServiceTest(11), AdminAccountServiceTest(9), AdminMemberServiceTest(5), AdminApiTest(8), SystemLogServiceTest(3), AuthServiceTest·WithdrawalServiceTest·SecurityConfigTest 보강 |

## DB·API 변경
- **DB:** DDL 변경은 없다.
  - INSERT: `SYSTEM_LOG`, `ACCESS_AUDIT_LOG`, `VERIFICATION_CODE`(ADMIN_LOGIN)
  - UPDATE: `APP_USER`(잠금·해제·비밀번호·임시 비밀번호), 관리자 INSERT(`APP_USER` ROLE_ADMIN)
- **API (🟡는 이번에 제안한 경로)**

  | ID | 메서드·경로 | 쓰는 표 |
  |---|---|---|
  | AUTH-01 (관리자) | `POST /api/auth/login` → `{ twoFactorRequired, challengeToken, maskedEmail }` | APP_USER, VERIFICATION_CODE |
  | AUTH-11 | `POST /api/auth/admin/verify-code` `{ challengeToken, code }` | VERIFICATION_CODE, APP_USER, SYSTEM_LOG |
  | 🟡 | `POST /api/auth/admin/password-setup` `{ passwordSetupToken, newPassword }` | APP_USER, SYSTEM_LOG |
  | 🟡 | `POST /api/admin/me/step-up/send`, `POST /api/admin/me/step-up/verify` `{ code }` | VERIFICATION_CODE |
  | 🟡 | `PUT /api/admin/me/password` `{ currentPassword, newPassword }` + X-Step-Up-Token | APP_USER, SYSTEM_LOG |
  | ADM-05 | `GET /api/admin/users?q&role&status&page&size` | APP_USER, ASSESSMENT, CONTENT_REPORT, BOARD_POST·BOARD_COMMENT |
  | ADM-06 | `PATCH /api/admin/users/{userId}/lock` `{ locked, reason }` | APP_USER, SYSTEM_LOG |
  | ADM-07 | `POST /api/admin/admins` `{ loginId, name, workEmail }` + X-Step-Up-Token | APP_USER, SYSTEM_LOG |
  | 🟡 | `POST /api/admin/admins/{userId}/temporary-password` + X-Step-Up-Token | APP_USER, SYSTEM_LOG |
  | ADM-08 | `POST /api/admin/users/{userId}/credit-data` `{ reason }` | ACCESS_AUDIT_LOG, APP_USER, ASSESSMENT, USER_CREDIT_PROFILE, 대안 데이터 4표 |
  | ADM-09 | `GET /api/admin/access-logs?page&size` | ACCESS_AUDIT_LOG, APP_USER |
  | ADM-10 | `GET /api/admin/system-logs?type&page&size` | SYSTEM_LOG |

- **새 오류 code**
  - 400: ADMIN_CHALLENGE_INVALID, INVALID_VERIFICATION_CODE, VERIFICATION_CODE_EXPIRED, VERIFICATION_ATTEMPTS_EXCEEDED, PASSWORD_SETUP_INVALID, SAME_PASSWORD, ACCESS_REASON_REQUIRED
  - 401·403·409·429: 429 CODE_RESEND_TOO_SOON, 401 STEP_UP_REQUIRED, 403 PASSWORD_CHANGE_REQUIRED, 409 CANNOT_CHANGE_SELF, 409 ACCOUNT_WITHDRAWN, 409 ADMIN_EMAIL_UNAVAILABLE
- **영향 받는 기능·팀원**
  - 관리자 화면(작업 8): AUTH-01 관리자 응답이 409에서 200(challenge)으로 바뀌었다.
  - 다른 팀: 시스템 로그를 남기려면 README "시스템 로그 남기기"를 본다.
  - 이미 발급된 옛 토큰(scope 없음)은 이제 401이다. 다시 로그인하면 된다.

## 확인
- **확인함:** `./mvnw test` 193개 통과
  - 2단계 인증: 만료·5회·재사용, 1회용 토큰 두 번째 사용 거부, scope가 다른 토큰 거부, 첫 로그인은 비밀번호를 바꾸기 전 ACCESS 토큰 없음
  - 잠금: 본인 거부·사유 필수
  - 관리자 추가: 재확인 없이 401, 중복 409, 닉네임 다시 짓기, 임시 비밀번호가 로그에 없음
  - 감사 로그가 데이터보다 먼저 저장되고, 기록이 실패하면 데이터를 주지 않음
  - 로그 기록이 실패해도 로그인 성공
  - AUTH-10에 관리자 아이디를 넣으면 없는 계정과 같은 404
  - 복호화 불가 표시
  - MockMvc: USER 토큰 403, 대기 토큰 401, STEP_UP_REQUIRED 401, PASSWORD_CHANGE_REQUIRED 403, AUTH-01 관리자 응답 모양
- **확인 못 함 (작업 3)**
  - 실제 Oracle에서 SQL 실행: `KEEP (DENSE_RANK LAST …)`, `OFFSET … FETCH`, 신고 건수 하위 질의
  - 화면 → Spring 전체 흐름

## 다음 사람이 알아야 할 것
- **이미 막혀 있는지 확인한 것**
  - AUTH-09·AUTH-10은 SQL이 `ROLE_CODE = 'ROLE_USER'`만 찾는다. 그래서 관리자 아이디는 "없는 계정"과 같은 응답이다.
  - 간편 로그인은 작업 2에서 이미 관리자를 거부한다.
- **2차로 미룬 것**
  - 1회용 토큰 저장소를 DB·Redis로 옮기기. 지금은 서버 메모리라 재시작하면 모두 무효다.
  - VERIFICATION_CODE 목적 코드 'ADMIN_STEP_UP' 추가(DDL 제안). 지금은 재확인도 'ADMIN_LOGIN'으로 저장한다.
  - 이메일 외 두 번째 수단(TOTP 등)
- 로컬 확인용 관리자는 화면으로 가입한 테스트 계정을 사람이 로컬 DB에서 `ROLE_ADMIN`으로 바꿔 쓴다(보고에 UPDATE 문). 코드에 회원 → 관리자 기능은 없다.

## [2026-11-15 · JWC / Claude Code] 작업 9 — 화면 합치기·계약 맞추기·실제 가동 확인
- **합치기:** `feature-A/FP-80-admin-ui`(4916f56, 작업 8 화면)를 merge했다(dce775d, 충돌 없음). 화면 쪽 계약 수정은 `FP-80-admin-ui.md` 작업 9 절에 있다.
- **실제 가동에서 찾아 고친 백엔드 버그 2건**
  1. ADM-09 열람 감사 로그가 500이었다(ORA-00923). 별칭 `AS resource`의 RESOURCE가 Oracle 예약어였기 때문이다. 별칭을 `accessedResource`로 바꿨고, 응답 필드 `resource`는 그대로다.
     - 단위 테스트는 매퍼를 mock으로 대신해 이 오류를 잡지 못했다.
  2. 관리자가 로그인한 직후 1분 안에 재확인 번호를 받으면 429가 났다. 1분 제한이 이미 확인한 로그인 번호까지 세었기 때문이다.
     - 이제 확인하지 않은 번호가 있을 때만 제한한다.
     - 테스트 `stepUpRightAfterVerifiedLoginIsNotRateLimited`를 추가했다.
- **실제 가동(화면 → Spring → 로컬 Docker Oracle, Playwright)**
  - 12/13 화면 단계가 통과했다. 나머지 1건(C08 감사 로그 화면)은 한 쪽 10줄이라 오래된 AUTH 행이 다음 쪽에 있어서였고, API로 전체를 확인해 통과로 판단했다.
  - 일반 로그인 영향 없음, 관리자 2단계 인증·틀린 번호 문구·429, 계정 목록(시드 "(복호화 불가)")·검색·필터·쪽 넘기기
  - 상세 열람 2건, 잠금·해제, 관리자 추가 → 첫 비밀번호 설정, 중복 409, 비밀번호 변경·되돌림, 탈퇴 INFO 로그
  - 시스템 로그에 개인정보 원문 없음(API 전체 조회)
- **확인:** `./mvnw test` 194개, `npm run lint`·`npm run build` 통과

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
