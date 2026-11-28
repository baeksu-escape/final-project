# N-12-2·N-25 모델 0.3 사전 기준(정의서 10장 C33) 점검 — 새 TRAIN으로 학습하고 VALID와 고정 점검 사례로 (a)~(f)를 판정한다.
# TEST는 읽자마자 버리며, 모델 파일은 저장하지 않는다(저장은 training.train). 기준은 모델 결과를 보기 전에 정했고 결과를 본 뒤 바꾸지 않는다.
# 실행(fastapi_server 폴더에서): python -m training.check_v03 --data-dir data/training [--out <결과 json>]   # data/training은 v3.7.0
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from pipeline.feature_builder import build_features
from schemas.assessment import ScoreRequest
from training import config
from training.explain import to_score
from training.interface import to_model_input
from training.train import fit_model, load_training_sets

LABELS = {"delinq": "label_any_delinquency_12m", "nonfin": "label_nonfin_effect_12m"}
AUC_RANGE = (0.62, 0.80)          # (e) 자기 라벨 AUC 5개 시드 평균
DELINQ_DIFF_LIMIT = 0.02          # (f) 연체 라벨에서 대안−기존
SHIPPED_SEED = config.SEEDS[0]    # (b)~(d)는 서버에 올릴 시드로 판정한다

# (b)·(c) 점검 출발 입력: 급여소득자 27세, 월 급여 2,404,634원, 월 지출 1,471,547원, 대출 0원, 신용 이력 없음(11/20 점검 사례).
SALARY, EXPENSE = 2_404_634, 1_471_547
BASE = {"income_svc_12m_krw": 12 * SALARY, "income_cv_svc_12m": 0.0, "zero_income_months_svc_12m": 0, "expense_avg_month_krw": EXPENSE,
        "debt_service_current_krw": 0, "expense_ratio_svc_12m": 0.612, "dsr_svc_12m": 0.0, "deficit_months_svc_12m": 0,
        "worst_month_net_cash_svc_12m_krw": 933_087, "debt_balance_krw": 0, "L00000001": 0, "DQ1200001": None, "L22000900": None,
        "LA0099212": None, "CF1231605": None, "CL0631905": None, "segment": "wage", "age": 27,
        "telecom_late_months": 0, "telecom_on_time_streak": 12, "utility_late_months": 0, "dp_ever_used": 1, "dp_active_months": 3,
        "dp_payment_count_12m": 51, "dp_payment_amount_12m_krw": 1_140_770, "np_coverage_status": "covered", "np_payer_type": "workplace",
        "np_due_months": 12, "np_on_time_months": 12, "np_arrears_months": 0, "np_on_time_rate": 1.0, "hi_coverage_status": "covered",
        "hi_payer_type": "workplace", "hi_due_months": 12, "hi_on_time_months": 12, "hi_arrears_months": 0, "hi_on_time_rate": 1.0, "si_arrears_any": 0}
ADDED_LOAN_BALANCE, ADDED_LOAN_PAYMENT = 20_000_000, 400_000


def with_income_expense(salary: int, expense: int) -> dict:
    """출발 입력에서 월 급여·월 지출만 바꾸고 파생 값을 다시 만든다."""
    net = salary - expense
    return {**BASE, "income_svc_12m_krw": 12 * salary, "expense_avg_month_krw": expense,
            "expense_ratio_svc_12m": round(expense / salary, 4), "deficit_months_svc_12m": 12 if net < 0 else 0,
            "worst_month_net_cash_svc_12m_krw": net}


def with_added_loan() -> dict:
    """(b) 출발 입력에 대출 1건(잔액 2,000만 원, 월 40만 원 상환)을 더한다. 월 순현금흐름은 상환액만큼 준다."""
    net = BASE["worst_month_net_cash_svc_12m_krw"] - ADDED_LOAN_PAYMENT
    return {**BASE, "L00000001": 1, "debt_balance_krw": ADDED_LOAN_BALANCE, "debt_service_current_krw": ADDED_LOAN_PAYMENT,
            "dsr_svc_12m": ADDED_LOAN_PAYMENT / SALARY, "worst_month_net_cash_svc_12m_krw": net,
            "deficit_months_svc_12m": 12 if net < 0 else 0}


