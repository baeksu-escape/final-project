"""Pure functions for service dummy data (loan products, members, external API).

No file IO here. Callers pass data frames, anchors and a numpy Generator, so the
logic can be checked with small fixtures without running the synthetic generators.
"""
import numpy as np
import pandas as pd

SEGMENTS = ('wage', 'selfemp', 'freelance')
SECTOR_NAMES = {0: '은행', 1: '카드', 2: '저축은행', 3: '캐피탈', 4: '대부', 5: '상호금융', 6: '보험'}
LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


# ---------------------------------------------------------------- loan products
def expand_loan_products(anchors, rng):
    """One row per dummy product. Rates in percent, amounts in KRW."""
    cap = float(anchors['legal_max_rate_pct']['value'])
    rates = anchors['rate_anchors_pct']
    jitter = anchors['product_jitter']
    step = int(jitter['limit_round_krw'])
    rows = []
    provider_counter = {}
    for t in anchors['product_templates']:
        anchor = rates[t['rate_anchor']]
        base = float(anchor['value'])
        for k in range(int(t['n_products'])):
            j = provider_counter.get(t['provider_prefix'], 0)
            provider_counter[t['provider_prefix']] = j + 1
            lo = base - t['spread_down_pp'] + rng.uniform(-jitter['rate_pp'], jitter['rate_pp'])
            hi = base + t['spread_up_pp'] + rng.uniform(-jitter['rate_pp'], jitter['rate_pp'])
            lo = round(min(max(lo, 0.1), base), 2)          # range must contain the anchor
            hi = round(min(max(hi, base), cap), 2)          # and never exceed the legal cap
            lim_lo = int(t['limit_min_krw'])
            lim_hi = int(max(lim_lo, round(t['limit_max_krw'] * rng.uniform(.7, 1.0) / step) * step))
            rows.append(dict(
                product_id=f"LP{len(rows)+1:03d}",
                provider_name=f"{t['provider_prefix']} {LETTERS[j % 26]}",
                sector=int(t['sector']), sector_name=SECTOR_NAMES[int(t['sector'])],
                product_type=t['product_type'],
                rate_min_pct=lo, rate_max_pct=hi, rate_anchor_pct=base,
                rate_anchor_basis=anchor['basis'], rate_anchor_as_of=anchor.get('as_of', ''),
                limit_min_krw=lim_lo, limit_max_krw=lim_hi,
                term_min_months=int(t['term_months'][0]), term_max_months=int(t['term_months'][1]),
                eligible_segments='|'.join(t['eligible_segments']),
                income_multiple_cap='' if t['income_multiple_cap'] is None else float(t['income_multiple_cap']),
                is_dummy=1, basis=t['basis'], as_of_date=anchors['as_of_date']))
    return pd.DataFrame(rows)


def check_loan_products(p, anchors):
    cap = float(anchors['legal_max_rate_pct']['value'])
    errors = []
    if p.product_id.duplicated().any(): errors.append('duplicate product_id')
    if not ((p.rate_min_pct > 0) & (p.rate_min_pct <= p.rate_anchor_pct) & (p.rate_anchor_pct <= p.rate_max_pct) & (p.rate_max_pct <= cap)).all():
        errors.append('rate range must satisfy 0 < min <= anchor <= max <= legal cap')
    if not (p.limit_min_krw <= p.limit_max_krw).all(): errors.append('limit_min > limit_max')
    if not ((p.term_min_months >= 1) & (p.term_min_months <= p.term_max_months)).all(): errors.append('bad term range')
    if not p.eligible_segments.map(lambda s: bool(s) and set(s.split('|')) <= set(SEGMENTS)).all(): errors.append('unknown segment')
    if not p.provider_name.str.startswith('가상').all(): errors.append('provider must be fictional (가상 prefix)')
    if not p.sector.isin(list(SECTOR_NAMES)).all(): errors.append('unknown sector code')
    if not (p.is_dummy == 1).all(): errors.append('is_dummy must be 1')
    return errors


