# 학습용 합성 데이터 v3.5.12 — 이것부터 보세요

모든 값은 합성 데이터다. 성능 수치는 실제 예측력의 근거가 아니다. 저장소의 생성 코드 v3.5.12(`fastapi_server/data_generation/`)를 기본 설정으로 생성했다.

이 묶음은 v3.5.12 코드로 다시 생성했다. 데이터 파일(`1_model/`, `2_detail/`, `3_reference/`)의 값은 v3.5.10 묶음과 같고, 바뀐 것은 문서(이 README, `docs/`)다. `3_reference/legacy/validation.json`은 실행 환경 기록(numpy·pandas 버전)만 다르다. 본문의 서비스 정책(회원 월 입력 12개월, 등급 상태·점수 범위)은 v3.5.12 기준이다.

이 폴더는 저장소의 `fastapi_server/data/training/`에 두는 것을 전제로 한다. 압축 푸는 위치와 폴더 구조는 저장소의 `fastapi_server/data/README.md`에 있다.

## 처음 볼 파일은 두 개

| 파일 | 행 | 열 | 내용 |
|---|---:|---:|---|
| `1_model/legacy_model_table.csv` | 12,000 | 242 | 기존 집단. 고객 한 줄 = 207열 + 6개월 소득·지출 집계 + 간편결제·사회보험·통신·공과금 집계 + 라벨 2개 |
| `1_model/thinfile_model_table.csv` | 2,400 | 251 | 금융이력 부족 집단(4개 cohort × 600명). 같은 형식 + 씬파일 전용 열 |

열마다 역할이 `1_model/model_table_columns.csv`에 있다(`id`, `group`, `feature`, `label`, `eval_only`). **`feature`인 열만 모델에 넣는다.**

## 서비스 회원에게도 있는 피처만 들어 있다

학습한 모델로 서비스 회원의 점수를 계산하려면, 모델의 입력이 회원 데이터에도 있어야 한다. 그래서 모델 표의 `feature`는 회원이 입력하거나 외부 API로 받는 값만 담는다. 회원 쪽 원천은 저장소의 `fastapi_server/data_generation/docs/SERVICE_DUMMY_DATA.md`에 있다.

| 모델 표의 피처 | 회원 쪽 원천 |
|---|---|
| 207열(`CB`, `SP`, 연체·대출·카드 집계 등) | 신용평가사 API (`credit_bureau_responses`) |
| `*_6m` 소득·지출·상환 집계 | 회원 월 입력 12개월 중 최근 완결 6개월(2026-03~2026-08) |
| 간편결제·국민연금·건강보험 집계(12개월), `dp_amount_to_income_6m` | 간편결제·공공보험 API (+ 회원 소득 입력) |
| 통신·공과금 미납(12개월) | 통신·공과금 API |
| 대출·카드 수, 현재 상환예정액 | 금융 API |
| 직군, 나이 | 회원 정보 |

회원은 소득을 12개월 입력하지만(v3.5.11, 이전 6개월), 회원 입력으로 만드는 모델 표 집계는 최근 6개월로 계산했다(`*_6m`, `2_detail/*/input_features_6m.csv`). 집계 값은 v3.5.10과 같다. API로 받는 정보는 회원 부담이 없어 12개월 그대로다.

**모델 표에서 뺀 열.** 원천 파일(`2_detail/`)에는 그대로 있다. 서비스용 모델에는 쓰지 않는다.

| 뺀 열 | 이유 |
|---|---|
| `annual_income_krw`, `annual_debt_service_krw`, `dsr`, `expense_ratio`, `income_cv`, `income_decile`, `deficit_months`, `zero_income_months`, `worst_month_net_cash_krw`, `snapshot_dsr`, `dp_amount_to_income` | 12개월 소득 기준. 같은 뜻의 6개월 열로 바꿨다 |
| `asset_total_krw`, `liquid_assets_krw`, `net_assets_krw`, `annual_shortfall_krw`, `ending_liquid_balance_krw`, `min_liquid_balance_krw`, `months_liquid_negative`, `shortfall_to_liquid_ratio`, `exceeds_drawdown_limit`, `liquid_assets_insufficient` | 회원이 자산을 입력하지 않는다 |
| `PRE_LMT`, `PRE_RT` | 대출 신청 때 금융사가 제시한 한도·금리. 회원에게 없다(씬파일은 원래 항상 0인 자리표시자라 이전부터 뺐다) |

