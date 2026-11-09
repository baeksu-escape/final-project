# 직군별 입력 화면 v3 수정 (FP-85)

- **날짜:** 2026-11-09
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-85-v3-update`
- **관련 N-ID:** N-05-2(소득·기간), N-05-5(지출 문구), N-05-6(대안 데이터), N-05-8(입력 완료 현황·점수 산출)
- **관련 결정:** 11/09 월 소득 12개월 확정, D-24(기간 단위), D-20(응답 형식 임시안)

## 무엇을, 왜 바꿨나
- 기능 명세서 v3와 11/06 UI 확정, 11/09 추가 수정에 맞춰 FP-85 화면을 고쳤다.
- 소득
  - 자영업자·프리랜서는 기준월로 끝나는 12개월을 12줄로 미리 채워 모두 받는다. 줄 추가·삭제는 없다.
  - 기준월 기본값은 지난달이다(`INCOME_END_MONTHS_AGO`). 기준월을 바꾸면 12줄의 달이 따라 바뀌고 겹치는 달의 금액은 유지한다. 급여소득자 기준월은 이번 달 그대로다.
  - 0원은 입력으로 인정하고, 빈칸은 null로 구분한다. 12칸이 모두 있어야 저장된다.
  - 재직·운영·활동 기간을 소득 다음 카드에서 개월 수로 받는다(필수).
- 지출 화면 문구를 "월 고정 지출", "할부·정기결제"로 바꿨다. 변수·필드·API 이름은 그대로다.
- 대안 데이터의 국민연금·건강보험료를 나눠 4종을 따로 불러온다.
- 입력 완료 현황을 6개 항목으로 바꾸고, 모두 완료일 때만 [점수 산출하기]를 켠다. 성공하면 신용 리포트 경로로 이동한다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/dataInput/config/inputSections.js` | 월별 소득 12줄 설정, 직군별 기간 섹션, 지출 문구 |
| `frontend/src/features/dataInput/config/validationLimits.js` | 12개월 끝 달 설정값 추가 |
| `frontend/src/features/dataInput/config/completionItems.js` | 새 파일. 완료 현황 6개 항목과 판단 함수 |
| `frontend/src/features/dataInput/config/altDataSources.js` | 대안 데이터 4종으로 분리 |
| `frontend/src/features/dataInput/utils/inputValues.js` | 기준월 기본값, 12줄 생성·맞추기, 완료 조건 |
| `frontend/src/features/dataInput/components/SectionList.jsx` | 달이 고정된 줄 표시 |
| `frontend/src/features/dataInput/components/InputStatus.jsx` | 완료 현황 6개 표시 |
| `frontend/src/features/dataInput/pages/DataInputPage.jsx` | 기준월 변경 처리, [점수 산출하기] |
| `frontend/src/features/dataInput/api/dataInputApi.js` | 점수 산출 요청 함수, 주석의 기능 번호 |
| `frontend/src/features/dataInput/mocks/dataInputMockHandlers.js` | 점수 산출 mock, 주석의 기능 번호 |
| `frontend/src/features/dataInput/mocks/altDataMock.js` | 국민연금·건강보험 더미 분리 |

## DB·API 변경
- DB: 없음
- API(mock만 변경, TODO(D-20))
  - 추가: `POST /api/members/me/score-calculation` → `{ calculatedAt }` / 완료 현황 미완료 409. B팀 명세가 나오면 맞춘다.
  - 변경: `POST /api/members/me/alt-data/social-insurance/import`를 없애고 `national-pension`, `health-insurance`로 나눴다. 응답 `rows`에서 `insuranceType`을 뺐다.
  - `PUT /api/members/me/financial-input` 요청에 `workPeriod: { baseMonth, periodMonths }` 추가. 자영업자·프리랜서의 `income.items`는 12줄이다.
  - `status.sections`에 `workPeriod` 추가. `status.altData`의 key는 `easypay`, `telecom`, `nationalPension`, `healthInsurance`다. `status.sections.income`은 자영업자·프리랜서의 경우 12개월을 모두 입력해야 true다.
- 영향을 받는 기능·팀원: 백엔드 입력 API 담당, 점수 산출 API 담당(B팀), 소득 변동성 진단(N-22-3, 0원인 달 수)

## 확인
- 확인함
  - `npm run lint` 오류 0건, `npm run build` 성공
  - 로직·mock node 검사 21건 통과(저장소 밖 스크립트): 12줄과 끝 달, 기준월 변경 시 금액 유지, 0원과 빈칸 구분, 완료 판단, mock PUT 400, 점수 산출 409·성공
  - 헤드리스 Chrome 점검 69건 통과: 세 직군 각각 직군 선택 → 입력 → 저장 → 완료 현황 6개 → 대안 데이터 4종 → [점수 산출하기] → `/report` 이동
  - 콘솔: 브라우저가 자동으로 요청하는 `favicon.ico` 404만 있다(이번 범위 밖).
- 확인 못 함: 실제 백엔드 연동(서버 없음)

## 다음 사람이 알아야 할 것
- `incomeShortageNotice`(정보 부족 안내)는 decisions.md에서 삭제됐지만 FP-86 수정 범위라 남겨 두었다. 지금은 처음 들어오면 "0개월" 안내가 보인다.
- 지출 완료는 월 고정 지출과 할부·정기결제 1줄 이상이 모두 있어야 한다. 대출이나 할부가 없는 사용자를 완료로 볼 방법이 없어 [점수 산출하기]가 켜지지 않는다.
- [점수 산출하기]의 완료 판단과 산출은 마지막으로 저장한 입력 기준이다.
- 첫 화면 분기(`getHomePath`)에 "점수 없음 → 데이터 입력"이 없다(N-01-2).

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