# ---------------------------------------------------------------------- members
def member_id_map(source_ids, prefix):
    return {cid: f'{prefix}{i+1:06d}' for i, cid in enumerate(source_ids)}


def make_members(profiles, ages, cfg, as_of, rng):
    """profiles: source customer_id, segment. ages: source customer_id -> age."""
    as_of = pd.Timestamp(as_of)
    ids = member_id_map(profiles.customer_id, cfg['id_prefix'])
    start = pd.Timestamp(cfg['signup_start'])
    span = (as_of - start).days
    n = len(profiles)
    signup = start + pd.to_timedelta(rng.integers(0, span + 1, n), unit='D')
    consent = rng.random(n) < cfg['external_consent_probability']['value']
    m = pd.DataFrame(dict(
        member_id=profiles.customer_id.map(ids).to_numpy(),
        email=[f"{ids[c].lower()}@{cfg['email_domain']}" for c in profiles.customer_id],
        nickname=[f'회원{i+1:05d}' for i in range(n)],
        age=profiles.customer_id.map(ages).astype(int).to_numpy(),
        segment=profiles.segment.to_numpy(),
        signup_date=signup.strftime('%Y-%m-%d'),
        external_data_consent=consent.astype(int),
        is_dummy=1))
    m['birth_year'] = as_of.year - m.age
    return m, ids


def make_monthly_inputs(monthly, members, ids, cfg, as_of, rng):
    """Member-entered monthly figures with the date each month was entered.
    cfg['input_months']의 달만 남긴다. v3.5.11부터 최근 완결 12개월이다(v3.5.7~v3.5.10은 6개월).
    입력일은 원천의 모든 달에 대해 먼저 뽑으므로 기간을 바꿔도 남는 달의 입력일은 같다."""
    as_of = pd.Timestamp(as_of)
    mm = monthly[monthly.customer_id.isin(ids)].copy()
    mm['member_id'] = mm.customer_id.map(ids)
    signup = pd.to_datetime(mm.member_id.map(members.set_index('member_id').signup_date))
    month_end = pd.PeriodIndex(mm.month, freq='M').to_timestamp(how='end').normalize()
    d = cfg['input_delay_days']
    natural = month_end + pd.to_timedelta(rng.integers(d['min'], d['max'] + 1, len(mm)), unit='D')
    entered = np.maximum(natural.to_numpy(), signup.to_numpy())           # backfilled at signup
    entered = np.minimum(entered, np.datetime64(as_of))
    mm['input_date'] = pd.to_datetime(entered).strftime('%Y-%m-%d')
    cols = ['member_id', 'month', 'income_krw', 'expense_total_krw', 'debt_service_krw', 'input_date']
    mm = mm[mm.month.isin(cfg['input_months']['value'])]
    return mm[cols].reset_index(drop=True)


def remap_ledger(frame, ids, account_prefix_col='account_id'):
    """Replace source customer IDs (also embedded in account IDs) with member IDs."""
    f = frame[frame.customer_id.isin(ids)].copy()
    if account_prefix_col in f:
        f[account_prefix_col] = [ids[c] + a[len(c):] for c, a in zip(f.customer_id, f[account_prefix_col])]
    f['customer_id'] = f.customer_id.map(ids)
    return f.rename(columns={'customer_id': 'member_id'}).reset_index(drop=True)


def make_v02_asset_snapshots(profiles, ids, base_month):
    """N-05-4 v0.2용 회원 자산 스냅샷만 추가한다. 기존 회원·원장 출력과 난수 소비는 바꾸지 않는다."""
    source = profiles[profiles.customer_id.isin(ids)]
    if source.customer_id.duplicated().any() or len(source) != len(ids):
        raise ValueError('v0.2 asset source must cover each member exactly once')
    values = source.asset_total_krw
    if values.isna().any() or (values < 0).any() or (values % 1 != 0).any():
        raise ValueError('v0.2 asset source requires nonnegative integer KRW')
    return pd.DataFrame(dict(member_id=source.customer_id.map(ids).to_numpy(), base_month=base_month,
                             total_asset_amt=values.astype('int64').to_numpy()))


