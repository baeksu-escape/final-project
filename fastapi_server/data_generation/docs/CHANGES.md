# 변경 이력

데이터 생성과 해석에 영향을 주는 변경만 적는다. 최신 항목이 위에 있다. 문서 표현만 고친 버전은 한 줄로 줄였다.

## v3.6.1 (2026-11-12) — 서비스 더미 대출 종류·금리 방식

- N-05-3 서비스 더미 대출 원장과 금융 응답에 대출 종류·금리 방식을 추가했다. 학습 데이터 값은 바꾸지 않는다.

## v3.6.0 (2026-11-10) — 서비스 정의 12개월 열, 학습·검증·시험 분리

- **서비스 정의 열(R1, DDL v0.2 제안).** 서비스는 소득만 12개월, 지출은 평균 월 지출 하나, 상환은 현재 월 원리금 하나를 받는다. 같은 정의로 `input_features_12m.csv` 뒤쪽에 9열을 붙였다: `income_svc_12m_krw`, `income_cv_svc_12m`, `zero_income_months_svc_12m`, `expense_avg_month_krw`(12개월 평균, `ROUND_HALF_UP`: 정확히 .5이면 올림. v3.5.8 규칙·DB 시드·Java·Oracle과 같음), `debt_service_current_krw`(기준월 2026-08 상환액), `expense_ratio_svc_12m`, `dsr_svc_12m`, `deficit_months_svc_12m`, `worst_month_net_cash_svc_12m_krw`(월 소득 − 평균 지출 − 현재 상환). 기존 12개월 열의 이름·값·이상치 기록은 그대로다.
- **급여소득자 소득.** 원천의 급여소득자 월 소득은 출렁인다(고객별 CV 평균 0.056). 서비스는 1개월 입력을 12개월로 펼치므로(`REQUIRED_INCOME_MONTHS = 1`) 서비스 정의 열에서만 기준월 소득 × 12로 계산한다. 원천·라벨·6개월·기존 12개월 열은 바꾸지 않았다. 급여소득자 기준월은 팀 확인 전 임시로 2026-08(`TODO`).
- **모델 표.** 서비스 정의 9열은 `feature`. 기존 12개월 집계 중 10열(`income_12m_krw`, `income_cv_12m`, `zero_income_months_12m`, `dp_amount_to_income_12m`, `expense_12m_krw`, `debt_service_12m_krw`, `expense_ratio_12m`, `dsr_12m`, `deficit_months_12m`, `worst_month_net_cash_12m_krw`)은 모델 표에서 뺐다(사용자 승인. v3.5.13 묶음은 배포되지 않았다). 상세 `input_features_12m.csv`에는 값 그대로 남는다. `dp_payment_amount_12m_krw`는 그대로 `feature`다. 모델 표 legacy 252열(피처 236→235), thinfile 261열(피처 244→243).
- **전처리 시연.** 새 설정 `reference/anomaly_injection_12m_svc.json`(seed 20261115)과 로그 `anomaly_log_12m_svc.csv`. 기존과 같은 결측 1%·단위 착오 0.5%·음수 상환 0.3% 교육용 가정이며, 기존 12개월 설정·로그는 바꾸지 않았다.
- **학습·검증·시험 분리.** 새 `generate/build_data_split.py`·`reference/data_split.json`(seed 20261114)이 각 폴더에 `data_split.csv`를 만든다. 고객 ID 단위 TRAIN/VALID/TEST 70/15/15, 직군 × `label_any_delinquency_12m` 층화, 집단마다 따로. 모델 표에서 `dataset` 바로 뒤, `role = split`. DB 적재 규칙(`LABEL_TYPE_CODE` 늘 `SYNTHETIC`, TEST면 `EVAL_ELIGIBLE_YN = Y`)은 `DATA_SPEC.md`에 적었다. 이 `Y`는 시험 분할 표시이며, 씬파일 성능 비교에는 `eval_future_credit_exposure = 1` 필터도 함께 적용한다.
- **서비스 더미 기관 응답(동의 무관).** 가상 기관 응답 6종을 동의와 무관하게 모든 회원 `status = OK` + 데이터로 바꿨다(`generate/service_dummy_logic.py`의 응답 함수와 짝 검사 3곳). 동의 확인은 목 서버가 요청 시점에 한다. `members.csv`의 `external_data_consent`는 그대로이며 뜻은 '시연 시작 시 동의 상태'다. 기존 동의 회원의 응답 값은 바뀌지 않도록 청구서 난수는 그 회원들 것을 먼저 뽑는다. 바뀐 출력은 비동의 회원의 응답 6개 파일 내용이다.
- **사전 정정.** `telecom_late_months`·`utility_late_months` 설명의 "현 버전 0 또는 1"이 틀려 "0~12, 실제 생성 분포 0~5"로 고쳤다(`DATA_DICTIONARY.csv`, `field_dictionary.csv`). 미납이 시작되면 매달 30% 확률로 이어지는 규칙(v3.2.0)이라 여러 달이 나온다. 생성 값은 바뀌지 않았다.
- **검증·바뀌지 않은 것.** 12개월 검증기를 서비스 정의 열까지 넓히고 `verify/verify_data_split.py`를 추가했다. 고정 예제 테스트를 11건 추가했다(정확히 .5 경계, 동의 회원 청구서 값 보존 포함). 재생성 결과 v3.5.13 생성 파일 85개 중 77개는 바이트가 같다. 바뀐 것은 두 집단의 `input_features_12m.csv`(기존 열 값 동일, 9열 추가)와 기관 응답 6개(동의 회원 응답은 그대로, 비동의 회원 82명만 OK + 데이터)다. 새 파일은 `data_split.csv`·`anomaly_log_12m_svc.csv` 각 2개와 DB 작업의 `member_asset_snapshots_v02.csv`다. DB 시드(DDL v0.2 구조)는 별도 작업이다. 최종 재생성 수치는 provenance.json에 기록한다.

