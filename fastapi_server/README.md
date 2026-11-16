# Avenue 예측 서버 (FastAPI) — 지금은 Mock

Spring이 부르는 내부 API(ML-01~04)를 제공한다. 지금 점수는 **Mock(고정 가중치)**이며 실제 모델이 아니다. 실제 모델은 FP-141에서 `pipeline/mock_scorer.py`만 바꿔 연결한다.

- API 상세: B팀 API 명세서 4장 (공유 페이지 https://claude.ai/artifact/XwacnHd2SAWDJvi5nXGchr#spec)
- 피처 39개: `docs/spec/feature_definition.md` 11장 = `docs/spec/sql/seed/avenue_seed_dim_feature_fs_draft.sql`
- FastAPI는 DB를 읽거나 쓰지 않는다. 저장은 Spring(FP-142)이 한다.

## 실행

```
cd fastapi_server
pip install -r requirements.txt        # 처음 한 번
uvicorn main:app --port 8000
```

브라우저에서 http://localhost:8000/docs 를 열면 API 4개를 직접 눌러 볼 수 있다.

| ID | 경로 | 내용 |
|---|---|---|
| ML-01 | `GET /v1/health` | 서버 상태 |
| ML-02 | `GET /v1/model-info` | 버전 3개(`DEV-DUMMY` / `FS-DRAFT` / `CUT-0.1`), 등급 구간, 피처 39개 |
| ML-03 | `POST /v1/assessments/score` | 기존·대안 점수, 등급, 부도 확률, SHAP 39개, 피처값 |
| ML-04 | `POST /v1/assessments/simulate` | 바꾼 값으로 다시 계산(저장 안 함), 감점 요인 3개 |

## Docker로 켜기 (FP-142, Python 설치 없이)

Docker Desktop이 켜져 있어야 한다. 저장소 맨 위(`final-project`)에서:

```
docker build -t avenue-fastapi fastapi_server              # 처음 한 번, 코드가 바뀌면 다시
docker run -d -p 8000:8000 --name fastapi avenue-fastapi    # 켜기 → http://localhost:8000/docs
docker stop fastapi / docker start fastapi                  # 끄기 / 다시 켜기
```

- Spring은 기본값 `avenue.prediction.base-url`(비어 있으면 `http://localhost:8000`)로 이 서버를 부른다.
- 8000번을 이미 쓰고 있으면(`uvicorn`으로 켠 서버 등) 그걸 끄거나 `-p 8001:8000`처럼 다른 번호를 쓰고 Spring 설정도 맞춘다.

## 테스트 방법

**1. 자동 검사 (Python 내장 unittest, 설치할 것 없음)**
```
cd fastapi_server
python -m unittest discover tests -v
```
마지막 줄이 `Ran 23 tests ... OK`이면 정상이다. 검사하는 것:
- 피처 39개가 시드 SQL·피처 정의서 11장과 같은지
- 기존 모델 19개 / 대안 모델 39개, 대안 데이터를 바꿔도 기존 점수는 그대로인지
- 점수 0~1000, 등급 경계(664 / 665 / 779 / 780), 같은 입력 같은 결과
- 기준점 + SHAP 점수 합 = 대안 점수, rank(같으면 항목 이름 가나다순)
- 급여소득자 월급 × 12, 값이 없으면 0으로 채우지 않음
- 시뮬레이션 금융 영향 + 대안 영향 = 전체 변화
- 409 버전 불일치, 422 입력 오류, 오류 시험 헤더

**2. 화면에서 직접 (`/docs`)**
1. 서버를 켜고 http://localhost:8000/docs 를 연다.
2. `GET /v1/health` → Try it out → Execute → `"status": "UP"`
3. `POST /v1/assessments/score` → Try it out → 본문에 명세서 4-3 요청 예시를 넣고 Execute → 200, `shap.factors` 39개
4. 같은 요청에 `"expectedModelVersion": "OLD"` → 409 `VERSION_MISMATCH`
5. `alternativeData`에서 `utility`를 빼고 보내면 → 422 `INVALID_INPUT`

## 오류 시험 헤더 (개발용, 실제 서버에는 없음)

요청 헤더 `X-Mock-Scenario`
- `MODEL_ERROR` → 500 `INTERNAL_ERROR`
- `NOT_READY` → 503 `MODEL_NOT_READY`
- `TIMEOUT` → 5초 뒤 응답 (Spring 타임아웃 처리 시험)

## 알아 둘 것

- 점수 변환식은 확정이다(명세서 O-3, 11/16): 700점 = 우량:불량 20:1, 40점마다 오즈 2배, 범위 0~1000. SHAP 점수도 같은 배율.
- 시뮬레이션 결과는 저장하지 않는다(O-9). 회복 점수는 그 항목을 시뮬레이터 범위 안 가장 좋은 값으로 바꿨을 때의 점수 차이다(O-14).
- 현금흐름 화면의 예상 대안 점수(N-21-8, DIAG-09)는 Spring이 바꾼 입력으로 ML-03을 부르고 저장하지 않는다(O-6). FastAPI 쪽 추가 작업은 없다.
- 가중치는 화면 시험용 임의 값이다. 학습 결과가 아니고 점수 의미도 없다.
- 시뮬레이션의 간편결제 월 건수 × 12, 통신비 미납 달 연동 안 함은 피처 정의서 9장 미정 사항이라 `TODO`로 표시해 두었다.
- 로그에는 requestId, 처리 시간, 오류 코드만 남긴다. 요청 본문(금융 정보)은 남기지 않는다.