def check_members(members, monthly_inputs, as_of, training_seed, member_seed, input_months=None):
    errors = []
    if input_months is not None:                       # 회원마다 입력 기간의 달을 정확히 입력해야 한다(v3.5.11부터 12개월)
        got = monthly_inputs.groupby('member_id').month.apply(lambda m: sorted(m) == sorted(input_months))
        if len(got) != len(members) or not got.all(): errors.append('every member must enter exactly the input months')
    as_of = pd.Timestamp(as_of)
    if member_seed == training_seed: errors.append('member seed must differ from training seed')
    if members.member_id.duplicated().any() or members.email.duplicated().any(): errors.append('duplicate member_id/email')
    if not members.segment.isin(SEGMENTS).all(): errors.append('unknown segment')
    if not members.email.str.endswith('@example.com').all(): errors.append('email must use reserved example.com domain')
    sd = pd.to_datetime(members.signup_date)
    if (sd > as_of).any(): errors.append('signup after as_of')
    x = monthly_inputs.merge(members[['member_id', 'signup_date']], on='member_id', validate='many_to_one')
    entered = pd.to_datetime(x.input_date)
    month_end = pd.PeriodIndex(x.month, freq='M').to_timestamp(how='end').normalize()
    if (entered < pd.to_datetime(x.signup_date)).any(): errors.append('input before signup')
    if (entered <= month_end).any(): errors.append('input on/before month end')
    if (entered > as_of).any(): errors.append('input after as_of')
    if monthly_inputs.duplicated(['member_id', 'month']).any(): errors.append('duplicate member-month')
    if (monthly_inputs[['income_krw', 'expense_total_krw', 'debt_service_krw']] < 0).any().any(): errors.append('negative amount')
    return errors


# ------------------------------------------------------------------ external API
def _date(as_of, days_ago):
    return (pd.Timestamp(as_of) - pd.Timedelta(days=int(days_ago))).strftime('%Y-%m-%d')


def make_financial_responses(members, loans, cards, card_monthly, as_of):
    """One dummy financial-API response per member, status OK with data for every member.
    v3.6.0: 동의와 무관하게 기관 응답을 만든다. 동의 확인은 목 서버가 요청 시점에 한다(external_data_consent는 시연 시작 시 동의 상태)."""
    by = lambda f: {k: g for k, g in f.groupby('member_id')} if len(f) else {}
    L, C, U = by(loans), by(cards), by(card_monthly)
    out = []
    for m in members.itertuples(index=False):
        base = dict(member_id=m.member_id, provider='dummy_financial_api', as_of_date=str(pd.Timestamp(as_of).date()), is_dummy=True)
        lg = L.get(m.member_id, pd.DataFrame(columns=loans.columns))
        cg = C.get(m.member_id, pd.DataFrame(columns=cards.columns))
        ug = U.get(m.member_id, pd.DataFrame(columns=card_monthly.columns))
        out.append(dict(base, status='OK',
            loans=[dict(account_id=r.account_id, sector=int(r.sector), kind=int(r.kind), institution_id=int(r.institution_id),
                        balance_krw=int(r.balance_thousand) * 1000, annual_rate=float(r.annual_rate),
                        remaining_months=int(r.remaining_months), opened_date=_date(as_of, r.age_days),
                        annual_service_krw=int(r.annual_service_thousand) * 1000) for r in lg.itertuples(index=False)],
            cards=[dict(account_id=r.account_id, institution_id=int(r.institution_id), opened_date=_date(as_of, r.age_days),
                        active=int(r.active)) for r in cg.itertuples(index=False)],
            card_usage=[dict(period_offset=int(r.month_offset),
                             period_start=_date(as_of, 30 * (int(r.month_offset) + 1) - 1), period_end=_date(as_of, 30 * int(r.month_offset)),
                             spend_krw=int(round(r.spend_thousand * 1000)), cash_advance_krw=int(round(r.cash_thousand * 1000)),
                             debit_krw=int(round(r.debit_thousand * 1000))) for r in ug.itertuples(index=False)]))
    return out


