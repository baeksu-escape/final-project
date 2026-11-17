# FastAPI 예측 서버 Mock — ML-01~04 (FP-140)

- **날짜:** 2026-11-16
- **작성자:** 오범영 / Claude Code
- **브랜치:** `feature-B/FP-140-prediction-mock-api`
- **관련 N-ID:** N-12-2 기존·대안 점수·3등급 계산·저장, N-14 항목별 SHAP 설명, N-18 신용케어 시뮬레이터(N-18-5 모델 점수 재계산, N-18-8 감점 요인 상위 3개 안내)
- **관련 결정:** 피처 정의서 v1.0(FP-132, 기존 19·대안 39), D-29, O-13(409, 11/16), O-15 A안, rank 동점 이름순(11/13), B팀 API 명세서 v0.3 4장

## 무엇을, 왜 바꿨나
- 빈 틀이던 `fastapi_server/`에 Spring → FastAPI 내부 API 4개(ML-01~04)를 Mock으로 만들었다. 진짜 모델 없이 Spring(FP-142)·A팀·C팀이 바로 호출해 개발할 수 있게 하려는 것이다.
- 피처 39개 계산(`feature_builder.py`)은 피처 정의서 3장 계산식대로 만들어 실제 모델(FP-141)에서도 그대로 쓴다. 점수만 Mock(고정 가중치 + PDO 변환)이고, 진짜 모델이 오면 `mock_scorer.py`만 바꾼다.
- 피처 코드는 `DIM_FEATURE` `FS-DRAFT` 시드 39개와 같다. 다르면 Spring 저장이 FK 오류로 실패하므로 검사로 막았다.
- 테스트는 수행계획서 기술 목록 안에서만 한다(Python 내장 `unittest` + FastAPI `/docs`). 새 라이브러리를 추가하지 않았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `fastapi_server/main.py` | 빈 파일 → 앱 시작점, 오류 응답 형식 `{code, message, fieldErrors, requestId}` |
| `fastapi_server/routers/assessment.py` | 새 파일. ML-01 health, ML-02 model-info, ML-03 score, ML-04 simulate, 409·422·오류 시험 헤더 |
| `fastapi_server/schemas/assessment.py` | 새 파일. ML-03·ML-04 요청 모양(명세서 4-3·4-4 필드 이름) |
| `fastapi_server/pipeline/feature_catalog.py` | 새 파일. 피처 39개·버전 3개·등급 구간 CUT-0.1 |
| `fastapi_server/pipeline/feature_builder.py` | 새 파일. 요청 → 피처 39개(정의서 3장) |
| `fastapi_server/pipeline/mock_scorer.py` | 새 파일. Mock 점수·SHAP·점수 합 맞추기·rank |
| `fastapi_server/pipeline/simulation.py` | 새 파일. 시뮬레이션(키 10개 → 피처, 영향 나누기, 감점 요인·회복 점수) |
| `fastapi_server/tests/test_mock_scorer.py` | 새 파일. 내장 unittest 23개 |
| `fastapi_server/README.md` | 새 파일. 실행·테스트 방법 |

## DB·API 변경
- DB: 없음. FastAPI는 DB를 읽거나 쓰지 않는다.
- API: 새 내부 경로 4개 `/v1/health`, `/v1/model-info`, `/v1/assessments/score`, `/v1/assessments/simulate` (Docker 내부망용, 화면은 직접 부르지 않음). 요청·응답은 B팀 명세서 4장과 같다. ML-03 `socialInsurance`에 `payerTypeCode`를 추가했다(명세서 11/16).
- 영향을 받는 기능·팀원:
  - 범영(FP-142 Spring): ML-03 응답을 `ASSESSMENT`·`ASSESSMENT_FACTOR`에 저장. `socialInsurance`에 `PAYER_TYPE_CODE`를 함께 보내야 한다
  - C팀 광희(SIM-02): ML-04를 부른다. `changes` 10번째 키 `UTILITY_LATE_MONTHS`는 🟡 제안(A-22)
  - 재욱(FP-141): 진짜 모델은 `feature_builder.py`가 만든 39개 피처를 입력으로 쓴다

## 확인
- 확인함: `python -m unittest discover tests -v` → 23개 통과 (피처 39개 = 시드 SQL = 정의서 11장, 기존 19/대안 39, 점수 0~1000, 등급 경계 664/665/779/780, 점수 합 규칙, rank 이름순, 급여소득자 × 12, null 유지, 시뮬레이션 영향 합, 409·422·500·503)
- 확인함: 로컬에서 `uvicorn`(포트 8765)을 켜고 Python 내장 `urllib`로 호출
  - ML-01 200 UP / ML-02 200 버전 3개·피처 39개
  - ML-03 200 (합성 예시: 기존 602 CAUTION, 대안 588 CAUTION, 기준점 639, SHAP 39개) — 대안 점수가 더 낮은 경우도 그대로 나온다
  - ML-04 200 (588 → 618, 금융 영향 16 + 대안 영향 14 = 30, 감점 요인 2개)
  - 422 `alternativeData.utility` 없음, 409 버전 불일치, 503 `X-Mock-Scenario: NOT_READY`