def direction_cases() -> list:
    """(c) 이름, 입력, 비교 입력, 상식 방향(+1이면 점수가 비교 입력보다 낮아지면 안 되고, -1이면 높아지면 안 된다)."""
    rows = [(f"급여 {title}", with_income_expense(round(SALARY * rate), EXPENSE), BASE, sign)
            for title, rate, sign in (("-10%", 0.9, -1), ("-50%", 0.5, -1), ("-90%", 0.1, -1), ("+50%", 1.5, 1))]
    rows.append(("지출 2배", with_income_expense(SALARY, EXPENSE * 2), BASE, -1))
    rows.append(("지출 301만 원", with_income_expense(SALARY, 3_010_000), BASE, -1))
    rows.append(("연체 3회", {**BASE, "DQ1200001": 3}, BASE, -1))
    rows.append(("카드 사용률 95%(10% 대비)", {**BASE, "CL0631905": 95.0}, {**BASE, "CL0631905": 10.0}, -1))
    return rows


def double_debt(frame: pd.DataFrame) -> tuple:
    """(a) 대출 잔액·상환액이 있는 행만 골라 (원래, 2배) 두 표를 돌려준다. 상환 부담률도 2배, 최악 월 순현금흐름은 늘어난 월 상환액만큼 준다."""
    has = frame[(frame.debt_balance_krw > 0) & (frame.debt_service_current_krw > 0) & frame.dsr_svc_12m.notna()]
    more = has.copy()
    for column in ("debt_balance_krw", "debt_service_current_krw", "dsr_svc_12m"):
        more[column] = has[column] * 2
    more["worst_month_net_cash_svc_12m_krw"] = has.worst_month_net_cash_svc_12m_krw - has.debt_service_current_krw
    return has, more


MONTHS = [f"2025-{m:02d}" for m in range(9, 13)] + [f"2026-{m:02d}" for m in range(1, 9)]


def person(worker, age, incomes, expense, loans, credit, telecom_late=(), utility_late=(), pension_late=(), easypay=None) -> dict:
    """(d) 점검 사례 한 명의 ML-03 요청을 만든다. incomes가 값 하나면 급여소득자의 기준월 월급이다. easypay는 달마다 건수(건당 3만 원)."""
    income_rows = [{"baseMonth": m, "incomeKindCode": "SALARY" if worker == "EMPLOYEE" else "MONTHLY_INCOME", "incomeAmt": v}
                   for m, v in zip(MONTHS if len(incomes) > 1 else MONTHS[-1:], incomes)]

    def bills(late):
        return [{"billMonth": m, "paymentStatusCode": "LATE" if i in late else "ON_TIME"} for i, m in enumerate(MONTHS)]

    counts = easypay if easypay is not None else [4, 5] * 6
    pays = [{"baseMonth": m, "observationStatusCode": "OBSERVED" if c else "NO_ACTIVITY", "paymentCount": c, "paymentAmt": c * 30_000}
            for m, c in zip(MONTHS, counts)]
    payer = "WORKPLACE" if worker == "EMPLOYEE" else "REGIONAL"
    insurance = [{"insuranceTypeCode": kind, "baseMonth": m, "coverageStatusCode": "COVERED", "payerTypeCode": payer,
                  "paymentStatusCode": "UNPAID" if kind == "NATIONAL_PENSION" and i in pension_late else "ON_TIME"}
                 for kind in ("NATIONAL_PENSION", "HEALTH_INSURANCE") for i, m in enumerate(MONTHS)]
    return {"requestId": "case", "applicant": {"workerTypeCode": worker, "age": age}, "inputBaseMonth": "2026-08", "incomeMonths": income_rows,
            "expenses": [{"expenseGroupCode": "FIXED", "monthlyAmt": expense}],
            "loans": [{"loanTypeCode": "CREDIT", "balanceAmt": b, "monthlyPaymentAmt": p} for b, p in loans], "creditProfile": credit,
            "alternativeData": {"telecom": bills(telecom_late), "utility": bills(utility_late), "easypay": pays, "socialInsurance": insurance}}


