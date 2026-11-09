# 소셜 로그인 프론트 흐름과 mock (FP-145)

- **날짜:** 2026-11-09
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-145-socialLogin`
- **관련 N-ID:** N-01-6(소셜 로그인), N-01-2(첫 화면), N-01-3(잠긴 계정), N-02(회원가입)
- **관련 결정:** decisions.md 소셜 로그인(Google·카카오·네이버, 관리자 불가), D-20(응답 형식 임시안)

## 무엇을, 왜 바꿨나
- 팀이 소셜 로그인을 추가하기로 해서 프론트 흐름을 만들었다. 백엔드 API와 제공자 키가 아직 없어 mock으로 확인한다.
- 제공자 인증은 백엔드가 맡고, 프론트는 시작 주소로 이동시킨 뒤 돌아온 일회용 코드를 교환 API로 토큰으로 바꾼다. 토큰은 주소로 받지 않는다.
- 처음 연결하는 소셜 계정은 기존 계정에 연결하거나 이름·이메일이 채워진 가입 화면으로 간다. 이 값은 화면 이동 상태로만 넘긴다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/socialLoginConfig.js` | 새 파일. 제공자 목록, 경로, 결과·오류 값, 안내 문구 |
| `frontend/src/features/auth/api/socialLoginApi.js` | 새 파일. 시작·교환·연결 |
| `frontend/src/features/auth/components/SocialLoginButtons.jsx` | 새 파일. 제공자 글자 버튼 |
| `frontend/src/features/auth/pages/SocialCallbackPage.jsx` | 새 파일. 코드 교환과 결과별 이동 |
| `frontend/src/features/auth/pages/SocialLinkPage.jsx` | 새 파일. 기존 계정 연결·새로 가입 선택 |
| `frontend/src/features/auth/mocks/socialLoginMockData.js` | 새 파일. 시나리오 설정값, 가짜 프로필 |
| `frontend/src/features/auth/mocks/socialLoginMockHandlers.js` | 새 파일. 교환·연결 mock |
| `frontend/src/features/auth/pages/LoginPage.jsx` | 버튼과 소셜 안내 문구 추가 |
| `frontend/src/features/auth/pages/SignupPage.jsx` | 이동 상태로 칸 채우기, `socialLinkKey` 전송 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | `findMockAccount` 추가, 가입 mock의 `socialLinkKey` 확인 |
| `frontend/src/common/auth/AuthProvider.jsx` | `loginWithToken` 추가(기존 동작 그대로, 사용자 승인) |
| `frontend/src/common/routes/AppRoutes.jsx` | 소셜 경로 2개 등록 |

## DB·API 변경
- DB: 없음
- API(프론트 mock 임시안, TODO(D-20))
  - 시작: `GET {API_BASE_URL}/oauth2/authorization/{google|kakao|naver}`
  - 콜백: 백엔드가 `{프론트 주소}/oauth/callback?code=<일회용 코드>`로 돌려보낸다. 취소는 `?error=access_denied`, 그 외 실패는 `?error=<값>`
  - 교환: `POST /api/auth/social/exchange` `{ code }`
    - 연결된 계정: 200 `{ result: 'LINKED', accessToken, user }`
    - 처음 연결: 200 `{ result: 'LINK_REQUIRED', linkKey, provider, profile: { name, email } }`
    - 관리자: 403 `{ code: 'SOCIAL_ADMIN_NOT_ALLOWED', message }`
    - 잠긴 계정: 423 `{ code: 'ACCOUNT_LOCKED', message }`
    - 코드 오류: 400 `{ code: 'INVALID_SOCIAL_CODE', message }`
  - 연결: `POST /api/auth/social/link` `{ linkKey, loginId, password }` → 200 `{ accessToken, user }` / 401 / 423 / 403(위와 같은 code) / 400 `{ code: 'SOCIAL_LINK_EXPIRED', message }`
  - 가입: `POST /api/auth/signup`에 선택 필드 `socialLinkKey` 추가
- 영향을 받는 기능·팀원: 백엔드 인증 담당, DB 담당(소셜 연결 정보 저장)

## 확인
- 확인함
  - `npm run lint` 오류 0건, `npm run build` 성공
  - 로직·mock node 검사 15건 통과(저장소 밖 스크립트)
  - 헤드리스 Chrome mock 점검 38건 통과: 세 제공자 버튼, 결과 a~e, 주소창의 코드 제거, 코드 없이 들어온 경우, 연결 성공·실패·잠금·관리자, 가입 칸 채우기와 수정, 저장소에 이름·이메일 없음, 콘솔에 토큰·코드·이름·이메일 없음
  - 실제 모드: 임시 가짜 백엔드와 환경 변수(`VITE_USE_MOCK=false`, `VITE_API_BASE_URL`)로 시작 주소 이동 → 콜백 → 교환 1회 → 토큰 저장 → 첫 화면 이동 확인(a 결과만)
- 확인 못 함: 실제 제공자 인증과 실제 백엔드 연동(키·서버 없음)

## 다음 사람이 알아야 할 것
- mock 결과는 `features/auth/mocks/socialLoginMockData.js`의 `scenario` 값으로 바꾼다.
- 가입이 끝나면 일반 가입처럼 완료 안내 화면으로 간다. 자동 로그인은 하지 않는다.
- 팀 결정 필요: 소셜 가입 시 이메일 인증 여부, 소셜 연결 정보 테이블, N-01-6 우선순위, 임시 연결 키 유효 시간

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
