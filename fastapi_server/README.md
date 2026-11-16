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
| ML-02 | `GET /v1/model-info` | 버전 3개(`DEV-DUMMY` / `FS-DRAFT` / `CUT-0.1`), 등급 구간, 피처 39개(`FS-DRAFT`) |
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

**1. 자동 검사 (Python 내장 unittest — 새 도구는 없고, `requirements.txt` 설치는 먼저 해야 한다)**
```
cd fastapi_server
pip install -r requirements.txt        # 처음 한 번 (테스트가 pydantic·fastapi를 불러온다)
python -m unittest discover tests -v
```
마지막 줄이 `Ran 33 tests ... OK`이면 정상이다. 검사하는 것:
- 피처 39개가 시드 SQL(`FS-DRAFT`)과 같은지, 피처 정의서 11장(지금 38개)이 모두 들어 있고 차이는 `LRZ021201`(C9로 제외)뿐인지
- 이상치 고정 상한(정의서 C8): 소득 합계 20억 초과·평균 월 지출 2억 초과·월 상환액 0 미만이면 그 값과 그 값으로 계산하는 피처를 결측으로
- 소득 합계 0 이하·카드 한도 0이면 비율 피처 결측
- 기존 모델 19개 / 대안 모델 39개, 대안 데이터를 바꿔도 기존 점수는 그대로인지
- 점수 0~1000, 등급 경계(664 / 665 / 779 / 780), 같은 입력 같은 결과
- 기준점 + SHAP 점수 합 = 대안 점수, rank(같으면 항목 이름 가나다순)
- 급여소득자 월급 × 12, 값이 없으면 0으로 채우지 않음
- 시뮬레이션 금융 영향 + 대안 영향 = 전체 변화
- 409 버전 불일치, 422 입력 오류(소득 개월 수가 직군과 다름·`requiredIncomeMonths` 없음·같은 달 중복, 시뮬레이션의 모르는 키·카드 한도/사용액 한쪽만), 오류 시험 헤더

**2. 화면에서 직접 (`/docs`)**
1. 서버를 켜고 http://localhost:8000/docs 를 연다.
2. `GET /v1/health` → Try it out → Execute → `"status": "UP"`
3. `POST /v1/assessments/score` → Try it out → 본문에 명세서 4-3 요청 예시를 넣고 Execute → 200, `shap.factors` 39개
4. 같은 요청에 `"expectedModelVersion": "OLD"` → 409 `VERSION_MISMATCH`
5. `alternativeData`에서 `utility`를 빼고 보내면 → 422 `INVALID_INPUT`
6. `POST /v1/assessments/simulate`에 `changes`로 `{"DELINQ_COUNT12M": 0}`(오타 키)를 보내면 → 422, `fieldErrors`에 `changes.DELINQ_COUNT12M`

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
- 피처 사전은 `FS-DRAFT` 39개를 쓴다. 정의서가 확정되면 `FS-V1`(지금 정의서 기준 38개, `LRZ021201` 제외)을 새로 넣고 진짜 모델(FP-141)과 함께 바꾼다(O-17).
- 이상치 상한 3개는 `pipeline/feature_builder.py` 맨 위 상수다. 학습 전처리도 같은 값을 써야 하며, Spring 업무상 상한이 정해지면 바꾼다(`TODO(C8)`).
- 학습에 없는 코드값(`VOLUNTARY`, 가입 상태 `UNKNOWN`)은 Mock에서 기여 0(중립)이다. 처리 방식은 정의서 9장 미정이다(`TODO`).
- 소수 반올림은 Python 방식(짝수 쪽)이다. 진짜 모델 연결 때 학습 생성 코드의 ROUND_HALF_UP으로 맞춘다(`TODO(FP-141)`).
- 시뮬레이션의 간편결제 월 건수 × 12, 통신비 미납 달 연동 안 함은 피처 정의서 9장 미정 사항이라 `TODO`로 표시해 두었다.
- 시뮬레이션 `changes`는 10개 키만 받는다. 모르는 키, 카드 한도·월 사용액 중 하나만 온 경우는 422다(조용히 무시하지 않는다). 카드 한도가 0이면 점수 계산과 같은 규칙으로 사용률을 결측으로 둔다.
- 로그에는 requestId, 처리 시간, 오류 코드만 남긴다. 요청 본문(금융 정보)은 남기지 않는다.
