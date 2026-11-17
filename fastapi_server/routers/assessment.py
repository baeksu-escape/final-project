# FP-140·FP-141 Spring → FastAPI 내부 API ML-01~04 (B팀 API 명세서 4장). FastAPI는 DB를 읽거나 쓰지 않는다. 저장은 Spring이 한다.
# 모델 버전이 계산기를 고른다: DB ACTIVE가 DEV-DUMMY면 Mock, LGBM-BASE-0.1이면 실제 모델(FP-141). 그래서 DB 전환이 곧 스위치다.
import logging
import re
import time

from fastapi import APIRouter, Header

from pipeline import mock_scorer, model_scorer
from pipeline.feature_builder import build_features
from pipeline.feature_catalog import (
    CUTOFF_VERSION, FEATURE_SET_VERSION, FEATURES, GRADE_BANDS, MODEL_VERSION,
    REAL_FEATURE_SET_VERSION, REAL_MODEL_VERSION,
)
from pipeline.simulation import simulate, validate_changes
from schemas.assessment import ScoreRequest, SimulateRequest

router = APIRouter(prefix="/v1")
log = logging.getLogger("avenue.prediction")

REQUEST_ID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
TIMEOUT_SECONDS = 5  # Spring 응답 타임아웃(🟡 3초)보다 길게 — 타임아웃 처리 시험용


class ApiError(Exception):
    """명세서 1-1 오류 응답 {code, message, fieldErrors, requestId}로 바뀌는 예외."""

    def __init__(self, status: int, code: str, message: str, field_errors=None, request_id=None):
        self.status, self.code, self.message = status, code, message
        self.field_errors = field_errors or []
        self.request_id = request_id


def _check_scenario(scenario: str | None, request_id: str):
    """개발용 오류 시험 헤더 X-Mock-Scenario (실제 서버에는 없다)."""
    if scenario == "MODEL_ERROR":
        raise ApiError(500, "INTERNAL_ERROR", "예측 중 오류가 발생했습니다.", request_id=request_id)
    if scenario == "NOT_READY":
        raise ApiError(503, "MODEL_NOT_READY", "모델을 아직 불러오지 못했습니다.", request_id=request_id)
    if scenario == "TIMEOUT":
        time.sleep(TIMEOUT_SECONDS)


def _check_request_id(request_id: str):
    if not REQUEST_ID_PATTERN.match(request_id):
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.",
                       [{"field": "requestId", "message": "소문자 UUID여야 합니다."}], request_id)


# 직군별 필요한 소득 개월 수 — DB DIM_WORKER_TYPE.REQUIRED_INCOME_MONTHS(12/12/1)와 같다.
INCOME_MONTHS_BY_WORKER_TYPE = {"EMPLOYEE": 1, "SELF_EMPLOYED": 12, "FREELANCER": 12}


def _check_income_months(req: ScoreRequest):
    """소득 개월 수를 FastAPI에서도 확인한다 — Spring이 빠뜨려도 3개월치로 12개월 피처를 만들지 않게(명세서 4-3)."""
    required = req.applicant.requiredIncomeMonths
    expected = INCOME_MONTHS_BY_WORKER_TYPE.get(req.applicant.workerTypeCode)
    if expected is None:
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.",
                       [{"field": "applicant.workerTypeCode", "message": "알 수 없는 직군입니다."}], req.requestId)
    if required is None or required != expected:
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.",
                       [{"field": "applicant.requiredIncomeMonths", "message": f"이 직군은 {expected}개월이어야 합니다."}], req.requestId)
    if len({m.baseMonth for m in req.incomeMonths}) != required or len(req.incomeMonths) != required:
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.",
                       [{"field": "incomeMonths", "message": f"소득은 서로 다른 {required}개월이어야 합니다."}], req.requestId)


def _check_bill_data(req: ScoreRequest):
    """N-12-2 피처 정의서 8-5 (다) — 통신비 또는 공과금이 빈 목록이면 422. Spring이 먼저 ALT_DATA_EMPTY로 막고, 이건 안전장치다.
    기록 없음은 학습에 없는 입력이라 점수를 내면 안 된다. 간편결제·보험 빈 목록은 학습에도 있어 그대로 받는다."""
    empty = [name for name in ("telecom", "utility") if not getattr(req.alternativeData, name)]
    if empty:
        label = {"telecom": "통신비", "utility": "공과금"}
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.",
                       [{"field": f"alternativeData.{n}", "message": f"{label[n]} 기관 기록이 없어 점수를 낼 수 없습니다(정의서 8-5)."}
                        for n in empty], req.requestId)


SUPPORTED_MODEL_VERSIONS = (MODEL_VERSION, REAL_MODEL_VERSION)


