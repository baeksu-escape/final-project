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

# 리포트·시뮬레이터·예상 점수가 써야 하는 모델 버전. 코드에 박지 않는다(FP-237: 모델 교체는 코드 없이 묶음 파일 + DB 전환).
# main()이 --model-version 옵션 값으로, 없으면 E2E-00에서 FastAPI /v1/health가 알려 준 modelVersion으로 정한다.
REAL_MODEL = None
# 시연 계정 3개. 다른 회원 평가 차단(E2E-09B)은 --login이 아닌 계정 중 첫 번째로 확인한다.
DEMO_LOGINS = ("demo_employee", "demo_self", "demo_free")
# 서비스 등급 구간 코드(CUT-0.1). 화면 게이지가 이 코드로 색을 정한다.
GRADE_CODES = {"CAUTION", "STANDARD", "GOOD"}
results = []


def record(case_id, title, ok, detail):
    """점검 항목 하나의 결과를 모으고 바로 한 줄 출력한다. ok: True=PASS, None=SKIP, 그 밖=FAIL."""
    status = "PASS" if ok is True else ("SKIP" if ok is None else "FAIL")
    results.append((case_id, status, title, detail))
    print(f"[{status}] {case_id} {title} — {detail}")


def read_password(env_file):
    """시연 계정 비밀번호를 env 파일(저장소 밖) 또는 환경변수에서 읽는다. 값은 출력하지 않는다.
    env 파일이 저장소 안에 있으면 커밋될 수 있어 멈춘다."""
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
    """서버 한 곳(백엔드 또는 FastAPI)에 JSON 요청을 보내는 작은 도우미. 로그인하면 토큰을 들고 다닌다."""

    def __init__(self, base):
        """base: 서버 주소(예: http://localhost:8080). 토큰은 로그인 전이라 비어 있다."""
        self.base = base.rstrip("/")
        self.token = None

    def call(self, method, path, body=None, token=True):
        """요청을 보내고 (HTTP 상태, JSON 본문)을 돌려준다. 4xx·5xx도 예외 대신 같은 모양으로 돌려준다.
        token=False면 로그인 토큰을 붙이지 않는다(401 확인용). 연결 자체가 안 되면 OSError가 난다."""
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

    def login(self, login_id, password):
        """로그인해서 토큰을 저장한다. (HTTP 상태, 토큰 있음 여부)를 돌려준다."""
        status, body = self.call("POST", "/api/auth/login", {"loginId": login_id, "password": password}, token=False)
        self.token = (body or {}).get("accessToken")
        return status, bool(self.token)


def is_score(value):
    """화면이 그대로 그리는 점수인지: 0~1000 정수."""
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 1000


def check_simulation(sim, report_score):
    """E2E-11 SIM-02 응답에서 시뮬레이터 화면이 쓰는 값이 맞는지 본다. 틀린 것 목록을 돌려준다(빈 목록 = 통과).
    - 전 점수 = 리포트의 대안 점수(같은 평가에서 출발), 전·후 점수 0~1000, 등급 코드
    - 점수 차이 total = 후 − 전 = 금융 이력 영향 + 대안 데이터 영향(화면의 두 막대)
    - 감점 요인마다 순위·피처 코드·이름(화면 문구)·감점이 있다"""
    wrong = []
    before, after, delta = sim.get("before") or {}, sim.get("after") or {}, sim.get("delta") or {}
    if sim.get("modelVersion") != REAL_MODEL:
        wrong.append(f"modelVersion={sim.get('modelVersion')}")
    if before.get("score") != report_score:
        wrong.append(f"전 점수 {before.get('score')} ≠ 리포트 {report_score}")
    for name, part in (("전", before), ("후", after)):
        if not is_score(part.get("score")) or part.get("gradeBandCode") not in GRADE_CODES:
            wrong.append(f"{name} 점수·등급 {part.get('score')}/{part.get('gradeBandCode')}")
    if is_score(before.get("score")) and is_score(after.get("score")):
        if delta.get("total") != after["score"] - before["score"]:
            wrong.append(f"delta.total {delta.get('total')} ≠ 후−전")
    if None in (delta.get("financialEffect"), delta.get("alternativeEffect")) or \
            delta.get("total") != (delta.get("financialEffect") or 0) + (delta.get("alternativeEffect") or 0):
        wrong.append(f"delta 나눔 {delta}")
    for factor in sim.get("topReductionFactors") or []:
        if not factor.get("featureCode") or not factor.get("featureName") or factor.get("rank") is None \
                or factor.get("shapScore") is None:
            wrong.append(f"감점 요인 칸 빠짐 rank={factor.get('rank')}")
            break
    return wrong


