"""Independent check of input_features_6m.csv (v3.5.7) in data/ and thinfile/. Read-only.

Recomputes every column from monthly_history.csv and digital_payment_monthly.csv with a wide
(customer x month) layout instead of the generator's group-by, and checks that the window equals
the member input months in reference/service_dummy_anchors.json.
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def main():
    months = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))['members']['input_months']['value']
    assert len(months) == 6 and months == sorted(months) and months[-1] == '2026-08', months
    report = {'window': f'{months[0]}~{months[-1]}'}
    for folder in ('data', 'thinfile'):
        d = ROOT/folder
        f = pd.read_csv(d/'input_features_6m.csv', encoding='utf-8-sig').set_index('customer_id')
        h = pd.read_csv(d/'monthly_history.csv', encoding='utf-8-sig')
        prof = pd.read_csv(d/'profiles.csv', encoding='utf-8-sig')
        assert f.index.is_unique and set(f.index) == set(prof.customer_id), folder
        w = lambda col: h.pivot(index='customer_id', columns='month', values=col)[months].loc[f.index].to_numpy(dtype=float)
        inc, exp, debt = w('income_krw'), w('expense_total_krw'), w('debt_service_krw')
        net = inc - exp - debt
        assert np.array_equal(net, w('net_cash_krw')), 'entered fields must reproduce the saved monthly net cash'
        si = inc.sum(1)
        ratio = lambda a: np.where(si > 0, a / np.where(si > 0, si, 1), np.nan)
        pay = pd.read_csv(d/'digital_payment_monthly.csv', encoding='utf-8-sig')
        dp = pay[pay.month.isin(months)].pivot(index='customer_id', columns='month', values='payment_amount_krw').reindex(f.index).fillna(0).to_numpy().sum(1)
        mean = inc.mean(1)
        expect = dict(income_6m_krw=si, expense_6m_krw=exp.sum(1), debt_service_6m_krw=debt.sum(1),
                      expense_ratio_6m=ratio(exp.sum(1)), dsr_6m=ratio(debt.sum(1)),
                      income_cv_6m=np.where(mean > 0, inc.std(1) / np.where(mean > 0, mean, 1), np.nan),
                      zero_income_months_6m=(inc == 0).sum(1), deficit_months_6m=(net < 0).sum(1),
                      worst_month_net_cash_6m_krw=net.min(1), dp_payment_amount_6m_krw=dp, dp_amount_to_income_6m=ratio(dp))
        for c, v in expect.items():
            got = f[c].to_numpy(dtype=float)
            assert np.array_equal(np.isnan(got), np.isnan(v)), (folder, c, 'null pattern')
            assert np.allclose(got[~np.isnan(v)], v[~np.isnan(v)], rtol=1e-12, atol=0), (folder, c)
        assert (f.dsr_6m.isna() == (f.income_6m_krw == 0)).all()
        report[folder] = dict(customers=len(f), zero_income_6m_customers=int((f.income_6m_krw == 0).sum()),
                              mean_dsr_6m=round(float(f.dsr_6m.mean()), 4))
    report['status'] = 'PASS'
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
