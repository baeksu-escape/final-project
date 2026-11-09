# 입력 화면 팀 결정 반영과 주석 정리 (FP-151)

- **날짜:** 2026-11-09
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-151-V3-Update`
- **관련 N-ID:** N-05-2, N-05-3, N-05-5, N-05-7, N-05-8, N-01-2
- **관련 결정:** D-16(월별 이력), D-20(응답 형식 임시안), D-24(기간 단위), D-27(대출 입력 항목)

## 무엇을, 왜 바꿨나
- FP-85·FP-86 v3 수정에서 "팀 결정 필요"로 남긴 항목을 권장안으로 반영했다.
  - 대출이 없는 사용자는 "보유한 대출이 없습니다" 체크로 카드/부채를 완료할 수 있다. 명세의 입력 항목에는 없지만, 체크가 없으면 대출 없는 사용자가 N-05-8의 6개 항목을 채울 수 없다.
  - 지출은 월 고정 지출만 입력하면 완료다. 할부·정기결제는 없을 수 있다.
  - 기간은 개월 수 정수만 받는다.
  - 대출 줄에 고정·변동을 추가했다(N-05-3). 대출 종류는 업권으로 유지한다.
  - N-01-2 첫 화면 규칙에 "점수 없음 → 데이터 입력"을 넣었다.
  - mock 입력 저장을 기준월별로 바꾸고, 덮어쓰기 안내도 저장한 기준월 목록으로 판단한다.
- 공통 프론트와 데이터 입력의 빠진 주석을 묶음 단위로 채우고 옛 기능 번호·이름을 고쳤다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/dataInput/config/inputSections.js` | 대출 없음 문구, 고정·변동 칸, 기간 정수 |
| `frontend/src/features/dataInput/config/inputOptions.js` | 고정·변동 선택지 |
| `frontend/src/features/dataInput/config/completionItems.js` | 지출 완료 조건 |
| `frontend/src/features/dataInput/utils/inputValues.js` | `noItems` 값·요청·완료 판단 |
| `frontend/src/features/dataInput/components/SectionList.jsx` | 대출 없음 체크, 주석 |
| `frontend/src/features/dataInput/pages/DataInputPage.jsx` | 대출 없음 처리, 기준월 목록, `hasScore` 반영 |
| `frontend/src/features/dataInput/mocks/dataInputMockHandlers.js` | 기준월별 저장, 점수 산출 시 `hasScore` |
| `frontend/src/common/auth/accessRules.js` | `getHomePath`에 점수 없음 분기 |
| `frontend/src/common/mocks/mockUsers.js` | 데모 계정 `hasScore` |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | 가입자 `hasScore: false` |
| `frontend/src/common/components/EditableList.jsx`, `common/layout/AppHeader.jsx`, `common/mocks/mockHandlers.js`, `common/routes/AppRoutes.jsx`, `features/dataInput/components/SectionFields.jsx`, `features/dataInput/pages/JobSelectPage.jsx` | 주석만 |

## DB·API 변경
- DB: 없음. 다만 더미 DB `MEMBER_LOAN`에 고정·변동 컬럼이 없어 DB 담당과 맞춰야 한다.
- API(mock 임시안, TODO(D-20))
  - `PUT /api/members/me/financial-input` 요청: `loans.noItems`(boolean), `loans.items[].rateType`(`FIXED`|`VARIABLE`) 추가
  - `GET`·`PUT /api/members/me/financial-input` 응답: `savedBaseMonths`(저장한 기준월 목록, 오래된 달부터) 추가
  - 로그인·내 정보의 `user`: `hasScore`(boolean) 추가. 값이 오지 않으면 기존처럼 신용 리포트로 간다.
- 영향을 받는 기능·팀원: 백엔드 입력·인증 API 담당, DB 담당

## 확인
- 확인함
  - `npm run lint` 오류 0건, `npm run build` 성공
  - 로직·mock node 검사 14건 통과(저장소 밖 스크립트)
  - 헤드리스 Chrome 점검 23건 통과: 첫 화면 분기 4가지, 대출 없음 체크, 고정·변동 필수, 기간 소수 차단, 할부 없이 지출 완료, 점수 산출 뒤 첫 화면, 기준월별 덮어쓰기 안내
  - 콘솔: 브라우저가 자동으로 요청하는 `favicon.ico` 404만 있다.
- 확인 못 함: 실제 백엔드 연동(서버 없음)

## 다음 사람이 알아야 할 것
- 데모 계정은 `employee`만 점수가 있다. `self`·`freelancer`로 로그인하면 데이터 입력 화면으로 간다.
- D-20은 권장안(`{ code, message, fieldErrors }` 채택)으로 정했으나 decisions.md에 아직 반영되지 않아 코드의 TODO를 남겨 두었다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