## v3.5.13 (2026-11-10) — 기본 모델 입력 12개월, 6개월 보존·참고용

- **기본 기준.** 12개월이 기본 학습(role=feature)이다. 6개월 파일·열·값은 보존·참고용(compatibility_only)이며 기본 학습에서 제외한다. 모델 표의 기존 열 값·상대 순서를 유지하고 새 12개월 10열을 라벨 앞에 추가했다(간편결제 금액 12개월 열은 이미 있어 값 대조 후 기존 위치 유지). 라벨은 맨 끝쪽에 두며 씬파일 평가용 tail은 기존처럼 라벨 뒤 마지막 열이다.
- **신규 집계.** data/·thinfile/의 input_features_12m.csv는 원천 12개월(2025-09~2026-08)로 소득·생활지출·상환 합계, 비율, CV, 무소득·적자 월수, 최저 현금흐름, 간편결제 금액·비율을 계산한다. 6개월 값을 두 배로 늘리지 않는다. 0소득 비율은 NULL, 누락·중복 월은 거부한다.
- **설정·공유 수식.** members.model_feature_months는 12개월, 새 model_feature_months_6m는 기존 6개월이다. 기존 함수·열 이름을 유지하며 input_feature_logic.aggregate_input_features를 두 생성기가 공유한다. build_members.py의 오래된 6개월 설명만 정정했다.
- **독립 전처리 시연.** anomaly_injection_12m.json(seed 20261113, 기존 설정 중복 없음)과 anomaly_log_12m.csv를 추가했다. 기존과 같은 결측 1%·단위 착오 0.5%·음수 상환 0.3%의 교육용 가정이며 라벨과 독립이다. 파생 비율은 주입 전 값으로 유지한다. 기존 6개월 주입 설정·로그는 그대로다.
- **전달·검증.** 새 12개월 파일은 2_detail, 새 로그는 학습 금지 3_reference에 배치한다. 사전·출처 미분류 거부와 미래값 누수 방지를 유지했다. 신규 독립 재계산 검증기와 고정 예제 테스트를 추가했다. 실제 실행 결과·환경·불변 비교는 provenance.json의 v3_5_13_regeneration에 기록한다.
- **서비스·DB.** 회원은 기존처럼 12개월 입력하며 서비스 더미에는 이상치를 넣지 않는다. DB 구조·API·라벨·원천 월별 이력은 변경하지 않는다. 실제 재생성 SQL 비교 결과는 새 작업 로그에 남긴다.

## v3.5.12 (2026-11-09) — 등급 상태 입력 부족 제거 (문서만)

- 회원 월 입력 12개월이 필수가 되어 덜 차면 점수를 산출하지 않으므로, 등급 상태 `INSUFFICIENT_INPUT`(입력 부족)을 없앴다. 상태는 `SCORED`·`NOT_SCORABLE` 두 개다. 서비스 점수 0~1000, 등급 경계 665·780(임시, D-01)을 `SERVICE_DUMMY_DATA.md`·`tools/handoff_README.md`에 적었다. 생성 코드와 데이터는 바뀌지 않았다. DB 묶음은 v2.4(`MEMBER_CREDIT_GRADE` CHECK·코멘트).

## v3.5.11 (2026-11-05) — 회원 월 입력 12개월, 모델 집계 기간 키 분리

- **배경(서비스 결정).** N-22 소득 변동성 진단의 비수기 판별에는 12개월 소득이 필요하다. v3.5.7에서 가입 장벽을 줄이려고 6개월로 줄였던 회원 월 입력(소득·생활지출·상환액)을 다시 최근 완결 12개월(2025-09~2026-08)로 늘린다. 12개월을 다 입력하지 않으면 입력 부족(`INSUFFICIENT_INPUT`)이다.
- **설정 키 분리.** `reference/service_dummy_anchors.json`의 `members.input_months`는 원래 뜻(회원이 입력하는 달)대로 12개월로 바꾸고, 학습 모델 표의 입력 기반 집계 기간은 새 키 `members.model_feature_months`(6개월, 2026-03~2026-08)로 나눴다. `generate/build_input_features_6m.py`의 `input_months()`는 새 키를 읽는다. 함수 이름과 `*_6m` 열의 이름·의미는 그대로다.
- **검증·테스트.** `verify/verify_input_features_6m.py`는 집계 기간이 회원 입력 기간의 마지막 연속 6개월인지 확인한다. 고정 예제 테스트: 회원 입력 12개월 기대값으로 수정, 입력 기간 밖 달이 빠지는지 1건 추가.
- **바뀐 출력.** `service_dummy/members/member_monthly_inputs.csv` 하나(2,400 → 4,800행, 회원 400명 × 12개월). DB 묶음 v2.3의 `12_seed_member_monthly_input.sql`과 관련 코멘트·행 수 검사.
- **바뀌지 않은 것.** 재생성 결과를 v3.5.10 학습 묶음(`2_detail/`)의 26개 파일(기존 집단 9, 씬파일 17; `input_features_6m.csv`, `monthly_history.csv`, `profiles.csv` 포함)과 값으로 비교해 모두 같았다. `member_monthly_inputs.csv`의 2026-03~2026-08 행 2,400건은 금액·입력일이 DB v2.2 시드와 모두 같다. 그 밖의 서비스 더미(외부 API 응답, 원장)는 이미 12개월이라 바뀌지 않는다.
- **재생성 환경.** 2026-11-05, Python 3.11.9, numpy 2.4.6, pandas 3.0.5, scipy 1.17.1, scikit-learn 1.9.1 (`provenance.json`의 기록 환경과 다르지만 위 비교에서 값이 같았다). Windows에서는 `PYTHONUTF8=1`로 실행했다.

