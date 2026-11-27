# 기존·대안 모델 학습 스크립트 (임시 베이스라인)

N-12-2 점수 모델을 학습하는 스크립트다. **서비스에 연결되어 있지 않다**(FP-141에서 `pipeline/mock_scorer.py`를 바꿔 연결한다). 결과는 합성 데이터, 튜닝 없음, TEST 미사용인 임시 베이스라인이며 실제 신용평가 결과가 아니다.

## 실행

```
cd fastapi_server
.venv\Scripts\activate                 # README 「실행」의 가상환경
python -m training.train --data-dir <학습 데이터 폴더>
```

- `<학습 데이터 폴더>`는 안에 `1_model/legacy_model_table.csv`가 있는 폴더다. 기본값은 `fastapi_server/data/training/`(`data/README.md` 참고, Git 제외).
- 지금 `data/training/`은 v3.7.0이다(11/27 교체). 모델 0.1·0.2를 다시 만들거나 확인할 때는 `--data-dir data/training_v3.6.1`을 준다.
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

## 학습 옵션 (모델 0.2, 11/20)

옵션 없이 실행하면 `LGBM-BASE-0.1`과 같은 결과가 나온다. 0.2는 `--monotone`만 켜서 만든다(학습 행은 0.1과 같은 기존 집단 TRAIN 8,400행).

```
python -m training.train --monotone --model-version LGBM-BASE-0.2 --out-dir <저장할 폴더>
```

