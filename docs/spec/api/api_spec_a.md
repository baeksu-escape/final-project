# API 명세서 — A팀 (회원·인증, 마이페이지, 데이터 입력, 관리자)

> A팀(우찬·경환) API의 요청·응답 상세다. 관리: A팀. 작성 규칙은 [README](README.md) 3장, 전체 목록과 ID는 [API 정의서](api_definition.md)에 있다.
>
> - **원본:** 우찬 님 「A팀 API 명세 — 반영 요청(11/16)」. develop `bfe6b94`(PR #50·#52·#53 병합 후)의 실제 Spring Controller·DTO에서 뽑은 내용이다. 🆕 11/18 이 파일로 옮겼다(그 전에는 정의서에 요약만 있었다). 그 뒤 코드가 바뀌면 A팀이 이 파일을 고친다.
> - 🆕 최근 변경 (11/19, FP-90): 7장 대출 상품 LOAN-01~05 추가(경환), 5장 오류 code에 `PRODUCT_NOT_FOUND`
> - 이전 변경 (11/18, FP-219): AUTH-06 가입 요청에 휴대폰 인증 토큰 추가·이름·닉네임 규칙, 닉네임 중복 확인·휴대폰 인증번호 발송·확인 API(AUTH-13~15) 추가
> - 11/18 확인: 아래 경로는 모두 develop `5ff443c` 코드에 있다.
> - AUTH-13~15와 AUTH-06 변경은 FP-219(PR #89, 11/19 develop 병합) 코드 기준. ID는 API 정의서 2-1에서 확정 🆕 11/19
> - 상태 표시: ✅ 구현·develop 병합 · 🟡 새로 만든 경로(원래 명세에 없던 것) · ↗ 다른 팀 담당(그 팀 명세서를 본다)
> - 프론트 코드의 `TODO(D-20) docs/spec/api/api_spec_a.md가 정해지면 …` 주석은 이 파일을 가리킨다.

---

## 0. 공통 규칙 — A팀 코드가 정한 것

정의서 1장 공통 규칙에도 같은 내용이 있다.

| 항목 | 규칙 |
|---|---|
| 오류 응답 | `{ "code", "message", "fieldErrors": [{ "field", "message" }] }`. `fieldErrors`는 입력 칸 오류일 때만 |
| 토큰 종류 | JWT에 `scope` 클레임이 있다. 일반 API는 `ACCESS`만 받는다. 관리자 2단계 인증 중 쓰는 1회용 토큰(`ADMIN_LOGIN_CHALLENGE`·`ADMIN_PASSWORD_SETUP`·`ADMIN_STEP_UP`)으로 일반 API를 부르면 401 |
| 옛 토큰 | `scope`가 없는 토큰(PR #53 이전 발급)은 401. 다시 로그인하면 된다 |
| 잠긴 계정 | `ACCOUNT_STATUS_CODE = LOCKED`인 계정은 이미 받은 토큰으로도 401 `ACCOUNT_LOCKED`. 잠금을 풀면 같은 토큰이 다시 동작 |
| 탈퇴 계정 | 이미 받은 토큰으로 401 `UNAUTHORIZED` |
| 재확인 헤더 | 관리자 민감 작업은 헤더 `X-Step-Up-Token`(`ADMIN_STEP_UP` 토큰) 필요. 없거나 만료면 401 `STEP_UP_REQUIRED`. CORS 허용 헤더에 추가됨 |
| 쪽 넘기기 | 관리자 목록은 `page`(0부터)·`size`. 응답 `{ items, page, size, totalCount }` |
| 시각 | 응답 시각은 ISO-8601 + 오프셋(`+09:00`) |

## 1. 회원·인증 (AUTH) — N-01~03

| ID | 메서드 · 경로 | 요청 | 응답 | 인증 | 상태 |
|---|---|---|---|---|---|
| AUTH-01 | `POST /api/auth/login` | `{ loginId, password }` | 일반: `{ accessToken, user }`<br>관리자: `{ twoFactorRequired: true, challengeToken, maskedEmail }` | 없음 | ✅ (관리자 응답 추가) |
| AUTH-02 | `POST /api/auth/logout` | — | `{}` | ACCESS | ✅ |
| AUTH-03 | `GET /api/auth/me` | — | `{ user }` | ACCESS | ✅ |
| AUTH-04 | `POST /api/auth/social/exchange` | `{ code }` | `{ result: LINKED \| LINK_REQUIRED, accessToken, user, linkKey, provider, profile, devMode }` | 없음 | ✅ |
| AUTH-05 | `POST /api/auth/social/link` | `{ linkKey, loginId, password }` | `{ accessToken, user }` | 없음 | ✅ |
| AUTH-06 | `POST /api/auth/signup` | `{ loginId, name, nickname, phone, email, password, birthYear, ageGroup, agreeCreditInfo, agreeMarketing, emailVerificationToken, socialLinkKey, phoneVerificationToken }` 🆕 11/18 | `{ userId }` | 없음 | ✅ (🆕 11/18 `phoneVerificationToken` 필수, 아래 설명) |
| AUTH-07 | `POST /api/auth/email/send` | `{ email, purpose, loginId }` | `{ expiresInSeconds }` | 없음 | ✅ |
| AUTH-08 | `POST /api/auth/email/verify` | `{ email, code, purpose, loginId }` | `{ verificationToken }` | 없음 | ✅ |
| AUTH-09 | `POST /api/auth/find-id` | `{ name, phone }` | `{ maskedLoginId }` | 없음 | ✅ (관리자 계정은 찾지 않음) |
| AUTH-10 | `POST /api/auth/password/reset` | `{ loginId, email, emailVerificationToken, newPassword }` | `{}` | 없음 | ✅ (관리자 아이디는 "없는 계정"과 같은 404) |
| AUTH-11 | `POST /api/auth/admin/verify-code` | `{ challengeToken, code }` | 통과: `{ token, user, passwordChangeRequired: false }`<br>임시 비밀번호: `{ passwordChangeRequired: true, passwordSetupToken }` | 없음(challengeToken) | ✅ |
| AUTH-12 🟡 | `POST /api/auth/admin/password-setup` | `{ passwordSetupToken, newPassword }` | `{ token, user }` | 없음(setup 토큰) | ✅ |
| AUTH-13 | `POST /api/auth/nickname/check` | `{ nickname }` | `{ available }` | 없음 | ✅ (FP-219, PR #89 · ID는 정의서에서 확정 🆕 11/19) |
| AUTH-14 | `POST /api/auth/phone/send` | `{ phone, purpose }` | `{ expiresInSeconds }` | 없음 | ✅ (FP-219, PR #89 · ID는 정의서에서 확정 🆕 11/19) |
| AUTH-15 | `POST /api/auth/phone/verify` | `{ phone, code, purpose }` | `{ verificationToken }` | 없음 | ✅ (FP-219, PR #89 · ID는 정의서에서 확정 🆕 11/19) |

- `user` = `{ userId, name, role, jobType, hasScore }`
- AUTH-11·12의 토큰 필드 이름은 `token`이다(AUTH-01은 `accessToken`). 화면은 둘 다 받는다.
- 관리자 [다시 보내기]는 별도 경로 없이 AUTH-01을 다시 부른다(1분에 1번, 넘으면 429).
- 🆕 11/18 **AUTH-06 가입 검사**(칸 오류는 모두 400 `INVALID_INPUT` + `fieldErrors`)
  - `name`: 완성형 한글 2~20자. 어기면 `name` 칸 `이름은 한글 2~20자로 입력해 주세요. (숫자·영문·기호 불가)`
  - `nickname`: 앞뒤 공백을 뺀 값이 한글(완성형)·영문·숫자 2~7자. 어기면 `nickname` 칸 `닉네임은 한글·영문·숫자 2~7자로 입력해 주세요.`, '탈퇴'로 시작하면 `쓸 수 없는 닉네임입니다.` AUTH-13도 같은 규칙·문구다. DDL(2~12자)보다 좁게 막는 것이라 새 가입에만 적용된다.
  - `phone`: 필수. 비면 `휴대폰 번호를 입력해 주세요.`, 형식이 틀리면 형식 오류 문구가 온다. `phoneVerificationToken`이 없거나 다른 번호·다른 목적·이메일용 토큰이거나 이미 쓴 토큰이면 `phone` 칸 `휴대폰 인증을 완료해 주세요.`
  - `birthYear`: 화면에서 고른 생일의 연도다. 생일(월·일)은 보내지도 저장하지도 않는다.
- 🆕 11/18 **AUTH-13 닉네임 중복 확인**: 닉네임을 주소에 남기지 않으려고 POST로 받는다. 형식이 틀리면 400 `INVALID_INPUT`(`nickname` 칸). 결과는 안내용이고, 가입 때 서버가 다시 막는다(409 `DUPLICATE_NICKNAME`).
- 🆕 11/18 **AUTH-14·15 휴대폰 인증번호**: 이메일 인증(AUTH-07·08)과 같은 모양이다.
  - `purpose`는 `SIGNUP`만 받는다(다르면 400 `INVALID_INPUT`, `purpose` 칸). 번호 형식이 틀리면 400 `INVALID_INPUT`(`phone` 칸).
  - 6자리 번호, 유효 300초, 5회 틀리면 그 번호는 쓸 수 없다. 틀림·만료·5회 초과는 모두 400 `INVALID_VERIFICATION_CODE`(`인증번호가 올바르지 않거나 만료되었습니다.`).
  - 받은 `verificationToken`(10분)을 AUTH-06의 `phoneVerificationToken`에 넣는다. 번호는 HMAC과 코드 해시만 저장한다(`VERIFICATION_CODE.CHANNEL_CODE = 'PHONE'`).
  - 발송 구현은 설정 `avenue.auth.phone.mode`로 바뀐다. 기본 `LOG`는 서버 로그에 개발용 번호를 남기고(번호는 `010-****-5678`처럼 가림), `FIXED`는 `avenue.auth.phone.fixed-code`를 쓴다. 실제 문자 발송은 아직 없다.

## 2. 마이페이지 (MEM) — N-04

| ID | 메서드 · 경로 | 요청 | 응답 | 상태 |
|---|---|---|---|---|
| MEM-01 | `GET /api/members/me/profile` | — | `{ profile: { loginId, nickname, name, phone, email, joinedAt, jobType } }` (마스킹) | ✅ |
| MEM-02 | `POST /api/members/me/profile/unmask` | `{ password }` | `{ profile: { name, phone, email } }` | ✅ |
| MEM-03 | `PUT /api/members/me/email` | `{ email, emailVerificationToken }` | `{}` | ✅ |
| MEM-04 | `PUT /api/members/me/password` | `{ currentPassword, newPassword }` | `{}` | ✅ (ROLE_USER 전용) |
| MEM-05 | `PATCH /api/members/me/job-type` | `{ jobType }` | `{ user }` | ✅ 🆕 11/19 FP-227 입력 저장 전에는 다시 고를 수 있다. 비어 있으면 저장 · 같은 직군이면 바꾸지 않고 200 · 다른 직군이면 저장한 데이터 입력(`USER_ASSET_SNAPSHOT`, 기준월 무관)도 평가(`ASSESSMENT`)도 없을 때만 바꾼다. 하나라도 있으면 409 `JOB_TYPE_LOCKED`. 동시에 바뀌어 반영하지 못하면 409 `JOB_TYPE_ALREADY_SELECTED` |
| MEM-06 | `GET /api/members/me/diagnoses` | — | [B팀 명세서](api_spec_b.md) 3-4 | ↗ B팀(범영) 구현 완료(FP-142), A팀 화면 연결됨 🆕 11/18 |
| MEM-07 | `DELETE /api/members/me` | `{ password }` | `{}` | ✅ |

- MEM-07: 비밀번호가 없는 간편 로그인 전용 계정은 비밀번호 대신 "토큰 발급 10분 이내"로 확인한다. 지나면 403 `RECENT_LOGIN_REQUIRED`(`password` 칸 오류).
- MEM-07 처리: 상태 `WITHDRAWN` + 개인정보 표시값 덮어쓰기, 소셜 연결·인증 기록·동의로 불러온 데이터 삭제, 직접 입력·평가는 보관. 시스템 로그 INFO 1건.

## 3. 데이터 입력·대안 데이터 (INP) — N-05

| ID | 메서드 · 경로 | 요청 | 응답 | 상태 |
|---|---|---|---|---|
| INP-01 | `GET /api/members/me/financial-input` | — | `{ input, status: { sections, altData }, altData, savedBaseMonths }` | ✅ |
| INP-02 | `PUT /api/members/me/financial-input` | `{ jobType, baseMonth, income, workPeriod, loans, creditProfile, assets, fixedExpense, otherExpenses }` | `{ savedAt, status, savedBaseMonths }` | ✅ |
| INP-03 | `POST /api/members/me/alt-data/{source}/import` | `{ baseMonth, consentId }` | `{ source, importedAt, rows, consentId, notice }` | ✅ |
| INP-04 | `GET /api/members/me/consents` | — | `{ items: [{ consentId, consentTypeCode, providerCode, itemCode, agreedAt, expiresAt, withdrawnAt }] }` | ✅ |
| INP-05 | `POST /api/members/me/consents` | `{ consentTypeCode, providerCode, itemCode }` | `{ consentId, agreedAt }` | ✅ |
| INP-06 | `DELETE /api/members/me/consents/{consentId}` | — | `{ consentId, withdrawnAt }` | ✅ |
| RPT-01 | `POST /api/members/me/score-calculation` | `{ requestId }` | [B팀 명세서](api_spec_b.md) 3-1 | ↗ B팀(범영) 구현 완료(FP-142), A팀 화면 연결됨 🆕 11/18 |

**INP-02 요청 세부**
- `income` = `{ incomeType, monthlySalary, items: [{ month, amount }] }` (급여소득자 1달, 그 외 12달)
- `workPeriod` = `{ periodMonths }`
- `loans` = `{ items: [{ loanTypeCode, balanceAmount, annualRatePercent, rateType, monthlyPaymentAmount, remainingMonths }], noItems }`
  - 필드 변경: `sectorCode` → `loanTypeCode` (`DIM_LOAN_TYPE` 6개)
  - `annualRatePercent` 0~20, `remainingMonths` 필수(0 허용)
  - `noItems: true` → `USER_ASSET_SNAPSHOT.NO_LOAN_YN = 'Y'`
- `creditProfile` 🟡 = `{ cardLimitAmount, cardMonthlySpendAmount, delinquencyCount12m, cashAdvanceMonths, newLoanCount3m, privateLenderLoanBalanceAmount, noCreditHistory }` → `USER_CREDIT_PROFILE`(`MANUAL`)
- `assets` = `{ depositAmount, investmentAmount, realEstateAmount, otherAmount }` → 합계만 `TOTAL_ASSET_AMT`에 저장(모두 비면 NULL). 다시 열면 합계가 `otherAmount`로 돌아온다
- `fixedExpense` = `{ monthlyAmount }`, `otherExpenses` = `{ items: [{ category, memo, monthlyAmount }] }` (`category`에 `INSTALLMENT`(할부) 추가)

**INP-03 세부**
- `source`: `easypay`, `telecom`, `national-pension`, `health-insurance`, `utility`
- 원천: 저장소 `docs/spec/sql/dummy_db/external_api/*.jsonl`(설정 `avenue.altdata.source-dir`). 파일에 없는 회원은 설정 `avenue.altdata.missing-member-mode`로 `EMPTY`(0건 + notice) 또는 `BORROW`(같은 직군 예시 + notice)
- 다시 불러오면 같은 동의의 이전 행을 교체한다. 기관 파일 기간을 그대로 저장한다(`baseMonth`는 형식 확인용)

**INP-05 세부**
- 동의 저장 값: `REQUIRED_YN 'N'`, `TERMS_VERSION 'DEV-0.2'`, 만료 365일
- 불러오기 성공 시 `EXTERNAL_CONSENT_ID = 'DUMMY-MEM{6자리}-{ITEM_CODE}'`

## 4. 관리자 (ADM) — N-27·N-28·N-35, 모두 ROLE_ADMIN + ACCESS 토큰

| ID | 메서드 · 경로 | 요청 | 응답 | 추가 조건 | 상태 |
|---|---|---|---|---|---|
| ADM-05 | `GET /api/admin/users?q&role&status&page&size` | — | `{ items: [{ userId, loginId, maskedName, role, workerTypeCode, latestAltScore, status, reportedPostCount, createdAt, lastLoginAt }], page, size, totalCount }` | `size` 최대 100 | ✅ |
| ADM-06 | `PATCH /api/admin/users/{userId}/lock` | `{ locked, reason }` | 바뀐 행(ADM-05 `items` 한 줄) | 잠글 때 `reason` 필수. 본인 409, 탈퇴 409 | ✅ |
| ADM-07 | `POST /api/admin/admins` | `{ loginId, name, workEmail }` | `{ userId, loginId, temporaryPassword }` | `X-Step-Up-Token` 필요 | ✅ |
| ADM-07-1 🟡 | `POST /api/admin/admins/{userId}/temporary-password` | — | ADM-07과 같음 | `X-Step-Up-Token` 필요, 본인 불가 | ✅ (화면 버튼은 없음) |
| ADM-08 | `POST /api/admin/users/{userId}/credit-data` | `{ reason }` | 아래 「ADM-08 응답」 | `reason` 필수. `ACCESS_AUDIT_LOG`를 먼저 저장(`ACCESSED_RESOURCE = 'MEMBER_DETAIL'`) | ✅ |
| ADM-09 | `GET /api/admin/access-logs?page&size` | — | `{ items: [{ accessedAt, viewerLoginId, targetLabel, reason, resource }], … }` | 조회만 | ✅ |
| ADM-10 | `GET /api/admin/system-logs?type&page&size` | — | `{ items: [{ createdAt, type, source, message }], … }` | `type`: AUTH·INFO·WARN | ✅ |
| ADM-ME-1 🟡 | `POST /api/admin/me/step-up/send` | — | `{ expiresInSeconds, maskedEmail }` | 1분에 1번 | ✅ |
| ADM-ME-2 🟡 | `POST /api/admin/me/step-up/verify` | `{ code }` | `{ stepUpToken, expiresIn }` | 토큰 5분·1회용 | ✅ |
| ADM-ME-3 🟡 | `PUT /api/admin/me/password` | `{ currentPassword, newPassword }` | `{}` | `X-Step-Up-Token` 필요 | ✅ |

**ADM-08 응답**
```
{
  profile: { loginId, maskedName, maskedEmail, maskedPhone, workerTypeCode, status, joinedAt },
  latestAssessment: { requestId, tradScore, altScore, altGradeBandCode, assessedAt } | null,
  creditProfile: { baseDate, cardLimitAmount, cardMonthlySpendAmount, delinquencyCount12m,
                   cashAdvanceMonths, newLoanCount3m, privateLenderLoanBalanceAmount } | null,
  altDataSummary: { telecom, utility, easypay, nationalPension, healthInsurance }
}
```

- 이름·이메일·휴대폰은 가린 값만 보낸다. 복호화가 안 되면 "(복호화 불가)", 탈퇴 회원은 "(탈퇴 회원)".
- 시스템 로그(`SYSTEM_LOG`) 기록 지점: 로그인 성공·실패·자동 잠금, 관리자 2단계 인증·재확인, 잠금·해제, 관리자 추가, 첫 비밀번호 설정, 비밀번호 변경, 회원 탈퇴. 메시지에 아이디는 `qa***`처럼 가린 값만.
- `PASSWORD_CHANGE_REQUIRED_YN = 'Y'`인 관리자는 ACCESS 토큰을 받지 못하고, 혹시 가진 경우 `/api/admin/**`에서 403 `PASSWORD_CHANGE_REQUIRED`.
- 다른 팀 관리자 API: 모형 성능 ADM-01·02, 신고함 ADM-11~14는 C팀(동주) — [api_spec_c.md](api_spec_c.md)·정의서 2-10.

## 5. 오류 code 목록 (A팀 범위)

| HTTP | code | 언제 |
|---|---|---|
| 400 | `INVALID_INPUT` | 입력 형식 오류(`fieldErrors` 포함) |
| 400 | `INVALID_PASSWORD` | 비밀번호 확인 실패(MEM-02·MEM-07 등) |
| 400 | `INVALID_VERIFICATION_CODE`, `VERIFICATION_CODE_EXPIRED`, `VERIFICATION_ATTEMPTS_EXCEEDED` | 인증번호 틀림·만료·5회 초과 (🆕 11/18 휴대폰 인증 포함 — 휴대폰·이메일은 세 경우 모두 `INVALID_VERIFICATION_CODE`) |
| 400 | `EMAIL_VERIFICATION_REQUIRED`, `SAME_EMAIL`, `SAME_PASSWORD` | 이메일 인증 누락, 같은 값으로 변경 |
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
| 404 | `PRODUCT_NOT_FOUND` | 없는 대출 상품 코드 (LOAN-02·04·05) 🆕 11/19 |
| 409 | `DUPLICATE_LOGIN_ID`, `DUPLICATE_EMAIL`, `DUPLICATE_NICKNAME`, `NICKNAME_UNAVAILABLE` | 중복 |
| 409 | `JOB_TYPE_REQUIRED`, `JOB_TYPE_ALREADY_SELECTED` | 직군 선택 전 저장 / 직군을 바꾸는 사이 다른 요청이 먼저 바꿈(MEM-05) |
| 409 | `JOB_TYPE_LOCKED` 🆕 11/19 | 입력을 저장했거나 평가가 있는 회원이 다른 직군으로 바꾸려 함(MEM-05) — "입력을 저장한 뒤에는 직군을 바꿀 수 없습니다." |
| 409 | `CONSENT_REQUIRED` | 동의 없이 불러오기 |
| 409 | `CREDIT_PROFILE_IMPORTED` | 같은 기준일에 불러온 신용 정보가 있어 직접 입력 저장 불가 |
| 409 | `SOCIAL_ALREADY_LINKED` | 이미 연결된 간편 로그인 |
| 409 | `CANNOT_CHANGE_SELF`, `ACCOUNT_WITHDRAWN`, `ADMIN_EMAIL_UNAVAILABLE` | 본인 잠금, 탈퇴 계정 잠금, 관리자 업무 이메일 복호화 불가 |
| 423 | `ACCOUNT_LOCKED` | 잠긴 계정 로그인 시도 |
| 429 | `CODE_RESEND_TOO_SOON` | 인증번호 1분 안에 재요청 |
| 503 | `ALT_DATA_SOURCE_UNAVAILABLE` | 기관 응답 파일 폴더 없음 |

## 6. 2차로 넘긴 것

- 관리자 2단계 인증의 이메일 외 수단(TOTP 등), 1회용 토큰 저장소(DB·Redis), `VERIFICATION_CODE.PURPOSE_CODE`에 `ADMIN_STEP_UP` 추가(DDL 제안)
- 자산 4칸 개별 저장(DDL 열 필요), 금융(대출) 불러오기, 간편 로그인 재인증 화면
- N-19 지난달 대비 알림(D-25로 1차 제외), N-01-5 시연 계정 [채우기](UI 초안용이라 제외)

## 7. 대출 상품 (LOAN) — N-37 🆕 11/19

> 담당: 경환(FP-90, PR #101). 코드: `backend/.../loan/`, `resources/mapper/loan/LoanMapper.xml`. 계약 테스트: `LoanApiContractTest`. 정의서 2-7의 LOAN-01~05와 같은 ID다.

| ID | 메서드 · 경로 | 요청 | 응답 | 인증 | 상태 |
|---|---|---|---|---|---|
| LOAN-01 | `GET /api/loan-products` | — | `{ items: [상품] }` | 로그인 | ✅ (FP-90, PR #101) |
| LOAN-02 | `GET /api/loan-products/{productCode}` | 경로 `productCode` | 상품 1개 | 로그인 | ✅ (FP-90, PR #101) |
| LOAN-03 | `GET /api/members/me/favorite-loan-products` | — | `{ items: [productCode] }` | USER | ✅ (FP-90, PR #101) |
| LOAN-04 | `PUT /api/members/me/favorite-loan-products/{productCode}` | 경로 `productCode` | `{}` | USER | ✅ (FP-90, PR #101) |
| LOAN-05 | `DELETE /api/members/me/favorite-loan-products/{productCode}` | 경로 `productCode` | `{}` | USER | ✅ (FP-90, PR #101) |

### 7-1. LOAN-01 대출 상품 목록 · N-37-1

- `GET /api/loan-products`, 요청 값 없음. 인증: 로그인(`/api/**` 규칙). 응답은 `items` 배열이고 한 칸의 모양은 아래 "상품 필드"와 같다. 상품이 없으면 `items: []`.
- 시드 17종 전부를 `PRODUCT_ID` 순으로 준다. 필터(전체·지금 점수로 가능·내 직군·즐겨찾기)와 정렬은 화면이 한다.

**상품 필드** (LOAN-01 `items[]`, LOAN-02 응답 공통)

| 필드 | 형식 | 설명 | N-ID |
|---|---|---|---|
| `productId` | number | 상품 번호(`LOAN_PRODUCT.PRODUCT_ID`) | N-37-1 |
| `productCode` | string | 상품 코드(예: `LP001`). 상세·즐겨찾기 경로에 쓴다 | N-37-1 |
| `name` | string | 상품명 | N-37-1 |
| `providerName` | string | 사업자명(가상 기관) | N-37-1 |
| `summary` | string | 한 줄 설명 | N-37-1 |
| `description` | string | 상품 설명(줄바꿈 `\n` 포함) | N-37-2 |
| `eligibility` | string | 대상 설명(`ELIGIBILITY_TEXT`) | N-37-1 |
| `rateMinPct`, `rateMaxPct` | number | 연 금리 범위(%) | N-37-1 |
| `limitAmount` | number | 최대 한도(원) | N-37-1 |
| `minScore` | number \| null | 신청 가능 최소 대안 점수. `null`이면 점수 조건 없음 | N-37-1 |
| `workerTypeCodes` | string[] | 대상 직군 코드(`EMPLOYEE`·`FREELANCER`·`SELF_EMPLOYED` 중, 코드순). 직군 행이 없는 상품은 3개 모두 | N-37-1 |
| `termText` | string \| null | 대출 기간 문구 | N-37-2 |
| `repaymentMethod` | string \| null | 상환 방식 | N-37-2 |
| `requiredDocuments` | string[] | 필요 서류. DB의 '·' 구분 문자열을 나눈 배열, 없으면 `[]` | N-37-2 |
| `features` | string[] | 신청 조건과 특징(표시 순서), 없으면 `[]` | N-37-2 |
| `cautionText` | string \| null | 유의 사항 | N-37-2 |
| `dummyYn` | boolean | 더미 상품 표시. DB `DUMMY_YN`이 `N`이 아니면 `true` | N-37 |

**응답 예시** (합성 시드 값)

```json
{
  "items": [
    {
      "productId": 1,
      "productCode": "LP001",
      "name": "든든 일반 신용대출",
      "providerName": "가상은행 A",
      "summary": "직군에 관계없이 쓸 수 있는 시연용 신용대출입니다.",
      "description": "급여소득자·자영업자·프리랜서가 함께 비교해 볼 수 있는 일반 신용대출 예시입니다.\n직군을 가리지 않는 기본형이라 처음 대출 조건을 가늠해 볼 때 기준으로 삼기 좋습니다.",
      "eligibility": "모든 직군 대상(시연용)",
      "rateMinPct": 4.51,
      "rateMaxPct": 9.76,
      "limitAmount": 95000000,
      "minScore": 780,
      "workerTypeCodes": ["EMPLOYEE", "FREELANCER", "SELF_EMPLOYED"],
      "termText": "12~60개월(시연)",
      "repaymentMethod": "원리금균등",
      "requiredDocuments": ["신분증 사본", "소득 증빙"],
      "features": ["직군 구분 없이 신청 가능", "시연용 가상 상품"],
      "cautionText": "더미 상품 · 실제 상품 아님",
      "dummyYn": true
    }
  ]
}
```

| HTTP | code | 언제 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 토큰 없음·만료 |

### 7-2. LOAN-02 대출 상품 상세 · N-37-2

- `GET /api/loan-products/{productCode}`. 인증: 로그인. 응답은 위 "상품 필드" 객체 하나(`items`로 감싸지 않는다).
- 응답 예시: 7-1의 `items[0]` 객체.

| HTTP | code | 언제 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 토큰 없음·만료 |
| 404 | `PRODUCT_NOT_FOUND` | 없는 상품 코드 |

### 7-3. LOAN-03 내 즐겨찾기 목록 · N-37-3, N-04-5

- `GET /api/members/me/favorite-loan-products`. 인증: USER(`/api/members/me/**`). 대상은 토큰의 회원이다.

| 필드 | 형식 | 설명 | N-ID |
|---|---|---|---|
| `items` | string[] | 즐겨찾기한 상품 코드, 최근에 담은 순. 없으면 `[]` | N-04-5 |

```json
{ "items": ["LP003", "LP001"] }
```

| HTTP | code | 언제 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 토큰 없음·만료 |
| 403 | `FORBIDDEN` | USER가 아닌 역할(관리자 토큰) |

### 7-4. LOAN-04·05 즐겨찾기 추가·해제 · N-37-3

- `PUT /api/members/me/favorite-loan-products/{productCode}`(추가), `DELETE …/{productCode}`(해제). 요청 본문 없음. 인증: USER. 응답은 둘 다 200 `{}`.
- 멱등이다. 이미 담았는데 PUT을 해도, 담지 않았는데 DELETE를 해도 200이다. 동시에 두 번 눌러 같은 줄이 겹쳐도 성공으로 본다.

| HTTP | code | 언제 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 토큰 없음·만료 |
| 403 | `FORBIDDEN` | USER가 아닌 역할(관리자 토큰) |
| 404 | `PRODUCT_NOT_FOUND` | 없는 상품 코드 |

### 7-5. 참고

- 상품은 모두 더미 데이터이며 금리·한도는 "같은 점수대의 참고 정보"다(`dummyYn`). 점수 조건 충족은 실제 대출 가능 여부가 아니다.
- LOAN-01·02는 내 점수·즐겨찾기 여부를 넣지 않는다. 정의서 1장 "본인 자료는 `/api/members/me/**`" 원칙에 따라 화면이 신용 리포트(점수)와 LOAN-03(즐겨찾기)을 따로 불러 합친다. 점수 조건은 화면이 `minScore`와 비교한다(`null`이면 조건 없음).
- LOAN-01·02는 `/api/**` "로그인 필요" 규칙만 받는다. 관리자 토큰으로도 조회되며 문제가 없다고 보고 막지 않았다. LOAN-03~05는 `/api/members/me/**`라 USER만 된다.
- SIM-03(`/api/simulation/loans/recommend`)은 만들지 않았다. 시뮬레이터의 상품 추천은 SIM-04(점수대 금리·한도, C조 담당 — API 정의서 2-6)와 LOAN-01을 화면에서 합쳐 대신한다.
- 새 오류 code는 `PRODUCT_NOT_FOUND` 하나다(5장).
