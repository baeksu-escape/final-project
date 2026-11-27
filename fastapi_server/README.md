# Avenue 예측 서버 (FastAPI) — Mock + 실제 모델(LightGBM 베이스라인)

Spring이 부르는 내부 API(ML-01~04)를 제공한다. **요청의 모델 버전이 계산기를 고른다**(FP-141).

| DB의 ACTIVE 모델(`MODEL_REGISTRY`) = Spring이 보내는 버전 | 계산 | 피처 세트 |
|---|---|---|
| `DEV-DUMMY` (지금) | Mock(`pipeline/mock_scorer.py`, 고정 가중치, 점수 의미 없음) | `FS-DRAFT` 39개 |
| `LGBM-BASE-0.1` | 실제 모델(`pipeline/model_scorer.py`, 합성 데이터로 학습한 임시 베이스라인) | `FS-V1` 38개 |
| 그 밖 | 409 `VERSION_MISMATCH` | |

- 그래서 **DB의 ACTIVE 모델을 바꾸는 것이 곧 스위치**다. 코드를 병합해도 DB가 `DEV-DUMMY`인 동안은 Mock 그대로다.
- **실제 모델 버전은 넣은 묶음의 `*.meta.json`(`model_version`)에서 정한다(FP-237).** 0.1 묶음을 넣으면 `LGBM-BASE-0.1`, 0.2 묶음을 넣으면 `LGBM-BASE-0.2`로 동작하고, 요청 버전(DB ACTIVE)이 불러온 버전과 다르면 409 `VERSION_MISMATCH`다. 두 설명 파일의 버전이 다르거나 `LGBM-BASE-숫자.숫자` 모양이 아니면 불러오지 않는다. 버전이 적히지 않은 옛 묶음은 `training/config.py`의 `MODEL_VERSION`(0.1)으로 본다.
- **등급 구간도 모델 버전을 따른다(FP-285).** `LGBM-BASE-0.3` 묶음은 `CUT-0.4`(0~644 / 645~711 / 712~1000), 그 밖(0.1·0.2·Mock)은 `CUT-0.3`(0~653 / 654~726 / 727~1000)으로 답한다(`pipeline/feature_catalog.py`의 `cutoff_for`). 그 DB에 해당 구간 행이 있어야 저장되므로 0.3 묶음을 넣기 전에 `add_cutoff_cut_0_4.sql`을 실행한다.
- 실제 모델은 `artifacts/legacy.joblib`·`alternative.joblib`에서 서버가 켜질 때 한 번 불러온다. 파일이 없으면 `/v1/health`의 `modelLoaded: false`이고, `LGBM-BASE-0.1` 요청은 **503 `MODEL_NOT_READY`**다(Mock으로 바꾸지 않는다, 11/17 범영·재욱 합의).
- 실제 모델의 점수 환산·SHAP·합 규칙은 `training/explain.py`(FP-138), 모델 입력은 `training/interface.py`를 그대로 쓴다. 점수·SHAP은 실제 신용평가나 인과관계가 아니다.

- API 상세: B팀 명세서 4장 ([docs/spec/api/api_spec_b.md](../docs/spec/api/api_spec_b.md))
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
2. 모델 파일 4개와 **`SHA256SUMS.txt`까지 5개**를 `fastapi_server/artifacts/`에 넣는다(Git에는 올리지 않는다).
3. `SHA256SUMS.txt`가 있으면 서버가 켜질 때 **joblib을 열기 전에 해시를 자동으로 대조**한다. 하나라도 다르면 모델을 열지 않고 "준비 안 됨"(로그에 `model hash mismatch`)이다. joblib은 불러올 때 파일 안의 코드가 실행될 수 있으므로 이 묶음 외의 `.joblib`은 넣지 않는다.
4. 서버를 다시 켜고 http://localhost:8000/v1/health 에서 `"modelLoaded": true`인지 본다.

