# Spring 점수 산출·저장 + 리포트·진단 내역 API (FP-142)

- **날짜:** 2026-11-16
- **작성자:** 오범영 / Claude Code
- **브랜치:** `feature-B/FP-142-score-save` (FP-140 `feature-B/FP-140-prediction-mock-api` 위에서 작업, FP-140을 먼저 올린다)
- **관련 N-ID:** N-12-2 기존·대안 점수·3등급 계산·저장, N-12 나의 신용 리포트(N-12-3 점수 차이·등급 변화, N-12-6 점수·등급 비교), N-14 영역별 영향도(SHAP), N-04-6 진단 내역 조회
- **관련 결정:** O-13(입력·동의 덜 차면 409, 11/16), O-11(타임아웃 연결 1초·응답 3초), 입력 최신성 = DB `APP_SETTING.INPUT_MAX_AGE_MONTHS`(11/16 범영, 현재 3), Q-1(RPT·MEM-06 Spring = 범영), B팀 API 명세서 v0.3 2장·3장·4-3

## 무엇을, 왜 바꿨나
- 화면은 점수 산출·리포트·진단 내역 API를 이미 부르는데 Spring에 코드가 없어서 "저장이 안 된다"는 상태였다. 새 패키지 `com.baeksuescape.assessment`에 API 4개를 만들었다.
- 점수 산출은 B팀 명세서 2장 순서를 따른다: requestId 확인 → 같은 요청이면 처음 결과 → 직군(409) → 입력 6항목·대안 5종(409 `INPUT_INCOMPLETE`) → 입력 최신성(넘으면 `NOT_SCORABLE`+`STALE_INPUT` 저장) → FastAPI ML-03(실패 시 1번 재시도, 그래도 실패면 `MODEL_ERROR` 저장) → `ASSESSMENT` 1행 + `ASSESSMENT_FACTOR` 여러 행을 한 트랜잭션으로 저장.
- 입력 완료 판정은 A팀 `FinancialInputService.load()`의 완료 현황을 그대로 읽고, 입력 행은 A팀 `FinancialInputMapper`의 읽기 메서드를 쓴다. A팀 코드는 고치지 않았다.
- FastAPI 호출은 Spring에 원래 있는 `RestClient`를 쓴다(새 라이브러리 없음, `pom.xml` 그대로).
- FastAPI를 어느 PC에서든 켤 수 있게 `fastapi_server/Dockerfile`(빈 파일이었음)과 `.dockerignore`를 채웠다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../assessment/controller/ScoreController.java` | 새 파일. RPT-01 `POST /api/members/me/score-calculation` |
| `backend/.../assessment/controller/ReportController.java` | 새 파일. RPT-02 `GET /api/report/me`, RPT-03 `GET /api/report/{requestId}` |
| `backend/.../assessment/controller/DiagnosisController.java` | 새 파일. MEM-06 `GET /api/members/me/diagnoses` |
| `backend/.../assessment/service/ScoreCalculationService.java` | 새 파일. 판정 흐름·재시도·한 트랜잭션 저장 |
| `backend/.../assessment/service/ScoreInputAssembler.java` | 새 파일. DB 입력 → ML-03 요청(`payerTypeCode` 포함, 대출 없음이면 `[]`) |
| `backend/.../assessment/service/ReportService.java` | 새 파일. 리포트(등급 구간·SHAP+피처 사전 이름)·진단 내역(직전 SCORED 대비 변화) |
| `backend/.../assessment/client/PredictionClient.java`, `PredictionProperties.java` | 새 파일. FastAPI 호출, `avenue.prediction.base-url`(기본 `http://localhost:8000`) |
| `backend/.../assessment/dto/ScoreDtos.java`, `ReportDtos.java`, `AssessmentRows.java` | 새 파일. 요청·응답·DB 행 |
| `backend/.../assessment/mapper/AssessmentMapper.java` + `resources/mapper/assessment/AssessmentMapper.xml` | 새 파일. 평가 저장·조회, 대안 데이터 읽기, 설정·모델 버전 조회 |
| `backend/src/main/resources/application.properties.example` | **공용 견본에 한 줄 추가**: `avenue.prediction.base-url=` (값 비움, 범영 승인 11/16) |
| `backend/src/test/.../assessment/**` | 새 파일. 서비스 테스트 2개 + API 계약 테스트 1개(21개) |
| `fastapi_server/Dockerfile`, `.dockerignore` | 빈 Dockerfile 채움(python:3.11-slim, uvicorn 8000), 학습 데이터·테스트 제외 |
| `fastapi_server/README.md` | Docker로 켜는 방법 추가 |

