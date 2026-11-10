"""N-05-2 회원 월 입력의 6개월·12개월 집계를 같은 수식으로 만든다."""
import pandas as pd


def aggregate_input_features(monthly, payment, months, window):
    """완결 월별 원천으로 합계·비율·변동성을 계산한다. 누락·중복 소득 월은 0으로 보충하지 않는다."""
    if len(months) != window or len(set(months)) != window or months != sorted(months):
        raise ValueError('months must be a sorted window without duplicates')
    if list(pd.period_range(months[0], months[-1], freq='M').strftime('%Y-%m')) != months:
        raise ValueError('months must be consecutive')
    h = monthly[monthly.month.isin(months)]
    if (h.duplicated(['customer_id', 'month']).any()
            or (h.groupby('customer_id').month.nunique() != window).any()
            or h.customer_id.nunique() != monthly.customer_id.nunique()):
        raise ValueError('every customer needs exactly the input months in monthly_history')
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
