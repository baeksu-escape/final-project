# 데이터 입력 검증 v3 수정 (FP-86)

- **날짜:** 2026-11-09
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-151-V3-Update`
- **관련 N-ID:** N-05-7(입력값 검사), N-05-8(입력 완료 현황), N-22-2(삭제)
- **관련 결정:** 11/09 월 소득 12개월 확정·정보 부족 삭제, D-24(기간), D-20(응답 형식 임시안)

## 무엇을, 왜 바꿨나
- N-22-2 "정보 부족" 처리가 삭제되어 안내와 기준값을 없앴다.
- 월별 소득은 일부만 입력해도 저장된다. 12개월이 안 차면 입력 완료 현황의 "소득(12개월)"이 미완료로 남아 [점수 산출하기]가 열리지 않고, 항목 옆에 남은 달 수를 안내한다.
- FP-85 v3 때의 "12칸이 모두 있어야 저장"은 이번 수정으로 바뀌었다.
- 범위 밖 달·중복·12줄 초과는 오류로 막는다. mock이 저장 본문을 되돌릴 때 이런 줄을 흘려 버리지 않게 고쳤다.
- 재직·운영·활동 기간에 숫자·0 이상·상한 검사를 더했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/dataInput/config/validationLimits.js` | `INCOME_MONTHS_SHORTAGE` 삭제, `WORK_PERIOD_MONTHS_MAX` 추가 |
| `frontend/src/features/dataInput/config/inputSections.js` | 소득 금액 칸 필수 해제, 남은 달 안내 연결, 기간 칸 검증 |
| `frontend/src/features/dataInput/validation/inputRules.js` | `incomeShortageNotice` 삭제, `incomeRemainingNotice` 추가 |
| `frontend/src/features/dataInput/validation/inputValidation.js` | 안내 예시 주석 수정 |
| `frontend/src/features/dataInput/validation/serverErrors.js` | TODO(D-20) 주석 |
| `frontend/src/features/dataInput/utils/inputValues.js` | 저장 본문을 되돌릴 때 범위 밖·중복 달을 남겨 검증이 잡게 함 |
| `frontend/src/features/dataInput/components/SectionList.jsx` | 정보 부족 안내 문단과 `notice` prop 삭제 |
| `frontend/src/features/dataInput/components/InputStatus.jsx` | 미완료 항목 옆 안내 표시 |
| `frontend/src/features/dataInput/pages/DataInputPage.jsx` | 안내를 완료 현황으로 전달, TODO(D-20) 주석 |

## DB·API 변경
- DB: 없음
- API: 경로와 오류 응답 형식은 그대로다. `PUT /api/members/me/financial-input`의 `income.items[].amount`는 미입력이면 `null`이다(줄은 12줄 그대로). `0`은 입력한 값이다.
- 영향을 받는 기능·팀원: 백엔드 입력 API 담당(빈 달 `null` 처리), 소득 변동성 진단 담당(N-22, 12개월이 다 차지 않은 저장값이 있을 수 있음)

## 확인
- 확인함
  - `npm run lint` 오류 0건, `npm run build` 성공
  - 규칙·mock node 검사 19건 통과(저장소 밖 스크립트): 지운 이름, 남은 달 안내, 0원·음수, 기간 필수·음수·문자·상한, 범위 밖·중복·13줄 400, 11개월 저장과 점수 산출 409, 12개월 성공
  - 헤드리스 Chrome 점검 58건 통과: 세 직군의 잘못된 값 차단, 11개월 저장 후 닫힘과 남은 달 안내, 12개월이면 열림, `/report` 이동, 정보 부족 문구 없음
  - 콘솔: 브라우저가 자동으로 요청하는 `favicon.ico` 404만 있다.
- 확인 못 함: 실제 백엔드 연동(서버 없음). 단위 테스트는 저장소에 없어 만들지 않았다.

## 다음 사람이 알아야 할 것
- 임시값 `WORK_PERIOD_MONTHS_MAX: 600`은 `config/validationLimits.js`에 있다(TODO(D-24)).
- 남은 달 수는 지금 입력 중인 값으로 세고, 완료 여부와 [점수 산출하기]는 저장값 기준이다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