def check_expected_score(exp, report_score, request_id):
    """E2E-13 DIAG-09 응답에서 예상 점수 화면이 쓰는 값이 맞는지 본다. 틀린 것 목록을 돌려준다(빈 목록 = 통과).
    - 현재 점수 = 리포트의 대안 점수, 출발 평가 = 방금 저장한 평가(requestId)
    - 예상 점수 0~1000, 두 등급 코드, 차이 = 예상 − 현재
    - 예상·현재 점수 모두 같은 실제 모델(차이에 모델 차이가 섞이지 않음)"""
    wrong = []
    if exp.get("currentScore") != report_score:
        wrong.append(f"현재 점수 {exp.get('currentScore')} ≠ 리포트 {report_score}")
    if exp.get("baseRequestId") != request_id:
        wrong.append("출발 평가가 방금 평가가 아님")
    if not is_score(exp.get("expectedScore")):
        wrong.append(f"예상 점수 {exp.get('expectedScore')}")
    if exp.get("currentGradeBandCode") not in GRADE_CODES or exp.get("expectedGradeBandCode") not in GRADE_CODES:
        wrong.append(f"등급 {exp.get('currentGradeBandCode')}/{exp.get('expectedGradeBandCode')}")
    if is_score(exp.get("expectedScore")) and isinstance(exp.get("currentScore"), int) and \
            exp.get("scoreDiff") != exp["expectedScore"] - exp["currentScore"]:
        wrong.append(f"차이 {exp.get('scoreDiff')} ≠ 예상−현재")
    if exp.get("modelVersion") != REAL_MODEL or exp.get("baseModelVersion") != REAL_MODEL:
        wrong.append(f"모델 {exp.get('modelVersion')}/{exp.get('baseModelVersion')}")
    return wrong


def check_other_member(api, args, password):
    """E2E-09B 다른 회원의 실제 평가를 내 토큰으로 열면 404인지 본다(남의 평가 차단).
    다른 시연 계정으로 로그인해 그 계정의 최신 평가 ID를 얻고, 그 계정에서는 200으로 열리는 것도 확인한다
    (없는 ID라서 404가 난 것이 아님을 보이기 위해). 다른 계정에 평가가 없으면 SKIP."""
    other_login = args.other_login or next(name for name in DEMO_LOGINS if name != args.login)
    other = Api(args.backend)
    status, ok = other.login(other_login, password)
    if not ok:
        record("E2E-09B", "다른 회원 평가 → 404", None, f"{other_login} 로그인 실패(HTTP {status}) — --other-login으로 바꿀 수 있음")
        return
    status, hist = other.call("GET", "/api/members/me/diagnoses")
    items = (hist or {}).get("items") or []
    if not items:
        record("E2E-09B", "다른 회원 평가 → 404", None, f"{other_login}에 평가가 없음 — 그 계정으로 점수 산출 후 다시")
        return
    other_id = items[0].get("diagnosisId")
    own_status, _ = other.call("GET", f"/api/report/{other_id}")
    status, err = api.call("GET", f"/api/report/{other_id}")
    record("E2E-09B", f"다른 회원({other_login}) 평가 → 404",
           own_status == 200 and status == 404 and (err or {}).get("code") == "ASSESSMENT_NOT_FOUND",
           f"본인 조회 HTTP {own_status}, 내 토큰으로 HTTP {status}, code={(err or {}).get('code')}")


