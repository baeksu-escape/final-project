# Credit Extension 합성 데이터 v3.5.10

신용평가 교육·시연용 합성 데이터의 생성 코드, 설정, 통계 원자료, 문서다. 모든 데이터는 합성 데이터이며 실제 개인·금융기관 자료가 아니다. 결과는 시연용이고 실제 모집단의 통계나 예측력 근거로 쓰지 않는다.

## 구성

| 데이터 | 내용 | 생성 스크립트 | 문서 |
|---|---|---|---|
| 기존 집단 12,000명 | 207열 신용정보(`data/base_207.csv`, 포함됨)에 소득·지출·자산·월별 현금흐름을 붙인다 | `generate/extend.py` | `docs/DATA_SPEC.md` |
| 씬파일 집단 2,400명 | 금융이력 부족 3개 집단 + 이력 충분한 20대 비교군, 각 600명. 대출·카드·연체 원장 포함 | `generate/build_thinfile.py` | `docs/THINFILE.md` |
| 간편결제·사회보험 원천 | 두 집단의 간편결제 월자료, 국민연금·건강보험 고지·납부 월자료, 고객 단위 집계(v3.5.0) | `generate/build_nonfinancial_sources.py` | `docs/NONFINANCIAL_SOURCES.md` |
| 비금융 효과 라벨 | 기존 라벨 옆에 비금융 효과를 가정한 라벨 열을 추가한다 | `generate/build_nonfinancial_labels.py` | `docs/NONFINANCIAL_LABEL.md` |
| 대출 원장·상환 일정 | 두 집단의 대출 계좌별 상환 일정(만기일시·원리금균등·원금균등)과 금리 시나리오 | `generate/build_loan_extension.py` | `docs/LOAN_EXTENSION.md` |
| 6개월 입력 집계 | 회원이 입력하는 소득·지출·상환액과 같은 최근 6개월(2026-03~2026-08) 집계. 모델 표의 소득·지출 피처(v3.5.7) | `generate/build_input_features_6m.py` | `docs/DATA_SPEC.md` |
| 서비스 개발용 더미 | 가상 대출상품, 가입 회원(6개월 입력), 외부 금융·통신·간편결제·공공보험·신용평가사·공과금 API 응답. **학습에 쓰지 않는다** | `generate/build_loan_products.py`, `build_members.py`, `build_external_api.py` | `docs/SERVICE_DUMMY_DATA.md` |
| 가정 민감도·비금융 실험 | 가정을 바꿨을 때의 변화, 라벨 신호 확인, 비금융 효과 라벨의 AUC 상승 측정 | `experiments/` 5개 스크립트 | `docs/ASSUMPTION_SENSITIVITY.md`, `docs/NONFINANCIAL_EXPERIMENT.md`, `docs/NONFINANCIAL_LABEL.md` |

필드 정의는 `docs/DATA_DICTIONARY.csv`가 기준이다. 출처와 가정은 `docs/SOURCES_AND_ASSUMPTIONS.md`, 변경 이력은 `docs/CHANGES.md`에 있다. 간편결제·사회보험 데이터는 설계안(`docs/NONFINANCIAL_CANDIDATES.md`)대로 v3.5.0에서 생성했고, 실제 규칙·근거·가정은 `docs/NONFINANCIAL_SOURCES.md`가 기준이다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `generate/` | 생성 로직과 생성 스크립트 |
| `verify/` | 생성 결과 검증기 |
| `tests/` | 생성 없이 로직만 확인하는 고정 예제 테스트 |
| `experiments/` | 가정 민감도·비금융 실험 |
| `reference/` | 통계 원자료, 생성 설정·기준점, 원본 사전과 원본 학원 생성기 |
| `docs/` | 문서와 데이터 사전 |
| `tools/` | 모델 팀 전달 묶음 만들기(`build_handoff.py`) |
| `data/` | 입력 `base_207.csv`. 생성 결과도 여기와 `thinfile/`, `loan_extension/`, `service_dummy/`, `nonfinancial_label_lift/` 등에 생긴다 |

## 생성 순서

이 패키지에는 입력인 `data/base_207.csv`만 들어 있고 생성 결과는 없다. 압축을 푼 폴더(이 README가 있는 곳)에서 `python -m <폴더>.<스크립트>` 형태로 실행한다.

```bash
cp data/base_207.csv /tmp/base_207_input.csv          # 입력을 먼저 복사한다
python -m generate.extend --input /tmp/base_207_input.csv --rows 0 --out data
python -m generate.build_thinfile
python -m generate.build_nonfinancial_sources          # 위 두 단계 다음 (v3.5.0)
python -m generate.build_nonfinancial_labels           # build_nonfinancial_sources 다음
python -m generate.build_input_features_6m             # build_nonfinancial_sources 다음 (v3.5.7)
python -m generate.build_loan_extension
python -m generate.build_loan_products
python -m generate.build_members
python -m generate.build_external_api                  # build_members 다음
python -m experiments.run_assumption_sensitivity
python -m experiments.run_nonfinancial_experiment
python -m experiments.rho_sensitivity
python -m experiments.expense_sensitivity
python -m experiments.measure_nonfinancial_label_lift  # 비금융 효과 라벨의 AUC 상승 (v3.5.0)
```

검증(생성 후):