## v3.5.10 (2026-11-03) — 학습용 6개월 입력 집계에 전처리 시연용 결측·이상치 추가

- **배경.** 모델 파트가 결측 처리와 이상치 탐지·처리를 시연할 수 있도록, `input_features_6m.csv`(`data/`, `thinfile/`)에 결측·이상치를 조금 넣었다. 생성 단계에서 넣어 데이터는 하나이고, 원래 값은 새 `anomaly_log.csv`(각 폴더)에 남겼다.
- **규칙(교육용 가정, 통계 근거 없음).** 결측 1%(소득·지출·상환 합계), 단위 착오 0.5%(소득·지출, 원래 값 × 1,000), 음수 0.3%(상환 합계, 원래 값 × −1). 파일별·열마다 비율을 적용하고 한 칸에는 하나만 넣는다. 설정은 `reference/anomaly_injection.json`, seed는 기존과 겹치지 않는 20261110이다.
- **코드.** 순수 함수 `inject_anomalies`(`generate/synthesis_logic.py`), `generate/build_input_features_6m.py`가 집계 뒤 저장 전에 적용. `verify/verify_input_features_6m.py`는 기록 칸을 "원래 값 = 재계산 값, 파일 값 = 넣은 값"으로 확인하고 종류·열별 개수를 설정 비율과 대조한다. `tools/build_handoff.py`는 `anomaly_log.csv`를 `3_reference`에 넣는다.
- **바뀐 출력.** `input_features_6m.csv` 2개, 새 `anomaly_log.csv` 2개, 전달 묶음 모델 표의 해당 열 값. 파생 비율 열과 `age`는 그대로다.
- **바뀌지 않은 것.** 그 밖의 모든 생성 결과(라벨, 207열, profiles, monthly_history, loan_extension, 서비스 더미, DB 시드).

## v3.5.9 (2026-11-03) — 상환방식 3종 배정, 대출 종류 코드 8번 정의

- **상환방식 3종.** 모든 계좌를 원금균등으로 가정하던 것을 만기일시(`bullet`)·원리금균등(`equal_payment`)·원금균등(`equal_principal`)으로 나눈다. 대출 종류별 확률표는 `reference/repayment_method_assumptions.json`(값마다 `basis`·`source`·`note`)에 있고, 계좌 ID 해시로 배정한다. 위험도·라벨과 무관하며 근거 열 `repayment_method_basis`(`kind_probability_assumption_v1`)를 추가했다. 기존 열 이름은 그대로다.
- **근거.** 통계는 주택담보 만기일시 0.48(은행 비거치 분할 51.6%)뿐이고, 신용대출은 만기일시가 기본이라는 상품 설명만 근거다. 나머지는 가정이다.
- **일정 계산.** 순수 함수 `amortization_rows`(`generate/synthesis_logic.py`). 이자 규칙(월초 잔액 × 연금리/12, ROUND_HALF_UP)과 금리 +2%p 시나리오(변동금리만)는 그대로다.
- **코드 8번.** 대출 종류 8 = 신차 외 할부(중고차 할부 등). 코드 사용 방식으로 추정한 정의다. 데이터 사전의 `kind` 설명에 0~8을 적었다.
- **검증·테스트.** `verify_loan_extension.py`가 방식별 규칙을 독립 재계산하고, 확률표 합 1과 해시 배정 일치를 검사한다. 고정 예제 테스트 1건 추가.
- **바뀐 출력.** `loan_extension/`의 `loans.csv`(상환방식 값, `repayment_method_basis` 열), `schedule.csv`, `service_comparison.csv`, `customer_horizons.csv`.
- **바뀌지 않은 것.** 그 밖의 모든 출력(원장 `legacy_loans.csv`, 씬파일, 라벨, 모델 표, 207열, 서비스 더미, DB 시드). 서비스 더미·DB에 상환방식을 넣는 일은 하지 않았다.

## v3.5.8 (2026-11-03) — 대출 금리 소수 4자리 고정, 반올림 규칙 문서화

