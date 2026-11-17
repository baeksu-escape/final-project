# Avenue 예측 서버 (FastAPI) — Mock + 실제 모델(LightGBM 베이스라인)

Spring이 부르는 내부 API(ML-01~04)를 제공한다. **요청의 모델 버전이 계산기를 고른다**(FP-141).

| DB의 ACTIVE 모델(`MODEL_REGISTRY`) = Spring이 보내는 버전 | 계산 | 피처 세트 |
|---|---|---|
| `DEV-DUMMY` (지금) | Mock(`pipeline/mock_scorer.py`, 고정 가중치, 점수 의미 없음) | `FS-DRAFT` 39개 |
| `LGBM-BASE-0.1` | 실제 모델(`pipeline/model_scorer.py`, 합성 데이터로 학습한 임시 베이스라인) | `FS-V1` 38개 |
| 그 밖 | 409 `VERSION_MISMATCH` | |

- 그래서 **DB의 ACTIVE 모델을 바꾸는 것이 곧 스위치**다. 코드를 병합해도 DB가 `DEV-DUMMY`인 동안은 Mock 그대로다.
- 실제 모델은 `artifacts/legacy.joblib`·`alternative.joblib`에서 서버가 켜질 때 한 번 불러온다. 파일이 없으면 `/v1/health`의 `modelLoaded: false`이고, `LGBM-BASE-0.1` 요청은 **503 `MODEL_NOT_READY`**다(Mock으로 바꾸지 않는다, 11/17 범영·재욱 합의).
- 실제 모델의 점수 환산·SHAP·합 규칙은 `training/explain.py`(FP-138), 모델 입력은 `training/interface.py`를 그대로 쓴다. 점수·SHAP은 실제 신용평가나 인과관계가 아니다.

