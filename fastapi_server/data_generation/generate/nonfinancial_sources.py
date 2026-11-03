"""Pure functions for the nonfinancial source panels (digital payment, social insurance).

No file IO and no generator calls. Callers pass arrays, the config dict from
reference/nonfinancial_sources.json and a numpy Generator, so every rule can be
checked with small fixtures (tests/test_nonfinancial_sources.py).

Design: docs/NONFINANCIAL_CANDIDATES.md (field meanings), docs/NONFINANCIAL_SOURCES.md
(generation rules, sources and assumptions). Original delinquency labels are never used here.
"""
import calendar
import numpy as np
import pandas as pd
from scipy.special import expit, logit
from scipy.stats import beta as beta_dist

PAYMENT_STATUSES = ('on_time', 'late', 'partial', 'unpaid', 'not_due', 'not_applicable', 'unknown')
COVERAGE = ('covered', 'exempt', 'dependent', 'not_covered', 'unknown')
PAYER = ('workplace', 'regional', 'voluntary', 'household', 'unknown')
ARREARS = ('late', 'partial', 'unpaid')
OBS = ('observed', 'no_activity', 'missing')


# ------------------------------------------------------------------ calendar
def due_dates(months, due_day):
    """Due date of each billing month: `due_day` of the following month."""
    out = []
    for m in months:
        y, mo = map(int, m.split('-'))
        y, mo = (y + 1, 1) if mo == 12 else (y, mo + 1)
        out.append(pd.Timestamp(year=y, month=mo, day=due_day))
    return out


def days_in_month(month):
    y, mo = map(int, month.split('-'))
    return calendar.monthrange(y, mo)[1]


# ----------------------------------------------------------- digital payment
def beta_params(mean, concentration):
    return mean * concentration, (1 - mean) * concentration


def active_days(count, days):
    """Expected distinct payment days for `count` payments spread over `days` (rounded,
    at least 1 when count > 0, never more than count or days)."""
    count = np.asarray(count, float)
    d = np.round(days * (1 - (1 - 1 / days) ** count))
    d = np.where(count > 0, np.maximum(d, 1), 0)
    return np.minimum(np.minimum(d, count), days).astype(np.int64)


def payment_panel(expense, month_days, cfg, rng):
    """expense: (n, m) monthly living expense in KRW. Returns dict of (n, m) arrays and
    per-person draws. Payment amount is a subset of living expense (never added to it)."""
    expense = np.asarray(expense, float)
    n, m = expense.shape
    ever = rng.random(n) < cfg['ever_used_probability']['value']
    mean = cfg['customer_month_active_target']['value'] / cfg['ever_used_probability']['value']
    a, b = beta_params(mean, cfg['activity_propensity_concentration']['value'])
    q = np.where(ever, rng.beta(a, b, n), 0.0)
    active = rng.random((n, m)) < q[:, None]
    s = cfg['spend_share_of_living_expense']
    share = np.clip(s['median'] * np.exp(s['log_sigma'] * rng.standard_normal(n)), *s['clip'])
    noise = np.exp(cfg['monthly_amount_noise_log_sigma']['value'] * rng.standard_normal((n, m)))
    amount = np.round(np.minimum(share[:, None] * expense * noise, expense) / 10) * 10
    amount = np.where(active, amount, 0)
    t = cfg['ticket_krw']
    ticket = t['median'] * np.exp(t['log_sigma'] * rng.standard_normal(n))
    count = np.where(amount > 0, np.maximum(1, np.round(amount / ticket[:, None])), 0)
    active = active & (count > 0)
    amount = np.where(active, amount, 0)
    days = np.column_stack([active_days(count[:, j], month_days[j]) for j in range(m)])
    return dict(ever_used=ever, propensity=q, active=active, amount=amount.astype(np.int64),
                count=count.astype(np.int64), active_days=days, share=share, ticket=ticket)


# ---------------------------------------------------------- social insurance
def draw_category(probs_by_segment, segment, u):
    """Pick a category per person from a {segment: {category: prob}} table using uniforms u."""
    segment = np.asarray(segment)
    out = np.empty(len(segment), dtype=object)
    for seg in np.unique(segment):
        k = segment == seg
        cats = [c for c in probs_by_segment[seg] if c not in ('basis', 'note')]
        p = np.array([probs_by_segment[seg][c] for c in cats], float)
        cum = np.cumsum(p / p.sum())
        idx = np.searchsorted(cum, np.asarray(u)[k], side='right')
        out[k] = np.array(cats, dtype=object)[np.minimum(idx, len(cats) - 1)]
    return out