- **금리 고정.** 원장에 내보내는 대출 금리를 소수 4자리(0.01%p)로 `ROUND_HALF_UP` 고정한다(`generate.synthesis_logic.quantize_rate`). 이전에는 0.0812345678 같은 float가 그대로 저장되고 DB 시드만 6자리로 반올림해서, DB 금리로 이자를 다시 계산하면 1원씩 어긋날 수 있었다. 이제 원장·상환 일정·더미 API·DB가 같은 금리를 쓴다.
- **적용 위치.** 씬파일 원장(`thinfile_engine.py`의 원장 행)과 기존 집단 원장(`build_loan_extension.py`)에서만 고정한다. 원본 학원 생성기·`base_207.csv`·금리를 만드는 계산은 그대로다.
- **바뀐 출력.** `annual_rate`가 들어간 파일(`thinfile/loans.csv`, `loan_extension/` 원장·일정·요약, 회원 원장, 금융 API 응답, DB 시드 15·16번)과 이자 합계.
- **바뀌지 않은 것.** 연간 상환 근사액(`annual_service_thousand`, `LRZ021201`), DSR, 라벨, 모델 입력·모델 표, 207열, profiles, 월별 원천. 그래서 원본 근사액과 고정된 금리 사이에 아주 작은 차이가 남는다(`LOAN_EXTENSION.md` 가정 6).
- **검증·문서.** `verify_loan_extension.py`에 `rate_precision` 검사 추가, `quantize_rate` 고정 예제 테스트 1건 추가. `DATA_SPEC.md`에 「반올림 규칙」 절, `LOAN_EXTENSION.md` 가정 3·6 보충, `DATA_DICTIONARY.csv`의 `annual_rate` 6행 설명 갱신.

## v3.5.7 (2026-11-02) — 회원 입력 6개월, 학습 피처를 회원 데이터에 맞춤, 신용평가사·공과금 API 더미, 등급 코드

- **배경(서비스 결정).** 학습한 모델로 서비스 회원의 점수를 계산하려면 모델의 입력이 회원 데이터에도 있어야 한다. 그동안 회원 더미에는 `CB` 등 207열과 공과금 정보가 없었고, 회원 입력은 12개월이었다. 회원에게 없는 항목은 회원 쪽에 추가하고, 회원 입력은 가입 장벽을 줄이려고 6개월로 줄이며, 학습 데이터를 그 6개월에 맞추기로 했다.
- **회원 월 입력 6개월.** `member_monthly_inputs.csv`는 최근 완결 6개월(2026-03~2026-08)만 담는다(4,800 → 2,400행). 기간은 `reference/service_dummy_anchors.json`의 `members.input_months` 한 곳에서 정한다. 남은 달의 값과 입력일은 v3.5.6과 같다. 6개월 미입력(입력 부족) 회원은 서비스 대상이 아니라 더미에 넣지 않았다.
- **신용평가사 API 더미(새로).** `credit_bureau_responses.jsonl`: 회원의 207열과 신용이력 열 4개. 미관측 값은 null, 라벨 원천 `결과값(연체회차)`와 제시 한도·금리 `PRE_LMT`·`PRE_RT`는 제외. 근거 원장 `ledgers/credit_bureau.csv`(회원 생성 때 버리던 207열을 남김).
- **공과금 API 더미(새로).** `utility_responses.jsonl`: 통신과 같은 형식, 미납 여부는 `utility_late`. 청구액 분포·기한은 가정. 근거 원장 `ledgers/utility_monthly.csv`. 기존 네 응답(금융·통신·간편결제·공공보험)은 바이트 단위로 같다.
- **6개월 입력 집계(새로).** `generate/build_input_features_6m.py`가 두 집단의 `input_features_6m.csv`(소득·지출·상환 합계, 지출비율, DSR, 소득 변동계수, 무소득·적자 월수, 최저 월 현금흐름, 간편결제 금액과 소득 대비 비율)를 만든다. 독립 재계산 검증기 `verify/verify_input_features_6m.py` 추가(검증기 10종).
- **모델 표(전달 묶음) 피처 변경.** 회원에게도 있는 값만 남겼다. 12개월 소득 기준 집계 11개는 6개월 열로 바꾸고, 회원이 입력하지 않는 자산 기반 열 10개와 금융사 제시 한도·금리 `PRE_LMT`·`PRE_RT`(기존 집단, 씬파일은 이전부터 제외)는 뺐다. 기존 집단 253 → 242열, 씬파일 261 → 251열. 뺀 열은 원천 파일(`2_detail/`)에 그대로 있고 목록·이유는 학습 묶음 README에 있다. 남은 피처마다 회원 쪽 원천이 있는지 확인했다.
- **등급 코드와 `CB` 방향 기록.** `CB`는 1 우량~10 고위험(원본 정의, 기존 집단 등급별 미래 연체 비율로 확인)임을 `DATA_SPEC.md`와 데이터 사전에 적었다. 서비스 회원 등급은 `CB`가 아니라 모델 점수를 구간으로 나눈 `GOOD`/`STANDARD`/`CAUTION`이고, 점수를 낼 수 없으면 `NOT_SCORABLE`(산정 불가)·`INSUFFICIENT_INPUT`(입력 부족)이다. 구간 기준은 모델 팀이 정한다(`SERVICE_DUMMY_DATA.md`). 임시로 논의한 `CB` 1~3/4~7/8~10 구간안은 쓰지 않는다.
- **바뀌지 않은 것.** 기존 생성 결과(`data/`, `thinfile/`, `loan_extension/`, 실험 출력, 라벨)는 v3.5.6과 바이트 단위로 같다. 바뀐 출력은 `member_monthly_inputs.csv` 하나이고, 새 파일 6개(`input_features_6m.csv` 2개, 신용평가사·공과금 응답과 원장 4개)가 생겼다.
- 고정 예제 테스트 8건 추가(74건): 6개월 입력, 신용평가사·공과금 응답과 검사기, 6개월 집계. 데이터 사전 31행 추가, 2행 수정.

