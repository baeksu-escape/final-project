# FP-166 건전성·DSR 계산 API와 공통 재계산 틀 추가 (DB 없이)

- **날짜:** 2026-11-13
- **작성자:** 광희 (C조) / Claude Code
- **브랜치:** `feature-C/FP-183-ImplementIncomeVolatilityANDCashFlowCalculationLogic` (FP-183·203에 이어 작업, 커밋 전)
- **관련 N-ID:** N-16-1, N-16-2, N-16-3, N-20-3, N-20-4, N-17-3, N-18-4, N-21-4
- **관련 결정:** decisions.md 1-4 "위험 단계(예시 기준)", 투표 D9(연소득 집계), D-20(공통 응답 형식 미정)

## 무엇을, 왜 바꿨나
- DB 없이 만들 수 있는 핵심부터 구현했다.
  - 건전성 지표(순자산, 상환 부담률, 자산 대비 부채, 순자산 대비 부채)와 위험 단계 판정
  - DSR 계산과 연소득 집계
- 상환 부담률(N-16-1)과 DSR(N-20-4)은 명세대로 `calculateRepaymentBurdenRatio()` 함수 하나를 함께 쓴다.
- 시나리오(N-17)·시뮬레이터(N-18)·현금흐름(N-21)이 함께 쓸 공통 재계산 틀(`RecalculationFrame`)을 만들었다. 값 변경 방식은 `SET`, `PERCENT`, `ADD` 세 가지다.
- 프론트 mock에만 있던 `POST /api/diagnosis/dsr/calculate`를 같은 경로·필드로 백엔드에 만들었다. 프론트는 mock을 끄면 바로 쓸 수 있다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../finance/util/FinancialHealthCalculator.java` (신규) | N-16·N-20 순수 계산, 위험 단계 기준 상수 6개 |
| `backend/.../finance/util/RecalculationFrame.java` (신규) | N-17-3·N-18-4·N-21-4 공통 재계산 틀 |
| `backend/.../finance/dto/FinancialHealthRequest.java` (신규) | 건전성 요청(총자산·연소득·총부채·연 원리금) |
| `backend/.../finance/dto/FinancialHealthResponse.java` (신규) | 건전성 응답(금액 3개, 비율 3개, 단계 3개) |
| `backend/.../finance/service/FinancialHealthService.java` (신규) | 입력 검사(음수·연소득 0이면 400)와 응답 변환 |
| `backend/.../finance/controller/FinancialHealthController.java` (신규) | `POST /api/diagnosis/dsr/calculate`, `POST /api/diagnosis/financial-health/calculate` |
| `backend/src/test/.../util/FinancialHealthCalculatorTest.java` (신규) | 비율·경계값·0 나눗셈·연소득 집계 6건 |
| `backend/src/test/.../util/RecalculationFrameTest.java` (신규) | 변경 방식 3개·불변·오류 5건 |
| `backend/src/test/.../controller/FinancialHealthControllerTest.java` (신규) | API 2개 응답 필드·400 4건 |
| `docs/spec/api_spec.md` | FP-166 절과 공통 재계산 틀 설명 추가 |
| `frontend/src/features/diagnosis/api/diagnosisApi.js` | `calculateFinancialHealth()` 추가 |
| `frontend/src/features/diagnosis/mocks/diagnosisMockData.js` | 건전성 기준 상수와 단계 판정 함수 추가 |
| `frontend/src/features/diagnosis/mocks/diagnosisMockHandlers.js` | 건전성 mock 등록 (기존 DSR mock은 그대로) |

## DB·API 변경
- DB: 없음
- API:
  - `POST /api/diagnosis/dsr/calculate` (백엔드 신규. 경로·필드는 기존 프론트 mock과 같다)
  - `POST /api/diagnosis/financial-health/calculate` (신규)
- 영향을 받는 기능·팀원: A조(N-16·N-20 화면, DSR 함수 공유), FP-167·FP-170(재계산 틀 사용 예정)

## 확인
- 확인함:
  - `./mvnw clean test` 전체 36건 통과. 새로 추가한 건은 15건이다.
    - FinancialHealthCalculator 6건
    - RecalculationFrame 5건
    - FinancialHealthController 4건
  - `npm run lint` 오류 0
- 확인 못 함:
  - 화면 동작. N-16·N-20 화면이 아직 없다.
  - 저장 데이터로 계산한 결과. DB 조회 연결은 이번 범위 밖이다.

## 다음 사람이 알아야 할 것
- 경계는 "기준 **이상**"이다. 30.00%는 주의, 40.00%는 위험이다.
- 나누는 값(연소득·총자산·순자산)이 0 이하이면 비율과 단계가 `null`이다. 화면에서 "계산 불가"를 어떻게 보일지, 순자산 0 이하를 위험으로 볼지는 팀 확인이 필요하다(`TODO(팀 확인)`).
- DSR 함수 이름·입출력은 A조와 맞춰야 한다(N-16-1·N-20-4 공유).
- FP-203 현금흐름 전망은 아직 자체 변화율 계산을 쓴다. 공통 재계산 틀로 옮기는 것은 후속 작업이다(반올림 차이 확인 필요).
- 프론트 mock의 DSR 안내 문구는 "30%를 초과"로 되어 있어 실제 기준(이상)과 다르다. 백엔드 응답 문구는 "이상"으로 썼다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