```bash
python -m verify.verify
python -m verify.verify_statistics
python -m verify.verify_thinfile_general
python -m verify.verify_thinfile                       # verify_card_accounts 포함
python -m verify.verify_loan_extension
python -m verify.verify_assumption_sensitivity
python -m verify.verify_nonfinancial_experiment
python -m verify.verify_nonfinancial_sources           # v3.5.0
python -m verify.verify_input_features_6m              # v3.5.7
```

고정 예제 테스트(생성 불필요): `python -m unittest discover -s tests -t .`

모델 팀 전달 묶음(생성 후, v3.5.2): `python -m tools.build_handoff --out <새 폴더>`. 출력 폴더는 패키지 밖의 아직 없는 경로여야 한다. `--overwrite`는 이 도구가 만든 묶음을 다시 만들 때만 쓴다. `.handoff_bundle`에 기록된 파일 목록·SHA256과 폴더 내용이 정확히 같을 때만 그 파일들만 지우고, 하나라도 다르면 아무것도 지우지 않는다(v3.5.4). `--out`이 심볼릭 링크면 `--overwrite`여도 멈춘다(v3.5.6). 집단별 고객 한 줄 모델 표 2개(`1_model/`), 상세 원천(`2_detail/`), 설계값·점검(`3_reference/`), 문서로 나눈다. 모델 표에는 기존 라벨의 원천인 `결과값(연체회차)`를 넣지 않고, 씬파일의 미관측 값은 `model_inputs.csv`의 결측 표시를 따르고, 항상 0인 자리표시자 `PRE_LMT`·`PRE_RT`는 뺀다. 열은 데이터 사전에 전달용(`delivery`)으로 등록된 원천 열만 `feature`가 되고, 그 밖의 모르는 열이 있으면 멈춘다.

일부만 시험 생성할 때(`--rows N`, `--per-cohort N`)는 `--out`을 `data/`가 아닌 다른 폴더로 준다. `data/`로 주면 `generate.extend`가 멈춘다. 집단당 수십 명 규모에서는 평가 집단에 한쪽 라벨만 남아 AUC를 계산할 수 없는 경우가 있으므로 성능 수치는 기본 규모에서 본다. 기본 환경은 `requirements.txt`를 따른다.

## 사용 시 주의

- **라벨이 두 가지다.** 기존 라벨 `label_any_delinquency_12m`과 비금융 효과를 가정한 `label_nonfin_effect_12m`(`labels_nonfinancial.csv`). 후자의 성능 향상은 가정한 효과를 찾아낸 것이며 실제 예측력의 증거가 아니다. 서비스의 대안 점수 모형은 후자로, 발표의 대조(효과를 넣지 않으면 차이가 없다)는 전자로 보는 것을 권한다.
- **간편결제·사회보험 원천(v3.5.0)은 기존 라벨 생성에 쓰이지 않는다.** 라벨 효과는 비금융 효과 라벨에만 들어 있다. 다만 사회보험 비정시 납부는 현실처럼 최근 금융 연체(SP, DQ1200001)가 있는 사람에게 더 자주 생기도록 만들었으므로 금융 위험과 독립은 아니다. 금융 특성을 통제하면 기존 라벨에 대한 추가 설명력은 없다(AUC 상승 +0.000). 가입하지 않았거나 납부 의무가 없는 사람, 간편결제를 쓰지 않는 사람은 감점되지 않는다(`docs/NONFINANCIAL_SOURCES.md`).
- **기존 집단과 씬파일 집단은 라벨 생성 방식이 다르다.** 합쳐 쓸 때는 `cohort`로 집단을 구분하고 집단별 결과를 함께 본다.
- **`profiles.csv`의 연소득·지출비율·DSR·소득 변동계수 등은 12개월 집계다.** 다른 기간이 필요하면 `monthly_history.csv`에서 계산한다.
- **`base_207.csv`의 `CB=5`, `PRE_LMT=0`, `PRE_RT=0`은 자리표시자다.** 미관측 값은 `model_inputs.csv`의 결측 표시를 따른다.
- **서비스 더미(`service_dummy/`)는 학습 데이터와 분리돼 있다.** 회원 데이터는 학습에 쓰지 않는다.
- **문서의 통계·연구 수치 일부는 보도나 요약본으로 확인한 값이다.** 보고서에 인용하기 전에 원문을 확인한다.

## 데이터 사전 사용법

`docs/DATA_DICTIONARY.csv`는 한 행이 한 필드다. 표 하나는 `dataset`과 `table`로 고르고, 다른 사람에게 넘기는 필드만 보려면 `scope == "delivery"`로 거른다(`reference`는 생성 설계표·요약표·참고용 메타데이터). `dataset` 값은 `legacy_207_and_thinfile_base`(공통 207열), `extension_outputs`(프로필·월별·시나리오·간편결제·사회보험, 두 집단 공통), `thinfile_outputs`, `loan_extension_outputs`, `service_dummy`다. 207열의 `description`은 원본 항목명이고 교육용 설명은 `teaching_note`에 있다.

필드의 의미나 단위를 바꿀 때는 같은 이름의 의미를 조용히 바꾸지 않고 새 필드나 새 버전으로 만들며, 사전과 `docs/CHANGES.md`를 함께 고친다.

## 메타데이터

- `provenance.json`: 패키지·데이터 버전, 기준 데이터와 원본 생성기 해시, 이번 버전의 실행 상태
- `manifest.json`: 포함 파일의 SHA256(자기 자신 제외)
- `field_dictionary.csv`, `reference/column_dictionary_207.csv`, `reference/academy/`: 원본 사전과 원본 학원 생성기(출처 보존용)