## v3.5.6 (2026-11-01) — 전달 묶음 도구 심볼릭 링크 차단 수정, 코드 ZIP 파일명 인코딩

- 외부 검토 반영. `build_handoff.py`의 `prepare_output()`이 `--out`을 먼저 `resolve()`해서 심볼릭 링크 검사(`out.is_symlink()`)가 늘 거짓이었다. 그래서 링크 경로에 `--overwrite`를 주면 링크가 가리키는 실제 묶음 폴더의 파일이 지워졌다(파일 목록·SHA256 검사는 그대로 작동해 도구가 만든 묶음만 해당). 이제 `resolve()` 전에 사용자가 준 경로가 링크인지 검사하고, 링크면 `--overwrite` 여부와 관계없이 아무것도 지우지 않고 멈춘다(끊어진 링크 포함). 상위 폴더의 링크(예: macOS `/tmp`)는 막지 않는다. 회귀 테스트 2건 추가(66건, 수정 전 코드에서는 2건 실패).
- 코드 ZIP의 한글 파일명 항목(`reference/statistics/` 3개)에 UTF-8 파일명 표시를 넣었다. v3.5.5 ZIP은 이 표시가 없어 Python 표준 압축 해제 등에서 이름이 깨지고 `manifest.json` 경로와 맞지 않았다(내용은 같음).
- 전달 README(`tools/handoff_README.md`)에 버전·테스트 수를 고치고 링크 경로를 받지 않는다는 안내를 한 줄 넣었다.
- 깨끗한 사본에서 기본 설정으로 다시 생성했다. 검증기 9종 PASS, 테스트 66건 통과. 전달 묶음 51개 파일 중 `README.md`와 그 해시를 담은 `.handoff_bundle`만 v3.5.5와 다르고, 모델 표·열 역할표·상세 원천·참고 파일 49개는 바이트 단위로 같다. 서비스 더미로 다시 만든 DB SQL 16개도 DB v2.1과 같다. 생성 코드 변경 없음.

## v3.5.5 (2026-11-01) — 요약 절대경로 제거, 씬파일 학습 대상 명시

- 외부 검토 반영. `build_nonfinancial_sources.py`가 `data/nonfinancial_sources_summary.json`의 `folder`에 생성 PC의 절대경로(예: `/home/.../data`)를 쓰던 것을 패키지 기준 상대경로(`data`, `thinfile`)로 바꿨다. 패키지 밖 폴더면 폴더 이름만 쓴다. 내부 경로가 전달 묶음(`3_reference/legacy/`)에 노출되지 않고, 다른 위치에서 생성해도 같은 바이트가 나온다. 고정 예제 테스트 1건 추가(64건).
- 전달 README(`tools/handoff_README.md`)에 씬파일은 **학습과 평가 모두** `eval_future_credit_exposure == 1`(1,531명)로 하라고 적었다. 이전에는 평가만 적혀 있어, 2,400명 전체로 학습하면 미래 신용을 쓰지 않아 라벨이 0인 869명 때문에 "신용이력 없음 = 저위험"을 배울 수 있었다. 패키지 실험(`measure_nonfinancial_label_lift.py`)은 원래 이 기준을 쓴다.
- 다른 생성 결과(모델 표·열 역할표·상세 원천·서비스 더미 포함)는 v3.5.4와 바이트 단위로 같다. 바뀐 출력은 `data/nonfinancial_sources_summary.json` 하나다.

## v3.5.4 (2026-11-01) — 전달 묶음 도구 안전장치 보강

- 외부 검토 반영. v3.5.3의 보호는 표시 파일이 있는지만 보고 폴더 전체를 지웠고(표시 파일은 누구나 만들 수 있다), 패키지 하위 경로(예: `docs/new_bundle`)를 막지 않았으며, `segment`만 사전 규칙의 예외였다.
- 폴더 전체 삭제를 없앴다. `.handoff_bundle`에 도구가 쓴 파일 목록과 SHA256을 기록하고, `--overwrite` 때 폴더의 파일 집합·내용이 목록과 정확히 같을 때만 목록의 파일과 비게 된 폴더를 지운다. 추가·누락·변경 파일, 목록 밖을 가리키는 경로, 심볼릭 링크가 있으면 아무것도 지우지 않고 멈춘다.
- 출력 위치는 패키지 루트·그 하위 모든 경로·패키지를 포함한 상위 폴더를 모두 거부한다.
- `segment` 예외를 없앴다. 모든 피처가 같은 사전 규칙을 따른다. 전달 README는 도구가 직접 쓴다(`tools/handoff_README.md`).
- 고정 예제 테스트 11건 추가(`tests/test_build_handoff.py`, 임시 폴더만 사용). 모델 표·열 역할표는 v3.5.3과 바이트 단위로 같다.

