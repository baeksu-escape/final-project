"""6-month aggregates of the figures a service member enters (income, living expense, debt service), for both cohorts.

v3.5.7. Members enter only the latest 6 complete months (reference/service_dummy_anchors.json
members.input_months), so the model table uses these aggregates instead of the 12-month ones in
profiles.csv. Reads monthly_history.csv and digital_payment_monthly.csv; writes input_features_6m.csv
next to them. Does not change any other file. Run after build_nonfinancial_sources.
"""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ['customer_id', 'income_6m_krw', 'expense_6m_krw', 'debt_service_6m_krw', 'expense_ratio_6m', 'dsr_6m',
           'income_cv_6m', 'zero_income_months_6m', 'deficit_months_6m', 'worst_month_net_cash_6m_krw',
           'dp_payment_amount_6m_krw', 'dp_amount_to_income_6m']


def input_months():
    a = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))
    return a['members']['input_months']['value']


def input_features_6m(monthly, payment, months):
    """Aggregates over `months` from the three entered fields only. Net cash is recomputed as
    income - expense - debt service (what a member's inputs allow). Ratios are null when income is 0."""
    h = monthly[monthly.month.isin(months)]
    if (h.groupby('customer_id').month.nunique() != len(months)).any() or h.customer_id.nunique() != monthly.customer_id.nunique():
        raise ValueError('every customer needs exactly the input months in monthly_history')
    net = h.income_krw - h.expense_total_krw - h.debt_service_krw
    g = h.assign(net=net).groupby('customer_id')
    inc, exp, debt = g.income_krw.sum(), g.expense_total_krw.sum(), g.debt_service_krw.sum()
    mean = g.income_krw.mean()
    safe = lambda s: s.where(s > 0)
    dp = payment[payment.month.isin(months)].groupby('customer_id').payment_amount_krw.sum().reindex(inc.index, fill_value=0)
    f = pd.DataFrame(dict(
        income_6m_krw=inc, expense_6m_krw=exp, debt_service_6m_krw=debt,
        expense_ratio_6m=exp / safe(inc), dsr_6m=debt / safe(inc),
        income_cv_6m=g.income_krw.std(ddof=0) / safe(mean),
        zero_income_months_6m=g.income_krw.apply(lambda x: int((x == 0).sum())),
        deficit_months_6m=g.net.apply(lambda x: int((x < 0).sum())),
        worst_month_net_cash_6m_krw=g.net.min(),
        dp_payment_amount_6m_krw=dp.astype('int64'),
        dp_amount_to_income_6m=dp / safe(inc)))
    return f.reset_index()[COLUMNS]


def run(folders=('data', 'thinfile')):
    months = input_months()
    for folder in folders:
        d = ROOT/folder
        monthly = pd.read_csv(d/'monthly_history.csv', encoding='utf-8-sig')
        payment = pd.read_csv(d/'digital_payment_monthly.csv', encoding='utf-8-sig')
        f = input_features_6m(monthly, payment, months)
        f.to_csv(d/'input_features_6m.csv', index=False, encoding='utf-8-sig')
        print(f'{folder}/input_features_6m.csv: {len(f)} customers, months {months[0]}~{months[-1]}')


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    run()