def make_telecom_responses(members, monthly, ids, tcfg, as_of, rng):
    """Monthly bills; late flag comes from the member's synthetic monthly history."""
    return make_bill_responses(members, monthly, ids, tcfg, as_of, rng, 'dummy_telecom_api', 'telecom_late')


def make_utility_responses(members, monthly, ids, ucfg, as_of, rng):
    """v3.5.7: 공과금(전기·가스·수도 합산) monthly bills, same shape as telecom; late flag from utility_late."""
    return make_bill_responses(members, monthly, ids, ucfg, as_of, rng, 'dummy_utility_api', 'utility_late')


def make_bill_responses(members, monthly, ids, tcfg, as_of, rng, provider, late_col):
    mm = monthly[monthly.customer_id.isin(ids)].copy()
    mm['member_id'] = mm.customer_id.map(ids)
    lo, hi = tcfg['bill_clip_krw']
    base = {m: float(np.clip(tcfg['bill_median_krw']['value'] * np.exp(tcfg['bill_sigma']['value'] * rng.standard_normal()), lo, hi))
            for m in members.member_id}
    delay = tcfg['late_payment_delay_days']
    out = {}
    groups = {k: g.sort_values('month') for k, g in mm.groupby('member_id')}
    # v3.6.0: 모든 회원에게 OK 응답을 만든다. 기존 동의 회원의 값이 바뀌지 않도록 그 회원들의 난수를 먼저 뽑고,
    # 시연 시작 시 비동의 회원의 청구서는 그 뒤에 이어서 뽑는다. 응답 순서는 회원 순서 그대로다.
    ordered = sorted(members.itertuples(index=False), key=lambda m: not m.external_data_consent)
    for m in ordered:
        head = dict(member_id=m.member_id, provider=provider, is_dummy=True)
        bills = []
        for r in groups.get(m.member_id, mm.iloc[0:0]).itertuples(index=False):
            amount = int(round(np.clip(base[m.member_id] * np.exp(tcfg['bill_month_noise_sigma']['value'] * rng.standard_normal()), lo, hi), -1))
            due = pd.Timestamp(f"{r.month}-{tcfg['due_day']['value']:02d}")
            late = int(getattr(r, late_col)) == 1
            paid = due + pd.Timedelta(days=int(rng.integers(delay['min'], delay['max'] + 1))) if late else due - pd.Timedelta(days=int(rng.integers(0, 10)))
            # A late bill not yet paid by the as-of date has no paid_date (still overdue).
            paid_text = paid.strftime('%Y-%m-%d') if paid <= pd.Timestamp(as_of) else None
            bills.append(dict(bill_month=r.month, billed_amount_krw=amount, due_date=due.strftime('%Y-%m-%d'),
                              paid_date=paid_text, payment_status='late' if late else 'on_time'))
        out[m.member_id] = dict(head, status='OK', bills=bills)
    return [out[m] for m in members.member_id]


def check_bills(rows, monthly, ids, as_of, late_col, name):
    """Late status and paid-date rules of a bill API (telecom, utility) against the monthly source."""
    mm = monthly[monthly.customer_id.isin(ids)].assign(member_id=lambda f: f.customer_id.map(ids)).set_index(['member_id', 'month'])
    for r in rows:
        for b in r['bills']:
            late = int(mm.loc[(r['member_id'], b['bill_month']), late_col]) == 1
            paid = b['paid_date']
            if (b['payment_status'] == 'late') != late or (not late and (paid is None or paid > b['due_date'])) or (late and paid is not None and paid <= b['due_date']):
                return [f"{name} status mismatch {r['member_id']} {b['bill_month']}"]
            if b['due_date'] > str(pd.Timestamp(as_of).date()) or (paid is not None and paid > str(pd.Timestamp(as_of).date())):
                return [f'{name} bill due or paid after as_of']
    return []