## v3.5.3 (2026-11-01) — 전달 묶음 도구 안전장치

- 외부 검토 반영. `build_handoff.py`가 기존 `--out` 폴더를 지우던 동작을 바꿨다: 폴더가 있으면 멈추고, `--overwrite`를 줘도 이 도구가 만든 폴더(`.handoff_bundle`)만 지운다. 패키지 자체·패키지를 포함한 상위 폴더·`data/`·`thinfile/` 안은 출력 위치로 쓸 수 없다.
- 열 역할을 엄격하게 바꿨다: 허용된 원천 표(`base_207`, `model_inputs`, `profiles`, `nonfinancial_source_features`)에서 왔고 데이터 사전에 그 표의 전달용 필드로 등록된 열만 `feature`. 그 밖의 열은 `unclassified`로 보고 생성을 멈춘다. 현재 출력의 역할표·모델 표는 v3.5.2와 바이트 단위로 같다.

## v3.5.2 (2026-11-01) — 전달 묶음 도구

- `tools/build_handoff.py` 추가: 생성 결과를 집단별 모델 표 2개(`1_model/`, 열 역할표 포함), 상세 원천(`2_detail/`), 설계값·점검(`3_reference/`), 문서로 나눈다. 모델 표에서 `결과값(연체회차)`(기존 라벨의 원천)를 빼고, 씬파일은 `model_inputs.csv`의 결측 표시와 항상 0인 자리표시자(`PRE_LMT`, `PRE_RT`) 제외를 적용한다. 원본 파일과 값을 대조하고, `data/`·`thinfile/`의 모든 파일이 한 폴더에 배정됐는지 확인한 뒤 저장한다. 생성 코드·데이터 변경 없음.

## v3.5.1 (2026-11-01) — 문서 정정

- 외부 검토 반영: `DATA_SPEC.md` 라벨 요약에 v3.5.0 두 항 추가, README·`NONFINANCIAL_SOURCES.md`에 사회보험 원천이 금융 연체와 연결돼 있음을 명시, `NONFINANCIAL_LABEL.md`에 상승폭 해석(v3.4 몫 포함, `dp_amount_to_income`을 빼도 상승이 줄지 않음) 추가. 코드·데이터 변경 없음.

## v3.5.0 (2026-11-01) — 간편결제·국민연금·건강보험 원천 생성, 비금융 효과 라벨에 두 항 추가

- **새 원천:** `NONFINANCIAL_CANDIDATES.md` 설계안대로 두 집단에 `digital_payment_monthly.csv`(고객-월), `social_insurance_monthly.csv`(고객-월-보험), `nonfinancial_source_features.csv`(고객 단위 집계)를 만든다(`generate/build_nonfinancial_sources.py`, 규칙 `nonfinancial_sources.py`, 설정 `reference/nonfinancial_sources.json`). 통계 기준점(Npay 경험률 85%, 고객-월 활성 58%, 건당 31,100원, 국민연금 당월 금액 징수율 사업장 95.4%·지역 71.7%)은 집단 수준에서만 맞추고, 가입유형·납부예외·위험 기울기 등은 가정으로 표시했다(`docs/NONFINANCIAL_SOURCES.md`). 기존 라벨은 읽지 않는다.
- **비금융 효과 라벨:** `label_nonfin_effect_12m`의 로짓에 사회보험 비정시 1개월 이상(승산비 2.0)과 간편결제 규칙성(사용자 안 표준점수당 −0.15)을 더했다. 근거는 국민연금 성실납부자 불량률 분석(보건복지부·금융위원회 2020)과 Ghosh·Vallée·Zeng(NBER w34148). 납부 의무가 없거나 간편결제를 쓰지 않는 사람은 0(감점 없음). **같은 이름의 라벨 값이 바뀐다.** 기존 라벨 `label_any_delinquency_12m`과 v3.4의 다른 출력은 바이트 단위로 같다.
- **확인 범위:** 생성 전에 AUC 상승 확인 범위를 전체 +0.02~0.05, 씬파일 +0.02~0.06으로 넓혔다(v3.4: +0.01~0.03, +0.02~0.05). 측정 결과 실현 라벨 +0.050·+0.067, 라벨 20회 재추출 기대값 +0.035·+0.053, 기존 라벨 +0.000·−0.020. 실현값이 상한을 조금 넘었지만 기대값이 범위 안이라 효과 크기와 시드는 바꾸지 않았다(`NONFINANCIAL_LABEL.md`).
- **측정 스크립트:** `experiments/measure_nonfinancial_label_lift.py`(v3.4.0에서 뺀 측정을 재현 가능하게 복원, 라벨 재추출 기대값 추가). 출력 `nonfinancial_label_lift/`.
- **서비스 더미:** 회원 원장에 `digital_payment_monthly.csv`, `social_insurance_monthly.csv`를 추가하고(회원 시드), 외부 API에 `payment_responses.jsonl`, `public_insurance_responses.jsonl`을 추가했다. 기존 회원·원장·금융·통신 응답 파일은 바뀌지 않는다.
- **검증:** `verify/verify_nonfinancial_sources.py`(규칙, 재현성, 집계 재계산, 기준점, 위험 연결, 라벨 항 재계산, 기존 라벨 보존), 고정 예제 테스트 17건 추가(`tests/test_nonfinancial_sources.py`).
- **문서:** `NONFINANCIAL_SOURCES.md` 신설, `NONFINANCIAL_LABEL.md`·`NONFINANCIAL_CANDIDATES.md`·`SERVICE_DUMMY_DATA.md`·`DATA_SPEC.md`·`SOURCES_AND_ASSUMPTIONS.md`·`DATA_DICTIONARY.csv`(85행 추가, 라벨 규칙 2행 수정) 갱신.