**공용 DB를 실제 모델로 전환하는 절차 (모델 전환 PR 작성자, 11/20 규칙)**
1. 시연·공유에 쓰는 서버 PC의 `artifacts/`에 위 5개 파일을 넣고 FastAPI를 켠다 → `/v1/health`가 **`"modelLoaded": true`**인지 확인한다. false면 여기서 멈춘다(그대로 바꾸면 모든 점수 요청이 503 → `MODEL_ERROR` 저장).
2. 공용 DB에 FS-V1 기준 데이터가 있는지 본다: `SELECT COUNT(*) FROM DIM_FEATURE WHERE FEATURE_SET_VERSION = 'FS-V1'` → 38(없으면 `docs/spec/sql/add_fs_v1_feature_set.sql` → `seed/avenue_seed_dim_feature_fs_v1.sql`).
3. 팀에 "지금 실제 모델로 바꾼다"고 알린 뒤, SQL Developer **공용 DB 접속**에서 `docs/spec/sql/activate_model_lgbm_base_0_1.sql`을 F5로 실행한다 → `LGBM-BASE-0.1` ACTIVE, `DEV-DUMMY` RETIRED.
4. 시연 계정으로 점수 산출 → 리포트 `modelVersion`이 `LGBM-BASE-0.1`, SHAP 요인 38개, 피처 칩 기존 18·대안 38인지 확인한다. FastAPI 로그에 `model=LGBM-BASE-0.1`.
5. 문제가 생기면 바로 `docs/spec/sql/rollback_model_to_dev_dummy.sql`로 Mock에 되돌린다(저장된 평가는 그대로).
6. 팀에 알린다: 이제 각자 PC에서 공용 DB를 쓰려면 모델 파일 5개가 `artifacts/`에 있어야 한다(없으면 503). 로컬 DB를 쓰는 팀원은 각자 DB가 `DEV-DUMMY`인 동안 영향이 없다.

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
마지막 줄이 `Ran 116 tests ... OK`이면 정상이다(학습·SHAP·FS-V1 시험 포함, 모델 파일이 없어도 작은 합성 모델로 돈다). 검사하는 것:
- 모델 파일 해시 자동 대조: `SHA256SUMS.txt`와 다르면 열지 않고 준비 안 됨
- 모델 버전으로 계산기 고르기(FP-141): `DEV-DUMMY`·버전 없음 → Mock, `LGBM-BASE-0.1` → 실제 모델(응답 모양이 Mock과 같고 합 규칙·38개 요인), 파일 없음 → 503, 모르는 버전 → 409, 설명 파일 버전이 다르면 준비 안 됨, ROUND_HALF_UP 반올림
- 피처 39개가 시드 SQL(`FS-DRAFT`)과 같은지, 피처 정의서 11장(지금 38개)이 모두 들어 있고 차이는 `LRZ021201`(C9로 제외)뿐인지
- 이상치 고정 상한(정의서 C8): 소득 합계 20억 초과·평균 월 지출 2억 초과·월 상환액 0 미만이면 그 값과 그 값으로 계산하는 피처를 결측으로
- 소득 합계 0 이하·카드 한도 0이면 비율 피처 결측
- 기존 모델 19개 / 대안 모델 39개, 대안 데이터를 바꿔도 기존 점수는 그대로인지
- 점수 0~1000, 등급 경계(CUT-0.3 653 / 654 / 726 / 727, 모델 0.3의 CUT-0.4 644 / 645 / 711 / 712), 같은 입력 같은 결과
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
- **모델을 바꿀 때(예: 0.1 → 0.2):** ① DB에 등록 SQL(`register_model_lgbm_base_0_2.sql`) — CANDIDATE로만 넣으므로 서비스는 그대로다. 미리 해 둬도 된다 ② 서버 PC `artifacts/`의 5개 파일을 새 묶음으로 바꾸고 FastAPI를 다시 켠다 → `/v1/health`의 `modelVersion`이 새 버전인지 확인 ③ **②가 끝나면 바로** 전환 SQL(`activate_model_lgbm_base_0_2.sql`). 되돌리기는 파일을 이전 묶음으로 바꾸고 바로 `rollback_model_lgbm_base_0_2_to_0_1.sql`. 그 DB를 쓰는 모든 PC가 같은 묶음이어야 한다(다르면 409). 코드는 바꾸지 않는다.
  - **0.2 → 0.3(FP-285)** 은 등급 구간도 바뀐다: ① `add_cutoff_cut_0_4.sql` → `register_model_lgbm_base_0_3.sql` → `load_model_eval_sample_lgbm_base_0_3.sql` → `update_model_metrics_same_label_lgbm_base_0_3.sql`(서비스 영향 없음) ② 파일을 0.3 묶음으로 교체·health 확인 ③ 바로 `activate_model_lgbm_base_0_3.sql` → `activate_cutoff_cut_0_4.sql` → 시드 평가 적재. 되돌리기는 파일을 0.2 묶음으로 바꾸고 `rollback_model_lgbm_base_0_3_to_0_2.sql` → `rollback_cutoff_cut_0_4_to_0_3.sql`.
  - ⚠️ **②와 ③ 사이에는 점수 요청이 모두 409 `VERSION_MISMATCH`다.** 서버는 새 버전만 계산하는데 DB ACTIVE는 아직 옛 버전이기 때문이다. 이때 점수 산출은 `NOT_SCORABLE`(`MODEL_ERROR`) 평가로 저장되어 쓸모없는 행이 남는다(시뮬레이터·예상 점수는 저장하지 않고 오류만 난다). 공용 DB에서는 ②·③을 연달아 하고, 사용자가 없는 시간(시연·통합 테스트 중이 아닐 때)에 한다. 반대 순서(파일은 그대로 두고 SQL만 실행)도 같은 409가 난다.
  - Spring은 ML-01·02를 부르지 않아서(시작할 때도) 버전이 어긋나도 미리 경고하지 않는다. 바꾼 뒤 `docs/spec/e2e/e2e_check.py`(FP-143)로 확인하면 E2E-03·05에서 바로 드러난다.
