# 데이터 명세

합성 데이터의 공통 규칙, 0과 결측의 구분, 파일 구성을 정리한다. 필드별 정의는 `DATA_DICTIONARY.csv`를 따른다.

## 공통 규칙

| 항목 | 규칙 |
|---|---|
| 고객 ID | `customer_id` 문자열. 기존 집단 `SYN…`(12,000명), 씬파일 집단 `THF…`(2,400명), 서비스 더미 회원 `MEM…`. 서로 겹치지 않는다 |
| 기준일 | `2026-09-18` |
| 월별 원천 범위 | 완결 달력월 `2025-09`~`2026-08`(12개월). 기준일이 속한 9월은 미완결이라 넣지 않는다 |
| 카드 월별 | 기준일부터 거슬러 올라가는 30일 구간(`month_offset` 0=최근). 달력월과 직접 조인하지 않는다 |
| 금액 | 원(KRW) 정수. 207열과 원장의 `_thousand` 필드는 천원 단위 |
| 비율 | 소수(0.18 = 18%). DSR은 1을 넘을 수 있다 |
| 월 표기 | `YYYY-MM` 문자열 |
| 버전 | `package_version`(코드·문서 패키지)와 `data_version`(생성 데이터 스냅샷)을 구분한다. 버전은 `provenance.json`에 있다 |
| 집단 | `cohort` ∈ `legacy`(기존 12,000명), `no_credit`, `short_history`, `sparse_history`, `young_established` |

## 라벨

| 라벨 | 파일 | 정의 |
|---|---|---|
| `label_any_delinquency_12m` | `profiles.csv` | 가상 향후 12개월 중 연체가 발생한 월이 1개월 이상. 부도확률이 아니다. 기존 집단은 원본 학원 생성기의 라벨, 씬파일 집단은 원장 위험요인과 미래 신용 사용 가정으로 새로 만든 라벨이다(`THINFILE.md`) |
| `label_nonfin_effect_12m` | `labels_nonfinancial.csv` | 같은 정의에 통신·공과금 미납(승산비 2.5), 약한 현금흐름 효과, 국민연금·건강보험 비정시 납부(승산비 2.0, v3.5.0), 간편결제 규칙성(사용자 안 표준점수당 로짓 −0.15, v3.5.0)을 가정해 넣은 라벨. 기존 라벨은 그대로 둔다(`NONFINANCIAL_LABEL.md`) |

두 집단의 라벨은 생성 방식이 다르므로 합쳐 쓸 때는 `cohort`로 구분하고 집단별 결과를 함께 본다. `labels_nonfinancial_metadata.csv`와 `target_metadata.csv`의 설계 확률은 라벨을 만든 값이므로 모델 입력에 넣지 않는다.

## 0과 결측

- 대출 0건·잔액 0은 유효한 값(대출 없음)이다. 월 소득 0원도 유효한 값(무소득월)이다. DSR 0은 소득이 양수이고 확인된 상환액이 0일 때만 유효하다.
- 신용이력이 없거나 관측되지 않은 값은 null이다. 0이나 '우량'으로 채우지 않는다. 예: `CB`, `SP`, 과거 연체 건수, `CL0631905`.
- 누락(null·레코드 없음)과 실제 0원은 서로 바꾸지 않는다.
- `base_207.csv`의 `CB=5`, `PRE_LMT=0`, `PRE_RT=0`은 기존 스키마 호환용 자리표시자다. 미관측 여부는 `model_inputs.csv`·`ui_credit_summary.csv`의 null 표시를 따른다.
- `profiles.csv`의 `annual_income_krw`, `expense_ratio`, `income_cv`, `dsr`, `zero_income_months` 등은 12개월 집계다. 다른 기간의 값은 `monthly_history.csv`에서 계산한다.

### 교육용 등급(CB)의 방향 (v3.5.7 기록)

`CB`는 1~10의 교육용 등급이며 **1이 우량, 10이 고위험**이다. 원본 학원 생성기의 정의("1 우량~10 고위험, NICE 등급 아님", `reference/column_dictionary_207.csv`)이고, 기존 집단에서 미래 연체 비율이 1등급 5.2% → 5등급 11.9% → 8등급 38.5% → 10등급 75%로 커지는 것으로 확인했다. 공식 신용점수가 아니며, 서비스 회원에게 보여 주는 3단계 등급(`GOOD`/`STANDARD`/`CAUTION`, 모델 점수 기준)과 별개다(`SERVICE_DUMMY_DATA.md`).