## v3.4.2 (2026-10-31) — 최종 전체 규모 검증

v3.4.1을 기본 설정 그대로 별도 작업 복사본에서 전체 생성하고 검증했다. 코드 변경은 없으며 생성 결과는 패키지에 넣지 않았다.

- **생성:** 기존 12,000명, 씬파일 2,400명(집단당 600명), 대출 33,317계좌(기존 32,110), 대출상품 17개, 회원 400명·월별 입력 4,800행, 금융·통신 응답 각 400건, 가정 민감도·비금융 실험·보조 민감도. 모든 단계 정상 종료.
- **검증:** `verify`, `verify_statistics`, `verify_thinfile_general`, `verify_card_accounts`, `verify_thinfile`, `verify_loan_extension`, `verify_assumption_sensitivity`, `verify_nonfinancial_experiment` 모두 PASS. 고정 예제 테스트 35건 통과. 입력 `data/base_207.csv`는 생성 후에도 해시가 같다.
- **비금융 효과 라벨 AUC 상승**(금융 특성만 → +비금융 특성, 5겹 교차검증 3회 평균): 기존 집단 +0.031(확인 범위 +0.01~0.03의 상한을 0.001 넘음), 씬파일 +0.025(범위 안). 기존 라벨은 +0.001, −0.005로 효과가 없다. 상한 초과는 측정 변동 수준이라 효과 크기는 바꾸지 않았다.
- **미납 규칙:** 공과금·통신 중 하나라도 미납한 비율 기존 10.0%, 씬파일 9.0%. 최근 금융 연체가 있는 사람의 통신 미납 19.6~20.4%, 없는 사람 4.0%. 미납자의 평균 미납 기간 1.34~1.41개월.
- **씬파일 집단:** 등급 미산출 no_credit 600·short_history 114·sparse_history 600명(`DATA_SPEC.md`와 일치). 기존 라벨 양성률 no_credit 3.0%, short_history 7.5%, sparse_history 1.2%, young_established 12.2%.
- **서비스 더미:** 회원 ID가 학습 데이터와 겹치지 않음, 외부 조회 동의 79.5%. 대출상품 최고금리 19.64%로 모든 상품이 법정 최고금리 20% 이하이고 금리 범위가 기준점을 포함한다.

## v3.4.1 (2026-10-31) — 기록 정정

- v3.4.0 기록의 테스트 수를 정정했다. 26건은 `test_reproduction_comparison`(9건)을 뺀 수였고, `tests/` 전체는 35건이다(외부 소규모 검증에서 발견). 코드 변경은 없다.

## v3.4.0 (2026-10-31) — 폴더 구조

- Python 파일을 역할별 폴더로 나눴다: `generate/`(생성 11개), `verify/`(검증 8개), `tests/`(테스트 4개), `experiments/`(실험 4개). 실행은 패키지 루트에서 `python -m generate.extend`처럼 한다(`README.md`). import 경로와 각 스크립트의 기준 경로를 고쳤고, 출력 위치(`data/`, `thinfile/` 등)는 그대로다.
- 데이터 생성·검증에 쓰지 않는 모델 쪽 스크립트 3개를 뺐다: `experiment_labels.py`(옛 효과 강도별 실험 라벨, 비금융 효과 라벨과 비금융 실험으로 대체), `check_models.py`(모델 비교), `load_thinfile_model.py`(모델 입력 예제, 같은 규칙이 `DATA_SPEC.md`·`THINFILE.md`에 있다).
- 생성 로직은 바뀌지 않았다. 작업 복사본에서 기존 12,000명·씬파일 집단당 60명·회원 집단당 10명으로 모든 생성·실험 스크립트와 검증기 8종을 새 구조로 실행해 통과했다. 고정 예제 테스트 35건 통과(`tests/` 4개 파일: 합성 로직 9, 서비스 더미 9, 비금융 라벨 8, 재현 비교 9).

## v3.3.0 (2026-10-31) — 문서·파일 정리

- 문서를 데이터 생성·해석에 필요한 내용으로 줄였다. 프로젝트 운영 문서(팀 결정, 작업 지침, 경량판 안내, 과거 결과 보고)를 빼고, 필요한 안내는 `README.md`로 모았다. `API_CONTRACT.md`는 데이터 규칙만 남겨 `DATA_SPEC.md`로, 비금융 후보 설계는 `NONFINANCIAL_CANDIDATES.md`로 바꿨다. 설계 가정 표는 `SOURCES_AND_ASSUMPTIONS.md`로 합쳤다.
- 생성·검증에 쓰지 않는 과거 기록을 뺐다: `VALIDATION_v2_11_7.json`, `reference/v2_3_reports/`, `reference/v2_4_reports/`, `data/preservation_v24.json`, `audit_v24.py`, 서비스 기능 현황표 `feature_coverage.csv`.
- 생성 로직은 바뀌지 않았다. 이 이력도 데이터에 영향을 주는 변경 위주로 압축했다.

