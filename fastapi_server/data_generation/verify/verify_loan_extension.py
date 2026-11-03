"""Read-only verification. Run only during the final validation stage."""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP, localcontext
import hashlib
import json
from collections import defaultdict
import numpy as np
import pandas as pd

R = Path(__file__).resolve().parents[1]
D = R / 'loan_extension'
SCENARIOS = ('baseline', 'rate_plus_2pp')
HORIZONS = (3, 6, 12)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def run():
    if not (D / 'schedule.csv').exists():
        raise SystemExit('schedule.csv가 없습니다. python -m generate.build_loan_extension 실행 후 이 검증기를 실행하세요. 생성기는 대출 원장·스케줄·요약 파일을 덮어씁니다.')
    b = pd.read_csv(R / 'data/base_207.csv').set_index('식별구분')
    legacy = pd.read_csv(D / 'legacy_loans.csv')
    loans = pd.read_csv(D / 'loans.csv', dtype={'annual_rate': str})
    require(loans.account_id.notna().all() and loans.account_id.is_unique, 'loan account key')
    require(loans.rate_type.isin(['fixed', 'variable']).all(), 'rate type')
    # 금리가 소수 4자리(0.01%p) 이하로 고정됐는지 본다. 원장 문자열을 Decimal로 읽어 자릿수를 센다.
    require(all(Decimal(r).as_tuple().exponent >= -4 for r in loans.annual_rate), 'rate precision')
    require((loans.remaining_months > 0).all() and (loans.remaining_months % 1 == 0).all(), 'loan term')
    require((loans.balance_krw >= 0).all() and (loans.balance_krw % 1 == 0).all(), 'loan balance')
    # 상환방식 확률표를 읽어 합이 1인지, 계좌별 배정이 해시로 다시 만든 값과 같은지 본다.
    cfg = json.loads((R / 'reference/repayment_method_assumptions.json').read_text(encoding='utf-8'))
    order = cfg['method_order']
    for kind_code, probs in cfg['kinds'].items():
        require(sum(Decimal(str(probs[m]['value'])) for m in order) == 1, 'repayment probability sum: kind ' + kind_code)
    require(loans.repayment_method.isin(order).all(), 'repayment method value')
    require((loans.repayment_method_basis == cfg['assignment_basis']).all(), 'repayment method basis')
    for loan_row in loans.itertuples():
        u = int(hashlib.sha256((cfg['hash_salt'] + loan_row.account_id).encode()).hexdigest()[:8], 16) / 16 ** 8
        cumulative, chosen = Decimal(0), order[-1]
        for m in order:
            cumulative += Decimal(str(cfg['kinds'][str(int(loan_row.kind))][m]['value']))
            if Decimal(u) < cumulative:
                chosen = m
                break
        require(loan_row.repayment_method == chosen, 'repayment assignment: ' + loan_row.account_id)
    all_l = loans.set_index('account_id')
    for col, source, agg in [('L00000001', 'account_id', 'count'), ('L00000002', 'balance_thousand', 'sum'), ('LRZ021201', 'annual_service_thousand', 'sum'), ('L23003700', 'age_days', 'max')]:
        actual = legacy.groupby('customer_id')[source].agg(agg).reindex(b.index, fill_value=0)
        require(np.array_equal(actual, b[col]), col)
    thin = pd.read_csv(R / 'thinfile/base_207.csv').set_index('식별구분')
    thin_loans = loans[loans.cohort_source == 'thinfile']
    require(set(thin_loans.customer_id).issubset(set(thin.index)), 'unknown thinfile loan customer')
    for col, source, agg in [('L00000001', 'account_id', 'count'), ('L00000002', 'balance_thousand', 'sum'), ('LRZ021201', 'annual_service_thousand', 'sum'), ('L23003700', 'age_days', 'max')]:
        actual = thin_loans.groupby('customer_id')[source].agg(agg).reindex(thin.index, fill_value=0)
        require(np.array_equal(actual, thin[col]), 'thinfile_' + col)
    s = pd.read_csv(D / 'schedule.csv', dtype={'annual_rate': str, 'month': str})
    require(s.notna().all().all(), 'null schedule field')
    keys = ['account_id', 'scenario', 'month_index']
    require(not s.duplicated(keys).any(), 'duplicate schedule key')
    expected_keys = {(a, c) for a in all_l.index for c in SCENARIOS}
    require(set(zip(s.account_id, s.scenario)) == expected_keys, 'account/scenario coverage')
    integer_cols = ['month_index', 'opening_balance_krw', 'principal_krw', 'interest_krw', 'payment_krw', 'closing_balance_krw']
    for col in integer_cols:
        require((s[col] >= 0).all() and (s[col] % 1 == 0).all(), 'nonnegative integer: ' + col)
    s = s.sort_values(keys).reset_index(drop=True)
    for (account, scenario), group in s.groupby(['account_id', 'scenario'], sort=False):
        loan = all_l.loc[account]
        n = int(loan.remaining_months)
        require(group.month_index.tolist() == list(range(1, n + 1)), 'term/sequence: ' + account)
        require((group.customer_id == loan.customer_id).all(), 'customer ownership: ' + account)
        start = pd.Period(loan.schedule_start, freq='M')
        require(group.month.tolist() == [str(start + i) for i in range(n)], 'calendar month: ' + account)
        rate = Decimal(loan.annual_rate)
        require(rate.is_finite() and rate >= 0, 'invalid loan rate: ' + account)
        if scenario == 'rate_plus_2pp' and loan.rate_type == 'variable':
            rate += Decimal('0.02')
        balance = int(loan.balance_krw)
        method = loan.repayment_method
        quotient, remainder = divmod(balance, n)
        monthly = rate / 12
        level_payment = None
        if method == 'equal_payment':
            # 원리금균등 월 납입액을 생성 함수와 별개로 계산한다(닫힌 식, 원 단위 ROUND_HALF_UP).
            with localcontext() as ctx:
                ctx.prec = 60
                level_payment = int((Decimal(balance) / n if monthly == 0 else Decimal(balance) * monthly / (1 - (1 + monthly) ** -n)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        for row in group.itertuples():
            require(Decimal(row.annual_rate) == rate, 'scenario rate: ' + account)
            last = row.month_index == n
            if method == 'equal_principal':
                principal = quotient + (row.month_index <= remainder)
            elif method == 'bullet':
                principal = balance if last else 0
            else:
                principal = balance if last else min(max(level_payment - int((Decimal(balance) * rate / 12).quantize(Decimal('1'), rounding=ROUND_HALF_UP)), 0), balance)
            interest = int((Decimal(balance) * rate / 12).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
            require(row.opening_balance_krw == balance, 'opening/continuity: ' + account)
            require(row.principal_krw == principal, method + ' principal: ' + account)
            if method == 'equal_payment' and not last:
                require(row.payment_krw == level_payment or principal == balance, 'equal payment constant: ' + account)
            require(row.interest_krw == interest, 'interest/rounding: ' + account)
            require(row.payment_krw == principal + interest, 'payment: ' + account)
            balance -= principal
            require(row.closing_balance_krw == balance, 'closing balance: ' + account)
        require(balance == 0 and group.principal_krw.sum() == loan.balance_krw, 'payoff/conservation: ' + account)
    fixed = set(all_l.index[all_l.rate_type == 'fixed'])
    a = s[(s.scenario == 'baseline') & s.account_id.isin(fixed)].drop(columns='scenario').reset_index(drop=True)
    c = s[(s.scenario == 'rate_plus_2pp') & s.account_id.isin(fixed)].drop(columns='scenario').reset_index(drop=True)
    pd.testing.assert_frame_equal(a, c, check_exact=True)
    ids = pd.concat([pd.read_csv(R / 'data/profiles.csv')[['customer_id', 'annual_income_krw']], pd.read_csv(R / 'thinfile/profiles.csv')[['customer_id', 'annual_income_krw']]], ignore_index=True)
    require(ids.customer_id.is_unique, 'profile customer key')
    require(set(loans.customer_id).issubset(set(ids.customer_id)), 'unknown loan customer')
    # Independently accumulate each validated schedule row into the three declared horizons.
    # The generator uses pandas customer-level groupby; this row-wise oracle also checks full key coverage.
    horizon_totals = defaultdict(int)
    for row in s.itertuples():
        if row.month_index <= max(HORIZONS):
            for horizon in HORIZONS:
                if row.month_index <= horizon:
                    horizon_totals[(row.customer_id, row.scenario, horizon)] += int(row.payment_krw)
    hkeys = ['customer_id', 'scenario', 'horizon_months']
    expected_keys = {(cid, scenario, horizon) for cid in ids.customer_id for scenario in SCENARIOS for horizon in HORIZONS}
    require(len(expected_keys) == len(ids) * len(SCENARIOS) * len(HORIZONS), 'expected horizon key construction')
    rows = []
    income_by_customer = ids.set_index('customer_id').annual_income_krw
    for customer_id, scenario, horizon in sorted(expected_keys):
        rows.append({
            'customer_id': customer_id,
            'annual_income_krw': income_by_customer.loc[customer_id],
            'scenario': scenario,
            'horizon_months': horizon,
            'scheduled_service_krw': horizon_totals.get((customer_id, scenario, horizon), 0),
        })
    expected = pd.DataFrame(rows)
    saved = pd.read_csv(D / 'customer_horizons.csv')
    require(not saved.duplicated(hkeys).any(), 'duplicate horizon key')
    require(set(map(tuple, saved[hkeys].itertuples(index=False, name=None))) == expected_keys, 'horizon key coverage')
    pd.testing.assert_frame_equal(saved.sort_values(hkeys).reset_index(drop=True), expected.sort_values(hkeys).reset_index(drop=True), check_exact=True, check_like=True)
    print(json.dumps({'status': 'PASS', 'validator_version': '3.0.0', 'schedule_rows': len(s), 'accounts': len(loans), 'customer_horizon_rows': len(expected), 'checks': ['legacy_aggregates', 'thinfile_aggregates', 'key_coverage', 'unique_keys', 'term_sequence', 'calendar_months', 'customer_ownership', 'rate_precision', 'repayment_probability_sum', 'repayment_assignment', 'repayment_method_rules', 'scenario_rates', 'equal_principal', 'decimal_interest_rounding', 'payment_balance_continuity', 'payoff_conservation', 'fixed_rate_unchanged', 'horizon_key_coverage', 'saved_horizons_comparison'], 'writes_files': False}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    run()
