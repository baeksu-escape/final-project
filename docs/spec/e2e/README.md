# E2E 연동 점검 (FP-143)

화면(React) → Spring(8080) → FastAPI(8000) → DB 저장까지 한 흐름으로 동작하는지 확인한다. 자동 점검은 [e2e_check.py](e2e_check.py)가 하고, 사람이 눈으로 볼 것은 아래 「수동 점검」에 적는다.

## 1. 준비
- DB: **평소에는 로컬 DB.** 점수 산출(E2E-03)이 평가 1행을 실제로 저장하므로, 공용 DB는 통합 테스트 때만 쓴다.
- 실제 모델로 보려면 그 DB의 ACTIVE가 `LGBM-BASE-0.1`이어야 한다(`docs/spec/sql/register_model_lgbm_base_0_1.sql` → `activate_model_lgbm_base_0_1.sql`). 공용 DB는 11/18 전환 완료.
- 켜 둘 것: 백엔드(STS), FastAPI(`uvicorn main:app --port 8000`, 모델 파일 5개는 `fastapi_server/artifacts/`). 화면은 자동 점검에는 필요 없다.
- 시연 계정 비밀번호는 저장소 밖 env 파일의 `AVENUE_DEMO_PASSWORD`(팀 개발 env 파일)에서 읽는다.

## 2. 자동 점검 실행 (저장소 루트에서)
```powershell
python -I -X utf8 docs/spec/e2e/e2e_check.py --env-file "$env:USERPROFILE\avenue-secrets\avenue_dev.env"
python -I -X utf8 docs/spec/e2e/e2e_check.py --login demo_self --env-file "$env:USERPROFILE\avenue-secrets\avenue_dev.env"
```
파이썬 기본 라이브러리만 쓴다(설치할 것 없음). 항목마다 `PASS/FAIL/SKIP`과 근거 한 줄을 출력하고, FAIL이 있으면 종료 코드 1이다.
E2E-09B는 다른 시연 계정(기본: `--login`이 아닌 첫 계정)으로도 로그인한다. 바꾸려면 `--other-login demo_free`.

| ID | 흐름 | 기대 결과 | API |
|---|---|---|---|
| E2E-00 | FastAPI 준비 | `modelLoaded: true` | ML-01 |
| E2E-01 | 시연 계정 로그인 | 200 + 토큰 | AUTH-01 |
| E2E-02 | 토큰 없이 리포트 | 401 | RPT-02 |
| E2E-03 | 점수 산출(저장) | 200 `SCORED` | RPT-01 → ML-03 → `ASSESSMENT`·`ASSESSMENT_FACTOR` |
| E2E-04 | 같은 requestId 다시 | 새로 저장하지 않고 같은 결과 | RPT-01 |
| E2E-05 | 내 리포트 | 방금 평가, `modelVersion` = 기대 모델 버전(E2E-00 health 또는 `--model-version`) | RPT-02 |
| E2E-06 | SHAP·피처 칩 | 요인 1개 이상, 피처 칩 기존 18 / 대안 38 | RPT-02 |
| E2E-07 | 진단 내역 | 맨 위 = 방금 평가 | MEM-06 |
| E2E-08 | 지난 평가 상세 | 200 | RPT-03 |
| E2E-09 | 없는 평가(임의 UUID) | 404 `ASSESSMENT_NOT_FOUND` | RPT-03 |
| E2E-09B | 다른 회원의 실제 평가 | 그 회원은 200으로 열리고, 내 토큰으로는 404 `ASSESSMENT_NOT_FOUND`. 다른 계정에 평가가 없으면 SKIP | MEM-06 → RPT-03 |
| E2E-10 | 시뮬레이터 현재 값 | 입력 10개 | SIM-01 |
| E2E-11 | 시뮬레이터 재계산 | 200. 화면이 쓰는 값: 전 점수 = 리포트 대안 점수, 전·후 점수 0~1000·등급 코드, `delta.total` = 후 − 전 = 금융 + 대안 영향, 감점 요인은 배열이고 항목마다 순위·피처 이름·감점 | SIM-02 → ML-04 |
| E2E-12 | 시뮬레이터 범위 밖(통신비 13개월) | 400 `changes.TELECOM_ON_TIME_MONTHS` | SIM-02 |
| E2E-13 | 예상 점수(소득 −10%) | 200. 화면이 쓰는 값: 현재 점수 = 리포트 대안 점수, 출발 평가 = 방금 평가, 예상 점수 0~1000·등급 코드, 차이 = 예상 − 현재, 두 모델 버전 = 실제 모델 | DIAG-09 → ML-03 |
| E2E-14 | 시뮬레이터·예상 점수 | 진단 내역 건수가 늘지 않고 맨 위 평가도 그대로(저장 안 함) | MEM-06 |

**스크립트와 같이 고쳐야 하는 값**
- 기대 모델 버전은 코드에 없다. E2E-00에서 FastAPI `/v1/health`의 `modelVersion`을 읽어 쓰고, 직접 정하려면 `--model-version LGBM-BASE-0.2`. 그래서 모델을 바꿔도 스크립트는 그대로다(FP-237).
- E2E-12의 13개월: 통신비 정시 납부 상한 **12개월이 임시값(SIM-02 TODO)**이라 그 바로 위 값으로 범위 밖을 확인한다. 상한이 바뀌면 이 값도 "새 상한 + 1"로 바꾼다.
- E2E-06의 피처 칩 18/38: 피처 세트(FS-V1)가 바뀌면 같이 바꾼다.

## 3. 수동 점검 (자동으로 보기 어려운 것)
| ID | 할 일 | 기대 결과 |
|---|---|---|
| M-01 | FastAPI를 끈 채 점수 산출 | 200 `NOT_SCORABLE` + `MODEL_ERROR` 저장, 화면 안내 문구 |
| M-02 | FastAPI를 끈 채 시뮬레이터·예상 점수 | 503 `MODEL_NOT_READY`, 진단 내역 늘지 않음 |
| M-03 | 새 회원가입(휴대폰·이메일 인증) → 직군 → 입력 → 대안 데이터 5종 동의·불러오기 → 점수 산출 | 화면 흐름이 끊기지 않고 리포트까지 |
| M-04 | 입력 덜 찬 계정으로 점수 산출 | 409 `INPUT_INCOMPLETE`, 평가 행 저장 안 함 |
| M-05 | 직군별 시연 계정 3개(`demo_employee`·`demo_self`·`demo_free`) | 각자 점수 산출·리포트 정상 (자영업자·프리랜서는 근무기간 입력 필요할 수 있음) |
| M-06 | 화면에서 리포트 게이지·SHAP 카드·시뮬레이터 슬라이더 | 숫자가 API 응답과 같음 |

## 4. 평가 조회 실행 계획 점검 (SQL)
- [explain_assessment_queries.sql](explain_assessment_queries.sql): 리포트·진단 내역·시뮬레이터가 부르는 쿼리 6개가 인덱스를 쓰는지 본다. 서비스 표는 바꾸지 않고, 계획을 적은 `PLAN_TABLE`의 자기 행만 끝에 지우고 COMMIT한다(새 창에서 실행).
- [gather_assessment_stats.sql](gather_assessment_stats.sql): 평가 행 수가 많이 바뀐 뒤에만 먼저 실행한다. **통계를 바꾸는 파일**이라 따로 뗐다(데이터는 그대로). 공용 DB에서는 실행하지 않는다한다.

## 5. 결과 기록
점검할 때마다 날짜·DB(로컬/공용)·계정·PASS/FAIL 수를 작업 로그(`docs/logs/`)에 남긴다.
