# FP-140 예측 Mock — 실제 모델 아님.
# N-12-2 점수 계산 입력 → 피처 39개. 계산식은 피처 정의서 v1.0(docs/spec/feature_definition.md) 3장을 따른다.
# 실제 모델(FP-141)도 이 함수를 그대로 쓰도록 계산만 담당한다(학습·서비스 계산이 갈라지지 않게 한 곳에서 만든다).
# 규칙: 0과 결측을 구분한다. 계산할 수 없는 값은 None으로 두고 0으로 채우지 않는다(정의서 7장).
# TODO(FP-141) 소수 반올림은 Python round(짝수 쪽)다. 학습 생성 코드는 ROUND_HALF_UP이라 진짜 모델 연결 때 맞춘다.
from statistics import mean, pstdev

from schemas.assessment import ScoreRequest

# 서비스 직군 코드 → 학습 데이터 segment 값 (정의서 3-5)
SEGMENT_BY_WORKER_TYPE = {"EMPLOYEE": "wage", "SELF_EMPLOYED": "selfemp", "FREELANCER": "freelance"}

# 납부 의무가 있는 달로 세는 상태 (NOT_DUE·NOT_APPLICABLE·UNKNOWN은 대상 아님, 정의서 3-7 ③)
DUE_STATUSES = {"ON_TIME", "LATE", "PARTIAL", "UNPAID"}

# 이상치 고정 상한 (정의서 9장·C8, 11/16 임시 결정) — 넘으면 그 값과 그 값으로 계산하는 피처를 결측으로 둔다(11/16 범영·재욱 (가)안).
# TODO(C8) Spring 담당의 업무상 상한이 정해지면 이 값을 바꾼다. 학습 전처리도 같은 상수를 써야 한다.
INCOME_SUM_MAX_KRW = 2_000_000_000      # 12개월 소득 합계 20억 원 초과
EXPENSE_AVG_MAX_KRW = 200_000_000       # 평균 월 지출 2억 원 초과
DEBT_SERVICE_MIN_KRW = 0                # 월 상환액 0 미만


def _ratio(numerator, denominator):
    """분모가 0 이하이거나 값이 없으면 None — 정의서 3-1·3-7 ①(소득 합계 0 이하면 결측)."""
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return round(numerator / denominator, 4)


def monthly_incomes(req: ScoreRequest) -> list[int]:
    """12개월 월소득 목록. 급여소득자는 기준월 월급 1개를 12달로 펼친다(정의서 7장 5번)."""
    rows = sorted(req.incomeMonths, key=lambda r: r.baseMonth)
    if req.applicant.workerTypeCode == "EMPLOYEE" and len(rows) == 1:
        return [rows[0].incomeAmt] * 12
    return [r.incomeAmt for r in rows]


def _income_expense_features(req: ScoreRequest) -> dict:
    """3-1 소득·지출·상환 9개. 이상치(C8)인 값은 결측으로 두고, 그 값으로 계산하는 피처도 결측으로 둔다((가)안)."""
    incomes = monthly_incomes(req)
    income_sum = sum(incomes)
    expense = sum(e.monthlyAmt for e in req.expenses)          # 평균 월 지출 = 월 지출 항목 합
    debt_service = sum(l.monthlyPaymentAmt for l in req.loans)  # 현재 월 상환액

    income_ok = income_sum <= INCOME_SUM_MAX_KRW
    expense_ok = expense <= EXPENSE_AVG_MAX_KRW
    debt_ok = debt_service >= DEBT_SERVICE_MIN_KRW
    avg_income = mean(incomes) if incomes else 0
    net_cash = [m - expense - debt_service for m in incomes]
    cash_ok = income_ok and expense_ok and debt_ok            # 월 순현금은 세 값을 모두 쓴다
    return {
        "income_svc_12m_krw": income_sum if income_ok else None,
        "income_cv_svc_12m": round(pstdev(incomes) / avg_income, 4) if income_ok and avg_income > 0 else None,
        # 0인 달 수는 큰 값(이상치)이 있어도 셀 수 있어 그대로 둔다
        "zero_income_months_svc_12m": sum(1 for m in incomes if m == 0),
        "expense_avg_month_krw": expense if expense_ok else None,
        "debt_service_current_krw": debt_service if debt_ok else None,
        "expense_ratio_svc_12m": _ratio(expense * 12, income_sum) if income_ok and expense_ok else None,
        "dsr_svc_12m": _ratio(debt_service * 12, income_sum) if income_ok and debt_ok else None,
        "deficit_months_svc_12m": sum(1 for v in net_cash if v < 0) if cash_ok else None,
        "worst_month_net_cash_svc_12m_krw": min(net_cash) if cash_ok and net_cash else None,
    }


def _bill_features(req: ScoreRequest) -> dict:
    """3-2 통신·공과금 3개. 미납 달 = LATE + UNPAID (DDL U2, 통신비·공과금에는 PARTIAL 상태가 없다).
    TODO(피처 정의서 9장) 기관 기록이 없어 빈 목록([])으로 불러온 경우(A팀 불러오기 EMPTY) 연속 정시 납부가 0이 된다.
    학습 데이터 중앙값은 12라 의미가 다르다. 처리 규칙은 피처 정의서에 없어 재욱 님께 보완 요청(11/16)."""
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
        # 학습 값은 생성 때 뽑은 "사용자 여부"라 서비스는 대용치를 쓴다: 12개월 결제 건수 > 0 (정의서 3-7 ④·C11 확정)
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
    card_util = None   # 한도가 없거나 0 이하면 사용률을 만들지 않는다(시뮬레이션도 같은 규칙)
    if cp.cardLimitAmt is not None and cp.cardLimitAmt > 0 and cp.cardMonthlySpendAmt is not None:
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
        # FS-DRAFT 전용. 정의서 C9(11/16)로 모델에서 뺐고 FS-V1(38개)에는 없다. 상환액이 이상치면 함께 결측.
        "LRZ021201": debt_service * 12 if debt_service is not None else None,
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
    features.update(_profile_credit_features(req, features["debt_service_current_krw"]))   # 이상치면 None이 넘어간다
    return features
