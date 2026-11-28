"""N-12-2 v3.7.0 연체 라벨의 순수 계산 함수. 파일 입출력과 생성기 호출은 없다.

logit_i = a + 원본 logit_i + sum(log(승산비_k) / 단위_k * 효과 항목 값_ik)
원본 logit은 카드 위험·연체 건수·대출 건수·잡음이다. a는 평균 확률이 원래 라벨의 양성 비율과 같게 맞춘다.
설정: reference/delinquency_label.json
"""
import numpy as np
import pandas as pd

# 효과 이름 → 필요한 입력 열
REQUIRED = ['annual_income_krw', 'annual_debt_service_krw', 'debt_balance_krw', 'expense_ratio', 'deficit_months',
            'zero_income_months', 'CL0631905', 'LA0099212', 'L22000900', 'CF1231605']


def effect_values(frame):
    """고객별 효과 항목 값(자르기 전)을 표로 돌려준다. 카드 사용률 결측만 0으로 두고, 다른 열의 결측은 오류다."""
    missing = [c for c in REQUIRED if c not in frame.columns]
    if missing:
        raise ValueError(f'missing columns: {missing}')
    nulls = [c for c in REQUIRED if c != 'CL0631905' and frame[c].isna().any()]
    if nulls:
        raise ValueError(f'null values: {nulls}')
    income = frame.annual_income_krw.to_numpy(float)
    if (income <= 0).any():
        raise ValueError('annual income must be positive')
    return pd.DataFrame(dict(
        dsr=frame.annual_debt_service_krw.to_numpy(float) / income,
        balance_to_income=frame.debt_balance_krw.to_numpy(float) / income,
        expense_ratio=frame.expense_ratio.to_numpy(float),
        deficit_months=frame.deficit_months.to_numpy(float),
        zero_income_months=frame.zero_income_months.to_numpy(float),
        log2_income=np.log2(income / np.median(income)),
        card_utilization=np.nan_to_num(frame.CL0631905.to_numpy(float), nan=0.0),
        private_lender=(frame.LA0099212.to_numpy(float) > 0).astype(float),
        new_loans_90d=frame.L22000900.to_numpy(float),
        cash_advance=frame.CF1231605.to_numpy(float),
    ), index=frame.index)


def effect_logit(frame, effects):
    """설정의 효과마다 값을 min~max로 자른 뒤 log(승산비)/단위를 곱해 더한다."""
    values = effect_values(frame)
    total = np.zeros(len(frame))
    for e in effects:
        v = values[e['name']].to_numpy()
        if 'min' in e or 'max' in e:
            v = np.clip(v, e.get('min', -np.inf), e.get('max', np.inf))
        total += np.log(e['odds_ratio']) / e['per'] * v
    return total


def noiseless_original_logit(risk, delinquency_count, loan_count, formula):
    """원본 생성기의 예측 가능한 부분(잡음 제외)."""
    return (formula['risk'] * np.asarray(risk, float) + formula['DQ1200001'] * np.asarray(delinquency_count, float)
            + formula['log1p_loan_count'] * np.log1p(np.asarray(loan_count, float)))


def logit_from_probability(p):
    """설계 확률을 logit으로 되돌린다(씬파일). 0과 1은 잘라서 무한대를 막는다."""
    p = np.clip(np.asarray(p, float), 1e-12, 1 - 1e-12)
    return np.log(p / (1 - p))
