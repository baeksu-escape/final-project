"""N-05-2 회원 월 입력의 6개월·12개월 집계를 같은 수식으로 만든다. v3.6.0: 서비스 입력 규칙과 같은 정의의 피처를 추가했다."""
import pandas as pd


def check_window(monthly, months, window):
    """집계 기간이 정렬된 연속 월인지, 모든 고객에게 그 달이 정확히 한 번씩 있는지 확인하고 기간 안의 행을 돌려준다."""
    if len(months) != window or len(set(months)) != window or months != sorted(months):
        raise ValueError('months must be a sorted window without duplicates')
    if list(pd.period_range(months[0], months[-1], freq='M').strftime('%Y-%m')) != months:
        raise ValueError('months must be consecutive')
    h = monthly[monthly.month.isin(months)]
    if (h.duplicated(['customer_id', 'month']).any()
            or (h.groupby('customer_id').month.nunique() != window).any()
            or h.customer_id.nunique() != monthly.customer_id.nunique()):
        raise ValueError('every customer needs exactly the input months in monthly_history')
    return h


def aggregate_input_features(monthly, payment, months, window):
    """완결 월별 원천으로 합계·비율·변동성을 계산한다. 누락·중복 소득 월은 0으로 보충하지 않는다."""
    h = check_window(monthly, months, window)
    net = h.income_krw - h.expense_total_krw - h.debt_service_krw
    g = h.assign(net=net).groupby('customer_id')
    inc, exp, debt = g.income_krw.sum(), g.expense_total_krw.sum(), g.debt_service_krw.sum()
    mean = g.income_krw.mean()
    safe = lambda s: s.where(s > 0)
    dp = payment[payment.month.isin(months)].groupby('customer_id').payment_amount_krw.sum().reindex(inc.index, fill_value=0)
    suffix = f'{window}m'
    return pd.DataFrame({
        f'income_{suffix}_krw': inc, f'expense_{suffix}_krw': exp, f'debt_service_{suffix}_krw': debt,
        f'expense_ratio_{suffix}': exp / safe(inc), f'dsr_{suffix}': debt / safe(inc),
        f'income_cv_{suffix}': g.income_krw.std(ddof=0) / safe(mean),
        f'zero_income_months_{suffix}': g.income_krw.apply(lambda x: int((x == 0).sum())),
        f'deficit_months_{suffix}': g.net.apply(lambda x: int((x < 0).sum())),
        f'worst_month_net_cash_{suffix}_krw': g.net.min(),
        f'dp_payment_amount_{suffix}_krw': dp.astype('int64'),
        f'dp_amount_to_income_{suffix}': dp / safe(inc),
    }).reset_index()


def service_view_features(monthly, segments, months):
    """N-05-2·N-12 v3.6.0 서비스 입력 규칙과 같은 정의의 12개월 피처를 만든다.
    지출은 12개월 평균 월 지출 하나, 상환은 기준월(마지막 달) 상환액 하나로 보고, 급여소득자 소득은 기준월 소득을 12개월로 펼친다."""
    window = len(months)
    h = check_window(monthly, months, window)
    wide = lambda col: h.pivot(index='customer_id', columns='month', values=col)[months]
    inc, exp, debt = wide('income_krw'), wide('expense_total_krw'), wide('debt_service_krw')
    seg = segments.set_index('customer_id').segment.reindex(inc.index)
    if seg.isna().any():
        raise ValueError('every customer needs a segment')
    base = months[-1]                                            # TODO(급여 기준월): 팀 확인 전 임시로 원천 마지막 달
    wage = (seg == 'wage').to_numpy()
    inc = inc.copy()
    inc.loc[wage, :] = inc.loc[wage, [base]].to_numpy().repeat(window, axis=1)
    # v3.6.0: 평균 월 지출은 규칙으로 계산하는 금융 값이라 ROUND_HALF_UP(v3.5.8 규칙, DB 시드·Java·Oracle ROUND와 같음).
    # 지출은 음이 아닌 정수 합계이므로 floor((2 x 합계 + 기간) / (2 x 기간))가 정확히 .5에서 올림이다.
    total_exp = exp.sum(axis=1).astype('int64')
    if (total_exp < 0).any():
        raise ValueError('expense must be non-negative')
    exp_avg = ((2 * total_exp + window) // (2 * window)).astype('int64')
    debt_now = debt[base].astype('int64')
    total = inc.sum(axis=1)
    safe = lambda s: s.where(s > 0)
    net = inc.sub(exp_avg + debt_now, axis=0)
    mean = inc.mean(axis=1)
    suffix = f'svc_{window}m'
    return pd.DataFrame({
        f'income_{suffix}_krw': total.astype('int64'),
        f'income_cv_{suffix}': inc.std(axis=1, ddof=0) / safe(mean),
        f'zero_income_months_{suffix}': (inc == 0).sum(axis=1).astype('int64'),
        'expense_avg_month_krw': exp_avg,
        'debt_service_current_krw': debt_now,
        f'expense_ratio_{suffix}': exp_avg * window / safe(total),
        f'dsr_{suffix}': debt_now * window / safe(total),
        f'deficit_months_{suffix}': (net < 0).sum(axis=1).astype('int64'),
        f'worst_month_net_cash_{suffix}_krw': net.min(axis=1).astype('int64'),
    }).rename_axis('customer_id').reset_index()