def _pick_scorer(version: str | None, field: str, request_id: str):
    """N-12-2 요청한 모델 버전으로 계산기를 고른다 → (score_features 함수, 모델 버전, 피처 세트).
    DEV-DUMMY(또는 버전 없음)는 Mock, LGBM-BASE-0.1은 실제 모델. 실제 모델 파일이 없으면 Mock으로 바꾸지 않고 503."""
    if version is None or version == MODEL_VERSION:
        return mock_scorer.score_features, MODEL_VERSION, FEATURE_SET_VERSION
    if version == REAL_MODEL_VERSION:
        scorer = model_scorer.get_scorer()
        if not scorer.ready:
            raise ApiError(503, "MODEL_NOT_READY", "모델을 아직 불러오지 못했습니다.", request_id=request_id)
        return scorer.score_features, REAL_MODEL_VERSION, REAL_FEATURE_SET_VERSION
    raise ApiError(409, "VERSION_MISMATCH", "요청한 모델 버전을 이 서버가 계산할 수 없습니다.",
                   [{"field": field, "message": f"받는 모델 버전: {', '.join(SUPPORTED_MODEL_VERSIONS)}"}], request_id)


# ML-01 서버 상태 확인 — modelLoaded는 실제 모델(LGBM-BASE-0.1) 파일을 불러왔는지다. Mock은 항상 쓸 수 있다.
@router.get("/health")
def health():
    loaded = model_scorer.get_scorer().ready
    return {"status": "UP", "modelLoaded": loaded, "modelVersion": REAL_MODEL_VERSION if loaded else MODEL_VERSION,
            "supportedModelVersions": list(SUPPORTED_MODEL_VERSIONS)}


# ML-02 모델·피처셋·등급 구간 버전과 피처 목록. 실제 모델을 불러왔으면 그 정보(피처 38개), 아니면 Mock 정보(39개).
@router.get("/model-info")
def model_info():
    if model_scorer.get_scorer().ready:
        from training.config import MODELS   # 실제 모델 피처 순서의 기준
        codes = set(MODELS["alternative"]["features"])
        model_version, feature_set, features = REAL_MODEL_VERSION, REAL_FEATURE_SET_VERSION, [f for f in FEATURES if f.code in codes]
    else:
        model_version, feature_set, features = MODEL_VERSION, FEATURE_SET_VERSION, FEATURES
    return {
        "modelVersion": model_version,
        "featureSetVersion": feature_set,
        "cutoffVersion": CUTOFF_VERSION,
        "gradeBands": GRADE_BANDS,
        "supportedModelVersions": list(SUPPORTED_MODEL_VERSIONS),
        "features": [
            {"featureCode": f.code, "alternativeYn": f.alternative_yn, "simulatableYn": f.simulatable_yn}
            for f in features
        ],
    }


# ML-03 N-12-2 기존·대안 점수·등급·부도 확률·SHAP 계산 (저장은 Spring)
@router.post("/assessments/score")
def score(req: ScoreRequest, x_mock_scenario: str | None = Header(default=None)):
    started = time.perf_counter()
    _check_request_id(req.requestId)
    _check_scenario(x_mock_scenario, req.requestId)
    score_features, model_version, feature_set = _pick_scorer(req.expectedModelVersion, "expectedModelVersion", req.requestId)

    _check_income_months(req)
    _check_bill_data(req)

    features = build_features(req)
    result = score_features(features)
    log.info("score requestId=%s model=%s elapsedMs=%d", req.requestId, model_version, (time.perf_counter() - started) * 1000)
    return {
        "requestId": req.requestId,
        "modelVersion": model_version,
        "featureSetVersion": feature_set,
        "cutoffVersion": CUTOFF_VERSION,
        **result,
        "featureSnapshot": features,
    }


# ML-04 N-18 신용케어 시뮬레이터 — 저장된 평가에서 출발해 바꾼 값으로 다시 계산 (저장 안 함)
@router.post("/assessments/simulate")
def simulate_score(req: SimulateRequest, x_mock_scenario: str | None = Header(default=None)):
    started = time.perf_counter()
    _check_request_id(req.requestId)
    _check_scenario(x_mock_scenario, req.requestId)
    score_features, model_version, _ = _pick_scorer(req.baseAssessment.modelVersion, "baseAssessment.modelVersion", req.requestId)

    missing = [f.code for f in FEATURES if f.code not in req.baseAssessment.featureSnapshot]
    if missing:
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.",
                       [{"field": "baseAssessment.featureSnapshot", "message": f"피처 {len(missing)}개가 없습니다."}],
                       req.requestId)
    change_errors = validate_changes(req.changes)   # 모르는 키·카드 한도/사용액 한쪽만 → 422 (조용히 무시하지 않는다)
    if change_errors:
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.", change_errors, req.requestId)

    result = simulate(req.baseAssessment.featureSnapshot, req.changes, score_features)
    log.info("simulate requestId=%s model=%s elapsedMs=%d", req.requestId, model_version, (time.perf_counter() - started) * 1000)
    return {"requestId": req.requestId, "modelVersion": model_version, "cutoffVersion": CUTOFF_VERSION, **result}