- API 상세: B팀 API 명세서 4장 (공유 페이지 https://claude.ai/artifact/XwacnHd2SAWDJvi5nXGchr#spec)
- 피처 39개: `docs/spec/feature_definition.md` 11장 = `docs/spec/sql/seed/avenue_seed_dim_feature_fs_draft.sql`
- FastAPI는 DB를 읽거나 쓰지 않는다. 저장은 Spring(FP-142)이 한다.

## 실행 (1차 개발·시연 기준: 한 PC + 파이썬 가상환경)

1차 개발과 시연은 Docker 없이 FastAPI·Spring·React를 **한 PC**에서 켠다(11/16 결정). FastAPI는 파이썬 내장 가상환경(venv, Python 3.11)에 라이브러리를 따로 설치해서 PC의 다른 파이썬 프로그램과 버전이 섞이지 않게 한다.

```
cd fastapi_server
python -m venv .venv                   # 처음 한 번 (.venv 폴더는 Git에 올라가지 않는다)
.venv\Scripts\activate                 # 켤 때마다 — 터미널 앞에 (.venv)가 보이면 된 것
pip install -r requirements.txt        # 처음 한 번, requirements.txt가 바뀌면 다시
uvicorn main:app --port 8000
```

- PowerShell에서 `activate`가 "스크립트를 실행할 수 없습니다"로 막히면 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`를 한 번 실행한 뒤 다시 한다. Git Bash는 `source .venv/Scripts/activate`.
- 끌 때는 `Ctrl + C`, 가상환경에서 나올 때는 `deactivate`.
- Spring은 기본값(`avenue.prediction.base-url`이 비어 있으면 `http://localhost:8000`)으로 이 서버를 부르므로 같은 PC면 따로 설정할 것이 없다.

**실제 모델 파일 받기 (실제 모델을 쓸 때만)**
1. 팀 채널 #파일공유에서 모델 묶음(`legacy.joblib`, `alternative.joblib`, `*.meta.json`, `SHA256SUMS.txt`)을 받는다.
2. 4개 파일을 `fastapi_server/artifacts/`에 넣는다(Git에는 올라가지 않는다).
3. 해시가 `SHA256SUMS.txt`와 같은지 확인한다: PowerShell `Get-FileHash artifacts\legacy.joblib -Algorithm SHA256`. joblib은 불러올 때 파일 안의 코드가 실행될 수 있으므로 이 묶음 외의 `.joblib`은 넣지 않는다.
4. 서버를 다시 켜고 http://localhost:8000/v1/health 에서 `"modelLoaded": true`인지 본다.

브라우저에서 http://localhost:8000/docs 를 열면 API 4개를 직접 눌러 볼 수 있다.

| ID | 경로 | 내용 |
|---|---|---|
| ML-01 | `GET /v1/health` | 서버 상태, 실제 모델을 불러왔는지(`modelLoaded`), 받는 모델 버전 목록 |
| ML-02 | `GET /v1/model-info` | 버전 3개, 등급 구간, 피처 목록(실제 모델을 불러왔으면 `LGBM-BASE-0.1`/`FS-V1` 38개, 아니면 `DEV-DUMMY`/`FS-DRAFT` 39개) |
| ML-03 | `POST /v1/assessments/score` | 기존·대안 점수, 등급, 부도 확률, SHAP(Mock 39개 / 실제 38개), 피처값 |
| ML-04 | `POST /v1/assessments/simulate` | 바꾼 값으로 다시 계산(저장 안 함), 감점 요인 3개 |

## Docker (2차 개발 후보 — 1차·시연에서는 사용하지 않음)

11/16 결정: Docker는 2차 개발 때 고도화하면서 쓸지 정하는 후보이며 확정이 아니다. 1차 개발과 시연은 위 「실행」(가상환경)으로 한다. 아래 방법과 `Dockerfile`은 그때를 위해 남겨 둔 것이고, **빌드·실행은 확인하지 않았다**(팀 PC에 Docker 없음).

Docker Desktop이 켜져 있어야 한다. 저장소 맨 위(`final-project`)에서:

```
docker build -t avenue-fastapi fastapi_server              # 처음 한 번, 코드가 바뀌면 다시
docker run -d -p 8000:8000 --name fastapi avenue-fastapi    # 켜기 → http://localhost:8000/docs
docker stop fastapi / docker start fastapi                  # 끄기 / 다시 켜기
```

- Spring은 기본값 `avenue.prediction.base-url`(비어 있으면 `http://localhost:8000`)로 이 서버를 부른다.
- 8000번을 이미 쓰고 있으면(`uvicorn`으로 켠 서버 등) 그걸 끄거나 `-p 8001:8000`처럼 다른 번호를 쓰고 Spring 설정도 맞춘다.

## 테스트 방법

**1. 자동 검사 (Python 내장 unittest — 새 도구는 없고, 「실행」의 가상환경을 켠 상태에서 한다)**
```
cd fastapi_server
.venv\Scripts\activate                 # 가상환경 켜기 (만들고 설치하는 법은 「실행」)
python -m unittest discover tests -v
```
마지막 줄이 `Ran 103 tests ... OK`이면 정상이다(학습·SHAP 시험 포함, 모델 파일이 없어도 작은 합성 모델로 돈다). 검사하는 것:
- 모델 버전으로 계산기 고르기(FP-141): `DEV-DUMMY`·버전 없음 → Mock, `LGBM-BASE-0.1` → 실제 모델(응답 모양이 Mock과 같고 합 규칙·38개 요인), 파일 없음 → 503, 모르는 버전 → 409, 설명 파일 버전이 다르면 준비 안 됨, ROUND_HALF_UP 반올림
- 피처 39개가 시드 SQL(`FS-DRAFT`)과 같은지, 피처 정의서 11장(지금 38개)이 모두 들어 있고 차이는 `LRZ021201`(C9로 제외)뿐인지
- 이상치 고정 상한(정의서 C8): 소득 합계 20억 초과·평균 월 지출 2억 초과·월 상환액 0 미만이면 그 값과 그 값으로 계산하는 피처를 결측으로
- 소득 합계 0 이하·카드 한도 0이면 비율 피처 결측
- 기존 모델 19개 / 대안 모델 39개, 대안 데이터를 바꿔도 기존 점수는 그대로인지
- 점수 0~1000, 등급 경계(664 / 665 / 779 / 780), 같은 입력 같은 결과
- 기준점 + SHAP 점수 합 = 대안 점수, rank(같으면 항목 이름 가나다순)
- 급여소득자 월급 × 12, 값이 없으면 0으로 채우지 않음
- 시뮬레이션 금융 영향 + 대안 영향 = 전체 변화
- 409 버전 불일치, 422 입력 오류(소득 개월 수가 직군과 다름·`requiredIncomeMonths` 없음·같은 달 중복·통신비 또는 공과금 빈 목록(정의서 8-5), 시뮬레이션의 모르는 키·카드 한도/사용액 한쪽만), 오류 시험 헤더

**2. 화면에서 직접 (`/docs`)**
1. 서버를 켜고 http://localhost:8000/docs 를 연다.
2. `GET /v1/health` → Try it out → Execute → `"status": "UP"`
3. `POST /v1/assessments/score` → Try it out → 본문에 명세서 4-3 요청 예시를 넣고 Execute → 200, `shap.factors` 39개
4. 같은 요청에 `"expectedModelVersion": "OLD"` → 409 `VERSION_MISMATCH`
5. `alternativeData`에서 `utility`를 빼고 보내면 → 422 `INVALID_INPUT`
6. `POST /v1/assessments/simulate`에 `changes`로 `{"DELINQ_COUNT12M": 0}`(오타 키)를 보내면 → 422, `fieldErrors`에 `changes.DELINQ_COUNT12M`

## 오류 시험 헤더 (개발용, 실제 서버에는 없음)

요청 헤더 `X-Mock-Scenario`
- `MODEL_ERROR` → 500 `INTERNAL_ERROR`
- `NOT_READY` → 503 `MODEL_NOT_READY`
- `TIMEOUT` → 5초 뒤 응답 (Spring 타임아웃 처리 시험)

## 알아 둘 것

- 점수 변환식은 확정이다(명세서 O-3, 11/16): 700점 = 우량:불량 20:1, 40점마다 오즈 2배, 범위 0~1000. SHAP 점수도 같은 배율.
- 시뮬레이션 결과는 저장하지 않는다(O-9). 회복 점수는 그 항목을 시뮬레이터 범위 안 가장 좋은 값으로 바꿨을 때의 점수 차이다(O-14).
- 현금흐름 화면의 예상 대안 점수(N-21-8, DIAG-09)는 Spring이 바꾼 입력으로 ML-03을 부르고 저장하지 않는다(O-6). FastAPI 쪽 추가 작업은 없다.
- Mock 가중치는 화면 시험용 임의 값이다. 학습 결과가 아니고 점수 의미도 없다.
- 피처 사전: Mock은 `FS-DRAFT` 39개, 실제 모델은 `FS-V1` 38개(`LRZ021201` 제외, O-17). `FS-V1`·`LGBM-BASE-0.1`(CANDIDATE) 기준 데이터는 PR #72로 들어왔다. 이미 만든 DB에는 `docs/spec/sql/add_fs_v1_feature_set.sql` → `seed/avenue_seed_dim_feature_fs_v1.sql` 순서로 한 번 실행한다. 버전 이름은 `training/config.py` 한 곳에서 가져온다.
- 실제 모델 호출 때 SHAP 라이브러리가 "LightGBM 이진 분류 출력 모양이 바뀌었다"는 경고를 한 줄 낸다. `training/explain.py`가 두 모양을 모두 처리하므로 결과에는 영향이 없다.
- 이상치 상한 3개는 `pipeline/feature_builder.py` 맨 위 상수다. 학습 전처리도 같은 값을 써야 하며, Spring 업무상 상한이 정해지면 바꾼다(`TODO(C8)`).
- 학습에 없는 코드값(`VOLUNTARY`, 가입 상태 `UNKNOWN`)은 Mock에서 기여 0(중립), 실제 모델에서는 결측(-1)으로 들어간다. 처리 방식은 정의서 9장 미정이다(`TODO`).
- 소수 반올림은 학습 생성 코드와 같은 ROUND_HALF_UP(정확히 .5면 올림)이다(`pipeline/feature_builder.round_half_up`, FP-141).
- 시뮬레이션의 간편결제 월 건수 × 12, 통신비 미납 달 연동 안 함은 피처 정의서 9장 미정 사항이라 `TODO`로 표시해 두었다.
- 시뮬레이션 `changes`는 10개 키만 받는다. 모르는 키, 카드 한도·월 사용액 중 하나만 온 경우는 422다(조용히 무시하지 않는다). 카드 한도가 0이면 점수 계산과 같은 규칙으로 사용률을 결측으로 둔다.
- 로그에는 requestId, 처리 시간, 오류 코드만 남긴다. 요청 본문(금융 정보)은 남기지 않는다.
