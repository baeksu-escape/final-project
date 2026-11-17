# 기존·대안 모델 학습 스크립트 (임시 베이스라인)

N-12-2 점수 모델을 학습하는 스크립트다. **서비스에 연결되어 있지 않다**(FP-141에서 `pipeline/mock_scorer.py`를 바꿔 연결한다). 결과는 합성 데이터, 튜닝 없음, TEST 미사용인 임시 베이스라인이며 실제 신용평가 결과가 아니다.

## 실행

```
cd fastapi_server
.venv\Scripts\activate                 # README 「실행」의 가상환경
python -m training.train --data-dir <학습 데이터 폴더>
```

- `<학습 데이터 폴더>`는 안에 `1_model/legacy_model_table.csv`가 있는 폴더다. 기본값은 `fastapi_server/data/training/`(`data/README.md` 참고, Git 제외).
- 학습 데이터는 `*_svc_12m` 열이 있는 v3.6.0 이상이어야 한다. 열이 없으면 없는 열 이름을 알리고 멈춘다.
- 결과: `artifacts/legacy.joblib`, `artifacts/alternative.joblib`(Git 제외) 와 설명 파일 `*.meta.json`(모델 버전 `LGBM-BASE-0.1`·피처 세트 `FS-V1`·알고리즘, 피처 목록, 범주 부호표, 설정, 라이브러리 버전, 학습 표 SHA-256, VALID AUC). 버전 이름은 DB 장부(`MODEL_REGISTRY`, `FEATURE_SET_VERSION`)와 같고 `config.py`의 상수가 원본이다. 설명 파일은 만들어지는 파일이라 커밋하지 않는다.
- 시험: `python -m unittest discover tests -v`

## 무엇을 하나

| 모델 | 피처 | 정답 라벨 |
|---|---|---|
| 기존(`legacy`) | 18개 | `label_any_delinquency_12m` |
| 대안(`alternative`) | 38개(기존 18 + 대안 데이터 20) | `label_nonfin_effect_12m` |

- 전처리(정의서 10장 C8·C13·C19): 이상치 상한 밖의 값과 그 값으로 만드는 파생 열을 결측으로 두고, 남은 결측은 LightGBM이 처리한다. 상한은 서비스(`pipeline/feature_builder.py`)와 같은 상수를 쓴다.
- 범주형 5개는 `config.CATEGORY_CODES`의 고정 부호표로 정수 부호화한다(표에 없는 값은 -1). 알파벳 자동 부호를 쓰지 않는다.
- TRAIN으로 학습하고 VALID로 평가한다(시드 5개 평균 ± 표준편차). 저장하는 모델은 첫 시드(11) 것이다. TEST는 쓰지 않는다.

## 지켜야 할 것

- **TEST는 최종 평가에서 한 번만** 쓴다. 이 스크립트에 TEST 평가를 넣지 않는다.
- `LRZ021201`은 모델 피처가 아니다(정의서 C9, 임시 결정). 피처 목록은 서비스 피처 사전에서 이것만 뺀 것과 같아야 하며 `tests/test_training_preprocess.py`가 검사한다.
- SHAP 결과를 "원인"처럼 설명하지 않는다. 모델이 쓴 기여도이다.
- 학습에 없는 코드값(`voluntary`, 가입 상태 `unknown`) 처리는 정의서 9장 미정이다. 지금은 -1(결측)로 두며 `TODO`가 `config.py`에 있다.
- 점수(0~1000)와 등급 변환은 하지 않는다. 변환식은 명세서 O-3, 등급 경계는 D-01(미정)이다.

## 학습 데이터 기본 통계 보고서 (FP-131)

`python -m training.data_report`가 분할별 행 수, 라벨 양성 비율, 결측, C8 상한 초과 행 수, 숫자 피처 요약, 범주 분포, 서비스 피처 사전과의 일치를 `docs/spec/training_data_report.md`에 만든다. 생성 파일이라 직접 고치지 않고 다시 실행해 갱신한다. **TEST는 행 수만 센다.** `--out`으로 다른 파일에 쓸 수 있다.

## 두 모델의 AUC 비교 (FP-130)