def pension_coverage(segment, age, decile, zero_income_any, cfg, u_type, u_exempt):
    """(coverage_status, payer_type) per person for the national pension."""
    payer = draw_category(cfg['payer_type_by_segment'], segment, u_type)
    ex = cfg['regional_exempt_probability']
    low = np.isin(decile, ex['low_income_deciles'])
    p_ex = np.minimum(np.where(low, ex['low_income'], ex['other']) + ex['zero_income_month_add'] * np.asarray(zero_income_any, bool), ex['cap'])
    exempt = (payer == 'regional') & (np.asarray(u_exempt) < p_ex)
    age = np.asarray(age)
    out_of_age = (age < cfg['eligible_age']['min']) | (age > cfg['eligible_age']['max'])
    not_cov = (payer == 'not_covered') | out_of_age
    coverage = np.where(not_cov, 'not_covered', np.where(exempt, 'exempt', 'covered')).astype(object)
    payer = np.where(not_cov, 'unknown', payer).astype(object)
    return coverage, payer


def health_coverage(segment, decile, cfg, u_type, u_dep, u_aid):
    """(coverage_status, payer_type) per person for national health insurance.
    Dependents (피부양자) are `dependent` with payer `household`; medical-aid recipients are `not_covered`."""
    payer = draw_category(cfg['payer_type_by_segment'], segment, u_type)
    dm = cfg['dependent_low_income_multiplier']
    low = np.isin(decile, dm['deciles'])
    segment = np.asarray(segment)
    base_dep = np.array([cfg['payer_type_by_segment'][s].get('dependent', 0.0) for s in segment])
    p_dep = np.minimum(base_dep * np.where(low, dm['value'], 1.0), 0.6)
    dependent = (segment != 'wage') & (np.asarray(u_dep) < p_dep)
    payer = np.where(dependent, 'dependent', np.where(payer == 'dependent', 'regional', payer))
    aid = (np.asarray(decile) == 1) & (np.asarray(u_aid) < cfg['medical_aid_probability_decile1']['value'])
    coverage = np.where(aid, 'not_covered', np.where(payer == 'dependent', 'dependent', 'covered')).astype(object)
    payer = np.where(aid, 'unknown', np.where(payer == 'dependent', 'household', payer)).astype(object)
    return coverage, payer


def month_rate(rate_by_year, months):
    return np.array([rate_by_year[m[:4]] for m in months], float)


def pension_base(monthly_income, months, limits):
    """Standard monthly income (기준소득월액) per month: income clipped to that month's limits."""
    out = np.zeros((len(monthly_income), len(months)))
    for j, m in enumerate(months):
        lim = next(x for x in limits if x['from'] <= m <= x['to'])
        out[:, j] = np.clip(monthly_income, lim['min'], lim['max'])
    return out


def premiums(base, rate, payer, coverage):
    """billed (total premium) and individual responsibility per (person, month), 10-won units.
    Workplace: employer pays half, so individual = billed/2. Regional: individual = billed."""
    billed = np.round(base * rate[None, :] / 10) * 10
    obligated = (np.asarray(coverage) == 'covered')[:, None]
    billed = np.where(obligated, billed, 0)
    half = (np.asarray(payer) == 'workplace')[:, None]
    indiv = np.where(half, np.round(billed / 2 / 10) * 10, billed)
    return billed.astype(np.int64), indiv.astype(np.int64)


def tilt_uniform(u, k):
    """Move a uniform toward 1 for higher-risk people: u' = u^(1/k), distributed as the
    maximum of k uniforms. With k = 3 a person is about 2.7 times as likely to land in the
    top 10% of propensity (1 - 0.9^3 = 0.271 vs 0.1). k = 1 leaves u unchanged."""
    return np.asarray(u, float) ** (1 / np.asarray(k, float))


def base_propensity(mean, concentration, u):
    """Beta quantile of the person's uniform u (shared across pension and health)."""
    a, b = beta_params(mean, concentration)
    return np.clip(beta_dist.ppf(np.asarray(u), a, b), 1e-6, 1 - 1e-6)


def shifted(p0, odds_multiplier, shift):
    return expit(logit(p0) + np.log(odds_multiplier) + shift)


