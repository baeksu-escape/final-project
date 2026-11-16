# FP-140 예측 Mock — 실제 모델 아님.
# N-12-2 점수 계산 입력 → 피처 39개. 계산식은 피처 정의서 v1.0(docs/spec/feature_definition.md) 3장을 따른다.
# 실제 모델(FP-141)도 이 함수를 그대로 쓰도록 계산만 담당한다(학습·서비스 계산이 갈라지지 않게 한 곳에서 만든다).
# 규칙: 0과 결측을 구분한다. 계산할 수 없는 값은 None으로 두고 0으로 채우지 않는다(정의서 7장).
from statistics import mean, pstdev

from schemas.assessment import ScoreRequest

# 서비스 직군 코드 → 학습 데이터 segment 값 (정의서 3-5)
SEGMENT_BY_WORKER_TYPE = {"EMPLOYEE": "wage", "SELF_EMPLOYED": "selfemp", "FREELANCER": "freelance"}

# 납부 의무가 있는 달로 세는 상태 (NOT_DUE·NOT_APPLICABLE·UNKNOWN은 대상 아님)
DUE_STATUSES = {"ON_TIME", "LATE", "PARTIAL", "UNPAID"}


def _ratio(numerator, denominator):
    """분모가 0이거나 값이 없으면 None — 0으로 나누지 않는다."""
    if numerator is None or not denominator:
        return None
    return round(numerator / denominator, 4)


def monthly_incomes(req: ScoreRequest) -> list[int]:
    """12개월 월소득 목록. 급여소득자는 기준월 월급 1개를 12달로 펼친다(정의서 7장 5번)."""
    rows = sorted(req.incomeMonths, key=lambda r: r.baseMonth)
    if req.applicant.workerTypeCode == "EMPLOYEE" and len(rows) == 1:
        return [rows[0].incomeAmt] * 12
    return [r.incomeAmt for r in rows]


def _income_expense_features(req: ScoreRequest) -> dict:
    """3-1 소득·지출·상환 9개."""
    incomes = monthly_incomes(req)
    income_sum = sum(incomes)
    expense = sum(e.monthlyAmt for e in req.expenses)          # 평균 월 지출 = 월 지출 항목 합
    debt_service = sum(l.monthlyPaymentAmt for l in req.loans)  # 현재 월 상환액
    avg_income = mean(incomes) if incomes else 0
    net_cash = [m - expense - debt_service for m in incomes]
    return {
        "income_svc_12m_krw": income_sum,
        "income_cv_svc_12m": round(pstdev(incomes) / avg_income, 4) if avg_income else None,
        "zero_income_months_svc_12m": sum(1 for m in incomes if m == 0),
        "expense_avg_month_krw": expense,
        "debt_service_current_krw": debt_service,
        "expense_ratio_svc_12m": _ratio(expense * 12, income_sum),
        "dsr_svc_12m": _ratio(debt_service * 12, income_sum),
        "deficit_months_svc_12m": sum(1 for v in net_cash if v < 0),
        "worst_month_net_cash_svc_12m_krw": min(net_cash) if net_cash else None,
    }


def _bill_features(req: ScoreRequest) -> dict:
    """3-2 통신·공과금 3개. 미납 달 = LATE + UNPAID (DDL U2)."""
    telecom = sorted(req.alternativeData.telecom, key=lambda r: r.billMonth, reverse=True)
    streak = 0
    for row in telecom:  # 최근 달부터 거꾸로 센 연속 정시 납부
        if row.paymentStatusCode != "ON_TIME":
            break
        streak += 1
    return {
        "telecom_late_months": sum(1 for r in telecom if r.paymentStatusCode in ("LATE", "UNPAID")),
        "telecom_on_time_streak": streak,
        "utility_late_months": sum(1 for r in req.alternativeData.utility if r.paymentStatusCode in ("LATE", "UNPAID")),
    }


def _easypay_features(req: ScoreRequest) -> dict:
    """3-3 간편결제 4개. 기록이 없는 달(MISSING, 값 null)은 더하지 않는다."""
    rows = req.alternativeData.easypay
    counts = [r.paymentCount for r in rows if r.paymentCount is not None]
    amounts = [r.paymentAmt for r in rows if r.paymentAmt is not None]
    active = sum(1 for c in counts if c > 0)
    return {
        "dp_ever_used": 1 if active > 0 else 0,
        "dp_active_months": active,
        "dp_payment_count_12m": sum(counts),
        "dp_payment_amount_12m_krw": sum(amounts),
    }


def _insurance_features(req: ScoreRequest, insurance_type: str, prefix: str) -> dict:
    """3-4 국민연금(np_)·건강보험(hi_) 6개씩. 납부 대상 달이 0이면 정시 납부율은 None(계산 대상 아님)."""
    rows = sorted((r for r in req.alternativeData.socialInsurance if r.insuranceTypeCode == insurance_type),
                  key=lambda r: r.baseMonth)
    latest = rows[-1] if rows else None
    due = sum(1 for r in rows if r.paymentStatusCode in DUE_STATUSES)
    on_time = sum(1 for r in rows if r.paymentStatusCode == "ON_TIME")
    return {
        f"{prefix}_coverage_status": latest.coverageStatusCode.lower() if latest else None,
        f"{prefix}_payer_type": latest.payerTypeCode.lower() if latest and latest.payerTypeCode else None,
        f"{prefix}_due_months": due,
        f"{prefix}_on_time_months": on_time,
        f"{prefix}_arrears_months": due - on_time,
        f"{prefix}_on_time_rate": _ratio(on_time, due),
    }


def _profile_credit_features(req: ScoreRequest, debt_service: int) -> dict:
    """3-5 프로필 3개 + 3-6 신용 이력 7개 (신용평가사 열 이름, 값은 회원 입력)."""
    cp = req.creditProfile
    card_util = None
    if cp.cardLimitAmt and cp.cardMonthlySpendAmt is not None:
        card_util = round(cp.cardMonthlySpendAmt / cp.cardLimitAmt * 100, 1)
    return {
        "segment": SEGMENT_BY_WORKER_TYPE.get(req.applicant.workerTypeCode),
        "age": req.applicant.age,
        "debt_balance_krw": sum(l.balanceAmt for l in req.loans),
        "DQ1200001": cp.delinqCount12m,
        "L22000900": cp.newLoanCount3m,
        "LA0099212": cp.privateLenderLoanBalanceAmt,
        "CF1231605": cp.cashAdvanceMonths,
        "CL0631905": card_util,
        "L00000001": sum(1 for l in req.loans if l.balanceAmt > 0),
        "LRZ021201": debt_service * 12,
    }


def build_features(req: ScoreRequest) -> dict:
    """요청 하나로 피처 39개를 만든다. 키는 DIM_FEATURE.FEATURE_CODE와 같다."""
    features = _income_expense_features(req)
    features.update(_bill_features(req))
    features.update(_easypay_features(req))
    features.update(_insurance_features(req, "NATIONAL_PENSION", "np"))
    features.update(_insurance_features(req, "HEALTH_INSURANCE", "hi"))
    np_arrears = features["np_arrears_months"]
    hi_arrears = features["hi_arrears_months"]
    features["si_arrears_any"] = 1 if (np_arrears + hi_arrears) > 0 else 0
    features.update(_profile_credit_features(req, features["debt_service_current_krw"]))
    return features
