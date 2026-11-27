# Avenue API 정의서 (전체 목록)

- **버전:** v0.2 · 관리: 범영(B팀, 1장 공통 규칙·오류 code·장 구성과 리뷰 검수) · 2장 API 행은 그 API를 만든 사람이 기능 PR에서 고친다(🆕 11/20, [README](README.md) 2장) · 처음 작성 2026-11-12
- **이 문서는 서비스 전체 API의 목차다.** ID·경로·기능(N-ID)·담당·상태만 적는다. 요청·응답 상세는 팀별 명세서에 있다. 문서 관계와 고치는 방법은 [README](README.md)에 있다.
  - A팀(회원·입력·관리자): [api_spec_a.md](api_spec_a.md)
  - B팀(점수 산출·리포트, Spring → FastAPI 내부 API ML-01~04): [api_spec_b.md](api_spec_b.md) — 이 문서에서 "B팀 명세서 3-1"처럼 부르는 장 번호는 이 파일의 장 번호다
  - C팀(재무 진단·시뮬레이터 등): [api_spec_c.md](api_spec_c.md)
- **기준:** DDL v0.3.2 `docs/spec/sql/avenue_ddl.sql`(표 48개 — 11/19 `MODEL_EVAL_SAMPLE` 추가 🆕 11/20), 피처 정의서 v1.0 `docs/spec/feature_definition.md`(FP-132). DB 제약은 DDL을, 피처는 피처 정의서를 따르고, 서로 다르면 확인 대상으로 적는다.

