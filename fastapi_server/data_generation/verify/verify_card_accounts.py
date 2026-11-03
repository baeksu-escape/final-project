"""Read-only account-usage reconciliation; requires regenerated thin-file outputs for v3.0.1."""
from pathlib import Path
import numpy as np
import pandas as pd


def validate(directory):
    directory = Path(directory)
    path = directory / 'card_account_monthly.csv'
    if not path.exists():
        raise FileNotFoundError('v3.0.1 card_account_monthly.csv is absent; regenerate thinfile in a separate working copy first')
    a = pd.read_csv(path)
    cards = pd.read_csv(directory / 'cards.csv').set_index('account_id')
    customer = pd.read_csv(directory / 'card_monthly.csv').set_index(['customer_id', 'month_offset'])
    b = pd.read_csv(directory / 'base_207.csv').set_index('식별구분')
    events = pd.read_csv(directory / 'delinquencies.csv')
    assert not a.duplicated(['account_id', 'month_offset']).any()
    assert set(a.account_id) == set(cards.index)
    assert set(zip(a.account_id, a.month_offset)) == {(k, m) for k in cards.index for m in range(12)}
    linked = cards.loc[a.account_id]
    assert np.array_equal(a.customer_id, linked.customer_id)
    assert np.array_equal(a.institution_id, linked.institution_id)
    expected_available = (linked.age_days.to_numpy() > 30*a.month_offset.to_numpy()) & (linked.active.to_numpy() == 1)
    assert np.array_equal(a.available, expected_available.astype(int))
    money = ['single_thousand', 'installment_thousand', 'cash_thousand']
    assert np.isfinite(a[money + ['spend_thousand']]).all().all()
    assert (a[money + ['spend_thousand']] >= 0).all().all()
    assert (a.loc[a.available == 0, money + ['spend_thousand']] == 0).all().all()
    np.testing.assert_allclose(a.spend_thousand, a[money].sum(axis=1), rtol=1e-12, atol=1e-8)
    totals = a.groupby(['customer_id', 'month_offset'])[money + ['spend_thousand']].sum().reindex(customer.index, fill_value=0)
    np.testing.assert_allclose(totals, customer[totals.columns], rtol=1e-12, atol=1e-8)
    latest = a[a.month_offset == 0].set_index('account_id')
    # Account-level reference flags in the ledger (not the definition of the 207 columns).
    qualified = latest.spend_thousand >= 300
    assert np.array_equal(a.qualifies_latest_300, a.account_id.map(qualified).astype(int))
    ordered = a.groupby('account_id', sort=False).spend_thousand.sum().reindex(cards.index)
    chosen = ordered.groupby(cards.customer_id, sort=False).idxmax()
    assert np.array_equal(a.is_main_card, (a.account_id == a.customer_id.map(chosen)).astype(int))
    # v3.0.0 207-column rule: legacy-compatible customer-level synthetic subsets.
    # Exact equality with account flags is NOT expected; check the rule's invariants instead.
    c = customer.reset_index()
    def months(column, window, mask=None):
        frame = c[c.month_offset < window]
        hit = frame[column] > 0 if mask is None else mask(frame)
        return hit.groupby(frame.customer_id).sum().reindex(b.index, fill_value=0)
    active = cards[cards.active == 1].groupby('customer_id').size().reindex(b.index, fill_value=0)
    latest_total = c[c.month_offset == 0].set_index('customer_id').reindex(b.index)
    spend12, single12, cash12 = months('spend_thousand', 12), months('single_thousand', 12), months('cash_thousand', 12)
    plain12 = months(None, 12, lambda f: (f.single_thousand + f.installment_thousand) > 0)
    cash3, cash6 = months('cash_thousand', 3), months('cash_thousand', 6)
    for prefix in ['CF123160', 'CF123260']:
        for suffix, upper in [('1', spend12), ('2', single12), ('4', plain12), ('5', cash12)]:
            assert (b[prefix+suffix] <= upper).all(), prefix+suffix
    for field, upper in [('CF0331605', cash3), ('CF0631605', cash6), ('CF0332605', cash3), ('CF0632605', cash6)]:
        assert (b[field] <= upper).all(), field
    single_card = active <= 1   # main share is applied every month for single-card customers
    for suffix, exact in [('1', spend12), ('2', single12), ('4', plain12), ('5', cash12)]:
        np.testing.assert_array_equal(b.loc[single_card, 'CF123160'+suffix], exact[single_card])
    np.testing.assert_array_equal(b.loc[single_card, 'CF0331605'], cash3[single_card])
    np.testing.assert_array_equal(b.loc[single_card, 'CF0631605'], cash6[single_card])
    not_qualified = latest_total.spend_thousand.fillna(0).to_numpy() < 300
    for field in ['CF1232601', 'CF1232602', 'CF1232604', 'CF1232605', 'CF0332605', 'CF0632605']:
        assert (b.loc[not_qualified, field] == 0).all(), field
    has_cash = latest_total.cash_thousand.fillna(0).to_numpy() > 0
    assert (b.loc[~has_cash, 'CS0000050'] == 0).all()
    assert ((b.loc[has_cash, 'CS0000050'] >= 1) & (b.loc[has_cash, 'CS0000050'] <= active[has_cash])).all()
    # CL0631905: utilization averaged only over windows with an open card.
    util = c.assign(w=c.statement_utilization_pct * c.available)[c.month_offset < 6]
    num = util.groupby('customer_id').w.sum().reindex(b.index, fill_value=0)
    den = c[c.month_offset < 6].groupby('customer_id').available.sum().reindex(b.index, fill_value=0)
    expected_cl = np.round(np.divide(num, den, out=np.zeros(len(b)), where=(den > 0).to_numpy()) * (active > 0).to_numpy(), 2)
    np.testing.assert_allclose(b.CL0631905.to_numpy(), expected_cl, atol=0.011)
    card_events = events[events.account_id.isin(cards.index)]
    usage_index = a.set_index(['account_id', 'month_offset'])
    keys = pd.MultiIndex.from_arrays([card_events.account_id, card_events.start_days_ago // 30])
    assert (usage_index.reindex(keys).spend_thousand.fillna(0) > 0).all()
    return {'status': 'PASS', 'scope': 'account usage, ledger reference flags, v3.0.0 legacy-compatible subset invariants, CS0000050 bounds, CL0631905 open-window mean, card event usage'}


if __name__ == '__main__':
    import argparse, json
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', default=str(Path(__file__).resolve().parents[1]/'thinfile'))
    print(json.dumps(validate(parser.parse_args().data), ensure_ascii=False))
