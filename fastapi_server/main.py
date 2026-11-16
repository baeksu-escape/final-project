# FP-140 예측 서버(FastAPI) 시작점 — 지금은 Mock 모델로 ML-01~04를 제공한다.
# 실행: fastapi_server 폴더에서 `uvicorn main:app --port 8000` → 브라우저에서 http://localhost:8000/docs
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from routers.assessment import ApiError, router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("avenue.prediction")

app = FastAPI(title="Avenue 예측 서버 (Mock)", version="FS-DRAFT")
app.include_router(router)


def _error_body(code: str, message: str, field_errors: list, request_id=None) -> dict:
    """B팀 명세서 1-1 오류 형식. 입력값·개인정보 원문은 넣지 않는다."""
    body = {"code": code, "message": message, "fieldErrors": field_errors}
    if request_id:
        body["requestId"] = request_id
    return body


@app.exception_handler(ApiError)
def handle_api_error(request: Request, error: ApiError):
    log.info("error code=%s requestId=%s", error.code, error.request_id)
    return JSONResponse(status_code=error.status,
                        content=_error_body(error.code, error.message, error.field_errors, error.request_id))


@app.exception_handler(RequestValidationError)
def handle_validation_error(request: Request, error: RequestValidationError):
    """요청 모양이 틀리면(필수 칸 없음, 형식 오류) 422 INVALID_INPUT. 어느 칸인지만 알려 준다."""
    field_errors = [
        {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": "값을 확인해 주세요."}
        for e in error.errors()
    ]
    log.info("error code=INVALID_INPUT fields=%d", len(field_errors))
    return JSONResponse(status_code=422, content=_error_body("INVALID_INPUT", "입력값을 확인해 주세요.", field_errors))