def main():
    """점검 순서대로 API를 부르고 항목마다 결과를 남긴다. 앞 단계가 막히면(연결·로그인 실패) 거기서 멈춘다."""
    global REAL_MODEL
    ap = argparse.ArgumentParser(description="FP-143 E2E 자동 점검")
    ap.add_argument("--model-version", help="기대 모델 버전(예: LGBM-BASE-0.2). 없으면 FastAPI /v1/health의 modelVersion")
    ap.add_argument("--backend", default="http://localhost:8080")
    ap.add_argument("--fastapi", default="http://localhost:8000")
    ap.add_argument("--login", default="demo_employee")
    ap.add_argument("--other-login", help="다른 회원 평가 차단(E2E-09B)에 쓸 계정. 기본은 --login이 아닌 첫 시연 계정")
    ap.add_argument("--env-file")
    args = ap.parse_args()
    password = read_password(args.env_file)
    api = Api(args.backend)

    # E2E-00 FastAPI 준비 상태 + 기대 모델 버전 정하기
    # 서버가 불러온 버전과 DB ACTIVE가 다르면 E2E-03이 MODEL_ERROR, E2E-05·13이 FAIL로 드러난다.
    fast = Api(args.fastapi)
    health = {}
    try:
        status, health = fast.call("GET", "/v1/health", token=False)
        health = health or {}   # JSON이 아닌 오류 응답이면 None이 온다
        record("E2E-00", "FastAPI 준비", status == 200 and health.get("modelLoaded") is True,
               f"HTTP {status}, modelLoaded={health.get('modelLoaded')}, modelVersion={health.get('modelVersion')}")
    except OSError as e:
        record("E2E-00", "FastAPI 준비", False, f"연결 안 됨({type(e).__name__}) — uvicorn main:app --port 8000")
    REAL_MODEL = args.model_version or (health.get("modelVersion") if health.get("modelLoaded") else None)
    print(f"기대 모델 버전: {REAL_MODEL or '(알 수 없음 — 모델 버전 확인 항목은 FAIL)'}"
          f"{' (--model-version)' if args.model_version else ' (/v1/health)'}")

    # E2E-01 로그인
    try:
        status, logged_in = api.login(args.login, password)
    except OSError as e:
        record("E2E-01", "로그인", False, f"백엔드 연결 안 됨({type(e).__name__}) — STS에서 백엔드를 켜세요")
        return finish()
    record("E2E-01", f"로그인({args.login})", status == 200 and logged_in, f"HTTP {status}")
    if not logged_in:
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
    report_score = (report.get("alternative") or {}).get("score")
    factors = len((report.get("shap") or {}).get("factors") or [])
    chips = report.get("modelFeatures") or {}
    trad, alt = len(chips.get("traditional") or []), len(chips.get("alternative") or [])
    record("E2E-05", "리포트 = 방금 평가·실제 모델", status == 200 and report.get("requestId") == request_id
           and report.get("modelVersion") == REAL_MODEL,
           f"HTTP {status}, modelVersion={report.get('modelVersion')}, 같은 평가={report.get('requestId') == request_id}")
    record("E2E-06", "리포트 SHAP 요인·피처 칩 수", status == 200 and factors > 0 and (trad, alt) == (18, 38),
           f"SHAP 요인 {factors}개, 피처 칩 기존 {trad}/대안 {alt} (기대 18/38)")

    # E2E-07 진단 내역 최신 = 방금 평가, E2E-08 상세 조회
    status, hist = api.call("GET", "/api/members/me/diagnoses")
    items = (hist or {}).get("items") or []
    record("E2E-07", "진단 내역 최신 = 방금 평가", status == 200 and bool(items) and items[0].get("diagnosisId") == request_id,
           f"HTTP {status}, {len(items)}건")
    status, _ = api.call("GET", f"/api/report/{request_id}")
    record("E2E-08", "지난 평가 상세", status == 200, f"HTTP {status}")

    # E2E-09 없는 평가 → 404 (임의 UUID), E2E-09B 다른 회원의 실제 평가 → 404
    status, err = api.call("GET", f"/api/report/{uuid.uuid4()}")
    record("E2E-09", "없는 평가 → 404", status == 404 and (err or {}).get("code") == "ASSESSMENT_NOT_FOUND",
           f"HTTP {status}, code={(err or {}).get('code')}")
    check_other_member(api, args, password)

    # E2E-10~12 시뮬레이터
    status, base = api.call("GET", "/api/members/me/credit-care-base")
    values = (base or {}).get("values") or {}
    record("E2E-10", "시뮬레이터 현재 값(SIM-01)", status == 200 and len(values) == 10, f"HTTP {status}, 키 {len(values)}개(기대 10)")
    status, sim = api.call("POST", "/api/members/me/credit-care-recalculate", {"changes": {"DELINQ_COUNT_12M": 0}})
    sim = sim or {}
    wrong = check_simulation(sim, report_score) if status == 200 else []
    record("E2E-11", "시뮬레이터 재계산(SIM-02)·화면 값", status == 200 and not wrong,
           f"HTTP {status}, 전 {(sim.get('before') or {}).get('score')} → 후 {(sim.get('after') or {}).get('score')}, "
           f"감점 요인 {len(sim.get('topReductionFactors') or [])}개" + (f", 틀림: {'; '.join(wrong)}" if wrong else ""))
    # 통신비 정시 납부 상한 12개월은 임시값(SIM-02 TODO). 상한이 바뀌면 13도 같이 바꾼다(README 참고).
    status, err = api.call("POST", "/api/members/me/credit-care-recalculate", {"changes": {"TELECOM_ON_TIME_MONTHS": 13}})
    fe = [f.get("field") for f in (err or {}).get("fieldErrors") or []]
    record("E2E-12", "시뮬레이터 범위 밖 → 400", status == 400 and "changes.TELECOM_ON_TIME_MONTHS" in fe,
           f"HTTP {status}, fieldErrors={fe}")

    # E2E-13 예상 점수(DIAG-09) — 저장하지 않음
    status, exp = api.call("POST", "/api/members/me/cash-flow-expected-score", {"incomeChangePercent": -10})
    exp = exp or {}
    wrong = check_expected_score(exp, report_score, request_id) if status == 200 else []
    record("E2E-13", "예상 점수(DIAG-09)·화면 값", status == 200 and not wrong,
           f"HTTP {status}, 현재 {exp.get('currentScore')} → 예상 {exp.get('expectedScore')}, 차이 {exp.get('scoreDiff')}, "
           f"모델 {exp.get('modelVersion')}" + (f", 틀림: {'; '.join(wrong)}" if wrong else ""))
    # E2E-14 저장 안 함: 건수만 보면 내역이 한 페이지로 잘릴 때 놓칠 수 있어, 맨 위 평가가 그대로 방금 평가인지도 본다
    # (새로 저장됐다면 최신순 맨 위가 바뀐다).
    status, hist2 = api.call("GET", "/api/members/me/diagnoses")
    items2 = (hist2 or {}).get("items") or []
    top_before = items[0].get("diagnosisId") if items else None
    top_after = items2[0].get("diagnosisId") if items2 else None
    record("E2E-14", "시뮬레이터·예상 점수는 저장 안 함",
           status == 200 and len(items2) == len(items) and top_after == top_before,
           f"진단 내역 {len(items)}건 → {len(items2)}건, 맨 위 평가 그대로={top_after == top_before}")
    return finish()


def finish():
    """합계를 출력하고, FAIL이 하나라도 있으면 종료 코드 1로 끝낸다(자동 실행에서 실패를 알 수 있게)."""
    fails = [r for r in results if r[1] == "FAIL"]
    print(f"\n합계: PASS {sum(r[1] == 'PASS' for r in results)} / FAIL {len(fails)} / SKIP {sum(r[1] == 'SKIP' for r in results)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