### 씬파일 집단의 교육용 등급(CB) 가용성

| 상태 | 판별 | 인원(기본 설정) |
|---|---|---:|
| 등급 있음 | `cb_available = 1` | 1,086 |
| 신용이력 없음 | `credit_history_days = 0` | 600 |
| 이력 180일 미만 | `0 < credit_history_days < 180` | 114 |
| 카드 이용 희소 | 그 외 `cb_available = 0` (희소 이력 집단) | 600 |

기존 집단 12,000명은 모두 등급이 있다. 180일 기준 등은 이 프로젝트의 설계 가정이며 공식 신용평가 조건이 아니다. CB는 교육용 등급이고 공식 신용점수가 아니다.

## 6개월 입력 집계 (v3.5.7)

서비스 회원은 최근 완결 12개월(2025-09~2026-08)의 소득·생활지출·상환액을 입력한다(v3.5.11, v3.5.7~v3.5.10은 6개월). 모델 표의 입력 기반 집계는 그중 **최근 6개월(2026-03~2026-08)**로 계산한다. 기간은 `reference/service_dummy_anchors.json`의 `members.model_feature_months`가 정하며, 회원 입력 기간(`members.input_months`)의 마지막 6개월이어야 한다. 학습한 모델을 회원에게 그대로 쓰려면 같은 기간의 값으로 학습해야 하므로, 두 집단 모두 `input_features_6m.csv`를 만든다(`generate/build_input_features_6m.py`, 검증 `verify/verify_input_features_6m.py`). v3.5.11에서 회원 입력 기간이 늘었어도 이 파일의 기간·값은 바뀌지 않았다.

| 열 | 정의 |
|---|---|
| `income_6m_krw`, `expense_6m_krw`, `debt_service_6m_krw` | 6개월 합계 |
| `expense_ratio_6m`, `dsr_6m` | 6개월 지출·상환 / 6개월 소득. 소득 합이 0이면 null |
| `income_cv_6m` | 6개월 월소득의 모집단 표준편차 / 평균. 평균이 0이면 null |
| `zero_income_months_6m`, `deficit_months_6m` | 소득 0인 달, (소득 − 지출 − 상환) < 0인 달 수 |
| `worst_month_net_cash_6m_krw` | 6개월 중 최저 (소득 − 지출 − 상환) |
| `dp_payment_amount_6m_krw`, `dp_amount_to_income_6m` | 6개월 간편결제 금액, 그 금액 / 6개월 소득 |

- **전처리 시연용 결측·이상치(v3.5.10).** 모델 파트가 결측 처리와 이상치 탐지·처리를 시연할 수 있도록 `input_features_6m.csv`(두 폴더)에 조금 넣었다. 생성 단계에서 넣어 데이터는 하나이고, 원래 값은 같은 폴더의 `anomaly_log.csv`(`customer_id, column, anomaly_type, original_value, injected_value`)에 있다. 설정은 `reference/anomaly_injection.json` 한 곳이며 비율은 모두 교육용 가정이고 통계 근거가 없다.

  | 종류 | 대상 열 | 비율(파일별, 열마다) | 넣는 값 |
  |---|---|---|---|
  | `missing` | `income_6m_krw`, `expense_6m_krw`, `debt_service_6m_krw` | 1% | 빈 값 |
  | `unit_error` | `income_6m_krw`, `expense_6m_krw` | 0.5% | 원래 값 × 1,000 (원·천원 혼동) |
  | `negative` | `debt_service_6m_krw` | 0.3% | 원래 값 × −1 (원래 값이 0이 아닌 칸만) |

  한 칸에는 하나만 넣고, 라벨·위험도와 무관한 별도 seed의 난수로 뽑는다. 단위 착오도 원래 값이 0인 칸은 바뀌지 않으므로 뽑지 않는다. 파생 비율 열(`expense_ratio_6m`, `dsr_6m` 등)은 깨끗한 값으로 계산된 그대로라서 입력 열과 맞지 않는 칸이 있다(실제 데이터에서도 흔한 모습). `age`와 다른 파일은 바꾸지 않았다.
