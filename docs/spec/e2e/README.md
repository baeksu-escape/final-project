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

| ID | 흐름 | 기대 결과 | API |
|---|---|---|---|
| E2E-00 | FastAPI 준비 | `modelLoaded: true` | ML-01 |
| E2E-01 | 시연 계정 로그인 | 200 + 토큰 | AUTH-01 |
| E2E-02 | 토큰 없이 리포트 | 401 | RPT-02 |
| E2E-03 | 점수 산출(저장) | 200 `SCORED` | RPT-01 → ML-03 → `ASSESSMENT`·`ASSESSMENT_FACTOR` |
| E2E-04 | 같은 requestId 다시 | 새로 저장하지 않고 같은 결과 | RPT-01 |
| E2E-05 | 내 리포트 | 방금 평가, `modelVersion` = `LGBM-BASE-0.1` | RPT-02 |
| E2E-06 | SHAP·피처 칩 | 요인 1개 이상, 피처 칩 기존 18 / 대안 38 | RPT-02 |
| E2E-07 | 진단 내역 | 맨 위 = 방금 평가 | MEM-06 |
| E2E-08 | 지난 평가 상세 | 200 | RPT-03 |
| E2E-09 | 없는·남의 평가 | 404 `ASSESSMENT_NOT_FOUND` | RPT-03 |
| E2E-10 | 시뮬레이터 현재 값 | 입력 10개 | SIM-01 |
| E2E-11 | 시뮬레이터 재계산 | 200, 전·후 점수와 감점 요인 | SIM-02 → ML-04 |
| E2E-12 | 시뮬레이터 범위 밖(통신비 13개월) | 400 `changes.TELECOM_ON_TIME_MONTHS` | SIM-02 |
| E2E-13 | 예상 점수(소득 −10%) | 200, 실제 모델로 계산 | DIAG-09 → ML-03 |
| E2E-14 | 시뮬레이터·예상 점수 | 진단 내역 건수가 늘지 않음(저장 안 함) | MEM-06 |

## 3. 수동 점검 (자동으로 보기 어려운 것)
| ID | 할 일 | 기대 결과 |
|---|---|---|
| M-01 | FastAPI를 끈 채 점수 산출 | 200 `NOT_SCORABLE` + `MODEL_ERROR` 저장, 화면 안내 문구 |
| M-02 | FastAPI를 끈 채 시뮬레이터·예상 점수 | 503 `MODEL_NOT_READY`, 진단 내역 늘지 않음 |
| M-03 | 새 회원가입(휴대폰·이메일 인증) → 직군 → 입력 → 대안 데이터 5종 동의·불러오기 → 점수 산출 | 화면 흐름이 끊기지 않고 리포트까지 |
| M-04 | 입력 덜 찬 계정으로 점수 산출 | 409 `INPUT_INCOMPLETE`, 평가 행 저장 안 함 |
| M-05 | 직군별 시연 계정 3개(`demo_employee`·`demo_self`·`demo_free`) | 각자 점수 산출·리포트 정상 (자영업자·프리랜서는 근무기간 입력 필요할 수 있음) |
| M-06 | 화면에서 리포트 게이지·SHAP 카드·시뮬레이터 슬라이더 | 숫자가 API 응답과 같음 |

## 4. 결과 기록
점검할 때마다 날짜·DB(로컬/공용)·계정·PASS/FAIL 수를 작업 로그(`docs/logs/`)에 남긴다.
