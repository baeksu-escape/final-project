# 회원가입·로그인·인증 화면 (FP-87)

- **날짜:** 2026-11-03
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-87-signUp-login-certify`
- **관련 N-ID:** N-01(로그인·로그아웃), N-02(회원가입), N-03(아이디·비밀번호 찾기)
- **관련 결정:** D-20(응답 형식 임시안), D-06(데모 계정 미정)

## 무엇을, 왜 바꿨나
- 공통 프론트(FP-79) 위에 로그인 전 화면 4개(로그인, 회원가입, 아이디 찾기, 비밀번호 찾기·재설정)를 만들었다.
- 이메일 인증코드 발송·확인을 재사용 컴포넌트(`EmailVerification`)로 만들었다. 마이페이지(FP-93)에서도 쓴다.
- 백엔드 API가 없어서 mock 응답을 `features/auth/mocks/`에서 `registerMockHandlers()`로 등록했다. 로그인·내 정보 mock은 가입자와 잠긴 계정을 포함하도록 덮어쓴다.
- 스타일 코드는 없다. className만 붙였다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/**` | 새 파일 15개(화면 4, 컴포넌트 4, API, mock 2, 경로·상수·검사 함수) |
| `frontend/src/common/components/TextInput.jsx` | 새 공통 컴포넌트(텍스트·이메일·비밀번호·전화 입력). 기존 컴포넌트는 그대로 |
| `frontend/src/common/components/index.js` | `TextInput` export 1줄 추가 |
| `frontend/src/common/routes/AppRoutes.jsx` | 로그인 placeholder 1줄 → 로그인 전 라우트 4개(GuestOnlyRoute 안), import 6줄 |

## DB·API 변경
- DB: 없음
- API: 프론트 mock 경로를 임시로 정함. TODO(D-20)
  - `POST /api/auth/login` `{ loginId, password }` → `{ accessToken, user }` / 401 / 423 `{ code: 'ACCOUNT_LOCKED' }`
  - `GET /api/auth/me` → `{ user }` / 401
  - `POST /api/auth/email/send` `{ email, purpose, loginId? }` → `{ expiresInSeconds }` / 409 `DUPLICATE_EMAIL`(가입 목적)
  - `POST /api/auth/email/verify` `{ email, code, purpose, loginId? }` → `{ verificationToken }` / 400 / 404
  - `POST /api/auth/signup` `{ loginId, name, phone, email, password, ageGroup, agreeCreditInfo, emailVerificationToken }` → `{ userId }` / 409 `DUPLICATE_LOGIN_ID`·`DUPLICATE_EMAIL` / 400
  - `POST /api/auth/find-id` `{ name, phone }` → `{ maskedLoginId }` / 404
  - `POST /api/auth/password/reset` `{ loginId, email, emailVerificationToken, newPassword }` → `{}` / 400
  - `purpose`: `SIGNUP` · `RESET_PASSWORD` · `CHANGE_EMAIL`(FP-93용)
- 영향을 받는 기능·팀원: 인증 백엔드 담당(경로·필드 맞추기), 마이페이지(FP-93, EmailVerification 재사용)

## 확인
- 확인함
  - `npm run lint` 오류 0건
  - `npm run build` 성공
  - 헤드리스 Chrome으로 개발 서버 점검 49건 통과
    - 가입: 동의 전 버튼 비활성, 규칙 실시간 표시, 항목별 형식 오류, 인증코드 발송·오류·확인, 이메일 변경 시 인증 해제, 중복 아이디·이메일
    - 로그인: 공통 실패 문구, 잠긴 계정 안내, 사용자 → /report, 관리자 → /admin/model, 신규 가입자 → /select-job, 로그인 상태에서 /login 접근 시 첫 화면으로 이동
    - 로그아웃: 토큰 삭제 후 /login
    - 아이디 찾기: 가린 아이디 표시
    - 비밀번호 찾기: 불일치 안내, 재설정 후 옛 비밀번호 실패·새 비밀번호 성공
    - 콘솔 출력 없음, localStorage에는 토큰만
- 확인 못 함
  - 실제 백엔드 연동(서버 없음)
  - 실제 메일 발송

## 다음 사람이 알아야 할 것
- mock 가입자는 메모리에만 있어서 새로고침하면 사라진다(토큰 외 개인정보는 브라우저 저장소에 두지 않는 규칙).
- mock 인증코드는 항상 `123456`이다. mock 모드에서만 화면에 안내된다.
- 데모 계정 `employee`·`self`·`freelancer`·`newbie`·`admin`·`locked`는 비밀번호를 비교하지 않는다.
- 팀 결정 필요
  - 아이디 규칙(임시: 영문 소문자로 시작하는 4~20자 영문 소문자·숫자)
  - 연령대 코드값(`AGE_20S`~`AGE_60_PLUS`)
  - 가입 화면에 추가한 아이디·비밀번호 확인 칸
  - 아이디 찾기 입력값(이름+휴대폰)
  - 잠금 응답 423

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