def _credit(delinq, cash, new, private, utilization) -> dict:
    return {"delinqCount12m": delinq, "cashAdvanceMonths": cash, "newLoanCount3m": new, "privateLenderLoanBalanceAmt": private,
            "cardLimitAmt": 5_000_000, "cardMonthlySpendAmt": 5_000_000 * utilization // 100}


def persona_features() -> dict:
    """(d) 낮음·평균·좋음 세 사람의 모델 입력. 받은 문서에 없는 값(카드 한도, 대출 분배, 미납 달, 간편결제)은 11/26 가정이다."""
    low_income = [2_160_000] * 12
    low_income[2] = low_income[7] = 0
    requests = {
        "낮음": person("FREELANCER", 29, low_income, 1_500_000, [(8_750_000, 237_500)] * 4, _credit(2, 5, 2, 5_000_000, 90),
                     telecom_late=(2, 5, 8), utility_late=(3, 7), pension_late=(1, 4, 6, 9), easypay=[1] + [0] * 11),
        "평균": person("EMPLOYEE", 48, [3_090_000], 1_500_000, [(8_000_000, 200_000), (8_000_000, 200_000), (6_000_000, 150_000)], _credit(0, 1, 0, 0, 20)),
        "좋음": person("EMPLOYEE", 40, [4_500_000], 1_600_000, [(10_000_000, 300_000)], _credit(0, 0, 0, 0, 10)),
    }
    return {name: build_features(ScoreRequest(**body)) for name, body in requests.items()}


def one_score(model, kind: str, features: dict) -> int:
    return to_score(float(model.booster_.predict(to_model_input(features, kind), raw_score=True)[0]))


def frame_scores(model, kind: str, frame: pd.DataFrame) -> np.ndarray:
    raw = model.booster_.predict(frame[config.MODELS[kind]["features"]], raw_score=True)
    return np.array([to_score(float(v)) for v in raw])


def wrong_directions(scores: dict) -> list:
    """(c) {이름: (점수, 비교 점수, 상식 방향)}에서 반대 방향인 이름. 변화가 0이면 반대가 아니다."""
    return [name for name, (score, reference, sign) in scores.items() if (score - reference) * sign < 0]


def judge(measured: dict) -> list:
    """C33 (a)~(f) 판정 목록. measured는 run()이 모은 값이다."""
    rows = []

    def add(key, title, value, ok):
        rows.append({"id": key, "criterion": title, "value": value, "result": "PASS" if ok else "FAIL"})

    for kind in config.MODELS:
        change = measured["double_debt_change"][kind]["mean"]
        add("a", f"{kind}: 제약 없이 학습해도 대출 2배면 평균 점수 하락", change, change < 0)
    for kind in config.MODELS:
        diff = measured["added_loan_change"][kind][str(SHIPPED_SEED)]
        add("b", f"{kind}: 대출 0원에 대출을 더해도 점수가 오르지 않음", diff, diff <= 0)
    for kind in config.MODELS:
        wrong = measured["wrong_directions"][kind][str(SHIPPED_SEED)]
        add("c", f"{kind}: 점검 사례의 상식 반대 방향 0개", wrong, not wrong)
    order = measured["persona_scores"]["alternative"][str(SHIPPED_SEED)]
    add("d", "대안 점수 낮음 < 평균 < 좋음", order, order["낮음"] < order["평균"] < order["좋음"])
    for kind, spec in config.MODELS.items():
        auc = measured["auc"][kind][spec["label"]]["mean"]
        add("e", f"{kind}: 자기 라벨 AUC {AUC_RANGE[0]}~{AUC_RANGE[1]}", auc, AUC_RANGE[0] <= auc <= AUC_RANGE[1])
    for key, label in LABELS.items():
        diff = round(measured["auc"]["alternative"][label]["mean"] - measured["auc"]["legacy"][label]["mean"], 4)
        if key == "delinq":
            add("f", f"연체 라벨에서 대안−기존 ±{DELINQ_DIFF_LIMIT}", diff, abs(diff) <= DELINQ_DIFF_LIMIT)
        else:
            add("f", "비금융 효과 라벨에서 대안−기존 양수", diff, diff > 0)
    return rows


def run(train: pd.DataFrame, valid: pd.DataFrame, seeds: list) -> dict:
    """시드마다 제약 모델(0.3)과 제약 없는 모델을 학습해 C33에 필요한 값을 모은다."""
    personas = persona_features()
    has, more = double_debt(valid)
    measured = {"double_debt_rows": int(len(has)), "double_debt_change": {}, "added_loan_change": {}, "wrong_directions": {},
                "direction_scores": {}, "persona_scores": {}, "auc": {}}
    for kind, spec in config.MODELS.items():
        features, own = spec["features"], spec["label"]
        aucs = {label: [] for label in LABELS.values()}
        free_change, added, wrong, detail, people = {}, {}, {}, {}, {}
        for seed in seeds:
            for label in LABELS.values():
                model = fit_model(train, features, label, seed, config.MONOTONE_CONSTRAINTS_V03)
                aucs[label].append(float(roc_auc_score(valid[label], model.predict_proba(valid[features])[:, 1])))
                if label == own:
                    shipped = model
            base = one_score(shipped, kind, BASE)
            added[str(seed)] = one_score(shipped, kind, with_added_loan()) - base
            detail[str(seed)] = {name: [one_score(shipped, kind, case), one_score(shipped, kind, ref), sign] for name, case, ref, sign in direction_cases()}
            wrong[str(seed)] = wrong_directions(detail[str(seed)])
            people[str(seed)] = {name: one_score(shipped, kind, values) for name, values in personas.items()}
            free = fit_model(train, features, own, seed)
            free_change[str(seed)] = round(float((frame_scores(free, kind, more) - frame_scores(free, kind, has)).mean()), 3)
        measured["double_debt_change"][kind] = {"mean": round(float(np.mean(list(free_change.values()))), 3), "by_seed": free_change}
        measured["added_loan_change"][kind] = added
        measured["wrong_directions"][kind] = wrong
        measured["direction_scores"][kind] = detail
        measured["persona_scores"][kind] = people
        measured["auc"][kind] = {label: {"mean": round(float(np.mean(v)), 4), "std": round(float(np.std(v, ddof=1)), 4) if len(v) > 1 else 0.0,
                                         "by_seed": [round(x, 4) for x in v]} for label, v in aucs.items()}
    return measured


def main() -> None:
    parser = argparse.ArgumentParser(description="모델 0.3 사전 기준(C33) 점검. VALID만 쓰고 TEST는 쓰지 않는다")
    parser.add_argument("--data-dir", type=Path, default=config.DEFAULT_DATA_DIR)
    parser.add_argument("--out", type=Path, help="결과를 저장할 json 경로")
    args = parser.parse_args()

    train, valid, _, info = load_training_sets(args.data_dir)
    print(f"TRAIN {len(train)}행, VALID {len(valid)}행 (TEST 사용 안 함), 표 SHA {info['table_sha256'][:8]}")
    measured = run(train, valid, config.SEEDS)
    results = judge(measured)
    for row in results:
        print(f"  {row['result']} ({row['id']}) {row['criterion']}: {row['value']}")
    failed = [row for row in results if row["result"] == "FAIL"]
    print(f"판정: {len(results) - len(failed)} PASS, {len(failed)} FAIL")
    if args.out:
        report = {"criteria": "docs/spec/feature_definition.md C33", "split": config.VALID_SPLIT, "data": info, "seeds": config.SEEDS,
                  "monotone_constraints": config.MONOTONE_CONSTRAINTS_V03, "lgbm_params": config.LGBM_PARAMS, "results": results,
                  "measured": measured, "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                  "note": "합성 데이터와 합성 라벨 기준이며 실제 신용평가·대출 심사 결과나 실제 개선을 뜻하지 않는다."}
        args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"저장: {args.out}")


if __name__ == "__main__":
    main()