## 모델에 넣으면 안 되는 것

- `customer_id`, `dataset`, `cohort`: 식별·평가 구분용이다. `cohort`는 집단별로 결과를 나눠 볼 때 쓴다.
- `label_any_delinquency_12m`, `label_nonfin_effect_12m`: 정답이다.
- `eval_future_credit_exposure`(씬파일): 미래에 신용을 쓸 사람 표시다. 0인 사람(869명, 주로 `no_credit`·`sparse_history`)은 라벨이 항상 0이다. **씬파일은 학습과 평가 모두 이 값이 1인 고객(1,531명)으로 한다.** 2,400명 전체로 학습하면 "신용이력 없음 = 저위험"이라는, 미래에 신용을 쓰지 않아서 생긴 가짜 패턴을 배운다. 생성 코드의 AUC 상승 측정(`data_generation/experiments/measure_nonfinancial_label_lift.py`)도 같은 기준으로 거른다.
- 원본 207열의 `결과값(연체회차)`는 기존 라벨을 만든 미래 연체 월 수라 **모델 표에서 뺐다**. `2_detail/`의 `base_207.csv`를 직접 쓸 때도 이 열은 빼야 한다.
- `3_reference/` 폴더 전체(설계 확률·점검 결과).

## 등급 이름

- `CB`는 교육용 신용등급이고 **1이 우량, 10이 고위험**이다. 기존 집단에서 미래 연체 비율이 1등급 5.2%, 5등급 11.9%, 8등급 38.5%, 10등급 75%로 등급과 함께 커진다.
- 서비스가 회원에게 보여 줄 등급은 `CB`가 아니라 **모델 점수**를 구간으로 나눈 3단계다: `GOOD` / `STANDARD` / `CAUTION`. 서비스 점수는 0~1000, 경계는 665·780이다(시연용 임시값, 모형 학습 후 다시 정한다).
- 점수를 낼 수 없으면 등급 대신 `NOT_SCORABLE`(산정 불가)로 표시한다. 이 상태는 서비스 회원에게만 생긴다. 12개월 월 입력이 덜 찬 회원은 점수를 산출하지 않는다(상태값 없음). 학습 데이터에는 해당하는 사람이 없다.

## 라벨 두 개

| 라벨 | 용도 |
|---|---|
| `label_nonfin_effect_12m` | **서비스 대안 점수 모형의 학습 정답.** 통신·공과금 미납, 현금흐름, 사회보험 비정시 납부, 간편결제 규칙성의 효과를 가정으로 넣었다. 이 라벨에서 대안 변수가 성능을 올리는 것은 넣은 효과를 찾아낸 것이다 |
| `label_any_delinquency_12m` | 발표용 대조. 같은 분할에서 기존 모형·대안 모형 AUC를 한 번 계산해 "효과를 넣지 않으면 차이가 없다"를 보인다 |

기존 집단과 씬파일 집단은 라벨 생성 방식이 달라 합쳐서 평가하지 않는다. 직군·연령·cohort별 결과도 함께 본다.

## 결측과 0