- 피처 사전: Mock은 `FS-DRAFT` 39개, 실제 모델은 `FS-V1` 38개(`LRZ021201` 제외, O-17). `FS-V1`·`LGBM-BASE-0.1`(CANDIDATE) 기준 데이터는 PR #72로 들어왔다. 이미 만든 DB에는 `docs/spec/sql/add_fs_v1_feature_set.sql` → `seed/avenue_seed_dim_feature_fs_v1.sql` 순서로 한 번 실행한다. 버전 이름은 `training/config.py` 한 곳에서 가져온다.
- 실제 모델 호출 때 SHAP 라이브러리가 "LightGBM 이진 분류 출력 모양이 바뀌었다"는 경고를 한 줄 낸다. `training/explain.py`가 두 모양을 모두 처리하므로 결과에는 영향이 없다.
- 이상치 상한 3개는 `pipeline/feature_builder.py` 맨 위 상수다. 학습 전처리도 같은 값을 써야 하며, Spring 업무상 상한이 정해지면 바꾼다(`TODO(C8)`).
- 학습에 없는 코드값(`VOLUNTARY`, 가입 상태 `UNKNOWN`)은 Mock에서 기여 0(중립), 실제 모델에서는 결측(-1)으로 들어간다. 처리 방식은 정의서 9장 미정이다(`TODO`).
- 소수 반올림은 학습 생성 코드와 같은 ROUND_HALF_UP(정확히 .5면 올림)이다(`pipeline/feature_builder.round_half_up`, FP-141).
- 시뮬레이션의 간편결제 월 건수 × 12, 통신비 미납 달 연동 안 함은 피처 정의서 9장 미정 사항이라 `TODO`로 표시해 두었다.
- 시뮬레이션 `changes`는 10개 키만 받는다. 모르는 키, 카드 한도·월 사용액 중 하나만 온 경우는 422다(조용히 무시하지 않는다). 카드 한도가 0이면 점수 계산과 같은 규칙으로 사용률을 결측으로 둔다.
- 로그에는 requestId, 처리 시간, 오류 코드만 남긴다. 요청 본문(금융 정보)은 남기지 않는다.