| 옵션 | 하는 일 |
|---|---|
| `--monotone` | `config.MONOTONE_CONSTRAINTS`의 8개 피처에 단조 제약을 건다. 지출 비율·DSR·적자 개월 수·카드 한도소진율·연체 건수·월 평균 지출 금액은 클수록 불량 확률이 높게, 최저 월 순현금흐름·12개월 소득 금액은 클수록 낮게. 소득·지출 금액은 학습 데이터가 소득↑ 연체↑ 방향이고 둘의 상관이 0.88이라 처음엔 뺐지만, 걸어도 AUC가 0.1 수준 이상이고 반대 방향 사례가 사라져서 넣었다(부채 금액까지는 반응이 과해 뺌) |
| `--with-thinfile` | **c안 시험용, 0.2에는 쓰지 않음**(시험에서 신용 이력 없음이 불리해지고 기존 모델에 새 이상이 생겨 채택하지 않았다, 정의서 C25). 씬파일 표에서 `eval_future_credit_exposure = 1`인 TRAIN 행을 학습에 더한다. 기존 집단에는 신용 이력 피처의 결측이 없어서 모델이 결측을 0으로 읽는 문제(신용 이력 없음 = 사용률 0%)를 줄이려는 것이다(결측 처리 c안) |
| `--model-version` | 설명 파일에 적을 모델 버전. 기본은 `config.MODEL_VERSION`(0.1)이고 코드 상수는 바꾸지 않는다. 서비스는 묶음 `meta.json`의 `model_version`을 읽는다(PR #110). DB 등록(`register_model_lgbm_base_0_2.sql`)과 전환 SQL은 따로 실행한다 |

- `valid_auc`는 두 경우 모두 **기존 집단 VALID** 기준이라 0.1과 그대로 비교할 수 있다. 씬파일 VALID는 `valid_auc_thinfile`(228행, 양성 22·14로 흔들림이 크다)에 따로 남는다.
- 씬파일 TRAIN을 학습에 썼으면 그 행은 평가에 쓰지 않는다(누수). `export_eval_scores.py --with-thinfile`은 씬파일을 VALID 행만 낸다. `compare_labels.py`도 같은 두 옵션을 받는다.
- 설명 파일에 `options`, `monotone_constraints`, 씬파일 표 해시·행 수가 남는다.

## 모델 0.3 (데이터 v3.7.0, 11/26)

학습 데이터를 v3.7.0(기존 집단 TRAIN 97,543행, 새 연체 라벨)으로 바꾸고 `--monotone-set v03`(19개: 0.2의 8개 + 대출 잔액·상환액·건수·신규 대출·대부업 잔액·현금서비스·소득 0인 달 +1(C33) + 통신 미납 개월 +1·통신 연속 정시 개월 −1·공과금 연체 개월 +1·간편결제 건수 −1(C36, 시뮬레이터 반대 방향 제거))으로 만든다. 사전 기준은 정의서 10장 C33·C36, VALID 결과는 C37이다.

```
python -m training.check_v03 --data-dir data/training --out ../docs/spec/model_v03_valid_check_c36.json   # C33 기준 11개 항목 판정(VALID만, 모델 저장 안 함)
python -m training.train --data-dir data/training --out-dir data/model_v03 --monotone-set v03 --model-version LGBM-BASE-0.3
```

- `compare_labels.py`와 `export_eval_scores.py`도 `--monotone-set`을 받는다. 관리자 성능 비교용 평가 표본(FP-285)은 `--max-rows`로 기존 집단 VALID를 직군×라벨 비율로 3,000행만 뽑는다(씬파일은 전부):

```
python -m training.export_eval_scores --data-dir data/training --model-dir data/model_v03 --monotone-set v03 --model-version LGBM-BASE-0.3 --max-rows 3000 --out data/model_v03_eval/eval_scores_v03.csv --sql-out ../docs/spec/sql/load_model_eval_sample_lgbm_base_0_3.sql
```

- 모델 파일은 서버 폴더(`artifacts/`)와 따로 두고, 서비스 전환 때 묶음(`avenue_model_files_20261127_v03.zip`)으로 옮긴다(`docs/spec/sql/activate_model_lgbm_base_0_3.sql` 머리말). **다시 학습해 덮어쓰지 않는다**(해시 C37).

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

## N-25 행 단위 평가 점수 파일

`python -m training.export_eval_scores`가 관리자 모형 비교 화면(FP-185)과 API(FP-184)가 컷오프별 지표·ROC를 계산할 행 데이터를 `eval_scores.csv`와 설명 파일 `eval_scores.meta.json`으로 만든다(`artifacts/`, Git 제외, `#파일공유`로 전달). `--out`으로 경로를, `--skip-thinfile`로 씬파일 집단 제외를, `--thinfile-valid-only`로 씬파일도 VALID만 쓰도록 고른다.

| 열 | 내용 |
|---|---|
| `customer_id`, `group`, `segment`, `data_split` | 고객, 집단(`legacy` 기존 집단 / `thinfile` 씬파일 집단), 직군 이름(`wage`·`selfemp`·`freelance`), 분할(`legacy`는 `VALID`만, `thinfile`은 `TRAIN`과 `VALID`) |
| `label_any_delinquency_12m`, `label_nonfin_effect_12m` | 정답 라벨 둘 다(1이 불량) |
| `score_legacy_delinq`, `score_alt_delinq` | 연체 라벨로 학습·평가한 기존·대안 모델의 0~1000 점수(높을수록 좋음) |
| `score_legacy_nonfin`, `score_alt_nonfin` | 비금융 효과 라벨로 학습·평가한 기존·대안 모델의 점수 |

- **같은 라벨끼리 비교한다**: 라벨마다 두 모델을 기존 집단 TRAIN으로 새로 학습한다(정의서 C20). 서버에 올린 모델은 `score_legacy_delinq`(= `legacy.joblib`)와 `score_alt_nonfin`(= `alternative.joblib`)뿐이고, 스크립트가 `artifacts/`의 파일과 점수가 같은지 확인해 설명 파일에 적는다. 나머지 두 열은 비교용 실험 모델이다.
- **평가 행**: 기존 집단은 VALID 1,800행만 쓴다. 씬파일 집단은 이 모델들이 학습하지 않은 집단이라 TRAIN 행도 평가에 써도 누수가 없어서 TRAIN+VALID 1,285행을 쓴다(VALID만으로는 양성이 연체 22건, 비금융 효과 14건뿐이라 지표가 흔들린다). 씬파일을 학습에 쓰는 모델이 생기면 TRAIN 행이 누수가 되므로 `--thinfile-valid-only`로 바꾼다.
- **씬파일은 `eval_future_credit_exposure = 1`인 고객만** 넣는다(0인 고객은 라벨이 항상 0이라 제외, 정의서 5장). 라벨 생성 방식이 기존 집단과 달라 집단별로 따로 본다.
- **점수 환산**은 서비스와 같다(명세서 O-3, `training/explain.py`의 `to_score`). 컷오프는 이 점수에 건다.
- **TEST 행은 표 안에 있지만 이 스크립트들은 읽을 때 버린다.** 최종 평가(FP-144)는 별도 스크립트 `final_test_eval.py`가 한 번만 읽는다(아래 「TEST 최종 평가」).
- **한계**: 시드 하나(11)의 값이다. 연체 라벨에서 기존 집단의 대안 모델 AUC는 시드 11(0.6183)이 5개 시드 중 가장 높고 평균은 0.5991이라 기존 모델(0.6049)과 구분되지 않는다. AUC는 `METRICS_JSON`의 5개 시드 평균(`same_label_comparison`)을 쓰고 이 파일은 컷오프별 지표·ROC에 쓰는 것을 권한다. 정수 점수 기준이라 확률 기준과 소수 넷째 자리가 다를 수 있다. 연체 라벨에는 대안 데이터 효과를 넣지 않았고(데이터 생성 설계) 비금융 효과 라벨은 설계로 넣은 효과가 반영된 라벨이라, 어느 쪽도 실제 개선의 근거가 아니다. 합성 데이터이며 실제 신용평가 결과가 아니다.

## 모델 입력·출력 규격 (FP-135)

서비스(FP-141)가 모델을 부를 때 지킬 규격이다. 원본은 이 표와 `config.py`이며(`*.meta.json`은 Git 제외), 같은 규격을 `interface.py`의 `to_model_input(feature_dict, model_name)`이 구현한다. 시험은 `tests/test_training_interface.py`.

- **입력**: 한 행 표(DataFrame). 열 이름과 **열 순서는 아래 표와 같다**. 기존 모델(`legacy`)은 "기존 모델" 칸이 ○인 18개, 대안 모델(`alternative`)은 38개 전부다. 서비스 `build_features`가 만드는 `LRZ021201`은 모델에 쓰지 않으므로 넣지 않는다(C9).
- **결측**: 값이 없으면 NaN으로 둔다. **0으로 채우지 않는다**(0과 결측은 다르다, 정의서 7장 1번). 서비스의 `None`은 NaN이 되고, 이상치로 걸러진 값(C8)과 그 파생 열도 같다.
- **숫자 열**: float. **범주형 5개**: 서비스가 보내는 소문자 문자열을 아래 부호표의 정수(int32)로 바꾼다. 표에 없는 값(`voluntary`, 가입 상태 `unknown`)과 결측은 -1이다(정의서 9장 "학습에 없는 코드값 처리"가 미정이라 임시 동작).
- **단위**: 금액은 원이다. 대부업 대출 잔액(`LA0099212`)만 학습 표가 천원이라 `to_model_input`이 서비스의 원 값을 1,000으로 나눠 넣는다(저장·화면 값은 원 그대로).
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
- **기준점**: `TreeExplainer`의 `expected_value`(학습 데이터에서 모델의 평균 log-odds)를 점수로 바꾼 값이다. 모델 0.1 대안 모델은 694점, 지금 서비스 모델 0.2는 689점이다(시연용 Mock은 639점, 🆕 11/20).
- **등급은 만들지 않는다**: 등급 경계(D-01)는 팀 결정이라 `gradeBandCode`는 서비스가 정한다.
- **주의**: SHAP 결과는 모델이 쓴 기여도이며 인과관계가 아니다. 화면에는 "작용한 정도"로만 보여 준다. 설명기 생성에 약 0.2초가 걸리고 요청마다 SHAP 계산 비용이 든다(응답 시간은 확인하지 못했다).

## TEST 최종 평가 (FP-144)

`final_test_eval.py`가 서버 모델 파일(모델 0.2)과 같은 설정의 비교용 실험 모델을 정의서 10장 C26 사전 기준으로 평가한다. 학습·내보내기 스크립트는 그대로 TEST를 버린다.

```
python -m training.final_test_eval                                   # 리허설(VALID). 파일은 만들지 않는다. 알려진 VALID 값과 맞는지 먼저 본다
python -m training.final_test_eval --split TEST --confirm-test-once  # 최종(TEST). 한 번만 실행한다
```

- 시작할 때 서버 모델 파일 4개의 해시를 `SHA256SUMS.txt`와 대조하고, 공용 DB에 등록한 모델 0.2의 해시(`docs/spec/sql/register_model_lgbm_base_0_2.sql`)와도 대조하며, `meta.json`이 `LGBM-BASE-0.2`인지 확인한다. 다르거나, 같은 설정으로 다시 학습한 모델과 VALID 점수가 다르면 TEST를 열기 전에 멈춘다.
- `--confirm-test-once` 없이는 TEST 행을 읽지 않는다. TEST는 추적 중인 파일에 커밋하지 않은 변경이 없을 때(코드를 먼저 커밋한 뒤)만 실행된다. 추적하지 않는 파일은 막지 않고 기록에 이름만 남긴다. TEST 행을 읽기 **전에** 고정 경로 `docs/spec/final_test_eval_run.json`에 실행 기록을 먼저 남기고(`--out-dir`과 무관, 옵션으로 바꿀 수 없음), 끝나면 `finished`, 오류면 `failed`로 바꾼다. 읽는 도중 중단돼 결과 파일이 없어도 이 기록이 있으면 다시 실행되지 않는다. 결과는 `docs/spec/final_test_eval_result.json`·`.md`에 남는다. 기록이나 결과 파일이 있으면 평가 코드 오류를 고친 재실행만 `--rerun-reason "<이유>"`로 같은 모델·코드로 실행할 수 있고, 사유는 실행 기록에 쌓인다. TEST를 실행한 직후 실행 기록과 결과 파일을 바로 커밋한다.
- 기존 집단은 C26 정상 범위로 판정한다. 씬파일은 평가 표본에 이력이 긴 비교군(`young_established`)이 섞여 있어 참고 값으로만 보여 준다. 직군별·cohort별 AUC는 양성 건수와 함께 나온다.
- 결과를 본 뒤에 모델·지표·정상 범위·등급 경계를 바꾸지 않는다. 범위를 벗어나도 그대로 보고한다.

### 모델 0.3 평가 (`--version 0.3`, 사전 기준 C38)

```
python -m training.final_test_eval --version 0.3                                           # 리허설(VALID). C38 기준값 4개가 '같음'인지 본다
python -m training.final_test_eval --version 0.3 --split TEST --confirm-test-once          # 최종(TEST). 한 번만 실행한다
```

- 기본 데이터는 `data/training`(v3.7.0), 모델은 `data/model_v03`이다. TEST를 실행한 시점에는 DB에 등록하지 않아 모델 파일 4개의 해시와 학습 표 해시를 정의서 C37에 적은 값과 대조하고, `meta.json`의 버전·표 해시도 확인한다.
- 정상 범위는 VALID 5개 시드 평균 ±0.02, 등급 비율은 후보 경계 CUT-0.4(0~644 / 645~711 / 712~1000)로 본다. 씬파일 TEST는 이전에 본 고객이라 판정하지 않는다.
- 실행 기록·결과는 `docs/spec/final_test_eval_run_v03.json`, `final_test_eval_result_v03.json`·`.md`로 따로 남으며 0.2의 파일은 건드리지 않는다. 커밋·재실행 규칙은 위와 같다.
- `--version`을 주지 않으면 0.2 설정이다.
