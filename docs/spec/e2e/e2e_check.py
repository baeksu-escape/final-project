"""FP-143 화면 → Spring → FastAPI → DB 연동(E2E) 자동 점검 — 점수 산출·리포트·진단 내역·시뮬레이터·예상 점수.

켜 둘 것: DB, 백엔드(8080), FastAPI(8000). 화면(5173)은 필요 없다(화면이 부르는 API를 같은 순서로 직접 부른다).
실행(저장소 루트에서, 파이썬 기본 라이브러리만 사용):
    python -I -X utf8 docs/spec/e2e/e2e_check.py --env-file "%USERPROFILE%\\avenue-secrets\\avenue_dev.env"
    python -I -X utf8 docs/spec/e2e/e2e_check.py --login demo_self --env-file ...      # 다른 시연 계정
비밀번호는 env 파일(저장소 밖)의 AVENUE_DEMO_PASSWORD 또는 같은 이름의 환경변수에서 읽고, 화면·로그에 출력하지 않는다.

⚠️ 점수 산출(E2E-03)은 실제로 평가 1행을 저장한다. 평소에는 로컬 DB로 돌리고, 공용 DB는 통합 테스트 때만 쓴다.
결과: 항목마다 PASS/FAIL/SKIP과 근거 한 줄. FAIL이 하나라도 있으면 종료 코드 1.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

REAL_MODEL = "LGBM-BASE-0.1"
results = []


def record(case_id, title, ok, detail):
    status = "PASS" if ok is True else ("SKIP" if ok is None else "FAIL")
    results.append((case_id, status, title, detail))
    print(f"[{status}] {case_id} {title} — {detail}")


def read_password(env_file):
    if env_file:
        path = Path(os.path.expandvars(env_file)).expanduser()
        if not path.is_file():
            sys.exit(f"env 파일이 없습니다: {path.name} (경로를 확인하세요)")
        repo_root = Path(__file__).resolve().parents[3]
        if repo_root in path.resolve().parents:
            sys.exit("env 파일은 저장소 밖에 두세요(키·비밀번호가 커밋될 수 있음).")
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, _, value = line.partition("=")
            if key.strip() == "AVENUE_DEMO_PASSWORD":
                return value.strip().strip('"')
    value = os.environ.get("AVENUE_DEMO_PASSWORD")
    if not value:
        sys.exit("시연 계정 비밀번호가 없습니다. --env-file 또는 환경변수 AVENUE_DEMO_PASSWORD를 주세요.")
    return value


class Api:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.token = None

    def call(self, method, path, body=None, token=True):
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if token and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                raw = res.read().decode("utf-8")
                return res.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, None


def main():
    ap = argparse.ArgumentParser(description="FP-143 E2E 자동 점검")
    ap.add_argument("--backend", default="http://localhost:8080")
    ap.add_argument("--fastapi", default="http://localhost:8000")
    ap.add_argument("--login", default="demo_employee")
    ap.add_argument("--env-file")
    args = ap.parse_args()
    password = read_password(args.env_file)
    api = Api(args.backend)

    # E2E-00 FastAPI 준비 상태
    fast = Api(args.fastapi)
    try:
        status, health = fast.call("GET", "/v1/health", token=False)
        record("E2E-00", "FastAPI 준비", status == 200 and health.get("modelLoaded") is True,
               f"HTTP {status}, modelLoaded={health.get('modelLoaded')}, modelVersion={health.get('modelVersion')}")
    except OSError as e:
        record("E2E-00", "FastAPI 준비", False, f"연결 안 됨({type(e).__name__}) — uvicorn main:app --port 8000")

    # E2E-01 로그인
    try:
        status, body = api.call("POST", "/api/auth/login", {"loginId": args.login, "password": password}, token=False)
    except OSError as e:
        record("E2E-01", "로그인", False, f"백엔드 연결 안 됨({type(e).__name__}) — STS에서 백엔드를 켜세요")
        return finish()
    api.token = (body or {}).get("accessToken")
    record("E2E-01", f"로그인({args.login})", status == 200 and bool(api.token), f"HTTP {status}")
    if not api.token:
        return finish()

    # E2E-02 토큰 없으면 401
    status, _ = api.call("GET", "/api/report/me", token=False)
    record("E2E-02", "토큰 없이 리포트 → 401", status == 401, f"HTTP {status}")

    # E2E-03 점수 산출(실제 저장)
    request_id = str(uuid.uuid4())
    status, score = api.call("POST", "/api/members/me/score-calculation", {"requestId": request_id})
    scored = status == 200 and (score or {}).get("gradeStatusCode") == "SCORED"
    reason = (score or {}).get("notScorableReasonCode") or (score or {}).get("code")
    record("E2E-03", "점수 산출 → SCORED", scored,
           f"HTTP {status}, 상태={(score or {}).get('gradeStatusCode')}, 사유/코드={reason}")

    # E2E-04 같은 requestId 다시 → 새로 저장하지 않고 같은 결과
    status2, score2 = api.call("POST", "/api/members/me/score-calculation", {"requestId": request_id})
    same = status2 == 200 and (score2 or {}).get("requestId") == request_id and \
        (score2 or {}).get("alternative") == (score or {}).get("alternative")
    record("E2E-04", "같은 requestId 재요청 → 같은 결과", same if status == 200 else None, f"HTTP {status2}")

    # E2E-05 리포트: 실제 모델·SHAP·피처 칩
    status, report = api.call("GET", "/api/report/me")
    report = report or {}
    factors = len((report.get("shap") or {}).get("factors") or [])
    chips = report.get("modelFeatures") or {}
    trad, alt = len(chips.get("traditional") or []), len(chips.get("alternative") or [])
    record("E2E-05", "리포트 = 방금 평가·실제 모델", status == 200 and report.get("requestId") == request_id
           and report.get("modelVersion") == REAL_MODEL,
           f"HTTP {status}, modelVersion={report.get('modelVersion')}, 같은 평가={report.get('requestId') == request_id}")
    record("E2E-06", "리포트 SHAP 요인·피처 칩 수", status == 200 and factors > 0 and (trad, alt) == (18, 38),
           f"SHAP 요인 {factors}개, 피처 칩 기존 {trad}/대안 {alt} (기대 18/38)")

    # E2E-07 진단 내역 최신 = 방금 평가, E2E-08 상세 조회, E2E-09 없는 평가 404
    status, hist = api.call("GET", "/api/members/me/diagnoses")
    items = (hist or {}).get("items") or []
    record("E2E-07", "진단 내역 최신 = 방금 평가", status == 200 and bool(items) and items[0].get("diagnosisId") == request_id,
           f"HTTP {status}, {len(items)}건")
    status, _ = api.call("GET", f"/api/report/{request_id}")
    record("E2E-08", "지난 평가 상세", status == 200, f"HTTP {status}")
    status, err = api.call("GET", f"/api/report/{uuid.uuid4()}")
    record("E2E-09", "남의·없는 평가 → 404", status == 404 and (err or {}).get("code") == "ASSESSMENT_NOT_FOUND",
           f"HTTP {status}, code={(err or {}).get('code')}")

    # E2E-10~12 시뮬레이터
    status, base = api.call("GET", "/api/members/me/credit-care-base")
    values = (base or {}).get("values") or {}
    record("E2E-10", "시뮬레이터 현재 값(SIM-01)", status == 200 and len(values) == 10, f"HTTP {status}, 키 {len(values)}개(기대 10)")
    status, sim = api.call("POST", "/api/members/me/credit-care-recalculate", {"changes": {"DELINQ_COUNT_12M": 0}})
    sim = sim or {}
    record("E2E-11", "시뮬레이터 재계산(SIM-02)", status == 200 and "after" in sim and "delta" in sim,
           f"HTTP {status}, 전 {(sim.get('before') or {}).get('score')} → 후 {(sim.get('after') or {}).get('score')}, "
           f"감점 요인 {len(sim.get('topReductionFactors') or [])}개")
    status, err = api.call("POST", "/api/members/me/credit-care-recalculate", {"changes": {"TELECOM_ON_TIME_MONTHS": 13}})
    fe = [f.get("field") for f in (err or {}).get("fieldErrors") or []]
    record("E2E-12", "시뮬레이터 범위 밖 → 400", status == 400 and "changes.TELECOM_ON_TIME_MONTHS" in fe,
           f"HTTP {status}, fieldErrors={fe}")

    # E2E-13 예상 점수(DIAG-09) — 저장하지 않음
    status, exp = api.call("POST", "/api/members/me/cash-flow-expected-score", {"incomeChangePercent": -10})
    exp = exp or {}
    record("E2E-13", "예상 점수(DIAG-09)", status == 200 and exp.get("modelVersion") == REAL_MODEL,
           f"HTTP {status}, 예상 {exp.get('expectedScore')}, 차이 {exp.get('scoreDiff')}, 모델 {exp.get('modelVersion')}")
    status, hist2 = api.call("GET", "/api/members/me/diagnoses")
    record("E2E-14", "시뮬레이터·예상 점수는 저장 안 함", status == 200 and len((hist2 or {}).get("items") or []) == len(items),
           f"진단 내역 {len(items)}건 → {len((hist2 or {}).get('items') or [])}건")
    return finish()


def finish():
    fails = [r for r in results if r[1] == "FAIL"]
    print(f"\n합계: PASS {sum(r[1] == 'PASS' for r in results)} / FAIL {len(fails)} / SKIP {sum(r[1] == 'SKIP' for r in results)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