- 씬파일에서 신용이력이 없어 관측되지 않은 값(`CB`, `SP`, `DQ1200001`, `KC5000016`, `CL0631905`)은 빈 값이다. 0으로 채우지 않는다. 원본의 자리표시자 중 등급 미산출 `CB=5`는 빈 값으로 바꿨고, 항상 0인 `PRE_LMT`·`PRE_RT`는 씬파일 표에서 뺐다.
- 정시납부율(`np_on_time_rate`, `hi_on_time_rate`)은 납부 의무가 없으면 빈 값이다(정보 없음 ≠ 나쁜 기록).
- 대출 0건·잔액 0·소득 0원인 달은 실제 0이다.
- **6개월 입력 열(`income_6m_krw`, `expense_6m_krw`, `debt_service_6m_krw`)의 결측·이상치는 일부러 넣은 것이다.** 결측(빈 값), 단위 착오(원래 값 × 1,000), 음수 상환액이 조금씩 섞여 있고, 이 세 열은 `feature`이므로 **학습 전에 결측 처리와 이상치 처리를 해야 한다.** 넣은 칸과 원래 값은 `3_reference/*/anomaly_log.csv`에 있다. 이 기록은 전처리가 제대로 잡아냈는지 확인하는 정답지이며 모델 입력에 쓰지 않는다. 파생 비율 열(`dsr_6m` 등)은 깨끗한 값 그대로라 입력 열과 맞지 않는 칸이 있다.

## 나머지 폴더

| 폴더 | 언제 보나 |
|---|---|
| `2_detail/legacy`, `2_detail/thinfile` | 피처를 새로 만들 때. 월별 소득·지출, 간편결제 월자료, 사회보험 월자료, 대출·카드·연체 원장, 그리고 모델 표를 만든 원본 표 |
| `3_reference/` | 생성 설계값·요약·점검 결과, AUC 상승 측정(`nonfinancial_label_lift/`). **모델 입력 금지** |
| `docs/` | `DATA_DICTIONARY.csv`(모든 필드), 생성 규칙 문서 |

## 다시 만들기

저장소의 `fastapi_server/data_generation/`에서 그 폴더 README 순서대로 생성한 뒤 `python -m tools.build_handoff --out <새 폴더>`를 실행하면 이 구조가 그대로 나온다. 모델 표는 원본 파일과 값 하나하나를 대조한 뒤에만 저장된다.

- 출력 폴더는 `data_generation/` 밖의 새 경로로 준다. 이미 있으면 멈춘다. 심볼릭 링크 경로는 받지 않으므로 실제 폴더 경로를 준다.
- 이 묶음을 다시 만들 때만 `--overwrite`를 붙인다. `.handoff_bundle`에는 도구가 쓴 파일 목록과 SHA256이 들어 있고, 폴더 내용이 그 목록과 정확히 같을 때만 목록의 파일을 지운다. 파일을 하나라도 더하거나 고쳤으면 아무것도 지우지 않고 멈추므로, 이 폴더에 메모나 결과 파일을 넣고 싶으면 다른 폴더를 쓴다.
- 데이터 사전에 전달용으로 등록되지 않은 열이 생기면 `feature`로 넣지 않고 멈춘다. 새 열을 피처로 쓰려면 먼저 `DATA_DICTIONARY.csv`에 등록한다.

- 직군 코드는 원본 값 `wage/selfemp/freelance`다(서비스 코드 `EMPLOYEE/SELF_EMPLOYED/FREELANCER`).
- 대출 상환 일정(`loan_extension/`, 약 440MB)은 크기 때문에 뺐다. 필요하면 `data_generation/`에서 `python -m generate.build_loan_extension`으로 만든다.
- 권장 재현 환경은 `requirements.txt`의 고정 버전(numpy 2.3.5·pandas 2.2.3·scipy 1.17.0·scikit-learn 1.8.0)이다. 다른 버전으로 다시 만들면 소수점 마지막 자리가 다를 수 있다.
- 이번 묶음(v3.5.12)의 실제 생성 환경은 Python 3.11.9·numpy 2.4.6·pandas 3.0.5·scipy 1.17.1·scikit-learn 1.9.1이다(`3_reference/legacy/validation.json`에 numpy·pandas 버전 기록). 데이터 파일 값은 v3.5.10 묶음(고정 버전 환경)과 같다.