## DB·API 변경
- DB: 표·열 변경 없음. `ASSESSMENT`·`ASSESSMENT_FACTOR`에 행을 쓰고 `APP_SETTING`·`MODEL_REGISTRY`·`SCORE_GRADE_BAND`·`DIM_FEATURE`·`DIM_WORKER_TYPE`·대안 데이터 표를 읽는다.
- API(새로 구현, 경로·필드는 화면 mock·B팀 명세서 그대로):
  - RPT-01 `POST /api/members/me/score-calculation` `{requestId}` → `{calculatedAt, requestId, gradeStatusCode, notScorableReasonCode, alternative, traditional}`. 오류 400 `INVALID_INPUT`, 409 `JOB_TYPE_REQUIRED`·`INPUT_INCOMPLETE`·`REQUEST_ID_CONFLICT`
  - RPT-02·03 리포트(404 `ASSESSMENT_NOT_FOUND`, 남의 평가도 404), MEM-06 진단 내역 `{items:[...]}`
  - 화면에 보내지 않는 것: `ASSESSMENT_ID`, `FEATURE_SNAPSHOT`, `SHAP_VALUE`
- 보안 설정(`SecurityConfig`)은 고치지 않았다. `/api/members/me/**`·`/api/report/**`가 이미 `ROLE_USER`다.
- 영향을 받는 기능·팀원:
  - A팀(우찬·경환): 화면 mock 대신 실제 서버로 점수 산출·리포트·진단 내역을 쓸 수 있다. 화면 쪽 변경은 없다
  - C팀(광희): 시뮬레이터(ML-04)는 아직 Spring 쪽 연결이 없다(SIM-02 담당)
  - 모두: Spring을 켤 때 FastAPI도 켜야 점수가 나온다(꺼져 있으면 `MODEL_ERROR`로 저장되고 다른 기능은 영향 없음)

## 확인
- 확인함: `./mvnw test` → **220개 통과, 실패 0** (새 21개 + 기존 199개)
  - 판정: 400·409(직군·입력·남의 requestId), 같은 requestId 재요청, 입력 최신성 경계(3개월 허용·4개월 STALE), FastAPI 2번 실패 → MODEL_ERROR, 1번 실패 후 성공, 평가 1 + 요인 39 저장, 연령대 경계, 저장 시각 마이크로초 맞춤
  - 리포트·진단 내역: 404, 점수 차이·등급 변화, 산출 불가 행 처리, 변화 계산(산출 불가 건너뜀), 내부 필드 비노출
- 확인함(실제 연결, 범영 PC): STS로 Spring(8080, 공용 DB) + FastAPI Mock(8000)을 켜고 시연 계정(급여소득자)으로 로그인 → 점수 산출 200 `SCORED`(기존 656 CAUTION / 대안 693 STANDARD) → 리포트 SHAP 39개·기준점+합 = 693 → 상세·진단 내역 정상
  - 이때 같은 requestId 재요청의 응답 시각이 소수점 끝자리만 달라(서버 7자리·DB 6자리) 저장 전에 마이크로초로 맞추도록 고쳤고 테스트를 추가했다
- 확인 못 함: Docker 빌드·실행(이 PC에 Docker 없음), 수정 후 실제 재요청(Spring 재시작 후 확인 예정), STALE_INPUT·MODEL_ERROR의 실제 DB 저장

## 다음 사람이 알아야 할 것
- 공용 DB에 시연 계정의 테스트 평가 1건이 저장됐다(11/16, 범영 확인용).
- 입력 최신성 기준은 DB 설정 `INPUT_MAX_AGE_MONTHS`(지금 3)다. 시드 데이터 기준월이 2026-08이라, 12월 시연 전에는 이 값을 늘리거나 입력을 다시 저장해야 시드 회원이 산출된다(팀 안건).
- 평가는 추가만 하고 고치거나 지우지 않는다(DDL W1).
- Spring 실행에 `application.properties`(DB)와 환경변수 `AVENUE_JWT_SECRET`·`AVENUE_DEV_AES_KEY`·`AVENUE_DEV_HMAC_KEY`가 필요하다(`backend/README.md`).

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