def check_external(fin, tel, members, loans, monthly, ids, as_of):
    errors = []
    expected = pd.Series(1, index=sorted(members.member_id))
    for name, rows in [('financial', fin), ('telecom', tel)]:
        counts = pd.Series([r['member_id'] for r in rows]).value_counts().sort_index()
        if not counts.reindex(expected.index, fill_value=0).equals(expected) or len(counts) != len(expected):
            errors.append(f'{name}: every member needs exactly one response (missing, duplicate or unknown member)')
    if errors:
        return errors
    for r in fin + tel:                                 # v3.6.0: 동의와 무관하게 모든 회원 OK
        if r['status'] != 'OK': errors.append(f"every member needs an OK response {r['member_id']}"); break
    debt = loans.groupby('member_id').balance_thousand.sum() * 1000
    for r in fin:
        if r['status'] == 'OK' and sum(l['balance_krw'] for l in r['loans']) != int(debt.get(r['member_id'], 0)):
            errors.append(f"loan balance mismatch {r['member_id']}"); break
        if any(l['opened_date'] > str(pd.Timestamp(as_of).date()) for l in r['loans'] + r['cards']):
            errors.append('account opened after as_of'); break
    return errors + check_bills(tel, monthly, ids, as_of, 'telecom_late', 'telecom')


# ------------------------------------------------- v3.5.0 nonfinancial source APIs
def make_payment_responses(members, payment, as_of):
    """One dummy 간편결제 API response per member (12 complete months), status OK for every member (v3.6.0)."""
    groups = {k: g.sort_values('month') for k, g in payment.groupby('member_id')}
    out = []
    for m in members.itertuples(index=False):
        head = dict(member_id=m.member_id, provider='dummy_payment_api', provider_scope='npay_synthetic',
                    as_of_date=str(pd.Timestamp(as_of).date()), is_dummy=True)
        g = groups.get(m.member_id, payment.iloc[0:0])
        out.append(dict(head, status='OK', months=[dict(month=r.month, observation_status=r.observation_status,
                                                       payment_count=int(r.payment_count), payment_amount_krw=int(r.payment_amount_krw),
                                                       active_days=int(r.active_days)) for r in g.itertuples(index=False)]))
    return out


def make_insurance_responses(members, insurance, as_of):
    """One dummy 공공(국민연금·건강보험) 납부 API response per member, status OK for every member (v3.6.0). Paid date is null when nothing was paid."""
    groups = {k: g.sort_values(['insurance_type', 'month']) for k, g in insurance.groupby('member_id')}
    out = []
    for m in members.itertuples(index=False):
        head = dict(member_id=m.member_id, provider='dummy_public_insurance_api', as_of_date=str(pd.Timestamp(as_of).date()), is_dummy=True)
        g = groups.get(m.member_id, insurance.iloc[0:0])
        txt = lambda v: v if isinstance(v, str) and v else None
        out.append(dict(head, status='OK', records=[dict(
            insurance_type=r.insurance_type, month=r.month, coverage_status=r.coverage_status, payer_type=r.payer_type,
            billed_amount_krw=int(r.billed_amount_krw), individual_responsibility_krw=int(r.individual_responsibility_krw),
            paid_amount_krw=int(r.paid_amount_krw), due_date=txt(r.due_date), paid_date=txt(r.paid_date),
            payment_status=r.payment_status) for r in g.itertuples(index=False)]))
    return out


