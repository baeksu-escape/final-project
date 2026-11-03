"""Digital payment and social insurance source panels (12 complete months).

Run after extend.py (data/) and build_thinfile.py (thinfile/), before build_nonfinancial_labels.py.
Writes, per dataset folder:
  digital_payment_monthly.csv      customer-month 간편결제 원천       (scope: delivery)
  social_insurance_monthly.csv     customer-month-보험종류 납부 원천  (scope: delivery)
  nonfinancial_source_features.csv 고객 단위 12개월 집계            (scope: delivery)
Original delinquency labels are not read. Parameters: reference/nonfinancial_sources.json.
Rules, sources and assumptions: docs/NONFINANCIAL_SOURCES.md
"""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd
from generate import nonfinancial_sources as ns

ROOT = Path(__file__).resolve().parents[1]


def load_cfg():
    return json.loads((ROOT/'reference/nonfinancial_sources.json').read_text(encoding='utf-8'))


def generate_frames(profiles, monthly, base, cfg, seed_offset, seed=None):
    """profiles: customer_id, segment, age, annual_income_krw, income_decile, zero_income_months.
    monthly: customer_id, month, expense_total_krw. base: customer_id, SP, DQ1200001.
    Returns (payment_df, insurance_df, features_df, design) where design holds per-person draws (never a model input)."""
    months = cfg['months']; as_of = cfg['as_of_date']
    seed = cfg['seed'] if seed is None else seed
    rng = np.random.default_rng(np.random.SeedSequence([seed, 217, seed_offset]))
    p = profiles.reset_index(drop=True)
    ids = p.customer_id.to_numpy(); n = len(p)
    exp = monthly.pivot(index='customer_id', columns='month', values='expense_total_krw')
    if list(exp.columns) != months:
        raise ValueError(f'monthly_history months {list(exp.columns)} != config months')
    exp = exp.loc[ids].to_numpy(float)
    b = base.set_index('customer_id').loc[ids]
    risk = ((b.SP.to_numpy() == 1) | (b.DQ1200001.to_numpy() > 0))
    seg = p.segment.to_numpy(); age = p.age.to_numpy(); dec = p.income_decile.to_numpy()
    income_m = p.annual_income_krw.to_numpy(float) / 12

    # ---- digital payment
    dp = cfg['digital_payment']
    panel = ns.payment_panel(exp, [ns.days_in_month(m) for m in months], dp, rng)
    pay = pd.DataFrame(dict(
        customer_id=np.repeat(ids, len(months)), month=np.tile(months, n),
        provider_scope=dp['provider_scope'],
        observation_status=np.where(panel['active'].ravel(), 'observed', 'no_activity'),
        payment_count=panel['count'].ravel(), payment_amount_krw=panel['amount'].ravel(),
        active_days=panel['active_days'].ravel()))

    # ---- social insurance coverage
    si = cfg['social_insurance']
    u = rng.random((6, n))
    np_cov, np_pay = ns.pension_coverage(seg, age, dec, p.zero_income_months.to_numpy() > 0, si['national_pension'], u[0], u[1])
    hi_cov, hi_pay = ns.health_coverage(seg, dec, si['health_insurance'], u[2], u[3], u[4])
    u_prop = u[5]                                     # shared: pension and health arrears move together
    mult = np.where(risk, si['risk_multiplier_recent_financial_delinquency']['value'], 1.0) * \
        np.where(np.isin(dec, si['low_income_multiplier']['deciles']), si['low_income_multiplier']['value'], 1.0)
    due = ns.due_dates(months, si['due_day_of_next_month']['value'])
    conc = si['propensity_concentration']['value']
    outcome = si['non_on_time_outcome']; early = si['on_time_paid_days_before_due']['value']

    frames, design = [], dict(customer_id=ids, risk_flag=risk.astype(int), propensity_tilt=mult,
                              dp_activity_propensity=panel['propensity'], dp_spend_share=panel['share'])
    plans = [
        ('national_pension', np_cov, np_pay,
         ns.pension_base(income_m, months, si['national_pension']['income_base_limits_krw']),
         ns.month_rate(si['national_pension']['rate_by_year'], months),
         {k: 1 - v for k, v in si['national_pension']['on_time_amount_ratio_target'].items() if k in ('workplace', 'regional')}),
        ('health_insurance', hi_cov, hi_pay, np.repeat(income_m[:, None], len(months), 1),
         ns.month_rate(si['health_insurance']['rate_by_year'], months),
         {k: v for k, v in si['health_insurance']['non_on_time_mean'].items() if k in ('workplace', 'regional')}),
    ]
    for itype, cov, payer, base_amt, rate, targets in plans:
        billed, indiv = ns.premiums(base_amt, rate, payer, cov)
        prop = np.zeros(n)
        for ptype, target in targets.items():
            k = (payer == ptype) & (cov == 'covered')
            if not k.any():
                continue
            # Risk and low income tilt the person's propensity quantile upward; a logit shift then
            # restores the amount-weighted mean to the anchor, so only the ranking changes.
            p0 = ns.base_propensity(target, conc, ns.tilt_uniform(u_prop[k], mult[k]))
            shift = ns.calibrate_shift(p0, np.ones(k.sum()), indiv[k].sum(1), target)
            prop[k] = ns.shifted(p0, np.ones(k.sum()), shift)
        obligated = (cov == 'covered')[:, None] & (indiv > 0)
        status, frac, paid_date = ns.draw_status(prop, obligated, due, as_of, outcome, early, rng)
        paid = ns.paid_amount(indiv, status, frac)
        design[f'{itype}_non_on_time_propensity'] = prop
        frames.append(pd.DataFrame(dict(
            customer_id=np.repeat(ids, len(months)), month=np.tile(months, n), insurance_type=itype,
            coverage_status=np.repeat(cov, len(months)), payer_type=np.repeat(payer, len(months)),
            billed_amount_krw=billed.ravel(), individual_responsibility_krw=indiv.ravel(), paid_amount_krw=paid.ravel(),
            due_date=np.where(obligated, np.tile([d.strftime('%Y-%m-%d') for d in due], (n, 1)), '').ravel(),
            paid_date=[x.strftime('%Y-%m-%d') if x is not None else '' for x in paid_date.ravel()],
            payment_status=status.ravel())))
    ins = pd.concat(frames, ignore_index=True)
    ins = ins.sort_values(['customer_id', 'insurance_type', 'month'], kind='stable').reset_index(drop=True)

    # ---- customer-level features
    feat = pd.DataFrame(dict(customer_id=ids, dp_ever_used=panel['ever_used'].astype(int)))
    feat = feat.merge(ns.payment_features(pay), on='customer_id', validate='one_to_one')
    inc = p.set_index('customer_id').annual_income_krw.loc[ids].to_numpy(float)
    feat['dp_amount_to_income'] = np.where(inc > 0, feat.dp_payment_amount_12m_krw / np.where(inc > 0, inc, 1), np.nan)
    for prefix, itype in (('np', 'national_pension'), ('hi', 'health_insurance')):
        feat = feat.merge(ns.insurance_features(ins, prefix, itype), on='customer_id', validate='one_to_one')
    feat['si_arrears_any'] = ((feat.np_arrears_months + feat.hi_arrears_months) > 0).astype(int)
    return pay, ins, feat, pd.DataFrame(design)


