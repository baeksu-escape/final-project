"""Independent check of input_features_6m.csv (v3.5.7) in data/ and thinfile/. Read-only.

Recomputes every column from monthly_history.csv and digital_payment_monthly.csv with a wide
(customer x month) layout instead of the generator's group-by. 집계 기간은 anchors의
members.model_feature_months_6m(6개월)이고, 회원 입력 기간 members.input_months(v3.5.11부터 12개월) 안에 있어야 한다.
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def main():
    members_cfg = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))['members']
    months = members_cfg['model_feature_months_6m']['value']
    member_months = sorted(members_cfg['input_months']['value'])
    # 모델 집계 달은 회원 입력 달의 마지막 연속 6개월이어야 회원 데이터로 같은 집계를 만들 수 있다.
    assert len(months) == 6 and months == sorted(months) and months[-1] == '2026-08', months
    assert months == member_months[-6:], ('model_feature_months_6m must be the last 6 input_months', months, member_months)
    assert list(pd.period_range(months[0], months[-1], freq='M').strftime('%Y-%m')) == months, ('months must be consecutive', months)
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
        # v3.5.10: 기록(anomaly_log.csv)에 있는 칸은 "기록의 원래 값 = 재계산 값"이고 "파일 값 = 기록의 넣은 값"인지 보고,
        # 원래 값으로 되돌린 표를 기존처럼 정확히 비교한다. 종류·열별 개수는 설정 비율과 맞아야 한다.
        spec = json.loads((ROOT/'reference/anomaly_injection.json').read_text(encoding='utf-8'))
        log = pd.read_csv(d/spec['log_file'], encoding='utf-8-sig')
        assert not log.duplicated(['customer_id', 'column']).any(), (folder, 'one anomaly per cell')
        want = {(r['type'], c): int(len(f) * r['rate']['value'] + 0.5) for r in spec['rules'] for c in r['columns']}
        assert log.groupby(['anomaly_type', 'column']).size().to_dict() == want, (folder, 'anomaly counts')
        factors = {r['type']: r.get('factor', {}).get('value') for r in spec['rules']}
        position = {cid: i for i, cid in enumerate(f.index)}
        restored = f.astype(float)
        for r in log.itertuples():
            i = position[r.customer_id]
            assert float(r.original_value) == float(expect[r.column][i]), (folder, r.customer_id, r.column, 'original value')
            value = f[r.column].iloc[i]
            if r.anomaly_type == 'missing':
                assert pd.isna(value) and pd.isna(r.injected_value), (folder, r.customer_id, r.column, 'missing')
            else:
                assert float(value) == float(r.injected_value) == float(r.original_value) * factors[r.anomaly_type] != 0, (folder, r.customer_id, r.column, r.anomaly_type)
            restored.iloc[i, restored.columns.get_loc(r.column)] = r.original_value
        injected_cells = len(log)
        for c, v in expect.items():
            got = restored[c].to_numpy(dtype=float)
            assert np.array_equal(np.isnan(got), np.isnan(v)), (folder, c, 'null pattern')
            assert np.allclose(got[~np.isnan(v)], v[~np.isnan(v)], rtol=1e-12, atol=0), (folder, c)
        assert (restored.dsr_6m.isna().to_numpy() == (si == 0)).all()
        report[folder] = dict(customers=len(f), zero_income_6m_customers=int((si == 0).sum()),
                              mean_dsr_6m=round(float(f.dsr_6m.mean()), 4), injected_cells=injected_cells)
    report['status'] = 'PASS'
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
