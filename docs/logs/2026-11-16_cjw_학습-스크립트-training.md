# 기존·대안 모델 학습 스크립트 추가 (fastapi_server/training)

- **날짜:** 2026-11-16
- **작성자:** 최재욱(B팀 모델·정의서 담당) / Claude Code
- **브랜치:** `feature-B/FP-141-training-script`
- **관련 N-ID:** N-12-2, N-14 (모델 학습 준비)
- **관련 결정:** `feature_definition.md` 10장 C8·C9·C13·C19, 9장 미정(학습에 없는 코드값)

## 무엇을, 왜 바꿨나
- 저장소 밖에서 돌리던 베이스라인(전처리 (나), 기존 18개·대안 38개, LightGBM 4.6.0)을 팀이 재현할 수 있게 `fastapi_server/training/`으로 옮겼다. 서비스 연결(FP-141)은 하지 않았다.
- 이상치 상한은 서비스 `pipeline/feature_builder.py`의 상수를 그대로 가져와 쓴다(학습과 서비스가 갈라지지 않게). 범주형은 알파벳 자동 부호 대신 고정 부호표로 정수화한다.
- 위치는 사용자가 정한 대로 스크립트 `training/`, 모델 `artifacts/`(`.joblib`은 `.gitignore`가 이미 제외), 학습 CSV `data/training/`.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `fastapi_server/training/__init__.py` | 빈 패키지 파일 (신규) |
| `fastapi_server/training/config.py` | 피처 18·38 목록, 범주 부호표, 라벨, 시드, LightGBM 고정 설정 (신규) |
| `fastapi_server/training/preprocess.py` | C8 상한, 전처리 (나), 범주형 부호화 (신규) |
| `fastapi_server/training/train.py` | 학습·VALID 평가·모델/설명 파일 저장 CLI (신규) |
| `fastapi_server/training/README.md` | 실행법과 지켜야 할 것 (신규) |
| `fastapi_server/tests/test_training_preprocess.py` | 전처리·피처 목록·범주 부호표 시험 14개 (신규) |

## DB·API 변경
- DB: 없음
- API: 없음
- 영향을 받는 기능·팀원: FastAPI 담당(FP-141에서 모델 파일과 `*.meta.json`의 범주 부호표를 읽어 같은 방식으로 입력을 바꿔야 함). 기존 파일은 수정하지 않았다.

## 확인
- 확인함: `python -m unittest discover tests` 47개 통과(기존 33 + 새 14). 실제 학습을 `--data-dir C:\Users\user1\Downloads\avenue_training_data_v3_6_1`로 실행: TRAIN 8,400행·VALID 1,800행, 기존 18개 VALID AUC 0.6049 ± 0.0026, 대안 38개 0.6533 ± 0.0051(저장소 밖 실험과 같은 값). `artifacts/`에 `.joblib` 2개와 `*.meta.json` 2개가 생겼고 `git status`에 `.joblib`는 잡히지 않음(설명 파일은 untracked라 커밋하지 않음).
- 확인함(추가): v3.6.1 내용물을 `fastapi_server/data/training/`에 복사한 뒤 `--data-dir` 없이 기본 경로로 실행해 같은 AUC(기존 0.6049 ± 0.0026, 대안 0.6533 ± 0.0051)를 재현. 학습 표 SHA-256이 원본과 같음. `data/training/`은 Git 제외라 `git status`에 잡히지 않음.
- 확인함(추가): 최신 `develop`(PR #61)을 병합한 뒤 FastAPI 테스트 47개 통과, DB 생성 도구 테스트 51개 통과(3개 건너뜀).
- 확인 못 함: 다른 PC에서의 재현, 서비스 연결(FP-141), TEST 평가.

## 다음 사람이 알아야 할 것
- 결과는 합성 데이터·튜닝 없음·TEST 미사용 임시 베이스라인이다. 점수 변환(O-3)과 등급 경계(D-01)는 포함하지 않았다.
- `voluntary`·가입 상태 `unknown`은 -1(결측)로 둔다. 정의서 9장 미정이다(`config.py`의 `TODO`).
- `artifacts/*.meta.json`은 `.gitignore` 대상이 아니라서 실수로 커밋하지 않도록 주의한다. 커밋 대상으로 삼을지는 팀이 정한다.
- 로그 파일명의 작성자 약어 `cjw`는 제안이다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