기존 모델은 `label_any_delinquency_12m`, 대안 모델은 `label_nonfin_effect_12m`이 정답이라 서로 다른 라벨의 AUC를 그대로 빼지 않는다. `python -m training.compare_labels`가 두 모델을 두 라벨에서 각각 평가해 같은 라벨끼리 비교한다. 해석과 한계는 정의서 2-1, 10장 C20.

## 모델 입력·출력 규격 (FP-135)

서비스(FP-141)가 모델을 부를 때 지킬 규격이다. 원본은 이 표와 `config.py`이며(`*.meta.json`은 Git 제외), 같은 규격을 `interface.py`의 `to_model_input(feature_dict, model_name)`이 구현한다. 시험은 `tests/test_training_interface.py`.

- **입력**: 한 행 표(DataFrame). 열 이름과 **열 순서는 아래 표와 같다**. 기존 모델(`legacy`)은 "기존 모델" 칸이 ○인 18개, 대안 모델(`alternative`)은 38개 전부다. 서비스 `build_features`가 만드는 `LRZ021201`은 모델에 쓰지 않으므로 넣지 않는다(C9).
- **결측**: 값이 없으면 NaN으로 둔다. **0으로 채우지 않는다**(0과 결측은 다르다, 정의서 7장 1번). 서비스의 `None`은 NaN이 되고, 이상치로 걸러진 값(C8)과 그 파생 열도 같다.
- **숫자 열**: float. **범주형 5개**: 서비스가 보내는 소문자 문자열을 아래 부호표의 정수(int32)로 바꾼다. 표에 없는 값(`voluntary`, 가입 상태 `unknown`)과 결측은 -1이다(정의서 9장 "학습에 없는 코드값 처리"가 미정이라 임시 동작).
- **출력**: `model.predict_proba(X)[:, 1]` = 불량(양성) 확률(0~1). 기존 모델은 연체 경험, 대안 모델은 비금융 효과 라벨의 양성 확률이다. 점수 0~1000 변환(명세서 O-3: 700점 = 우량:불량 20:1, 40점마다 오즈 2배)과 등급 매기기는 모델 밖 서비스의 일이다.
- **모델 파일**: `artifacts/legacy.joblib`, `artifacts/alternative.joblib`(Git 제외). 서비스는 LightGBM 4.6.0 같은 버전으로 불러온다(`requirements.txt`).

| 순번 | 피처 | 기존 모델 | 타입 |
|---:|---|:---:|---|
| 1 | `income_svc_12m_krw` | ○ | 숫자(float) |
| 2 | `income_cv_svc_12m` | ○ | 숫자(float) |
| 3 | `zero_income_months_svc_12m` | ○ | 숫자(float) |
| 4 | `expense_avg_month_krw` | ○ | 숫자(float) |
| 5 | `debt_service_current_krw` | ○ | 숫자(float) |
| 6 | `expense_ratio_svc_12m` | ○ | 숫자(float) |
| 7 | `dsr_svc_12m` | ○ | 숫자(float) |
| 8 | `deficit_months_svc_12m` | ○ | 숫자(float) |
| 9 | `worst_month_net_cash_svc_12m_krw` | ○ | 숫자(float) |
| 10 | `debt_balance_krw` | ○ | 숫자(float) |
| 11 | `L00000001` | ○ | 숫자(float) |
| 12 | `DQ1200001` | ○ | 숫자(float) |
| 13 | `L22000900` | ○ | 숫자(float) |
| 14 | `LA0099212` | ○ | 숫자(float) |
| 15 | `CF1231605` | ○ | 숫자(float) |
| 16 | `CL0631905` | ○ | 숫자(float) |
| 17 | `segment` | ○ | 범주형 정수 부호 |
| 18 | `age` | ○ | 숫자(float) |
| 19 | `telecom_late_months` |  | 숫자(float) |
| 20 | `telecom_on_time_streak` |  | 숫자(float) |
| 21 | `utility_late_months` |  | 숫자(float) |
| 22 | `dp_ever_used` |  | 숫자(float) |
| 23 | `dp_active_months` |  | 숫자(float) |
| 24 | `dp_payment_count_12m` |  | 숫자(float) |
| 25 | `dp_payment_amount_12m_krw` |  | 숫자(float) |
| 26 | `np_coverage_status` |  | 범주형 정수 부호 |
| 27 | `np_payer_type` |  | 범주형 정수 부호 |
| 28 | `np_due_months` |  | 숫자(float) |
| 29 | `np_on_time_months` |  | 숫자(float) |
| 30 | `np_arrears_months` |  | 숫자(float) |
| 31 | `np_on_time_rate` |  | 숫자(float) |
| 32 | `hi_coverage_status` |  | 범주형 정수 부호 |
| 33 | `hi_payer_type` |  | 범주형 정수 부호 |
| 34 | `hi_due_months` |  | 숫자(float) |
| 35 | `hi_on_time_months` |  | 숫자(float) |
| 36 | `hi_arrears_months` |  | 숫자(float) |
| 37 | `hi_on_time_rate` |  | 숫자(float) |
| 38 | `si_arrears_any` |  | 숫자(float) |

