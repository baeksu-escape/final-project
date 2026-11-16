# FP-140 예측 Mock — 실제 모델 아님.
# Spring → FastAPI 내부 API ML-01~04 (B팀 API 명세서 4장). FastAPI는 DB를 읽거나 쓰지 않는다. 저장은 Spring이 한다.
import logging
import re
import time

from fastapi import APIRouter, Header

from pipeline.feature_builder import build_features
from pipeline.feature_catalog import (
    CUTOFF_VERSION, FEATURE_SET_VERSION, FEATURES, GRADE_BANDS, MODEL_VERSION,
)
from pipeline.mock_scorer import score_features
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


def _check_model_version(version: str | None, field: str, request_id: str):
    if version is not None and version != MODEL_VERSION:
        raise ApiError(409, "VERSION_MISMATCH", "요청한 모델 버전과 지금 모델 버전이 다릅니다.",
                       [{"field": field, "message": f"지금 모델은 {MODEL_VERSION}입니다."}], request_id)


# ML-01 서버 상태 확인
@router.get("/health")
def health():
    return {"status": "UP", "modelLoaded": True, "modelVersion": MODEL_VERSION}


# ML-02 모델·피처셋·등급 구간 버전과 피처 목록 — Spring이 시작할 때 DB 값과 맞는지 확인한다.
@router.get("/model-info")
def model_info():
    return {
        "modelVersion": MODEL_VERSION,
        "featureSetVersion": FEATURE_SET_VERSION,
        "cutoffVersion": CUTOFF_VERSION,
        "gradeBands": GRADE_BANDS,
        "features": [
            {"featureCode": f.code, "alternativeYn": f.alternative_yn, "simulatableYn": f.simulatable_yn}
            for f in FEATURES
        ],
    }


# ML-03 N-12-2 기존·대안 점수·등급·부도 확률·SHAP 계산 (저장은 Spring)
@router.post("/assessments/score")
def score(req: ScoreRequest, x_mock_scenario: str | None = Header(default=None)):
    started = time.perf_counter()
    _check_request_id(req.requestId)
    _check_scenario(x_mock_scenario, req.requestId)
    _check_model_version(req.expectedModelVersion, "expectedModelVersion", req.requestId)

    _check_income_months(req)

    features = build_features(req)
    result = score_features(features)
    log.info("score requestId=%s elapsedMs=%d", req.requestId, (time.perf_counter() - started) * 1000)
    return {
        "requestId": req.requestId,
        "modelVersion": MODEL_VERSION,
        "featureSetVersion": FEATURE_SET_VERSION,
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
    _check_model_version(req.baseAssessment.modelVersion, "baseAssessment.modelVersion", req.requestId)

    missing = [f.code for f in FEATURES if f.code not in req.baseAssessment.featureSnapshot]
    if missing:
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.",
                       [{"field": "baseAssessment.featureSnapshot", "message": f"피처 {len(missing)}개가 없습니다."}],
                       req.requestId)
    change_errors = validate_changes(req.changes)   # 모르는 키·카드 한도/사용액 한쪽만 → 422 (조용히 무시하지 않는다)
    if change_errors:
        raise ApiError(422, "INVALID_INPUT", "입력값을 확인해 주세요.", change_errors, req.requestId)

    result = simulate(req.baseAssessment.featureSnapshot, req.changes)
    log.info("simulate requestId=%s elapsedMs=%d", req.requestId, (time.perf_counter() - started) * 1000)
    return {"requestId": req.requestId, "modelVersion": MODEL_VERSION, "cutoffVersion": CUTOFF_VERSION, **result}