> **🆕 최근 변경 (11/20)** — 바뀐 곳에 🆕 11/20 표시. 번호 없이 문서 관리자가 모아 정리한다(기능 PR은 이 블록을 고치지 않는다, [README](README.md) 2장)
> - 2-5·2-6 **경로 이동(광희, PR #103)**: DIAG-07-1·08-1·09, SIM-01·02를 `/api/members/me/…`로 → Q-8 해결
> - 2-7 **대출 상품 LOAN-01~05 ✅(경환, FP-90 PR #101)**, SIM-03은 만들지 않음 → Q-9 해결, 오류 `PRODUCT_NOT_FOUND`
> - 2-10 N-25 모형 성능 비교의 재료를 평가 표본 표 `MODEL_EVAL_SAMPLE`(PR #99, 표 48개)로, 1장 등급 구간 `CUT-0.2`(DRAFT, PR #106)
> - 광희 님 요청: SIM-01 주요 표에 `USER_CREDIT_PROFILE`, DIAG-09 409에 "같은 달 겹침"
> - 2-9 **용어 사전 HELP-01 ✅**(FP-180 PR #108)
> - 2-5 **DIAG-01 ✅ 경로 `/api/members/me/peer-benchmark`·원천 회원 표(동주, FP-160 PR #120)**, DIAG-02·05 ⛔(쓰는 화면 없음 / `scenario-base`가 기준금리 제공), 2-10 ADM-01·02 쿼리·담당 FP-184
> - 2-5 **(광희, FP-239)** DIAG-03-1 자산·부채 저장값 `GET /api/members/me/financial-health` ✅, DIAG-04 시나리오 새 경로 2개 ✅(PR #118), DIAG-09 '밀림' 반영(연체 +1, `assumedDelinquencyCount`). 이번부터 API를 만든 사람이 PR에서 정의서를 같이 고친다(범영 11/20)
> - 2-2·2-3 **(우찬, FP-227)** MEM-05 입력 저장 전 직군 다시 고르기·409 `JOB_TYPE_LOCKED`, INP-02 자산 4종 각각 저장(DDL C13)
> - 2-10 **모형 성능 비교 ADM-01·02 ✅(동주, FP-184)** — ACTIVE 모델(지금 0.2)의 평가 표본 기준
> - **(범영, FP-246)** 1장 오류 응답 ✅(D-20 확정), 2-11 공용 DB 모델 0.2, Q-7 해결
>
> 이전 변경 (11/19): FP-219 AUTH-13~15·AUTH-06 휴대폰 인증 필수, FP-170 SIM-01·02·DIAG-09 ✅, 1-2 C팀 오류 표 정리
> 이전 변경 (11/18): 저장소 `docs/spec/api/`로 이관, PR #83(DIAG-07 표준편차·DIAG-08 `months[]`·전망 조건) 반영, 간편결제 × 12 🟡 정정, `isXxx` 필드 규칙
> 이전 변경 (11/17): A팀 명세(우찬) 반영(공통 규칙·오류 code·AUTH-11·12·ADM-07-1·ADM-ME-1~3), INP-03 `utility`, RPT-01 `{ requestId }`·`ALT_DATA_EMPTY`, 시뮬레이터 입력 10개 확정, C조 광희 재무 계산 API(PR #78), 커뮤니티(PR #80), ML-01~04 실제 모델 연결(PR #74·#77), Jira 번호 정정
> 이전 변경 (11/16): 기준 DDL 47개 표, RPT-01 입력 부족 409(O-13), 대출 "해당 없음" `NO_LOAN_YN`(O-15), RPT·MEM-06·ML 구현 완료
> 이전 변경 (11/13): 피처 정의서 v1.0(기존 19·대안 39), 시뮬레이터 입력 10개

- **v0.2 (11/12 범영 결정):**
  - 점수·리포트·진단 내역의 Spring 구현은 범영이 맡는다.
  - 1차 개발에는 신용평가사 조회가 없다.
  - 점수 산출에 필요한 필수 동의는 대안 데이터 5개다.
  - 대출은 "해당 없음"을 고를 수 있다.
- **11/13 피처 정의서 v1.0 반영:** 모델 피처는 기존 19개, 대안 39개다. 피처 사전(`DIM_FEATURE`)에는 39개를 `FS-DRAFT`로 넣는다(`docs/spec/sql/seed/`, FP-123). 시뮬레이터 입력은 10개(공과금 미납 개월 수 추가, ✅ 11/17 확정)다.
- 출처
  - 각 브랜치 코드와 mock에 이미 있는 경로(2026-11-12 기준 원격 브랜치 전체를 확인)
  - Jira 담당 작업
  - DDL 표 주석의 N-ID

**상태 표시**

| 표시 | 뜻 | 할 일 |
|---|---|---|
| ✅ | 프론트 코드나 mock에 이미 쓰이는 경로 | 경로·필드 이름을 바꾸지 않는다(AGENTS.md 3-1). 필요하면 필드를 추가만 한다 |
| 🟡 | 이 문서가 제안하는 경로 | 담당 팀이 확정한다 |
| ⛔ | 기능 자체가 미정·보류 | 결정 전에는 만들지 않는다 |

---

## 1. 공통 규칙

| 항목 | 규칙 | 근거 |
|---|---|---|
| 호출 구조 | React → Spring Boot(`/api/**`) → FastAPI(`/v1/**`, 내부 호출 — 1차·시연은 한 PC `localhost:8000`, Docker는 2차 후보). React는 FastAPI와 가상 기관을 직접 부르지 않는다 | AGENTS.md 1장 |
| 인증 | `Authorization: Bearer {JWT}`. 로그인·가입·찾기 API만 인증 없이 부른다 | 프론트 `client.js` |
| 권한 | `ROLE_USER` / `ROLE_ADMIN` (`DIM_ROLE`). `/api/admin/**`는 관리자만 쓴다 | DDL `DIM_ROLE` |
| 내 데이터 | 로그인한 본인 자료는 `/api/members/me/**`로 부른다. URL에 회원 번호(`USER_ID`)를 넣지 않는다 | 기존 경로 |
| 평가 식별자 | 화면과 URL에는 `ASSESSMENT_ID` 대신 **`REQUEST_ID`(소문자 UUID)**만 쓴다. 번호를 추측해 남의 결과를 보는 것을 막기 위해서다 | DDL `ASSESSMENT.REQUEST_ID` 주석 |
| 형식 | JSON, UTF-8. 필드는 camelCase, 경로는 kebab-case. 코드값은 DB 코드 그대로 쓴다(`SELF_EMPLOYED`, `SCORED` 등) | 기존 코드 |
| 금액·비율 | 금액은 원 단위 정수, 금리는 연 %(8.9 = 8.9%), 확률은 0~1 | DDL 머리말 |
| 점수 | **0~1000** 정수. 등급은 `GOOD` / `STANDARD` / `CAUTION`(ACTIVE CUT-0.4: 0~644 / 645~711 / 712~1000, 🟡 임시값. 🆕 11/27 모델 0.3과 함께 `CUT-0.3`(0~653 / 654~726 / 727~1000)에서 전환, FP-285 — 전환 SQL을 아직 실행하지 않은 DB는 CUT-0.3. 11/23 `CUT-0.1`(0~664 / 665~779 / 780~1000)에서 전환, FP-248 🆕 11/23. `CUT-0.2` 0~659 / 660~730 / 731~1000은 DRAFT) | DDL v0.3.1 A-1 |
| 날짜 | 월 `"YYYY-MM"`, 날짜 `"YYYY-MM-DD"`, 시각은 ISO-8601 | DDL CHECK |
| 오류 응답 | HTTP 상태 + `{ "code", "message", "fieldErrors": [{ "field", "message" }] }`. ✅ 전 API 공통(FP-87 `GlobalExceptionHandler`, D-20 확정 🆕 11/20) | 프론트 `serverErrors.js` |
| 개인정보 | 이름·휴대폰·이메일은 마스킹해서 응답한다. 원문은 로그에 남기지 않는다. 관리자가 회원 신용정보를 열람하면 `ACCESS_AUDIT_LOG`에 남긴다 | AGENTS.md 5장, DDL N-35 |
| 토큰 종류 | JWT에 `scope` 클레임이 있다. 일반 API는 `ACCESS`만 받는다. 관리자 2단계 인증용 1회용 토큰(`ADMIN_LOGIN_CHALLENGE`·`ADMIN_PASSWORD_SETUP`·`ADMIN_STEP_UP`)으로 일반 API를 부르면 401. `scope` 없는 옛 토큰(PR #53 이전)도 401 → 다시 로그인 | A팀 명세 0장 |
| 잠긴 계정 | `ACCOUNT_STATUS_CODE = LOCKED`면 이미 받은 토큰도 401 `ACCOUNT_LOCKED`. 잠금을 풀면 같은 토큰이 다시 동작 | A팀 명세 0장 |
| 재확인 헤더 | 관리자 민감 작업은 헤더 `X-Step-Up-Token`(ADMIN_STEP_UP 토큰) 필요. 없거나 만료면 401 `STEP_UP_REQUIRED`. CORS 허용 헤더에 추가됨 | A팀 명세 0장 |
| 쪽 넘기기 | 관리자 목록은 `page`(0부터)·`size`. 응답 `{ items, page, size, totalCount }` | A팀 명세 0장 |
| 응답 시각 | ISO-8601 + 오프셋(`+09:00`) | A팀 명세 0장 |
| 불리언 필드 이름 | Java DTO의 `boolean isXxx` 필드는 JSON에서 **`is`가 빠진 `xxx`**로 나간다(Lombok·Jackson 규칙). 예: `isHighVolatility` → `highVolatility` | C팀 명세 머리말 |
| 탈퇴 회원 | 행을 지우지 않고 상태만 `WITHDRAWN`으로 바꾼다. 개인정보는 정해진 값으로 덮어쓴다. 탈퇴 회원은 이미 받은 토큰으로도 401 `UNAUTHORIZED` | DDL v0.3.2 W1, A팀 명세 0장 |

### 1-1. 오류 code 목록 — A팀 범위 (우찬 명세 5장)

| HTTP | code | 언제 |
|---|---|---|
| 400 | `INVALID_INPUT` | 입력 형식 오류(`fieldErrors` 포함) |
| 400 | `INVALID_PASSWORD` | 비밀번호 확인 실패(MEM-02·MEM-07 등) |
| 400 | `INVALID_VERIFICATION_CODE`, `VERIFICATION_CODE_EXPIRED`, `VERIFICATION_ATTEMPTS_EXCEEDED` | 인증번호 틀림·만료·5회 초과 |
| 400 | `EMAIL_VERIFICATION_REQUIRED`, `SAME_EMAIL`, `SAME_PASSWORD`, `SAME_NICKNAME` | 이메일 인증 누락, 같은 값으로 변경(SAME_NICKNAME은 MEM-08, FP-222) 🆕 11/23 |
| 400 | `ADMIN_CHALLENGE_INVALID`, `PASSWORD_SETUP_INVALID` | 관리자 1회용 토큰 만료·재사용 |
| 400 | `ACCESS_REASON_REQUIRED` | ADM-08 사유 없음 |
| 400 | `INVALID_SOCIAL_CODE`, `SOCIAL_LINK_EXPIRED` | 간편 로그인 코드·연결 키 문제 |
| 401 | `UNAUTHORIZED`, `LOGIN_FAILED` | 토큰 없음·만료·탈퇴 / 로그인 실패 |
| 401 | `ACCOUNT_LOCKED` | 잠긴 계정의 기존 토큰 |
| 401 | `STEP_UP_REQUIRED` | 재확인 토큰 없음·만료 |
| 403 | `FORBIDDEN` | 역할 권한 없음 |
| 403 | `PASSWORD_CHANGE_REQUIRED` | 관리자 비밀번호 변경 필요 |
| 403 | `RECENT_LOGIN_REQUIRED` | 간편 로그인 전용 계정 탈퇴 10분 초과 |
| 403 | `SOCIAL_ADMIN_NOT_ALLOWED` | 관리자 계정 간편 로그인 연결 |
| 404 | `NOT_FOUND`, `ACCOUNT_NOT_FOUND` | 대상 없음 |
| 404 | `PRODUCT_NOT_FOUND` | 없는 대출 상품 코드(LOAN-02·04·05, 경환 FP-90) 🆕 11/20 |
| 409 | `DUPLICATE_LOGIN_ID`, `DUPLICATE_EMAIL`, `DUPLICATE_NICKNAME`, `NICKNAME_UNAVAILABLE` | 중복 |
| 409 | `JOB_TYPE_REQUIRED`, `JOB_TYPE_ALREADY_SELECTED`, `JOB_TYPE_LOCKED` | 직군 선택 전 저장 / 직군 재선택 / 입력 저장 뒤 직군 변경(MEM-05) 🆕 11/23 |
| 409 | `CONSENT_REQUIRED` | 동의 없이 불러오기 |
| 409 | `CREDIT_PROFILE_IMPORTED` | 같은 기준일에 불러온 신용 정보가 있어 직접 입력 저장 불가 |
| 409 | `SOCIAL_ALREADY_LINKED` | 이미 연결된 간편 로그인 |
| 409 | `CANNOT_CHANGE_SELF`, `ACCOUNT_WITHDRAWN`, `ADMIN_EMAIL_UNAVAILABLE` | 본인 잠금, 탈퇴 계정 잠금, 관리자 업무 이메일 복호화 불가 |
| 423 | `ACCOUNT_LOCKED` | 잠긴 계정 로그인 시도 |
| 429 | `CODE_RESEND_TOO_SOON` | 인증번호 1분 안에 재요청 |
| 503 | `ALT_DATA_SOURCE_UNAVAILABLE` | 기관 응답 파일 폴더 없음 |

- B팀 점수 산출 오류(`INPUT_INCOMPLETE`, `REQUEST_ID_CONFLICT`, `ASSESSMENT_NOT_FOUND` 등)는 B팀 명세서 3장에 있다.

### 1-2. 오류 code 목록 — C조 광희 범위 (PR #78)

| HTTP | code | 언제 |
|---|---|---|
| 400 | `INVALID_INPUT` | 예측 기간이 3·6·12가 아님(`forecastMonths`), 빈 POST 본문(`monthlyIncomes`), 금액 음수(그 필드), DSR 연소득 0(`annualIncome`), 점수 0~1000 밖(`score`), 시뮬레이터 입력 오류(`changes.<키>`, ML-04 422 포함), DIAG-09 조건 오류(조건 이름, ML-03 4xx 포함) |
| 401 | `UNAUTHORIZED` | DIAG-07-1·08-1·09, SIM-01·02 토큰 없음·만료 |
| 403 | `FORBIDDEN` | DIAG-07-1·08-1·09, SIM-01·02를 관리자 계정으로 부름(`/api/members/me/**`는 `ROLE_USER` 전용) 🆕 11/20 |
| 404 | `NOT_FOUND` | 저장된 소득 없음(DIAG-07-1·08-1), 점수대·등급 자료 없음(SIM-04) |
| 404 | `ASSESSMENT_NOT_FOUND` | SIM-01·02, DIAG-09: 점수가 나온(SCORED) 평가가 하나도 없음 — 리포트(RPT-02)와 같은 코드 |
| 409 | `VERSION_MISMATCH` | SIM-02: ML-04가 출발 평가의 모델 버전을 계산할 수 없음 → "점수를 다시 산출한 뒤 이용" 안내 |
| 409 | `INPUT_INCOMPLETE` | DIAG-09: 입력 기준월·출생연도 없음, 소득이 직군에 필요한 개월 수보다 적거나 같은 달이 겹침(점수 산출과 같은 문구) 🆕 11/20 |
| 409 | `ALT_DATA_EMPTY` | DIAG-09: 통신비 또는 공과금 기관 기록이 0건이라 ML-03을 부르지 않음 → "통신비·공과금 기록이 없어 예상 점수를 계산할 수 없어요." (점수 산출 RPT-01의 `NOT_SCORABLE` `ALT_DATA_EMPTY`와 같은 기준, FP-239 리뷰 후속) 🆕 11/23 |
| 503 | `MODEL_NOT_READY` | SIM-02·DIAG-09: 실제 모델 파일 없음, 연결 실패, 타임아웃, 그 밖의 5xx. 저장하지 않으므로 `MODEL_ERROR` 기록 없음 |
| 409 | `NOT_SCORED` | RPT-04: 점수가 산출되지 않은(SCORED가 아닌) 평가는 요약하지 않음 🆕 11/26 |
| 429 | `DAILY_LIMIT_EXCEEDED` | HELP-03: 오늘 성공한 자유 질문이 하루 횟수(`CHATBOT_DAILY_LIMIT`, 기본 10)에 이름 — 신고(COMM)와 같은 코드 🆕 11/26 |
| 502 | `AI_FAILED` | HELP-03·RPT-04: OpenAI 연결 실패·시간 초과(D-18)·4xx·5xx·빈 답. 자유 질문은 실패로 기록하고 횟수는 줄지 않음, 요약은 저장하지 않음 🆕 11/26 |
| 409 | `QUESTION_IN_PROGRESS` | HELP-03: 같은 사용자의 앞 질문이 아직 AI 답을 기다리는 중(한 번에 1개만 처리해 하루 횟수를 넘기지 않게 함) 🆕 11/27 |
| 503 | `AI_UNAVAILABLE` | HELP-03·RPT-04: 서버에 OpenAI 키(`avenue.ai.openai.api-key`)가 없음. 백엔드는 켜지고 두 API만 이 응답 🆕 11/26 |

- 커뮤니티(동주, PR #80) 오류 code: 403 `NOT_OWNER`(남의 글 수정·삭제), 404 `POST_NOT_FOUND`·`TARGET_NOT_FOUND`·`REPORT_NOT_FOUND`·`COMMENT_NOT_FOUND`(없거나 삭제된 댓글, 다른 글의 댓글 🆕 11/25), 409 `OWN_CONTENT`(본인 글 신고)·`DUPLICATE_REPORT`·`POST_HIDDEN`·`COMMENT_HIDDEN`(신고로 숨겨진 댓글 수정·삭제 🆕 11/25)·`STATUS_CHANGED`·`ALREADY_HANDLED`, 429 `DAILY_LIMIT_EXCEEDED`(하루 3번 초과).
---

## 2. API 목록

### 2-1. 회원·인증 — 담당 우찬 (FP-75)

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| AUTH-01 | `POST /api/auth/login` | N-01-1 로그인 (관리자는 `{ twoFactorRequired, challengeToken, maskedEmail }`로 2단계 인증 시작, [다시 보내기]도 이 경로·1분 1번) | `APP_USER` | 없음 | ✅ |
| AUTH-02 | `POST /api/auth/logout` | N-01-4 로그아웃 | — | USER·ADMIN | ✅ |
| AUTH-03 | `GET /api/auth/me` | N-01-2 역할별 첫 화면 이동 (로그인 정보) | `APP_USER` | USER·ADMIN | ✅ |
| AUTH-04 | `POST /api/auth/social/exchange` | N-01-6 소셜 로그인 (코드 교환) | `USER_SOCIAL_ACCOUNT` | 없음 | ✅ |
| AUTH-05 | `POST /api/auth/social/link` | N-01-6 소셜 로그인 (계정 연결) | `USER_SOCIAL_ACCOUNT` | 없음 | ✅ |
| AUTH-06 | `POST /api/auth/signup` | N-02-1 가입 정보 입력·형식 검사, N-02-2 필수 동의, N-02-4 계정 생성·개인정보 암호화 저장. 휴대폰 인증 필수(`phoneVerificationToken`), 이름 한글 2~20자, 닉네임 2~7자 | `APP_USER`, `USER_CONSENT` | 없음 | ✅ |
| AUTH-07 | `POST /api/auth/email/send` | N-02-3 이메일 인증코드 발송·확인 (발송) | `VERIFICATION_CODE` | 없음 | ✅ |
| AUTH-08 | `POST /api/auth/email/verify` | N-02-3 이메일 인증코드 발송·확인 (확인) | `VERIFICATION_CODE` | 없음 | ✅ |
| AUTH-09 | `POST /api/auth/find-id` | N-03-1 아이디 찾기 (관리자 계정은 찾지 않음) | `APP_USER`(HMAC 조회) | 없음 | ✅ |
| AUTH-10 | `POST /api/auth/password/reset` | N-03-2 비밀번호 찾기 본인 확인, N-03-3 비밀번호 재설정 (관리자 아이디는 "없는 계정"과 같은 404) | `APP_USER`, `VERIFICATION_CODE` | 없음 | ✅ |
| AUTH-11 | `POST /api/auth/admin/verify-code` | 관리자 로그인 2단계 인증 (6자리 번호). 통과 `{ token, user }`, 임시 비밀번호면 `{ passwordChangeRequired, passwordSetupToken }` | `VERIFICATION_CODE`(`ADMIN_LOGIN`) | 없음(challengeToken) | ✅ |
| AUTH-12 | `POST /api/auth/admin/password-setup` | 관리자 첫 비밀번호 설정 `{ passwordSetupToken, newPassword }` → `{ token, user }` | `APP_USER` | 없음(setup 토큰) | ✅ (새 경로) |
| AUTH-13 | `POST /api/auth/nickname/check` | N-02-1 닉네임 중복 확인 `{ nickname }` → `{ available }` (주소에 닉네임을 남기지 않으려고 POST, 가입 때 서버가 다시 막음) | `APP_USER` | 없음 | ✅ (FP-219, PR #89) |
| AUTH-14 | `POST /api/auth/phone/send` | N-02-3 휴대폰 인증번호 발송 `{ phone, purpose }` → `{ expiresInSeconds }` (`purpose`는 `SIGNUP`만, 실제 문자 발송 없음 — 개발용 로그·고정 번호) | `VERIFICATION_CODE`(`PHONE`) | 없음 | ✅ (FP-219, PR #89) |
| AUTH-15 | `POST /api/auth/phone/verify` | N-02-3 휴대폰 인증번호 확인 `{ phone, code, purpose }` → `{ verificationToken }` (10분, AUTH-06 `phoneVerificationToken`에 넣음) | `VERIFICATION_CODE`(`PHONE`) | 없음 | ✅ (FP-219, PR #89) |

- `user` = `{ userId, name, role, jobType, hasScore }`. AUTH-11·12의 토큰 필드 이름은 `token`(AUTH-01은 `accessToken`), 화면은 둘 다 받는다.
- AUTH-13~15 요청·응답·오류 상세는 [A팀 명세서](api_spec_a.md) 1장. 휴대폰 번호는 원문 없이 HMAC과 인증번호 해시만 저장한다.

### 2-2. 마이페이지 — 담당 우찬 (FP-77)

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| MEM-01 | `GET /api/members/me/profile` | N-04-1 내 정보 조회 (마스킹) | `APP_USER` | USER | ✅ |
| MEM-02 | `POST /api/members/me/profile/unmask` | N-04-2 마스킹 해제 | `APP_USER` | USER | ✅ |
| MEM-03 | `PUT /api/members/me/email` | N-04-3 계정 관리 (이메일 변경, N-02-3 재인증) | `APP_USER`, `VERIFICATION_CODE` | USER | ✅ |
| MEM-04 | `PUT /api/members/me/password` | N-04-3 계정 관리 (비밀번호 변경) | `APP_USER` | USER 전용 | ✅ |
| MEM-05 | `PATCH /api/members/me/job-type` | N-05-1 직군 선택 (입력 저장 전에는 다시 고를 수 있음. 같은 직군이면 200, 저장한 입력이나 평가가 있으면 409 `JOB_TYPE_LOCKED`, 그사이 다른 요청이 먼저 바꿨으면 409 `JOB_TYPE_ALREADY_SELECTED`) 🆕 11/20 | `APP_USER`, `USER_ASSET_SNAPSHOT`·`ASSESSMENT`(잠금 판단에 읽기만) | USER | ✅ |
| MEM-06 | `GET /api/members/me/diagnoses` | N-04-6 진단 내역 조회 | `ASSESSMENT` | USER | ✅ **구현됨 (FP-142, 실제 연결 확인 11/16)** (응답 상세: B팀 명세서 3-4) |
| MEM-07 | `DELETE /api/members/me` | N-04-7 회원 탈퇴 `{ password }` — 상태 `WITHDRAWN`·개인정보 덮어쓰기, 소셜 연결·인증 기록·동의로 불러온 데이터 삭제, 직접 입력·평가는 보관. 간편 로그인 전용 계정은 토큰 발급 10분 이내로 확인(넘으면 403 `RECENT_LOGIN_REQUIRED`) | `APP_USER`, `USER_*`, `SYSTEM_LOG` | USER | ✅ |
| MEM-08 | `PATCH /api/members/me/nickname` 🆕 11/23 | N-04-3 계정 관리 (닉네임 변경 `{ nickname }`, 규칙은 가입과 같음. 중복 확인은 AUTH-13. 같은 닉네임이면 400 `SAME_NICKNAME`, 다른 회원이 쓰면 409 `DUPLICATE_NICKNAME`) | `APP_USER` | USER | ✅ (FP-222) |

- [게시판관리] 탭은 COMM-08·09(🟡, C팀 확정 대기)가 생기면 연결한다. 🆕 11/23

### 2-3. 데이터 입력 — 담당 우찬 (FP-75)

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| INP-01 | `GET /api/members/me/financial-input` | N-05-8 입력 완료 현황 (저장된 입력·완료 상태) | `USER_INCOME_MONTH`, `USER_LOAN`, `USER_ASSET_SNAPSHOT`, `USER_EXPENSE_ITEM` | USER | ✅ |
| INP-02 | `PUT /api/members/me/financial-input` | N-05-2 직군별 소득 입력, N-05-3 대출(기존 부채) 입력, N-05-4 자산 입력, N-05-5 지출 입력, N-05-7 입력값 검사·저장 | 위와 같음 | USER | ✅ |
| INP-03 | `POST /api/members/me/alt-data/{source}/import` | N-05-6 대안 데이터 모의 연동 | `USER_TELECOM_PAYMENT`, `USER_UTILITY_PAYMENT`, `USER_EASYPAY_USAGE`, `USER_SOCIAL_INSURANCE_PAYMENT`, `USER_LOAN`(IMPORTED) | USER | ✅ (`utility` 추가 완료) |
| INP-04 | `GET /api/members/me/consents` | N-05-9 대안 데이터 정보 제공 동의 (조회) | `USER_CONSENT` | USER | ✅ |
| INP-05 | `POST /api/members/me/consents` | N-05-9 대안 데이터 정보 제공 동의 (항목별 동의) | `USER_CONSENT` | USER | ✅ |
| INP-06 | `DELETE /api/members/me/consents/{consentId}` | N-05-9 대안 데이터 정보 제공 동의 (철회 = [연결 해제]) | `USER_CONSENT`(`WITHDRAWN_AT`) | USER | ✅ |

- INP-02 요청 세부(A팀 명세 3장)
  - `income` = `{ incomeType, monthlySalary, items: [{ month, amount }] }` (급여소득자 1달, 그 외 12달)
  - `loans` = `{ items: [{ loanTypeCode, balanceAmount, annualRatePercent, rateType, monthlyPaymentAmount, remainingMonths }], noItems }` — **필드 변경 `sectorCode` → `loanTypeCode`**(`DIM_LOAN_TYPE` 6개), 금리 0~20, `remainingMonths` 필수(0 허용), `noItems: true` → `NO_LOAN_YN = 'Y'`
  - `creditProfile` = `{ cardLimitAmount, cardMonthlySpendAmount, delinquencyCount12m, cashAdvanceMonths, newLoanCount3m, privateLenderLoanBalanceAmount, noCreditHistory }` → `USER_CREDIT_PROFILE`(MANUAL)
  - `assets` 4칸 → 자산 4종을 각각 저장하고 합계도 `TOTAL_ASSET_AMT`에 저장(DDL C13, 모두 비면 NULL). 다시 열면 4종이 그대로 돌아오고, C13 전에 저장한 행만 `otherAmount`에 총자산이 들어감 🆕 11/20
  - `otherExpenses` category에 `INSTALLMENT`(할부) 추가
- INP-03 세부(A팀 명세 3장)
  - `source`: `easypay`, `telecom`, `national-pension`, `health-insurance`, `utility`
  - 원천: `docs/spec/sql/dummy_db/external_api/*.jsonl`(설정 `avenue.altdata.source-dir`). 파일에 없는 회원은 `avenue.altdata.missing-member-mode`로 `EMPTY`(0건 + notice, 기본) 또는 `BORROW`(같은 직군 예시 + notice)
  - 다시 불러오면 같은 동의의 이전 행을 교체한다. 동의 저장 값: `REQUIRED_YN 'N'`, `TERMS_VERSION 'DEV-0.2'`, 만료 365일
- ⚠️ DDL v0.3.2 W3: 불러온 데이터(`SOURCE_CODE = IMPORTED`)는 `CONSENT_ID`가 꼭 있어야 한다. 그래서 INP-03은 해당 항목의 동의가 있어야 성공한다.
- ✅ 11/12 결정: 점수 산출에 **필수인 동의는 대안 데이터 5개**다. 통신 `TELECOM_BILL`, 공과금 `UTILITY_BILL`, 간편결제 `EASYPAY`, 국민연금 `NATIONAL_PENSION`, 건강보험 `HEALTH_INSURANCE`
  - 대출(`financial/LOANS`)은 선택이다. 대출이 없으면 화면에서 "해당 없음"을 고르고 `USER_ASSET_SNAPSHOT.NO_LOAN_YN = 'Y'`로 저장한다(O-15 A안).
  - 신용평가사(`credit-bureau/CREDIT_PROFILE`)는 1차에 쓰지 않는다. 카드·신용 정보는 회원이 직접 입력해 `USER_CREDIT_PROFILE`(`SOURCE_CODE = MANUAL`)에 저장한다.

### 2-4. 신용 리포트·점수 — Spring 담당 범영 (✅ 11/12 확정, FP-142), 화면 경환 (FP-76)

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| RPT-01 | `POST /api/members/me/score-calculation` | N-12-2 기존·대안 점수·3등급 계산·저장 | `ASSESSMENT`, `ASSESSMENT_FACTOR` | USER | ✅ **구현됨 (FP-142, 실제 연결 확인 11/16)** (요청 `{ requestId }` 필수·소문자 UUID, 화면도 이렇게 보냄. 응답: B팀 명세서 3-1. 입력·동의가 덜 차면 409 `INPUT_INCOMPLETE`, O-13 확정. 통신비·공과금 기록 0건이면 200 `NOT_SCORABLE` + `ALT_DATA_EMPTY`, PR #62) |
| RPT-02 | `GET /api/report/me` | N-12-1 저장 데이터 조회, N-12-3 점수 차이·등급 변화 계산, N-12-6 점수·등급 비교 표시, N-12-7 부도 확률 표시, N-14 영역별 영향도(SHAP) | `ASSESSMENT`, `ASSESSMENT_FACTOR`, `DIM_FEATURE`, `SCORE_GRADE_BAND` | USER | ✅ **구현됨 (FP-142, 실제 연결 확인 11/16)** 경로 / 🟡 응답 (B팀 명세서 3-2) |
| RPT-03 | `GET /api/report/{requestId}` | N-04-6 진단 내역 조회 (지난 평가 1건 상세) | 위와 같음 | USER | ✅ **구현됨 (FP-142, 실제 연결 확인 11/16)** (B팀 명세서 3-3) |
| RPT-04 | `POST /api/report/{requestId}/ai-summary` | N-12-5 AI 결과 요약 요청, N-31-2 AI 요약 생성·저장 | `ASSESSMENT.AI_SUMMARY` | USER | ✅ 담당 광희 (FP-181, C팀 명세서 N-31-2) 🆕 11/26 |
| RPT-05 | `GET /api/members/me/score-percentile` 🆕 11/23 | N-13-1 저장 데이터 조회, N-13-2 같은 직군·연령대·직군+연령대 점수 조회, N-13-3 상위 n%·평균 대비 차이 계산. 집계 기준은 ADM-03과 같음(ACTIVE 모델의 회원별 최근 SCORED 평가, 탈퇴 제외), 5명 미만 집단은 값 숨김. 내 점수가 없으면 404 `ASSESSMENT_NOT_FOUND` 🆕 11/23 | `ASSESSMENT`, `APP_USER` 🆕 11/23 | USER | ✅ 담당 동주 (FP-251, C팀 명세서 N-13) 🆕 11/23 |

### 2-5. 재무 진단 — 담당 동주·광희

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 담당 | 상태 |
|---|---|---|---|---|---|---|
| DIAG-01 | `GET /api/members/me/peer-benchmark` 🆕 11/20 | N-15-2 동년배 기준값 조회 (같은 직군·같은 연령대 회원 평균, 11/19 팀 결정으로 공공통계 대신 회원 표) | `APP_USER`, `USER_INCOME_MONTH`, `USER_ASSET_SNAPSHOT`, `USER_LOAN` 🆕 11/20 | USER | 동주 (FP-160) | ✅ |
| DIAG-02 | `GET /api/finance/peer-benchmark/all` | N-15-3 나와 평균 비교 막대 | — | USER | 동주 | ⛔ 만들지 않음 — 화면은 DIAG-01 `sameWorkerType`을 쓴다 🆕 11/20 |
| DIAG-03 | `POST /api/diagnosis/financial-health/calculate` | N-16-1 건전성 지표 계산, N-16-2 위험 단계 판정, N-16-3 값 바꿔 보기 (요청 본문 `{ totalAsset, annualIncome, totalDebt, annualDebtService }`로 계산, DB 안 읽음) | — | USER | 광희 (FP-166) | ✅ |
| DIAG-03-1 | `GET /api/members/me/financial-health` 🆕 11/20 | N-16-1·2·4 저장값 조회: 총자산·연소득·총부채·연 원리금·보유 대출 목록 (로그인 회원 본인, 미입력은 null). 비율·위험 단계는 이 값으로 DIAG-03을 부른다 | `USER_INCOME_MONTH`, `USER_ASSET_SNAPSHOT`, `USER_LOAN`, `DIM_LOAN_TYPE` | USER | 광희 (FP-239) | ✅ |
| DIAG-04 | `GET /api/members/me/scenario-base`, `POST /api/members/me/scenario-recalculate` 🆕 11/20 | N-17-1 기준월 대출 `loanItems[]`(잔액 `balanceAmount` 포함), N-17-2~5 재계산 응답에도 현재 대출 `loanItems[]` 추가(11/26). 상환 여력을 다시 계산한다(점수 안 구함, 저장 안 함). 옛 경로 `POST /api/diagnosis/scenario/recalculate`(프론트 mock만 있던 것)를 대신한다 | `USER_INCOME_MONTH`, `USER_EXPENSE_ITEM`, `USER_LOAN`, `USER_ASSET_SNAPSHOT`, `FACT_POLICY_RATE` | USER | 광희 (FP-167) | ✅ (PR #118) |
| DIAG-05 | `GET /api/finance/policy-rates` | N-17-2 시나리오 입력 (기준금리) | `FACT_POLICY_RATE` | USER | 동주 | ⛔ 만들지 않음 — 기준금리는 `GET /api/members/me/scenario-base`의 `policyRate`(광희 FP-167, 원천 `FACT_POLICY_RATE` 동주 FP-153)로 받는다 🆕 11/20 |
| DIAG-06 | `POST /api/diagnosis/dsr/calculate` | N-20-4 DSR 계산·위험 단계 (요청 본문 `{ annualIncome, annualDebtService }`) | — | USER | 광희 (FP-166) | ✅ |
| DIAG-07 | `POST /api/diagnosis/income-volatility` | N-22-3 변동성 지표 계산(월 소득 표준편차 `standardDeviation` 포함), N-22-4 성수기·비수기 소득 격차 계산, N-22-5 소득 부족 달 확인 (요청 본문으로 계산, DB 안 읽음) | — | USER | 광희 (FP-203) | ✅ |
| DIAG-07-1 | `GET /api/members/me/income-volatility` 🆕 11/20 | N-22-1 저장 데이터 조회 + N-22-3·4·5 (로그인 회원 본인, **화면이 쓰는 쪽**) | `USER_INCOME_MONTH`, `USER_EXPENSE_ITEM` | USER | 광희 (FP-203) | ✅ |
| DIAG-08 | `POST /api/diagnosis/cash-flow/forecast` | N-21-5 현금흐름 전망 계산, N-21-6 최근 12개월 적자 개월 수 계산, N-21-7 성수기·비수기 소득 격차 계산 (화면 이름: 가장 많이 번 달과 적게 번 달의 차이 🆕 11/26), N-21-9 과거 월 실적 `months[]`(요청의 `past12MonthsHistory`를 같은 모양으로 돌려줌) (요청 본문으로 계산, DB 안 읽음) | — | USER | 광희 (FP-203) | ✅ |
| DIAG-08-1 | `GET /api/members/me/cash-flow-forecast` 🆕 11/20 | N-21-1 저장 데이터 조회 + N-21-2 전망 조건(쿼리, `incomeVariationPct`·`fixedExpenseAmount`·`paymentStatus` 추가) + N-21-5·6·7 + N-21-9 과거 월 실적 `months[]`(최대 12개) + 🆕 11/26 기준값 항목별 내역 `baseOtherExpenseItems[]`(기타 지출)·`baseLoanItems[]`(대출별 월 원리금) (로그인 회원 본인, **화면이 쓰는 쪽**) | `USER_INCOME_MONTH`, `USER_EXPENSE_ITEM`, `USER_LOAN` | USER | 광희 (FP-203) | ✅ |
| DIAG-09 | `POST /api/members/me/cash-flow-expected-score` 🆕 11/20 | N-21-8 예상 대안 점수 재계산 (FastAPI ML-03을 ACTIVE 모델로 1번 호출, 저장 안 함 — O-6 확정). 응답 `expectedScore`·`scoreDiff`·`modelVersion`·`baseModelVersion`. 🆕 11/20 밀림 반영: `paymentStatus=DELAYED`면 최근 1년 30일 이상 연체(`DQ1200001`)를 +1로 가정, 응답 `assumedDelinquencyCount`(넣은 건수) 추가, `paymentStatusApplied`는 DELAYED일 때 `true`. 🆕 11/23 통신비·공과금 기관 기록이 없으면 409 `ALT_DATA_EMPTY` | 읽기만 (`ASSESSMENT` 최근 SCORED, 입력 표) | USER | 광희 (FP-170, 밀림 FP-239) | ✅ (PR #93) |
| ~~DIAG-10~~ | ~~`GET /api/commercial/dongs/{admDongCode}`~~ | N-24-2 소상공인 상권 분석, N-24-3 상권 분석 차트, N-24-5 행정동 상세 창 | — (상권 표 5개는 DDL에서 제거, 11/14) | USER | C조 | ⛔ **API 만들지 않음** — 화면이 정적 JSON(`frontend/public/data/market/`)을 읽는다(N-24 결정) |
| ~~DIAG-11~~ | ~~`GET /api/commercial/heatmap`~~ | N-24-4 상권 공간 시각화 (지도 히트맵) | 위와 같음 | USER | C조 | ⛔ 위와 같음 |

- C팀(광희) API의 요청·응답 상세와 오류 문구는 [api_spec_c.md](api_spec_c.md)에 있다.
- DIAG-08-1 화면 조건이 범위 밖이면 400 `INVALID_INPUT`(`fieldErrors[0].field` = 쿼리 이름). `paymentStatus`는 DIAG-08-1에서는 값만 검사하고 계산에 쓰지 않는다. 🆕 11/20 DIAG-09는 '밀림'(`DELAYED`)이면 최근 1년 30일 이상 연체 +1로 예상 점수를 구한다(경환 제안, 범영 동의, FP-239). 화면 문구는 "최근 1년 30일 이상 연체 1회 추가로 가정".
- `/api/income`이 프론트 코드에 1번 나온다. 어느 기능의 경로인지 확인이 필요하다.
- DIAG-07-1·08-1·09와 SIM-01·02는 공통 규칙(1장)대로 `/api/members/me/**`에 있다(광희 PR #103, 우찬 합의). 로그인 확인은 보안 설정이 하며 토큰이 없으면 401, 관리자 계정은 403이다. 옛 경로(`/api/diagnosis/income-volatility` GET 등)는 지웠고, 요청 본문만 쓰는 POST(DIAG-03·06·07·08)는 `/api/diagnosis/**`에 그대로 있다. 🆕 11/20
- DIAG-07-1·08-1 저장 데이터 규칙: 기준월 = `USER_INCOME_MONTH`의 가장 늦은 `BASE_MONTH`(DDL 11/10 결정). 지출·대출도 같은 달 값을 쓴다(그 달에 행이 없으면 0). 급여소득자는 월급 1행을 12개월로 펼친다.
- DIAG-08·08-1 예측 기간 `forecastMonths`는 3·6·12개월만 받는다(없거나 0이면 6, 그 밖은 400). 전망은 마지막 입력월 다음 달부터 시작한다.
- 상환 부담률(N-16-1)과 DSR(N-20-4)은 함수 하나를 함께 쓴다(`FinancialHealthCalculator.calculateRepaymentBurdenRatio`). 위험 단계는 기준 **이상**이면 그 단계다: DSR 30/40, 자산 대비 부채 40/60, 순자산 대비 부채 70/100. N-21-7과 N-22-4의 성수기·비수기 격차도 함수 하나를 함께 쓴다(`IncomeVolatilityCalculator.calculatePeakOffPeakGap`).
- DIAG-03 POST는 `totalAsset`을 보내지 않으면 0으로 계산한다(DDL은 NULL = 미입력). 미입력과 0의 구분은 DIAG-03-1에서 한다.

### 2-6. 신용케어 시뮬레이터 — 담당 광희 (FP-168·FP-170), 화면 경환 (FP-76)

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| SIM-01 | `GET /api/members/me/credit-care-base` 🆕 11/20 | N-18-1 저장 데이터 조회, N-18-10 내 실제 값으로 되돌리기 (입력 10개의 원래 값과 출발 점수·등급. 피처값 전체는 보내지 않음) | `ASSESSMENT`(최근 SCORED의 `FEATURE_SNAPSHOT`), `USER_CREDIT_PROFILE`(카드 한도·월 사용액 — 피처값에는 사용률만 있어 그 평가 기준월의 직접 입력에서 읽음 🆕 11/20) | USER | ✅ (FP-170, PR #93) |
| SIM-02 | `POST /api/members/me/credit-care-recalculate` 🆕 11/20 | N-18-4 공통 재계산 틀, N-18-5 모델 점수 재계산, N-18-6 부도 확률 변화 계산, N-18-8 감점 요인 상위 3개 안내, N-18-9 결과 표시 | 읽기만 (FastAPI **ML-04** 호출) | USER | ✅ (FP-170, PR #93) |
| ~~SIM-03~~ | ~~`GET`·`POST /api/simulation/loans/recommend`~~ | N-18-7 같은 점수대 금리·한도·상품 조회 | — | USER | ⛔ **만들지 않음** — 화면이 SIM-04(점수대 금리·한도)와 LOAN-01(상품 목록)을 합쳐 대신한다(경환 FP-90) 🆕 11/20 |
| SIM-04 | `GET /api/simulation/score-band-offer?score=` | N-18-7 같은 점수대 참고 금리·한도·등급 (상품 없음, 더미 데이터 표시 `dummyNotice`) | `SCORE_BAND_OFFER`, `SCORE_GRADE_BAND` (ACTIVE 버전) | USER | ✅ (FP-208) |

- ✅ **11/17 해결 (광희, PR #78):** 이전 판의 "⚠️ SIM-02 mock과 DDL이 다른 점"을 모두 고쳤다.
  1. 점수를 300~900으로 자르던 것 → **0~1000**
  2. 화면이 현재 점수(`currentScore`)를 보내던 것 → **보내지 않는다.** 요청은 `{ changes }`뿐이고, 서버가 저장된 최신 평가의 `FEATURE_SNAPSHOT`·`MODEL_VERSION`을 출발점으로 쓴다.
  3. `altDataBonusDiff` → **삭제.** FastAPI와 같은 `delta.financialEffect`·`delta.alternativeEffect`를 쓴다.
  4. 바꿀 수 있는 입력은 10개로 확정(공과금 미납 개월 수 `UTILITY_LATE_MONTHS` 포함, 11/17 범영). 통신비 정시 납부 범위는 0~12개월이다(B팀 명세서 4-4, 11/20 범영·광희 확정).
- ✅ 11/17 광희 확인: SIM-02는 ML-04 규칙(10개 키, 모르는 키 422, 카드 한도·사용액 함께, 바뀌지 않은 값은 보내지 않음)에 맞춰 처음부터 만든다. ML-04 422의 `fieldErrors`는 공통 `INVALID_INPUT`으로 바꿔 화면에 전달한다.
- ✅ 11/17 범영 결정: **입력 범위 검사는 Spring SIM-02가 화면 범위로 먼저 한다.** FastAPI ML-04는 지금 범위를 검사하지 않고 그대로 계산한다(소수는 정수로 자름).
- SIM-02 범위: 10개 키 모두 0 이상 정수, `TELECOM_ON_TIME_MONTHS`·`UTILITY_LATE_MONTHS`는 0~12. ~~나머지 상한은 화면 슬라이더 범위가 정해지면 추가한다.~~ `DELINQ_COUNT_12M` 0~6, `CASH_ADVANCE_MONTHS` 0~10, `NEW_LOAN_COUNT_3M` 0~4, `EASYPAY_MONTHLY_COUNT` 0~60이며 상한 초과는 400 `INVALID_INPUT`(각 필드 "0~N 사이로 입력해 주세요.")이다 🆕 11/25. `EASYPAY_MONTHLY_COUNT`는 **월 횟수 그대로** 보낸다. 🟡 FastAPI ML-04가 지금은 × 12로 12개월 값을 만들지만, 변환 방식은 피처 정의서 9장에서 아직 정하지 않았다(코드 TODO). `null`은 키를 뺀 것과 같다.
- SIM-02 응답 = ML-04 응답에서 `requestId`·`shap`을 빼고 감점 요인에 `featureName`을 더한다(그 평가의 `FEATURE_SET_VERSION`으로 `DIM_FEATURE` 조회. Mock `FS-DRAFT` 39개 / 실제 `FS-V1` 38개).
- SIM-02 오류 전달: ML-04 422 → 400 `INVALID_INPUT`, 503 `MODEL_NOT_READY` → 503, 409 `VERSION_MISMATCH` → 409(점수를 다시 산출하라는 안내), 연결 실패·타임아웃·그 밖의 5xx → 503 `MODEL_NOT_READY`. 시뮬레이터는 저장하지 않으므로 NOT_SCORABLE로 저장하지 않는다.
- SIM-04는 금리·한도·등급만 돌려주는 실제 API다. SIM-03은 만들지 않고, 시뮬레이터의 상품 추천은 화면이 SIM-04와 LOAN-01(대출 상품 목록, 경환 FP-90)을 합쳐 보여 준다. 🆕 11/20

### 2-7. 대출 상품 — 담당 경환 (FP-90, PR #101) 🆕 11/20

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| LOAN-01 | `GET /api/loan-products` | N-37-1 상품 목록·필터 | `LOAN_PRODUCT`, `LOAN_PRODUCT_WORKER_TYPE` | 로그인 | ✅ 🆕 11/20 |
| LOAN-02 | `GET /api/loan-products/{productCode}` | N-37-2 상품 상세 | `LOAN_PRODUCT`, `LOAN_PRODUCT_FEATURE` | 로그인 | ✅ (없으면 404 `PRODUCT_NOT_FOUND`) 🆕 11/20 |
| LOAN-03 | `GET /api/members/me/favorite-loan-products` | N-04-5 즐겨찾기한 대출 상품 | `LOAN_PRODUCT_FAVORITE` | USER | ✅ 🆕 11/20 |
| LOAN-04 | `PUT /api/members/me/favorite-loan-products/{productCode}` | N-37-3 상품 즐겨찾기 (추가) | `LOAN_PRODUCT_FAVORITE` | USER | ✅ 🆕 11/20 |
| LOAN-05 | `DELETE /api/members/me/favorite-loan-products/{productCode}` | N-37-3 상품 즐겨찾기 (해제) | `LOAN_PRODUCT_FAVORITE` | USER | ✅ 🆕 11/20 |

- 모든 상품 응답에 "더미 데이터 · 같은 점수대의 참고 정보" 표시용 `dummyYn`을 넣는다(AGENTS.md 5장).
- 요청·응답 상세는 [A팀 명세서](api_spec_a.md) 7장. LOAN-01·02는 로그인만 확인하고(관리자도 조회), LOAN-03~05는 `ROLE_USER`. 즐겨찾기 추가·해제는 같은 요청을 다시 보내도 200(멱등). 🆕 11/20
- LOAN-01·02는 내 점수·즐겨찾기 여부를 넣지 않는다. 화면이 리포트(점수)와 LOAN-03을 따로 불러 합친다. 🆕 11/20

### 2-8. 커뮤니티·신고 — 담당 동주 (FP-191)

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| COMM-01 | `GET /api/board/posts?page&size&keyword&filter&category` | N-06-1 글 목록·상세 조회 (목록, `page`는 1부터·기본 10개, `keyword`는 제목·본문 검색, 숨김 글은 검색 안 됨). `filter=mine`(선택)은 내 글만(숨긴 내 글 포함), 다른 값이면 무시, `totalCount`도 같은 조건. 늘 최신순(정렬 `sort`는 11/26 뺐다). `category`(선택)는 그 카테고리의 보이는 글만, 응답 글마다 `categoryCode`(숨긴 글은 null) 🆕 11/25 | `BOARD_POST`, `BOARD_COMMENT` | USER | ✅ (PR #80, 조건 추가 FP-279·카테고리 FP-261 🆕 11/25) |
| COMM-02 | `GET /api/board/posts/{postId}` | N-06-1 글 목록·상세 조회 (상세. 숨김이면 제목·내용 null + `hidden: true`). 응답에 `categoryCode`(숨김이면 null) 🆕 11/25 | `BOARD_POST`, `BOARD_COMMENT` | USER | ✅ (PR #80) |
| COMM-03 | `POST /api/board/posts` | N-06-2 글 작성 (제목 200자, **본문 1300자**). `categoryCode` 선택(없으면 `FREE`, 정해진 값이 아니면 400 `INVALID_INPUT`) 🆕 11/25 | `BOARD_POST`, `BOARD_POST_LOG` | USER | ✅ (PR #80) |
| COMM-04 | `PUT /api/board/posts/{postId}` | N-06-5 내 글 수정 (본문 1300자). `categoryCode` 선택(없으면 기존 값 유지) 🆕 11/25 | `BOARD_POST`, `BOARD_POST_LOG` | USER | ✅ (PR #80) |
| COMM-05 | `DELETE /api/board/posts/{postId}` | N-06-6 내 글 삭제 (`DELETED`, 미처리 신고는 남음. 신고로 숨겨진 글은 본인도 못 지움 409 `POST_HIDDEN` 🆕 11/25) | `BOARD_POST`, `BOARD_POST_LOG` | USER | ✅ (PR #80, 숨김 규칙 변경 FP-280 🆕 11/25) |
| COMM-06 | `GET`·`POST /api/board/posts/{postId}/comments` | N-06-3 댓글 작성·조회 (1000자) | `BOARD_COMMENT` | USER | ✅ (PR #80) |
| COMM-07 | `POST /api/reports` | N-06-4 신고하기 진입, N-33-1 신고 접수, N-33-2 기준 건수 자동 숨김 (본인 글 불가, 같은 대상 중복 불가, 하루 3번, '기타'만 상세 500자) | `CONTENT_REPORT`, `APP_SETTING` | USER | ✅ (PR #80) |
| ~~COMM-08~~ | ~~`GET /api/members/me/posts?page&size`~~ | 마이페이지 [게시판관리] 내가 쓴 글 목록 | — | USER | ⛔ 만들지 않음 — 게시판관리 탭을 쓰지 않기로 했고(A조 합의), 내 글은 COMM-01 `filter=mine`이 준다 🆕 11/25 |
| COMM-09 | `GET /api/members/me/comments?page&size&keyword&category` | 신용 라운지 [내가 쓴 댓글] 탭 목록 (N-06, 세부 N-ID 미정). 본인 댓글만 최신순, 삭제 댓글과 삭제된 글의 댓글 제외. `page`·기본 개수는 COMM-01 규칙(1부터, 기본 10개). `keyword`(선택)는 보이는 댓글의 내용이나 보이는 글의 제목에서 찾고, `category`(선택)는 그 카테고리의 보이는 글에 쓴 댓글만. 응답 `{ items: [{ commentId, postId, categoryCode, postTitle, postNickname, content, createdAt, hidden }], page, size, totalCount }` — `postNickname`은 글을 쓴 회원, `createdAt`은 댓글 쓴 시각. 숨김 댓글은 `content` null + `hidden: true`, 숨김 글의 댓글은 `categoryCode`·`postTitle`·`postNickname` null 🆕 11/25 | `BOARD_COMMENT`, `BOARD_POST` | USER | ✅ 동주 (FP-279) 🆕 11/25 |
| COMM-10 | `PUT /api/board/posts/{postId}/comments/{commentId}` | N-06 내 댓글 수정 (세부 N-ID 미정). 요청 `{ content }`(1000자), 응답 `{}`. 남의 댓글 403 `NOT_OWNER`, 댓글 없음·다른 글의 댓글 404 `COMMENT_NOT_FOUND`, 숨긴 글 409 `POST_HIDDEN`, 숨긴 댓글 409 `COMMENT_HIDDEN`, 그사이 상태 바뀜 409 `STATUS_CHANGED` 🆕 11/25 | `BOARD_COMMENT`, `BOARD_POST`(읽기) | USER | ✅ 동주 (FP-280) 🆕 11/25 |
| COMM-11 | `DELETE /api/board/posts/{postId}/comments/{commentId}` | N-06 내 댓글 삭제 (세부 N-ID 미정). 행은 남기고 상태만 `DELETED`, 응답 `{}`. 오류는 COMM-10과 같음 🆕 11/25 | `BOARD_COMMENT`, `BOARD_POST`(읽기) | USER | ✅ 동주 (FP-280) 🆕 11/25 |

- 게시글 본문은 DDL C9로 `CLOB` → `VARCHAR2(1300 CHAR)`(PR #80). 기존 DB는 `docs/spec/sql/alter_board_post_content_varchar2.sql`. 공용 DB는 11/18 적용 완료(범영). CLOB 상태의 DB에서도 글쓰기·검색·수정·삭제가 동작하는 것을 11/17 로컬에서 확인했다.
- 글 카테고리(`BOARD_POST.CATEGORY_CODE`, DDL C15): `CREDIT_SCORE` 신용점수, `LOAN` 대출·상환, `CARD` 카드·결제, `FREE` 자유(기본값). 기존 DB는 `docs/spec/sql/alter_board_post_category.sql`을 실행해야 라운지가 열린다. 🆕 11/25
- 탈퇴 회원 글은 그대로 두고 작성자만 "탈퇴한 회원"으로 표시한다. 알림(D-25)은 넣지 않았다.
- 신고로 숨겨진 글·댓글은 작성자도 수정·삭제할 수 없고 관리자만 처리한다(ADM-13). 반려로 숨김이 풀리면 다시 고치거나 지울 수 있다. 숨기기 전 평상시에는 신고가 들어와 있어도 본인이 고치거나 지울 수 있다. 🆕 11/25

### 2-9. 도움말·AI — 담당 광희 (FP-179)

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| HELP-01 | `GET /api/glossary` | N-30-1 용어 사전 데이터, N-30-2 쉬운 말로 바꾸기 | `GLOSSARY_TERM` | USER | ✅ FP-180 PR #108 🆕 11/20 |
| HELP-02 | `GET /api/chatbot/presets` | N-32-1 질문 버튼 방식 설명, 오늘 남은 자유 질문 횟수(`remainingCount`·`dailyLimit`) 🆕 11/26 | `CHATBOT_PRESET_QUESTION`, `CHATBOT_QUESTION_LOG`, `APP_SETTING` | USER | ✅ FP-181 🆕 11/23 |
| HELP-03 | `POST /api/chatbot/questions` | N-32-2 자유 질문 AI 설명 (하루 10회, 질문 글은 저장 안 함) | `CHATBOT_QUESTION_LOG`, `APP_SETTING` | USER | ✅ FP-181 🆕 11/26 |

- 서비스 AI는 OpenAI다(decisions.md 1-1, 🆕 11/26 Gemini에서 변경). AI 요약(RPT-04)에는 계산된 숫자·라벨만 넘긴다. 자유 질문(HELP-03)에는 사용자가 쓴 질문 글만 넘긴다(AGENTS.md 5장, D-21).

### 2-9-1. 알림 — 담당 경환 (FP-284) 🆕 11/27

| ID | 메서드 · 경로 | 기능 | 주요 표 | 인증 | 상태 |
|---|---|---|---|---|---|
| NOTI-01 | `GET /api/members/me/notifications` | 알림 목록(최신 20건, `unreadOnly`·`type`·`before` 선택, `size` 기본 20·최대 50)·전체 안 읽은 개수 `unreadCount`·다음 페이지 여부 `hasMore` (D-23, 11/27) | `USER_NOTIFICATION` | USER | ✅ 🆕 11/27 |
| NOTI-02 | `PATCH /api/members/me/notifications/{notificationId}/read` | 알림 읽음 처리(본인 것만, 이미 읽었으면 그대로 200, 남의 것·없는 번호는 404 `NOT_FOUND`) | `USER_NOTIFICATION` | USER | ✅ 🆕 11/27 |
| NOTI-03 | `PATCH /api/members/me/notifications/read-all` | 안 읽은 알림 모두 읽음 처리, 응답 `updatedCount` | `USER_NOTIFICATION` | USER | ✅ 🆕 11/27 |
| NOTI-04 | `GET /api/members/me/notifications/stream` | 새 알림 SSE 스트림(`text/event-stream`). 이벤트: `connected`(연결 직후), `notification`(알림 1건, NOTI-01 항목과 같은 모양), 25초마다 `ping` 주석. 로그인은 `Authorization` 헤더(화면은 `fetch` 스트림으로 읽음). 연결 30분 제한·회원당 5개 상한(넘으면 가장 오래된 것 종료). 끊기면 화면이 목록을 다시 불러온다 | `USER_NOTIFICATION` | USER | ✅ 🆕 11/27 |

- 알림 종류(`typeCode`)는 `SCORE_NEW`·`COMMENT_NEW`·`REPORT_RESULT`·`WELCOME`이고 `linkUrl`은 서비스 내부 경로만 담는다. 제목·내용에 개인정보 원문을 넣지 않는다.

### 2-10. 관리자

| ID | 메서드 · 경로 | 기능 | 주요 표 | 담당 | 상태 |
|---|---|---|---|---|---|
| ADM-01 | `GET /api/admin/model-performance?group=LEGACY\|THINFILE&label=DELINQ\|NONFIN&cutoff=600~800` 🆕 11/20 | N-25-1 비교 조건 선택, N-25-2 성능 지표 재계산·비교 표, N-25-4 직군별 우량 고객 오거절률 | `MODEL_EVAL_SAMPLE`(평가 표본 3,085건, PR #99 🆕 11/20), `MODEL_ARTIFACT`(같은 라벨 AUC `METRICS_JSON.same_label_comparison`, PR #98 🆕 11/20) | 동주 (FP-184) 🆕 11/20 | ✅ ACTIVE 모델(지금 `LGBM-BASE-0.2`) 기준 🆕 11/20 |
| ADM-02 | `GET /api/admin/model-performance/roc?group=…&label=…` 🆕 11/20 | N-25-3 ROC 곡선 | 위와 같음 | 동주 (FP-184) 🆕 11/20 | ✅ 🆕 11/20 |
| ADM-03 | `GET /api/admin/stats?groupBy=WORKER_TYPE\|AGE_BAND` 🆕 11/20 | N-26-1 구분 선택(직군별·연령대별), N-26-2 요약 수치(평가 고객 수·평균 기존·대안 점수·상승폭·Standard 이상 비율 기존·대안·가입 회원 수·오늘 산출), N-26-3 기존·대안 등급 분포, N-26-4 그룹별 통계 표(🆕 11/23 기존 모델 등급 값 추가). 서비스 회원이 ACTIVE 모델로 낸 최근 SCORED 평가(🆕 11/23 ACTIVE가 아닌 모델의 평가 제외), 탈퇴 회원 제외, 값마다 계산 인원 5명 미만이면 숨김(D-26·D-28 담당자 결정) | `ASSESSMENT`, `APP_USER` | 광희 (FP-161) 🆕 11/20 | ✅ 🆕 11/20 |
| ADM-04 | `GET /api/members/me/group-comparison` 🆕 11/23 | N-26-5 비교 분석 화면 (사용자), N-26-6 직군 × 연령 격자·선택한 집단, N-26-7 직군별·연령별 비교. 전체·직군 3·연령대 4·격자 12칸과 내 평가(`me`)를 한 번에 준다. 집계 기준은 ADM-03과 같다(ACTIVE 모델 최근 SCORED 평가, 탈퇴 제외, 값마다 5명 미만 숨김, 11/23 동주 합의). 일반 회원만(Q-8 경로) | `ASSESSMENT`, `APP_USER` | 광희 (FP-164) 🆕 11/23 | ✅ 🆕 11/23 |
| ADM-05 | `GET /api/admin/users?q&role&status&page&size` | N-27-1 계정 목록 조회·검색 (size 최대 100) | `APP_USER` | 경환·우찬 (FP-80) | ✅ |
| ADM-06 | `PATCH /api/admin/users/{userId}/lock` | N-27-3 회원 계정 잠금 `{ locked, reason }` (잠글 때 reason 필수, 본인·탈퇴 409) | `APP_USER` | 경환·우찬 | ✅ |
| ADM-07 | `POST /api/admin/admins` | N-27-4 관리자 계정 추가 (임시 비밀번호), `X-Step-Up-Token` 필요 | `APP_USER` | 경환·우찬 | ✅ |
| ADM-07-1 | `POST /api/admin/admins/{userId}/temporary-password` | 관리자 임시 비밀번호 재발급 (`X-Step-Up-Token`, 본인 불가, 화면 버튼 없음) | `APP_USER` | 경환·우찬 | ✅ (새 경로) |
| ADM-08 | `POST /api/admin/users/{userId}/credit-data` | N-35-1 열람 사유 입력·권한 검증, N-35-2 감사 로그 자동 저장 (POST: 사유를 본문으로 받는다, 감사 로그 먼저 저장 `MEMBER_DETAIL`) | `ACCESS_AUDIT_LOG`, `ASSESSMENT`, `USER_*` | 경환·우찬 | ✅ |
| ADM-09 | `GET /api/admin/access-logs` | N-28-2 로그 조회 (열람 감사 로그) | `ACCESS_AUDIT_LOG` | 경환·우찬 | ✅ |
| ADM-10 | `GET /api/admin/system-logs` | N-28-1 로그 기록, N-28-2 로그 조회 (시스템 로그, P4, type: AUTH·INFO·WARN) | `SYSTEM_LOG` | 경환·우찬 | ✅ |
| ADM-ME-1 | `POST /api/admin/me/step-up/send` | 관리자 재확인 인증번호 발송 (1분 1번) | `VERIFICATION_CODE` | 경환·우찬 | ✅ (새 경로) |
| ADM-ME-2 | `POST /api/admin/me/step-up/verify` | 재확인 → `{ stepUpToken, expiresIn }` (5분·1회용) | — | 경환·우찬 | ✅ (새 경로) |
| ADM-ME-3 | `PUT /api/admin/me/password` | 관리자 비밀번호 변경 (`X-Step-Up-Token`) | `APP_USER` | 경환·우찬 | ✅ (새 경로) |
| ADM-11 | `GET /api/admin/reports?status&reason&from&to` | N-34-1 신고 목록·필터 (신고 **대상 단위**로 묶음) | `CONTENT_REPORT` | 동주 (FP-191) | ✅ (PR #80) |
| ADM-12 | `GET /api/admin/reports/{reportId}` | N-34-2 신고 상세 (신고자 닉네임은 가림, 지운 글은 '삭제됨') | `CONTENT_REPORT`, `BOARD_POST_LOG` | 동주 (FP-191) | ✅ (PR #80) |
| ADM-13 | `PATCH /api/admin/reports/{reportId}` | N-34-3 처리 결과 저장 (숨김 유지·삭제·반려. 같은 대상의 미처리 신고를 한 번에 닫는다) | `CONTENT_REPORT`, `BOARD_POST`, `BOARD_POST_LOG` | 동주 (FP-191) | ✅ (PR #80) |
| ADM-14 | `GET`·`PUT /api/admin/settings` | N-33-2 신고 자동 숨김 기준 (지금 바꿀 수 있는 키는 `REPORT_AUTO_HIDE_COUNT` 하나, 3~10, 기본 5) | `APP_SETTING` | 동주 (FP-191) | ✅ (PR #80) |

- 모든 `/api/admin/**`은 `ROLE_ADMIN` + `ACCESS` 토큰만 쓴다(N-27-2 역할별 접근 제한). `PASSWORD_CHANGE_REQUIRED_YN = Y`인 관리자는 403 `PASSWORD_CHANGE_REQUIRED`.
- 관리자 화면의 이름·이메일·휴대폰은 가린 값만. 복호화 실패는 "(복호화 불가)", 탈퇴 회원은 "(탈퇴 회원)". 시스템 로그 메시지의 아이디도 `qa***`처럼 가린다.
- N-25의 평가 표본은 API로 만들지 않고 적재 SQL로 넣는다(B팀): `create_model_eval_sample.sql` → `load_model_eval_sample_lgbm_base_0_1.sql`(PR #99, 공용 DB 11/20 적용). 서비스 회원 평가(`ASSESSMENT`)와 별개다. 🆕 11/20
- 두 모델 AUC는 라벨이 달라 그대로 비교하면 안 된다. 같은 라벨끼리의 값(`same_label_comparison`)으로 비교한다(피처 정의서 10장 C20, 재욱 11/18). 🆕 11/20

### 2-11. 내부 API: Spring → FastAPI (예측 서버) — 담당 범영 (FP-127·FP-140)

| ID | 메서드 · 경로 | 기능 | 호출하는 Spring API | 상태 |
|---|---|---|---|---|
| ML-01 | `GET /v1/health` | 서버·모델 준비 상태 (`modelLoaded`, `supportedModelVersions`) | 운영 점검 | ✅ **구현됨 (Mock FP-140 + 실제 모델 FP-141)** |
| ML-02 | `GET /v1/model-info` | 모델·피처셋·등급 구간 버전, 피처 목록 | Spring 시작 시 | ✅ **구현됨 (Mock FP-140 + 실제 모델 FP-141)** |
| ML-03 | `POST /v1/assessments/score` | N-12-2 점수·등급·확률·SHAP·피처값 계산 | RPT-01, DIAG-09(저장 안 함) | ✅ **구현됨 (Mock FP-140 + 실제 모델 FP-141)** |
| ML-04 | `POST /v1/assessments/simulate` | N-18-5 모델 점수 재계산, N-18-6 부도 확률 변화 계산, N-18-8 감점 요인 상위 3개 안내 | SIM-02 | ✅ **구현됨 (Mock FP-140 + 실제 모델 FP-141)** |

- FastAPI는 DB를 읽거나 쓰지 않는다. 저장은 Spring이 한다. 상세는 B팀 명세서 4장에 있다.
- **모델 선택 (PR #74):** Spring이 보내는 모델 버전(= DB `MODEL_REGISTRY`의 ACTIVE)으로 FastAPI가 계산기를 고른다. `DEV-DUMMY` → Mock(`FS-DRAFT` 39개), `LGBM-BASE-0.1` → 실제 모델(`FS-V1` 38개), 그 밖 → 409 `VERSION_MISMATCH`. 실제 모델 파일이 없으면 Mock으로 바꾸지 않고 503 `MODEL_NOT_READY`.
- **모델 파일 확인 (PR #77):** `fastapi_server/artifacts/SHA256SUMS.txt`가 있으면 서버가 켜질 때 모델 파일 해시를 대조하고, 다르면 열지 않는다. 공용 DB는 11/18 `LGBM-BASE-0.1`(FP-216, PR #88)에 이어 **11/20 `LGBM-BASE-0.2`로 전환**(FP-237, PR #110·#113) 🆕 11/20. `LGBM-BASE-0.3` 전환 SQL은 FP-285에서 추가했고 공용 DB 전환은 병합 뒤에 한다 🆕 11/27. `/v1/health`의 해시 확인 표시(`hashVerified`)는 2차 후보(FP-215).

### 2-12. 내부 연동: Spring → 가상 기관(mock 서버) — A팀

- 가상 금융·통신·공과금·간편결제·사회보험·신용평가사 API는 A팀 mock 서버가 맡는다. INP-03이 이 API들을 부른다.
- 신용평가사 응답 원문(207개 항목)은 DB에 저장하지 않는다(DDL R2). ✅ **1차 개발에는 신용평가사 조회를 하지 않는다.** 2차에 필요하면 ML-03의 `creditBureau` 필드로 추가한다.

---

## 3. 만들지 않는 API

| 기능 | 이유 |
|---|---|
| N-19 금융 이력·자산 이력 알림 | P3, DDL에 표 없음 (D-23 미정) |
| N-29 다국어 지원 | P3, DDL에 표 없음 |
| N-10 메인(홍보) 페이지 홍보 그래프 | P3, 고정 화면 |
| N-23 가산점, N-36 비회원 간이 예측 | 삭제된 기능 |
| N-24 상권 분석 API (DIAG-10·11) | 화면이 정적 JSON(`frontend/public/data/market/`)을 읽는다. 상권 표 5개는 DDL에서 제거(11/14, C조 결정) |
| (A팀) 관리자 2단계 인증의 이메일 외 수단(TOTP 등), 1회용 토큰 저장소(DB·Redis), `VERIFICATION_CODE.PURPOSE_CODE`에 `ADMIN_STEP_UP` 추가(DDL 제안) | 2차로 넘김 |
| (A팀) 금융(대출) 불러오기, 간편 로그인 재인증 화면, N-01-5 시연 계정 [채우기] 🆕 11/23 | 2차로 넘김 |

## 4. 담당 팀이 정해야 할 것

| # | 질문 | 누구 |
|---|---|---|
| ~~Q-1~~ | ~~RPT-01·02·03과 MEM-06의 Spring 구현 담당~~ ✅ **해결:** 범영 | — |
| ~~Q-2~~ | ~~INP-03에 `utility` 공과금 추가~~ ✅ **해결:** 추가 완료 | — |
| ~~Q-3~~ | ~~INP-04~06 동의 API 경로~~ ✅ **해결:** 구현 완료 | — |
| ~~Q-4~~ | ~~SIM-02 mock의 점수 범위, 출발점, 필드 이름~~ ✅ **해결:** PR #78에서 모두 고침(2-6) | — |
| ~~Q-5~~ | ~~RPT-05(N-13 백분위) 담당~~ ✅ **해결 🆕 11/23:** 동주(FP-251). ~~DIAG-03(N-16 건전성)~~ ✅ 광희(FP-166) | — |
| Q-6 | 🟡 경로 전체 확정 (각 담당) | 각 팀 |
| ~~Q-7~~ | ✅ 해결(🆕 11/20): 오류 응답 형식은 D-20 확정(1장 공통 형식), FastAPI 타임아웃은 설정값으로 분리(D-18, Gemini만 남음 → 🆕 11/26 OpenAI 연결 2초·응답 15초로 확정, FP-181) | 팀 전체 |
| ~~Q-8~~ | ~~DIAG-07-1·08-1 경로~~ ✅ **해결:** `/api/members/me/…`로 이동(광희 PR #103, 우찬 합의, SIM-01·02·DIAG-09 포함) 🆕 11/20 | — |
| ~~Q-9~~ | ~~SIM-03·대출 상품 담당~~ ✅ **해결:** 대출 상품 LOAN-01~05 경환(FP-90, PR #101), SIM-03은 만들지 않고 SIM-04 + LOAN-01로 대신 🆕 11/20 | — |
| ~~Q-10~~ | ~~ADM-03(N-26 관리자 통계) 담당과 Jira 번호. 정의서에 있던 FP-191은 커뮤니티 카드였다. 비교 통계는 FP-159(광희)~~ ✅ **해결 🆕 11/20:** 광희, API FP-161·화면 FP-162 | — |
| Q-11 | ~~COMM-08·09(내가 쓴 글·댓글 목록) 구현 담당·경로·응답 필드 확정~~ ✅ COMM-09 동주(FP-279), COMM-08은 만들지 않음 🆕 11/25. 남은 것: 내가 쓴 댓글·내 댓글 수정·삭제(COMM-09~11)의 기능 정의서 N-ID 부여 | C팀(동주) |