범주형 부호표(`config.CATEGORY_CODES`):

| 열 | 부호 |
|---|---|
| `segment` | freelance=0, selfemp=1, wage=2 |
| `np_coverage_status` | covered=0, exempt=1, not_covered=2 |
| `np_payer_type` | regional=0, unknown=1, workplace=2 |
| `hi_coverage_status` | covered=0, dependent=1, not_covered=2 |
| `hi_payer_type` | household=0, regional=1, unknown=2, workplace=3 |

이 부호표나 열 순서를 바꾸면 이미 저장한 모델의 입력이 어긋난다. 바꿀 때는 모델을 다시 학습하고 서비스 담당에게 알린다.

## SHAP 요인 (FP-138)

ML-03 응답의 `shap`(기준점 + 항목별 SHAP 점수)을 대안 모델에서 만든다. 형식과 규칙은 서비스 Mock(`pipeline/mock_scorer.py`)과 같아서 FP-141에서 그대로 끼울 수 있다.

```python
import joblib
from training.explain import AlternativeExplainer, score_one

explainer = AlternativeExplainer(joblib.load("artifacts/alternative.joblib"))   # 서비스 시작 때 한 번만 만든다
result = explainer.explain(feature_dict)        # feature_dict = pipeline.feature_builder.build_features(...) 결과
# result = {"logOdds", "score", "defaultProb", "baseScore", "factors": [{"rank", "featureCode", "featureValue", "shapValue", "shapScore"}, ...]}
legacy = score_one(joblib.load("artifacts/legacy.joblib"), feature_dict, "legacy")   # 기존 모델·시뮬레이터 재계산: {"logOdds", "score", "defaultProb"}
```

- **합 규칙**: `baseScore + Σ shapScore = score`. 모델의 `expected_value + Σ SHAP = raw margin`(log-odds)이 정확히 맞고, 점수로 환산한 값을 정수로 반올림하면서 합이 `score`와 같게 맞춘다(최대 잉여 방식). 점수가 0이나 1000으로 잘리는 경우에도 합은 잘린 `score`와 같다.
- **환산**: 명세서 O-3. `score = OFFSET − FACTOR × log-odds`(700점 = 우량:불량 20:1, 40점마다 오즈 2배, 0~1000). SHAP 점수 = `−FACTOR × SHAP(log-odds)`로, 불량 쪽으로 미는 항목이 점수를 깎는다. 같은 상수가 `pipeline/mock_scorer.py`에도 있고 시험이 두 곳이 같은지 검사한다.
- **순서**: `rank`는 `|shapScore|` 큰 순서, 같으면 항목 이름 가나다순(DDL `FEATURE_RANK` 주석). 피처 38개를 모두 담는다. `featureValue`는 서비스가 만든 원래 값의 글자이고 결측이면 `None`이다.
- **기준점**: `TreeExplainer`의 `expected_value`(학습 데이터에서 모델의 평균 log-odds)를 점수로 바꾼 값이다. 현재 베이스라인 대안 모델은 694점이다(시연용 Mock은 639점).
- **등급은 만들지 않는다**: 등급 경계(D-01)는 팀 결정이라 `gradeBandCode`는 서비스가 정한다.
- **주의**: SHAP 결과는 모델이 쓴 기여도이며 인과관계가 아니다. 화면에는 "작용한 정도"로만 보여 준다. 설명기 생성에 약 0.2초가 걸리고 요청마다 SHAP 계산 비용이 든다(응답 시간은 확인하지 못했다).