## v3.2.x (2026-10-31) — 비금융 효과 라벨과 실행 점검

- **v3.2.0** 통신·공과금 미납을 금융 위험과 연동했다. 최근 금융 연체(SP=1 또는 DQ1200001>0)가 있으면 미납 발생확률 3배, 미납은 다음 달 30% 확률로 지속된다(이전에는 연중 한 달). 기존 라벨 옆에 비금융 효과 라벨 `label_nonfin_effect_12m`을 추가했다(미납 승산비 2.5, 현금흐름 로짓 0.15/SD). 근거는 `NONFINANCIAL_LABEL.md`. **재생성하면 미납 관련 필드가 이전 생성본과 달라진다.**
- **v3.2.2** 외부 API 더미 검사가 회원별 응답 개수를 세도록 고쳤다(중복을 놓치던 문제).
- **v3.2.4** 작은 규모로 전체 흐름을 실행해 오류 2건을 고쳤다. `verify_nonfinancial_experiment.py`가 한 클래스만 있는 평가 집단에서 멈추던 문제, `extend.py`가 일부 행 실행 시 `data/base_207.csv`를 덮어쓰던 문제. 전체 규모에서 비금융 효과 라벨의 AUC 상승은 기존 +0.031, 씬파일 +0.025였다.
- **v3.2.5** ZIP의 한글 파일명에 UTF-8 표시를 넣었다(이전 ZIP은 Python으로 풀면 통계 원자료 파일명이 깨졌다).

## v3.1.x (2026-10-31) — 서비스 개발용 더미

- **v3.1.0** 가상 대출상품(17개), 가입 회원, 외부 금융·통신 API 응답 생성기를 추가했다. 출력은 `service_dummy/`이며 학습에 쓰지 않는다. 회원은 씬파일 생성기를 별도 시드로 실행해 만든다.
- **v3.1.1** 금리·통신비 기준점의 출처를 문서에 기록했다.

## v3.0.x (2026-10-31) — 카드 필드 규칙 통일과 난수 분리

- **v3.0.0** 씬파일 집단의 207열 카드 필드(주사용 카드, 30만원 조건 카드, `CS0000050`)를 기존 집단과 같은 원본 생성기 규칙으로 계산한다. 같은 열 이름이 두 집단에서 같은 의미를 갖게 하기 위해서다. 계좌별 값은 `card_account_monthly.csv`에 있다. 생성기별 난수 하위 스트림을 나눴다.
- **v3.0.1** `extend.py`와 `thinfile_engine.py`의 난수 스트림이 같은 시드에서 겹치던 문제를 고쳤다(213/212). `CL0631905`가 카드 개설 전 구간까지 평균하던 문제를 고쳤다. 카드 검증기를 v3.0.0 규칙에 맞췄다.
- v3.0.2~v3.0.3 문서 정리.

## v2.11.x (2026-10) — 생성 로직 보정

- **v2.11.7** 소득·부채 코퓰라에서 동률 부채(특히 무부채)를 동률 구간 안의 무작위 위치로 변환하고, 부채가 모두 같으면 잡음을 줄이지 않도록 고쳤다. 카드 사용을 계좌별로 배분하는 원장(`card_account_monthly.csv`)을 추가하고, 카드 연체 사건을 해당 카드의 사용 구간에 연결했다.
- **v2.11.5** 씬파일 카드 사용의 상관행렬을 대칭화·고유값 보정 후 정규화했다. `LA6000005`에 최근 5년 해제 조건을 넣었다.
- **v2.11.6** 씬파일 미래 신용 사용 확률을 인자로 조정할 수 있게 했다.
- **v2.11.3** 비금융 후보 데이터(간편결제·사회보험) 설계안과 출처를 추가했다(`NONFINANCIAL_CANDIDATES.md`, 생성 코드 없음).
- v2.11.1~v2.11.4, v2.11.8~v2.11.9 문서·검증기 정리, 통합 데이터 사전(`DATA_DICTIONARY.csv`) 작성.

## v2.4~v2.11 — 기능 추가

- **v2.11** 가정 민감도 실험(`run_assumption_sensitivity.py`).
- **v2.10** 비금융 추가 정보 통제 실험(`run_nonfinancial_experiment.py`).
- **v2.9** 대출 원장과 원금균등 상환 일정, 금리 +2%p 시나리오(`build_loan_extension.py`).
- **v2.6~v2.8** 검증기 정밀화(정수 금액은 정확 비교, 실수만 허용오차), 한글 파일명 압축 문제 수정.
- **v2.5** 씬파일 4개 집단 2,400명과 대출·카드·연체 원장, 미관측 값을 결측으로 표시한 모델·화면용 뷰.
- **v2.4** 통계 원자료 적용: 급여소득자 연령별 소득, 소득구간별 지출비율, 1인 가구 자산·저축 비율(`SOURCES_AND_ASSUMPTIONS.md`).

기준 데이터는 원본 학원 생성기로 만든 207열 12,000명(`data/base_207.csv`)이며, 기존 집단의 207열과 라벨은 모든 버전에서 바꾸지 않았다.