def check_nonfinancial_external(pay_resp, ins_resp, members, payment, insurance):
    errors = []
    expected = pd.Series(1, index=sorted(members.member_id))
    for name, rows in [('payment', pay_resp), ('public_insurance', ins_resp)]:
        counts = pd.Series([r['member_id'] for r in rows]).value_counts().sort_index()
        if not counts.reindex(expected.index, fill_value=0).equals(expected) or len(counts) != len(expected):
            errors.append(f'{name}: every member needs exactly one response (missing, duplicate or unknown member)')
    if errors:
        return errors
    for r in pay_resp + ins_resp:                       # v3.6.0: 동의와 무관하게 모든 회원 OK
        if r['status'] != 'OK':
            errors.append(f"every member needs an OK response {r['member_id']}"); break
    n_months = payment.groupby('member_id').month.nunique()
    amount = payment.groupby('member_id').payment_amount_krw.sum()
    paid = insurance.groupby('member_id').paid_amount_krw.sum()
    rows = insurance.groupby('member_id').size()
    for r in pay_resp:
        if r['status'] == 'OK' and (len(r['months']) != int(n_months[r['member_id']]) or
                                    sum(x['payment_amount_krw'] for x in r['months']) != int(amount[r['member_id']])):
            errors.append(f"payment response does not match ledger {r['member_id']}"); break
    for r in ins_resp:
        if r['status'] == 'OK' and (len(r['records']) != int(rows[r['member_id']]) or
                                    sum(x['paid_amount_krw'] for x in r['records']) != int(paid[r['member_id']])):
            errors.append(f"insurance response does not match ledger {r['member_id']}"); break
        if any((x['paid_date'] is None) != (x['payment_status'] not in ('on_time', 'late', 'partial')) for x in r['records']):
            errors.append(f"insurance paid_date/status mismatch {r['member_id']}"); break
    return errors


# ------------------------------------------------------ v3.5.7 credit bureau / utility APIs
def _json_value(v):
    if pd.isna(v):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return int(v) if float(v).is_integer() else float(v)
    return v


def make_credit_bureau_responses(members, bureau, as_of):
    """One dummy 신용평가사 API response per member: the member's 207 credit fields (label source and
    offer placeholders removed) plus credit-history fields. Unobserved values are null. CB is the
    educational 1 (best) ~ 10 (highest risk) grade, not the service grade. v3.6.0: status OK for every member."""
    rows = bureau.set_index('member_id')
    out = []
    for m in members.itertuples(index=False):
        head = dict(member_id=m.member_id, provider='dummy_credit_bureau_api', as_of_date=str(pd.Timestamp(as_of).date()), is_dummy=True)
        r = rows.loc[m.member_id]
        out.append(dict(head, status='OK', credit_info={c: _json_value(r[c]) for c in rows.columns}))
    return out


def check_new_external(cb_resp, util_resp, members, bureau, monthly, ids, as_of, excluded):
    errors = []
    expected = pd.Series(1, index=sorted(members.member_id))
    for name, rows in [('credit_bureau', cb_resp), ('utility', util_resp)]:
        counts = pd.Series([r['member_id'] for r in rows]).value_counts().sort_index()
        if not counts.reindex(expected.index, fill_value=0).equals(expected) or len(counts) != len(expected):
            errors.append(f'{name}: every member needs exactly one response (missing, duplicate or unknown member)')
    if errors:
        return errors
    for r in cb_resp + util_resp:                       # v3.6.0: 동의와 무관하게 모든 회원 OK
        if r['status'] != 'OK':
            return [f"every member needs an OK response {r['member_id']}"]
    if set(excluded) & set(bureau.columns):
        return ['credit bureau ledger contains an excluded column (label source or offer placeholder)']
    b = bureau.set_index('member_id')
    for r in cb_resp:
        if r['status'] != 'OK':
            continue
        info = r['credit_info']
        if set(info) != set(b.columns):
            return [f"credit bureau fields differ from ledger {r['member_id']}"]
        for c, v in info.items():
            src = b.at[r['member_id'], c]
            if (v is None) != bool(pd.isna(src)) or (v is not None and v != _json_value(src)):
                return [f"credit bureau value mismatch {r['member_id']} {c}"]
        cb = info.get('CB')
        if cb is not None and not (1 <= cb <= 10):
            return [f"CB out of 1..10 {r['member_id']}"]
        if (cb is None) != (info.get('cb_available') == 0):
            return [f"CB null must match cb_available=0 {r['member_id']}"]
    return check_bills(util_resp, monthly, ids, as_of, 'utility_late', 'utility')
