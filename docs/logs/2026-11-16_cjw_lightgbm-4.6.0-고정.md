# LightGBM 버전을 4.7.0에서 4.6.0으로 변경 (requirements.txt)

- **날짜:** 2026-11-16
- **작성자:** 최재욱 / Claude Code
- **브랜치:** `feature-B/fix-lightgbm-4.6.0`
- **관련 N-ID:** 없음 (모델 학습·FastAPI 환경)
- **관련 결정:** 피처 정의서 `docs/spec/feature_definition.md` 10장 C10 (참고 기록)

## 무엇을, 왜 바꿨나
- `fastapi_server/requirements.txt`의 `lightgbm==4.7.0`을 `lightgbm==4.6.0`으로 바꿨다. 한 줄만 바꿨고 다른 패키지는 그대로다.
- 작성자 PC(Windows 11, Python 3.11.9 64비트)의 `.venv`에서 LightGBM 4.7.0이 학습 데이터를 만들 때 라벨을 설정하는 순간(`LGBM_DatasetSetField`) `access violation reading 0x0000000000000000` 오류로 멈춘다. 라벨 없이 `Dataset`을 만드는 것은 된다.
- 스레드 수 제한(`num_threads=1`, `OMP_NUM_THREADS=1`), float32 입력, `set_label` 순서 변경으로는 해결되지 않았다.
- 임시 가상환경에 4.7.0을 새로 설치해도 같은 오류가 나서 설치 파일이 깨진 것이 아니다. 같은 환경에서 4.6.0은 정상 동작한다.
- 모델 학습과 SHAP 산출이 이 오류 때문에 막혀서 4.6.0으로 맞춘다. `requirements.txt`는 임시로 작성한 파일이라 바꿔도 된다는 확인을 받았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `fastapi_server/requirements.txt` | `lightgbm==4.7.0` → `lightgbm==4.6.0` |
| `docs/logs/2026-11-16_cjw_lightgbm-4.6.0-고정.md` | 이 작업 로그 (새 파일) |

## DB·API 변경
- DB: 없음
- API: 없음
- 영향을 받는 기능·팀원:
  - FastAPI 담당: 모델 서버 환경을 만들 때 4.6.0이 설치된다. Docker 이미지를 다시 빌드할 때 영향을 받는다.
  - 모델 학습·SHAP을 같은 환경에서 돌리는 팀원: 기존 `.venv`에 4.7.0이 있으면 `pip install lightgbm==4.6.0`으로 내려야 한다.

## 확인
- 확인함: 임시 가상환경(저장소 밖)에서 `numpy==2.4.6`, `lightgbm==4.7.0`은 최소 학습이 `access violation`으로 실패, `lightgbm==4.6.0`은 성공.
- 확인함: 4.6.0 환경에 `scikit-learn==1.9.1`, `pandas==3.0.5`, `scipy==1.17.1`, `shap==0.51.0`, `joblib==1.6.0`을 설치해 `LGBMClassifier` 학습, AUC 계산, `shap.TreeExplainer` 계산이 모두 정상 동작.
- 확인함: 학습 데이터 v3.6.1로 4.6.0 환경에서 LightGBM 실험(피처 중복 비교)을 끝까지 실행.
- 확인 못 함: 작성자 PC의 기존 `.venv`를 4.6.0으로 다시 설치한 상태에서의 실행(`.venv`는 바꾸지 않았다).
- 확인 못 함: 다른 팀원 PC와 Docker(Linux)에서 4.7.0이 정상인지. 이 오류가 작성자 PC에서만 나는 것일 수 있다.
- 확인함: 수정한 `requirements.txt` 전체를 새 임시 가상환경에 `pip install -r`로 설치 → 10개 패키지가 파일의 버전 그대로 설치됨(`lightgbm 4.6.0` 포함), `LGBMClassifier` 학습과 `shap.TreeExplainer` 계산 정상.

## 다음 사람이 알아야 할 것
- FastAPI 담당은 Docker 환경에서 4.7.0이 정상인지 확인해 주세요. 정상이면 팀 전체를 4.6.0으로 맞출지, 작성자 PC만 다르게 둘지 정해야 한다.
- 4.6.0에서 모델 파일을 저장(`joblib`)하고 다른 버전의 LightGBM으로 불러올 때 호환성은 확인하지 않았다. 학습 환경과 서비스 환경의 버전을 같게 두는 것이 안전하다.
- 되돌리려면 `requirements.txt`의 줄을 `lightgbm==4.7.0`으로 바꾸면 된다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