def calibrate_shift(p0, odds_multiplier, weight, target, lo=-20.0, hi=20.0, tol=1e-10):
    """Logit shift so the weight-averaged non-on-time probability equals `target`
    (weight = individual premium due over the year, i.e. an amount-weighted target)."""
    w = np.asarray(weight, float)
    if w.sum() <= 0:
        return 0.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if np.sum(w * shifted(p0, odds_multiplier, mid)) / w.sum() < target:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol:
            break
    return (lo + hi) / 2


def draw_status(p, obligated, due, as_of, outcome, on_time_days, rng):
    """Monthly payment status and paid date offsets for obligated person-months.

    p: (n,) non-on-time propensity. obligated: (n, m) bool. due: list of m Timestamps.
    Returns status (n, m) object, paid_fraction (n, m) float, paid_date (n, m) object (Timestamp or None)."""
    n, m = obligated.shape
    as_of = pd.Timestamp(as_of)
    late_flag = rng.random((n, m)) < np.asarray(p)[:, None]
    u_out = rng.random((n, m))
    chronic = (np.asarray(p) >= outcome['chronic_threshold'])[:, None]
    kind = np.where(u_out < outcome['late'], 'late', np.where(u_out < outcome['late'] + outcome['partial'], 'partial', 'unpaid'))
    kind = np.where(chronic, 'unpaid', kind)
    lo, hi = outcome['late_days']
    late_days = rng.integers(lo, hi + 1, (n, m))
    early = rng.integers(on_time_days[0], on_time_days[1] + 1, (n, m))
    frac_lo, frac_hi = outcome['partial_paid_fraction']
    part = rng.uniform(frac_lo, frac_hi, (n, m))
    status = np.full((n, m), 'not_applicable', dtype=object)
    fraction = np.zeros((n, m))
    paid = np.full((n, m), None, dtype=object)
    for j in range(m):
        d = due[j]
        if d > as_of:                                   # deadline not reached yet
            status[obligated[:, j], j] = 'not_due'
            continue
        for i in np.flatnonzero(obligated[:, j]):
            if not late_flag[i, j]:
                status[i, j] = 'on_time'; fraction[i, j] = 1.0; paid[i, j] = d - pd.Timedelta(days=int(early[i, j]))
                continue
            k = kind[i, j]
            when = d + pd.Timedelta(days=int(late_days[i, j]))
            if k == 'unpaid' or when > as_of:
                status[i, j] = 'unpaid'
            elif k == 'late':
                status[i, j] = 'late'; fraction[i, j] = 1.0; paid[i, j] = when
            else:
                status[i, j] = 'partial'; fraction[i, j] = part[i, j]; paid[i, j] = when
    return status, fraction, paid


def paid_amount(indiv, status, fraction):
    amt = np.round(np.asarray(indiv) * np.asarray(fraction) / 10) * 10
    amt = np.where(np.asarray(status) == 'partial', np.minimum(amt, np.asarray(indiv) - 10), amt)
    return np.maximum(amt, 0).astype(np.int64)


# ------------------------------------------------------------------ features
def payment_features(panel_df):
    g = panel_df.groupby('customer_id', sort=False)
    return pd.DataFrame(dict(
        dp_active_months=g.payment_count.apply(lambda s: int((s > 0).sum())),
        dp_payment_count_12m=g.payment_count.sum().astype(np.int64),
        dp_payment_amount_12m_krw=g.payment_amount_krw.sum().astype(np.int64))).reset_index()


def insurance_features(si_df, prefix, insurance_type):
    x = si_df[si_df.insurance_type == insurance_type]
    g = x.groupby('customer_id', sort=False)
    due = g.payment_status.apply(lambda s: int(s.isin(('on_time',) + ARREARS).sum()))
    on_time = g.payment_status.apply(lambda s: int((s == 'on_time').sum()))
    arrears = g.payment_status.apply(lambda s: int(s.isin(ARREARS).sum()))
    out = pd.DataFrame({
        f'{prefix}_coverage_status': g.coverage_status.first(),
        f'{prefix}_payer_type': g.payer_type.first(),
        f'{prefix}_due_months': due, f'{prefix}_on_time_months': on_time, f'{prefix}_arrears_months': arrears})
    # Denominator 0 (not covered / exempt / dependent) -> null, never 0 or 1 (no information, not a penalty).
    out[f'{prefix}_on_time_rate'] = np.where(out[f'{prefix}_due_months'] > 0,
                                             out[f'{prefix}_on_time_months'] / out[f'{prefix}_due_months'].replace(0, 1), np.nan)
    return out.reset_index()