- 원천 월자료(`monthly_history.csv`)와 `profiles.csv`의 12개월 집계는 바꾸지 않는다. 다만 전달 묶음의 **모델 표에는 12개월 소득 집계 대신 6개월 집계가 들어간다.** 모델 표에서 뺀 열과 이유는 학습 묶음 README(`tools/handoff_README.md`)에 있다.
- 간편결제·사회보험·통신·공과금처럼 외부 API로 받는 정보는 회원 부담이 없으므로 12개월 집계를 그대로 쓴다.
- 라벨(향후 12개월 연체)은 예측 기간이며 입력 기간과 별개라 그대로다. 비금융 효과 라벨은 12개월 원천으로 만든 "실제로 일어난 일" 역할이고 바꾸지 않았다.

## 반올림 규칙 (v3.5.8)

- **난수로 만든 금액을 정수로 바꿀 때:** numpy 기본 방식(가까운 짝수, `np.rint`·`.round()`)을 쓴다. 원본 학원 생성기와 같은 방식이고, 입력이 연속값이라 딱 0.5가 나오는 일은 사실상 없다.
- **규칙으로 계산하는 금융 값:** `ROUND_HALF_UP`을 쓴다. 월 이자(원 단위)와 대출 금리 자릿수(소수 4자리, 0.01%p)가 해당한다. 금리는 `generate.synthesis_logic.quantize_rate`로 원장에 내보내는 시점에만 고정한다.
- 기존 `np.rint`·`.round()` 코드는 바꾸지 않았다. 기존 집단은 원본과 일치해야 하고 바꾸면 전체 결과가 달라진다. 금리 고정은 연간 상환 근사액(`annual_service_thousand`, `LRZ021201`), DSR, 라벨, 모델 표에 영향을 주지 않는다.

## 파일 구성

| 용도 | 파일 |
|---|---|
| 프로필·월별 원천 | `data/profiles.csv`, `data/monthly_history.csv` / `thinfile/profiles.csv`, `thinfile/monthly_history.csv` |
| 207열 신용정보 | `data/base_207.csv`(입력, 포함됨) / `thinfile/base_207.csv` |
| 기본 모델 입력 뷰 | `thinfile/model_inputs.csv` (미관측 값을 결측으로 표시) |
| 화면용 요약 | `thinfile/ui_credit_summary.csv` |
| 신용 원장 | `thinfile/loans.csv`, `cards.csv`, `delinquencies.csv`, `card_monthly.csv`, `card_account_monthly.csv` |
| 대출 목록·상환 일정 | `loan_extension/loans.csv`(두 집단), `schedule.csv`, `customer_horizons.csv`, `thinfile/loan_monthly_budget.csv` |
| 시나리오 예시 | `data/scenarios.csv`, `thinfile/scenarios.csv` (과거 12개월에 소득 20% 감소를 적용한 예시) |
| 간편결제·사회보험 원천(v3.5.0) | `digital_payment_monthly.csv`, `social_insurance_monthly.csv`, `nonfinancial_source_features.csv`(두 폴더 각각, `NONFINANCIAL_SOURCES.md`) |
| 비금융 효과 라벨 | `data/labels_nonfinancial.csv`, `thinfile/labels_nonfinancial.csv` |
| 6개월 입력 집계(v3.5.7) | `data/input_features_6m.csv`, `thinfile/input_features_6m.csv` (v3.5.10부터 결측·이상치 포함, 기록은 각 폴더 `anomaly_log.csv`) |
| 서비스 개발용 더미 | `service_dummy/` (학습에 쓰지 않는다, `SERVICE_DUMMY_DATA.md`) |
| 생성 설계·참고 | `thinfile/plan.csv`, `availability.csv`, `target_metadata.csv`, `cohort_summary.csv`, `*_metadata.csv` |

모든 파일은 생성 스크립트를 실행해야 만들어진다(`README.md`의 생성 순서). 시연 고객 목록은 포함된 코드가 만들지 않는다.