- 확인함(11/16, FP-142와 함께): Spring에서 실제 호출 — 시연 계정 로그인 → 점수 산출 → 공용 DB에 평가 1행 + SHAP 39행 저장 → 리포트·진단 내역
- 확인 못 함: Docker 실행(Dockerfile은 FP-142, 이 PC에 Docker 없음), `TIMEOUT` 시나리오(5초 대기) 실제 시간 측정

## 다음 사람이 알아야 할 것
- 점수·가중치는 Mock이다. 점수 변환식은 O-3 확정(11/16 범영): 700점 = 20:1, 40점마다 오즈 2배, 0~1000.
- O-6(DIAG-09는 ML-03을 부르고 저장 안 함)·O-9(시뮬레이션 저장 안 함)·O-14(회복 점수 = 시뮬레이터 범위 안 가장 좋은 값으로 바꿨을 때의 점수 차이)도 11/16 추천안으로 확정됐고, 코드는 이미 그대로 동작한다.
- 정의서 9장 미정 사항은 `TODO`로 남겼다: 간편결제 월 건수 × 12 변환, 통신비 정시 납부를 바꿀 때 미납 달 연동 안 함, 회복 점수용 "가장 좋은 값"(O-14).
- 피처 정의서 11장·시드 SQL이 바뀌면 `feature_catalog.py`도 같이 고친다. 안 고치면 테스트가 실패해서 알려 준다.
- 학습 데이터의 코드형 피처 값은 소문자(`covered`, `workplace`, `selfemp`)라 DB 대문자 코드를 소문자로 바꿔 넣는다.

## [2026-11-16 · 오범영 / Claude Code] PR 검토 반영 (재욱 검토, 피처 정의서 PR #54 기준)
- develop 최신화(PR #54: 3-7 계산 세부 규칙, C8 이상치 상한, C9 `LRZ021201` 제외 38개, C11 `dp_ever_used` 확정)를 반영했다.
- 결정(11/16 범영·재욱, 모두 추천안)
  - ① 피처 수: `FS-DRAFT` 39개를 유지하고, 정의서가 확정되면 `FS-V1`(38개) 시드는 재욱이 추가한다(O-17 계획 그대로). 테스트는 "정의서 코드 ⊂ FS-DRAFT, 차이는 `LRZ021201`뿐"으로 바꿨다.
  - ② 이상치(C8): 소득 합계 20억 초과·평균 월 지출 2억 초과·월 상환액 0 미만이면 그 값과 **그 값으로 계산하는 피처도 함께 결측**((가)안). 상한은 `feature_builder.py` 상수(`TODO(C8)`).
  - ③ 시뮬레이션: 모르는 키, 카드 한도·월 사용액 중 하나만 온 경우 422. 카드 한도 0이면 사용률 결측(점수 계산과 같은 규칙). B팀 명세서 4-4 변경 → C팀 광희 님께 알림.
- 추가 반영
  - 소득 합계 0 이하면 지출 비율·상환 부담률 결측, 평균 0 이하면 소득 변동 결측(정의서 3-1·3-7 ①).
  - ML-03: `requiredIncomeMonths`가 없거나 직군(12/12/1)과 다르거나, 소득 달이 겹치면 422(3개월치로 12개월 피처를 만들지 않게).
  - `VOLUNTARY`·`HOUSEHOLD`·가입 상태 `UNKNOWN`의 Mock 기여를 0(중립)으로 명시하고, 학습에 없는 값은 정의서 9장 미정 `TODO`로 표시.
  - `TODO(FP-141)` 반올림 방식(학습은 ROUND_HALF_UP), 간편결제 × 12 `TODO(정의서 9장)` 유지, `dp_ever_used` C11 확정 주석.
  - README: "설치할 것 없음" → "`pip install -r requirements.txt` 후"(테스트가 pydantic을 불러온다). httpx는 쓰지 않는다(TestClient 미사용).
  - 통신비·공과금에는 PARTIAL 상태가 없음을 확인(DDL `ON_TIME/LATE/UNPAID`, 생성 코드 `on_time/late`) → 정의서 3-2 보완 요청.
- 확인: `python -m unittest discover tests` **33개 통과**(새 10개: 이상치 3종·소득 0·카드 한도 0·이상치 점수 범위, 소득 개월 필수·중복 달, 시뮬레이션 422·카드 한도 0)

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