# -------------------------------------------------------------------- checks
def check_payment(df, months):
    e = []
    if df.duplicated(['customer_id', 'month']).any(): e.append('payment: duplicate customer-month')
    if not df.month.isin(months).all(): e.append('payment: month outside panel')
    if df.groupby('customer_id').month.nunique().ne(len(months)).any(): e.append('payment: customer without 12 months')
    if (df[['payment_count', 'payment_amount_krw', 'active_days']] < 0).any().any(): e.append('payment: negative values')
    zero = df.payment_count == 0
    if ((zero) & ((df.payment_amount_krw != 0) | (df.active_days != 0))).any(): e.append('payment: 0 count with amount/days')
    if ((~zero) & ((df.payment_amount_krw <= 0) | (df.active_days < 1))).any(): e.append('payment: positive count without amount/days')
    if (df.active_days > df.payment_count).any(): e.append('payment: more active days than payments')
    if not df.observation_status.isin(OBS).all(): e.append('payment: unknown observation_status')
    if ((df.observation_status == 'observed') != (df.payment_count > 0)).any(): e.append('payment: observed must mean count > 0')
    return e


def check_insurance(df, months, as_of):
    e = []
    as_of = pd.Timestamp(as_of)
    if df.duplicated(['customer_id', 'month', 'insurance_type']).any(): e.append('insurance: duplicate key')
    if not df.insurance_type.isin(['national_pension', 'health_insurance']).all(): e.append('insurance: unknown type')
    if not df.coverage_status.isin(COVERAGE).all(): e.append('insurance: unknown coverage_status')
    if not df.payer_type.isin(PAYER).all(): e.append('insurance: unknown payer_type')
    if not df.payment_status.isin(PAYMENT_STATUSES).all(): e.append('insurance: unknown payment_status')
    amt = ['billed_amount_krw', 'individual_responsibility_krw', 'paid_amount_krw']
    if (df[amt] < 0).any().any(): e.append('insurance: negative amount')
    if (df.individual_responsibility_krw > df.billed_amount_krw).any(): e.append('insurance: individual share above billed')
    if (df.paid_amount_krw > df.individual_responsibility_krw).any(): e.append('insurance: paid above individual share')
    no_duty = df.coverage_status.isin(['exempt', 'dependent', 'not_covered']) | (df.individual_responsibility_krw == 0)
    if (no_duty & (df.payment_status != 'not_applicable')).any(): e.append('insurance: no duty must be not_applicable')
    if ((df.coverage_status == 'covered') & (df.individual_responsibility_krw > 0) & (df.payment_status == 'not_applicable')).any():
        e.append('insurance: obligated month marked not_applicable')
    if ((df.coverage_status == 'exempt') & (df.payer_type != 'regional')).any(): e.append('insurance: exempt only for regional payers')
    if ((df.coverage_status == 'dependent') & (df.payer_type != 'household')).any(): e.append('insurance: dependent must be household')
    full = df.payment_status.isin(['on_time', 'late'])
    if (full & (df.paid_amount_krw != df.individual_responsibility_krw)).any(): e.append('insurance: on_time/late must pay in full')
    if ((df.payment_status == 'partial') & ~((df.paid_amount_krw > 0) & (df.paid_amount_krw < df.individual_responsibility_krw))).any():
        e.append('insurance: partial must pay between 0 and the full share')
    if ((df.payment_status.isin(['unpaid', 'not_applicable', 'not_due'])) & (df.paid_amount_krw != 0)).any(): e.append('insurance: unpaid with amount')
    paid = pd.to_datetime(df.paid_date, errors='coerce'); due = pd.to_datetime(df.due_date, errors='coerce')
    has_paid = df.payment_status.isin(['on_time', 'late', 'partial'])
    if (has_paid & paid.isna()).any() or ((~has_paid) & paid.notna()).any(): e.append('insurance: paid_date presence')
    if ((df.payment_status == 'on_time') & (paid > due)).any(): e.append('insurance: on_time paid after due')
    if ((df.payment_status.isin(['late', 'partial'])) & (paid <= due)).any(): e.append('insurance: late/partial paid on or before due')
    if (paid > as_of).any(): e.append('insurance: paid after as_of date')
    if ((df.payment_status == 'not_due') & (due <= as_of)).any(): e.append('insurance: not_due with past deadline')
    if df.groupby(['customer_id', 'insurance_type']).month.nunique().ne(len(months)).any(): e.append('insurance: customer without 12 months')
    return e