def summarize(pay, ins, feat, design, cfg):
    """Aggregate checks against the anchors in reference/nonfinancial_sources.json."""
    si = cfg['social_insurance']
    act = pay[pay.payment_count > 0]
    pen = ins[(ins.insurance_type == 'national_pension') & (ins.individual_responsibility_krw > 0)]
    ratio = {}
    for ptype in ('workplace', 'regional'):
        x = pen[pen.payer_type == ptype]
        ratio[ptype] = float(x.loc[x.payment_status == 'on_time', 'paid_amount_krw'].sum() / x.individual_responsibility_krw.sum()) if len(x) else None
    pcov = feat.drop_duplicates('customer_id')
    regional = pcov[pcov.np_payer_type == 'regional']
    risk = design.set_index('customer_id').risk_flag.loc[feat.customer_id].to_numpy() == 1
    return dict(
        customers=int(len(feat)),
        dp_ever_used_rate=float(feat.dp_ever_used.mean()),
        dp_customer_month_active_rate=float((pay.payment_count > 0).mean()),
        dp_ticket_median_krw=float((act.payment_amount_krw / act.payment_count).median()) if len(act) else None,
        dp_amount_share_of_expense_median=float(design.dp_spend_share.median()),
        pension_on_time_amount_ratio=ratio,
        pension_on_time_amount_ratio_target={k: si['national_pension']['on_time_amount_ratio_target'][k] for k in ('workplace', 'regional')},
        pension_regional_exempt_share=float((regional.np_coverage_status == 'exempt').mean()) if len(regional) else None,
        pension_regional_exempt_reference=0.443,
        pension_payer_mix=pcov.np_payer_type.value_counts(normalize=True).round(4).to_dict(),
        health_payer_mix=pcov.hi_payer_type.value_counts(normalize=True).round(4).to_dict(),
        si_arrears_any_rate=float(feat.si_arrears_any.mean()),
        si_arrears_any_rate_recent_financial_delinquency=float(feat.si_arrears_any[risk].mean()) if risk.any() else None,
        si_arrears_any_rate_no_recent_delinquency=float(feat.si_arrears_any[~risk].mean()) if (~risk).any() else None)


def build(folder, cfg, seed_offset):
    folder = Path(folder)
    read = lambda name, **kw: pd.read_csv(folder/name, encoding='utf-8-sig', **kw)
    profiles = read('profiles.csv')
    monthly = read('monthly_history.csv', usecols=['customer_id', 'month', 'expense_total_krw'])
    base = read('base_207.csv', usecols=['식별구분', 'SP', 'DQ1200001']).rename(columns={'식별구분': 'customer_id'})
    pay, ins, feat, design = generate_frames(profiles, monthly, base, cfg, seed_offset)
    errors = ns.check_payment(pay, cfg['months']) + ns.check_insurance(ins, cfg['months'], cfg['as_of_date'])
    if errors:
        raise ValueError('; '.join(errors))
    pay.to_csv(folder/'digital_payment_monthly.csv', index=False, encoding='utf-8-sig')
    ins.to_csv(folder/'social_insurance_monthly.csv', index=False, encoding='utf-8-sig')
    feat.to_csv(folder/'nonfinancial_source_features.csv', index=False, encoding='utf-8-sig')
    s = summarize(pay, ins, feat, design, cfg)
    s['folder'] = folder_label(folder)
    return s


def folder_label(folder):
    # 요약에 생성 PC의 절대경로를 남기지 않는다(경로 노출, 재생성 시 해시 변동). 패키지 안이면 상대경로, 밖이면 폴더 이름
    folder = Path(folder).resolve()
    try:
        return folder.relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return folder.name


def run(data=ROOT/'data', thinfile=ROOT/'thinfile'):
    cfg = load_cfg()
    summary = [build(data, cfg, 0), build(thinfile, cfg, 1)]
    (Path(data)/'nonfinancial_sources_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=str(ROOT/'data'))
    ap.add_argument('--thinfile', default=str(ROOT/'thinfile'))
    a = ap.parse_args(); run(a.data, a.thinfile)
