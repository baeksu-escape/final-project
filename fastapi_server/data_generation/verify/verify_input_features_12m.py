"""N-12 기본 모델 입력 input_features_12m.csv 독립 검증 (v3.5.13) in data/ and thinfile/. Read-only.

Recomputes every column from monthly_history.csv and digital_payment_monthly.csv with a wide
(customer x month) layout instead of the generator's group-by. 집계 기간은 anchors의
members.model_feature_months(12개월)이고, 회원 입력 기간 members.input_months(v3.5.11부터 12개월) 안에 있어야 한다.
v3.6.0: 서비스 정의 열(*_svc_12m, expense_avg_month_krw, debt_service_current_krw)도 같은 원천에서 따로 다시 계산하고
별도 기록 anomaly_log_12m_svc.csv로 복원해 대조한다. 급여소득자 소득은 기준월(마지막 달) 소득 x 12개월이다.
"""
from pathlib import Path
import json
from decimal import Decimal, ROUND_HALF_UP
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def restore(f, log_path, spec, expect, folder):
    """주입 기록의 원래 값·넣은 값·건수를 확인하고 원래 값으로 되돌린 표를 돌려준다."""
    log = pd.read_csv(log_path, encoding='utf-8-sig')
    assert not log.duplicated(['customer_id', 'column']).any(), (folder, 'one anomaly per cell')
    want = {(r['type'], c): int(len(f) * r['rate']['value'] + 0.5) for r in spec['rules'] for c in r['columns']}
    assert log.groupby(['anomaly_type', 'column']).size().to_dict() == want, (folder, 'anomaly counts', log_path.name)
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
    return restored, len(log)


