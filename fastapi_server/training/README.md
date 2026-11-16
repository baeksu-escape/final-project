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
- 결과: `artifacts/legacy.joblib`, `artifacts/alternative.joblib`(Git 제외) 와 설명 파일 `*.meta.json`(피처 목록, 범주 부호표, 설정, 라이브러리 버전, 학습 표 SHA-256, VALID AUC). 설명 파일은 만들어지는 파일이라 커밋하지 않는다.
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
