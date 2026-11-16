# FP-140 예측 Mock — 실제 모델 아님.
# Spring → FastAPI 내부 API(ML-03·ML-04) 요청 모양. 필드 이름은 B팀 API 명세서 4-3·4-4와 같다.
# 응답은 dict로 만들어 돌려준다(필드가 많고 Spring이 그대로 저장만 하므로 모델 클래스를 따로 두지 않는다).
from pydantic import BaseModel


class Applicant(BaseModel):
    """신청자 기본 정보 — 개인정보는 받지 않고 직군·만 나이만 받는다."""
    workerTypeCode: str            # EMPLOYEE / SELF_EMPLOYED / FREELANCER
    age: int | None = None         # ML-04에서는 안 보낼 수 있다
    requiredIncomeMonths: int | None = None  # DIM_WORKER_TYPE.REQUIRED_INCOME_MONTHS (12/12/1)


class IncomeMonth(BaseModel):
    baseMonth: str
    incomeKindCode: str            # MONTHLY_INCOME / SALARY
    incomeAmt: int


class ExpenseItem(BaseModel):
    expenseGroupCode: str
    expenseCategory: str | None = None
    monthlyAmt: int


class Loan(BaseModel):
    loanTypeCode: str
    sourceCode: str | None = None
    balanceAmt: int
    annualRatePct: float | None = None
    remainingMonths: int | None = None
    monthlyPaymentAmt: int


class CreditProfile(BaseModel):
    """카드·신용 이용 (회원 직접 입력). "신용 이력이 없어요"면 값이 null로 온다."""
    sourceCode: str | None = None
    delinqCount12m: int | None = None
    newLoanCount3m: int | None = None
    cardLimitAmt: int | None = None
    cardMonthlySpendAmt: int | None = None
    cashAdvanceMonths: int | None = None
    privateLenderLoanBalanceAmt: int | None = None


class BillPayment(BaseModel):
    """통신비·공과금 한 달."""
    billMonth: str
    billedAmt: int | None = None
    dueDate: str | None = None
    paidDate: str | None = None
    paymentStatusCode: str         # ON_TIME / LATE / UNPAID


class EasypayMonth(BaseModel):
    baseMonth: str
    observationStatusCode: str     # OBSERVED / NO_ACTIVITY / MISSING
    paymentCount: int | None = None
    paymentAmt: int | None = None
    activeDays: int | None = None


class SocialInsuranceMonth(BaseModel):
    insuranceTypeCode: str         # NATIONAL_PENSION / HEALTH_INSURANCE
    baseMonth: str
    coverageStatusCode: str
    payerTypeCode: str | None = None
    paymentStatusCode: str
    individualAmt: int | None = None
    paidAmt: int | None = None


class AlternativeData(BaseModel):
    """대안 데이터 5종. 5개 동의가 필수라 모두 와야 한다(빈 목록은 '불러왔지만 기록 없음')."""
    telecom: list[BillPayment]
    utility: list[BillPayment]
    easypay: list[EasypayMonth]
    socialInsurance: list[SocialInsuranceMonth]


class ScoreRequest(BaseModel):
    """ML-03 N-12-2 점수 계산 요청."""
    requestId: str
    expectedModelVersion: str | None = None
    applicant: Applicant
    inputBaseMonth: str
    incomeMonths: list[IncomeMonth]
    expenses: list[ExpenseItem]
    loans: list[Loan]
    creditProfile: CreditProfile
    alternativeData: AlternativeData


class BaseAssessment(BaseModel):
    requestId: str
    modelVersion: str
    featureSetVersion: str
    featureSnapshot: dict


class SimulateRequest(BaseModel):
    """ML-04 N-18 시뮬레이션 요청 — 저장된 평가의 피처값에서 출발해 바꾼 값만 덮어쓴다."""
    requestId: str
    baseAssessment: BaseAssessment
    applicant: Applicant | None = None
    changes: dict[str, float | None]
