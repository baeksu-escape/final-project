# 학습 데이터 기본 통계 보고서 (생성 파일)

- 생성일 2026-11-17, 학습 표 SHA-256 앞 8자리 `79511b5d`. 합성 데이터이며 실제 개인·금융 데이터가 아니다.
- `python -m training.data_report`로 만든 파일이다. 직접 고치지 않고 스크립트를 다시 실행해 갱신한다(FP-131).
- 분석은 TRAIN·VALID만 쓴다. TEST는 행 수만 센다(성능 비교는 최종 평가에서 한 번만).

## 1. 분할과 라벨
| 분할 | 행 수 | `label_any_delinquency_12m` 양성 비율 | `label_nonfin_effect_12m` 양성 비율 |
|---|---|---|---|
| TRAIN | 8,400 | 0.097 | 0.099 |
| VALID | 1,800 | 0.097 | 0.097 |
| TEST | 1,800 | (보지 않음) | (보지 않음) |

- 라벨 정의: 기존 모델 `label_any_delinquency_12m`, 대안 모델 `label_nonfin_effect_12m`(정의서 2-1).
- TRAIN·VALID 합계 10,200행, 직군(`segment`)별 행 수: wage=7,999, selfemp=1,477, freelance=724.

## 2. 결측 (TRAIN + VALID)
| 피처 | 원본 결측 | 비율 | 전처리 (나) 적용 후 결측 | 비율 |
|---|---|---|---|---|
| `income_svc_12m_krw` | 110 | 1.1% | 162 | 1.6% |
| `income_cv_svc_12m` | 0 | 0.0% | 162 | 1.6% |
| `expense_avg_month_krw` | 95 | 0.9% | 146 | 1.4% |
| `debt_service_current_krw` | 102 | 1.0% | 135 | 1.3% |
| `expense_ratio_svc_12m` | 0 | 0.0% | 306 | 3.0% |
| `dsr_svc_12m` | 0 | 0.0% | 295 | 2.9% |
| `deficit_months_svc_12m` | 0 | 0.0% | 436 | 4.3% |
| `worst_month_net_cash_svc_12m_krw` | 0 | 0.0% | 436 | 4.3% |
| `np_on_time_rate` | 2,526 | 24.8% | 2,526 | 24.8% |
| `hi_on_time_rate` | 398 | 3.9% | 398 | 3.9% |

- 위 표에 없는 피처 28개는 두 경우 모두 결측이 없다.
- 전처리 (나)(정의서 C19): C8 상한 밖 값·결측 입력과 그 파생 열을 결측으로 둔다. 구조적 결측(`*_on_time_rate`)은 채우지 않는다(C13).

## 3. C8 이상치 상한 (TRAIN + VALID, 정의서 10장 C8)
| 열 | 판정 | 행 수 | 비율 |
|---|---|---|---|
| `income_svc_12m_krw` | > 2,000,000,000 | 52 | 0.51% |
| `expense_avg_month_krw` | > 200,000,000 | 51 | 0.50% |
| `debt_service_current_krw` | < 0 | 33 | 0.32% |
| 하나라도 해당 |  | 133 | 1.30% |

## 4. 숫자 피처 요약 (TRAIN, 전처리 전 원본 값)
| 피처 | 최소 | 25% | 중앙값 | 75% | 최대 |
|---|---|---|---|---|---|
| income_svc_12m_krw | 1,053,084 | 22,447,296 | 37,298,268 | 61,907,004 | 117,947,328,000 |
| income_cv_svc_12m | 0 | 0 | 0 | 0 | 1.214 |
| zero_income_months_svc_12m | 0 | 0 | 0 | 0 | 4 |
| expense_avg_month_krw | 212,743 | 1,129,520 | 1,514,152 | 2,422,055 | 8,029,802,000 |
| debt_service_current_krw | -8,316,666 | 167,916 | 541,250 | 1,214,416 | 71,726,583 |
| expense_ratio_svc_12m | 0.0218 | 0.4542 | 0.5323 | 0.6656 | 2.935 |
| dsr_svc_12m | 0 | 0.05237 | 0.1608 | 0.3749 | 21.53 |
| deficit_months_svc_12m | 0 | 0 | 0 | 11 | 12 |
| worst_month_net_cash_svc_12m_krw | -55,666,388 | -636,048 | 322,821 | 1,428,716 | 15,908,337 |
| debt_balance_krw | 0 | 7,288,250 | 21,888,500 | 42,361,250 | 837,363,000 |
| L00000001 | 0 | 1 | 3 | 4 | 10 |
| DQ1200001 | 0 | 0 | 0 | 0 | 6 |
| L22000900 | 0 | 0 | 0 | 1 | 4 |
| LA0099212 | 0 | 0 | 0 | 0 | 810,679 |
| CF1231605 | 0 | 0 | 1 | 2 | 10 |
| CL0631905 | 0 | 4.38 | 19.43 | 64.28 | 179.4 |
| age | 20 | 41 | 49 | 56 | 69 |
| telecom_late_months | 0 | 0 | 0 | 0 | 4 |
| telecom_on_time_streak | 0 | 12 | 12 | 12 | 12 |
| utility_late_months | 0 | 0 | 0 | 0 | 5 |
| dp_ever_used | 0 | 1 | 1 | 1 | 1 |
| dp_active_months | 0 | 4 | 8 | 10 | 12 |
| dp_payment_count_12m | 0 | 19 | 50 | 107 | 2,135 |
| dp_payment_amount_12m_krw | 0 | 662,985 | 1,628,385 | 3,151,782 | 65,322,230 |
| np_due_months | 0 | 12 | 12 | 12 | 12 |
| np_on_time_months | 0 | 0 | 12 | 12 | 12 |
| np_arrears_months | 0 | 0 | 0 | 0 | 12 |
| np_on_time_rate | 0 | 1 | 1 | 1 | 1 |
| hi_due_months | 0 | 12 | 12 | 12 | 12 |
| hi_on_time_months | 0 | 12 | 12 | 12 | 12 |
| hi_arrears_months | 0 | 0 | 0 | 0 | 12 |
| hi_on_time_rate | 0 | 1 | 1 | 1 | 1 |
| si_arrears_any | 0 | 0 | 0 | 0 | 1 |

## 5. 범주형 값 분포 (TRAIN + VALID)
| 열 | 값별 행 수 | 부호표에 없는 값·결측 |
|---|---|---|
| `segment` | freelance=724, selfemp=1,477, wage=7,999 | 0 |
| `np_coverage_status` | covered=7,674, exempt=459, not_covered=2,067 | 0 |
| `np_payer_type` | regional=1,659, unknown=2,067, workplace=6,474 | 0 |
| `hi_coverage_status` | covered=9,802, dependent=300, not_covered=98 | 0 |
| `hi_payer_type` | household=300, regional=1,920, unknown=98, workplace=7,882 | 0 |

## 6. 피처 목록 일치 (DB 기준 확인용)
- 학습 피처: 기존 18개, 대안 38개.
- 서비스 피처 사전(FS-DRAFT 39개)에만 있는 것: ['LRZ021201']. (기대값: `LRZ021201` 하나, 정의서 C9로 모델에서 뺌)
- 학습에만 있는 것: 없음. (기대값: 없음)