def main():
    """N-12 기본 12개월 피처를 독립 재계산하고 주입 기록을 원래 값으로 복원해 검사한다."""
    members_cfg = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))['members']
    months = members_cfg['model_feature_months']['value']
    member_months = sorted(members_cfg['input_months']['value'])
    # 모델 집계 달은 회원 입력 달의 마지막 연속 12개월이어야 회원 데이터로 같은 집계를 만들 수 있다.
    assert len(months) == 12 and months == sorted(months) and months[-1] == '2026-08', months
    assert months == member_months, ('model_feature_months must equal all 12 input_months', months, member_months)
    assert list(pd.period_range(months[0], months[-1], freq='M').strftime('%Y-%m')) == months, ('months must be consecutive', months)
    report = {'window': f'{months[0]}~{months[-1]}'}
    for folder in ('data', 'thinfile'):
        d = ROOT/folder
        f = pd.read_csv(d/'input_features_12m.csv', encoding='utf-8-sig').set_index('customer_id')
        h = pd.read_csv(d/'monthly_history.csv', encoding='utf-8-sig')
        prof = pd.read_csv(d/'profiles.csv', encoding='utf-8-sig')
        assert f.index.is_unique and set(f.index) == set(prof.customer_id), folder
        w = lambda col: h.pivot(index='customer_id', columns='month', values=col)[months].loc[f.index].to_numpy(dtype=float)
        inc, exp, debt = w('income_krw'), w('expense_total_krw'), w('debt_service_krw')
        assert np.isfinite(inc).all() and np.isfinite(exp).all() and np.isfinite(debt).all(), 'observed monthly amounts required'
        net = inc - exp - debt
        assert np.array_equal(net, w('net_cash_krw')), 'entered fields must reproduce the saved monthly net cash'
        si = inc.sum(1)
        profile = prof.set_index('customer_id').loc[f.index]
        assert np.array_equal(si, profile.annual_income_krw.to_numpy()), (folder, 'profile annual income')
        assert np.array_equal(debt.sum(1), profile.annual_debt_service_krw.to_numpy()), (folder, 'profile annual debt service')
        ratio = lambda a: np.where(si > 0, a / np.where(si > 0, si, 1), np.nan)
        pay = pd.read_csv(d/'digital_payment_monthly.csv', encoding='utf-8-sig')
        dp = pay[pay.month.isin(months)].pivot(index='customer_id', columns='month', values='payment_amount_krw').reindex(f.index).fillna(0).to_numpy().sum(1)
        mean = inc.mean(1)
        expect = dict(income_12m_krw=si, expense_12m_krw=exp.sum(1), debt_service_12m_krw=debt.sum(1),
                      expense_ratio_12m=ratio(exp.sum(1)), dsr_12m=ratio(debt.sum(1)),
                      income_cv_12m=np.where(mean > 0, inc.std(1) / np.where(mean > 0, mean, 1), np.nan),
                      zero_income_months_12m=(inc == 0).sum(1), deficit_months_12m=(net < 0).sum(1),
                      worst_month_net_cash_12m_krw=net.min(1), dp_payment_amount_12m_krw=dp, dp_amount_to_income_12m=ratio(dp))
        # v3.5.13: 독립 12개월 기록의 원래 값·넣은 값을 대조한다.
        # 원래 값으로 되돌린 표를 기존처럼 정확히 비교한다. 종류·열별 개수는 설정 비율과 맞아야 한다.
        spec = json.loads((ROOT/'reference/anomaly_injection_12m.json').read_text(encoding='utf-8'))
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
        assert (restored.dsr_12m.isna().to_numpy() == (si == 0)).all()
        # v3.6.0 서비스 정의 열: 원천 월자료를 다른 방식(넓은 표 + 직군 마스크)으로 다시 계산한다.
        seg = profile.segment.to_numpy()
        wage = seg == 'wage'
        sinc = inc.copy()
        sinc[wage] = inc[wage][:, [-1]]                          # 기준월 = 마지막 달 (TODO: 급여 기준월 팀 확인)
        # v3.6.0: ROUND_HALF_UP를 Decimal로 따로 계산한다(생성기는 정수 산술).
        exp_avg = np.array([float((Decimal(int(v)) / 12).quantize(Decimal(1), rounding=ROUND_HALF_UP)) for v in exp.sum(1)])
        debt_now = debt[:, -1]
        st = sinc.sum(1)
        sratio = lambda a: np.where(st > 0, a / np.where(st > 0, st, 1), np.nan)
        snet = sinc - (exp_avg + debt_now)[:, None]
        smean = sinc.mean(1)
        svc_expect = dict(income_svc_12m_krw=st, income_cv_svc_12m=np.where(smean > 0, sinc.std(1) / np.where(smean > 0, smean, 1), np.nan),
                          zero_income_months_svc_12m=(sinc == 0).sum(1), expense_avg_month_krw=exp_avg, debt_service_current_krw=debt_now,
                          expense_ratio_svc_12m=sratio(exp_avg * 12), dsr_svc_12m=sratio(debt_now * 12),
                          deficit_months_svc_12m=(snet < 0).sum(1), worst_month_net_cash_svc_12m_krw=snet.min(1))
        svc_spec = json.loads((ROOT/'reference/anomaly_injection_12m_svc.json').read_text(encoding='utf-8'))
        assert svc_spec['seed']['value'] != spec['seed']['value'] and svc_spec['log_file'] != spec['log_file']
        assert not set(c for r in svc_spec['rules'] for c in r['columns']) & set(expect), 'svc injection must not touch existing columns'
        assert list(f.columns[-len(svc_expect):]) == list(svc_expect), (folder, 'svc columns appended after existing columns')
        srestored, svc_cells = restore(f, d/svc_spec['log_file'], svc_spec, svc_expect, folder)
        for c, v in svc_expect.items():
            got = srestored[c].to_numpy(dtype=float)
            assert np.array_equal(np.isnan(got), np.isnan(v)), (folder, c, 'null pattern')
            assert np.allclose(got[~np.isnan(v)], v[~np.isnan(v)], rtol=1e-12, atol=0), (folder, c)
        assert np.all(srestored.income_cv_svc_12m.to_numpy()[wage & (st > 0)] == 0), (folder, 'wage income is flat')
        assert np.array_equal(st[~wage], si[~wage]), (folder, 'non-wage income unchanged')
        report[folder] = dict(customers=len(f), zero_income_12m_customers=int((si == 0).sum()),
                              mean_dsr_12m=round(float(f.dsr_12m.mean()), 4), injected_cells=injected_cells,
                              svc_injected_cells=svc_cells, mean_dsr_svc_12m=round(float(f.dsr_svc_12m.mean()), 4),
                              mean_deficit_months_12m=round(float(srestored.deficit_months_12m.mean()), 3),
                              mean_deficit_months_svc_12m=round(float(srestored.deficit_months_svc_12m.mean()), 3),
                              wage_mean_income_cv_12m=round(float(srestored.income_cv_12m.to_numpy()[wage].mean()), 4))
    report['status'] = 'PASS'
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
