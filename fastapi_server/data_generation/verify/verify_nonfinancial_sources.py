"""Verify the digital payment / social insurance panels and the v3.5.0 label terms.

Read-only. Checks, per dataset (data/, thinfile/):
  rules               every row satisfies the logical rules of nonfinancial_sources.check_*
  reproducible        regenerating in memory with the same seed gives identical files
  features            nonfinancial_source_features.csv recomputes from the two panels
  anchors             aggregate rates are close to reference/nonfinancial_sources.json
  risk_link           social insurance arrears are more common with a recent financial delinquency
  label_terms         labels_nonfinancial_metadata.csv design probabilities recompute from their terms
  original_label      the original label still equals (207-column 연체회차 >= 1) and no panel carries a label
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
from scipy.special import expit
from generate import nonfinancial_sources as ns
from generate import nonfinancial_label as nl
from generate.build_nonfinancial_sources import generate_frames, load_cfg

R = Path(__file__).resolve().parents[1]
TOL = dict(ever_used=0.02, active=0.02, ticket_rel=0.10, pension_ratio=0.015)


def check(folder, seed_offset, cfg, lcfg):
    f = R/folder
    read = lambda n, **kw: pd.read_csv(f/n, encoding='utf-8-sig', keep_default_na=False, **kw)
    pay = read('digital_payment_monthly.csv')
    ins = read('social_insurance_monthly.csv')
    feat = pd.read_csv(f/'nonfinancial_source_features.csv', encoding='utf-8-sig')
    out = {}
    errors = ns.check_payment(pay, cfg['months']) + ns.check_insurance(ins, cfg['months'], cfg['as_of_date'])
    assert not errors, errors
    out['rules'] = 'pass'

    profiles = pd.read_csv(f/'profiles.csv', encoding='utf-8-sig')
    monthly = pd.read_csv(f/'monthly_history.csv', encoding='utf-8-sig', usecols=['customer_id', 'month', 'expense_total_krw'])
    base = pd.read_csv(f/'base_207.csv', encoding='utf-8-sig', usecols=['식별구분', 'SP', 'DQ1200001']).rename(columns={'식별구분': 'customer_id'})
    p2, i2, f2, design = generate_frames(profiles, monthly, base, cfg, seed_offset)
    pd.testing.assert_frame_equal(pay.reset_index(drop=True), p2.astype(pay.dtypes.to_dict()).reset_index(drop=True))
    pd.testing.assert_frame_equal(ins.reset_index(drop=True), i2.astype(ins.dtypes.to_dict()).reset_index(drop=True))
    pd.testing.assert_frame_equal(feat.reset_index(drop=True), f2.reset_index(drop=True), check_dtype=False, rtol=1e-12, atol=0)
    out['reproducible'] = 'pass'

    rec = pd.DataFrame(dict(customer_id=feat.customer_id))
    rec = rec.merge(ns.payment_features(pay), on='customer_id')
    for prefix, itype in (('np', 'national_pension'), ('hi', 'health_insurance')):
        rec = rec.merge(ns.insurance_features(ins, prefix, itype), on='customer_id')
    cols = [c for c in rec.columns if c != 'customer_id']
    pd.testing.assert_frame_equal(feat[['customer_id'] + cols].reset_index(drop=True), rec.reset_index(drop=True), check_dtype=False)
    assert (feat.si_arrears_any == ((feat.np_arrears_months + feat.hi_arrears_months) > 0).astype(int)).all()
    assert set(feat.customer_id) == set(profiles.customer_id)
    out['features'] = 'pass'

    dp = cfg['digital_payment']; si = cfg['social_insurance']['national_pension']
    act = pay[pay.payment_count > 0]
    ever = float(feat.dp_ever_used.mean()); month_active = float((pay.payment_count > 0).mean())
    ticket = float((act.payment_amount_krw / act.payment_count).median())
    assert abs(ever - dp['ever_used_probability']['value']) <= TOL['ever_used'], ever
    assert abs(month_active - dp['customer_month_active_target']['value']) <= TOL['active'], month_active
    assert abs(ticket / dp['ticket_krw']['median'] - 1) <= TOL['ticket_rel'], ticket
    pen = ins[(ins.insurance_type == 'national_pension') & (ins.individual_responsibility_krw > 0)]
    ratios = {}
    for ptype in ('workplace', 'regional'):
        x = pen[pen.payer_type == ptype]
        r = x.loc[x.payment_status == 'on_time', 'paid_amount_krw'].sum() / x.individual_responsibility_krw.sum()
        ratios[ptype] = round(float(r), 4)
        assert abs(r - si['on_time_amount_ratio_target'][ptype]) <= TOL['pension_ratio'], (ptype, r)
    out['anchors'] = dict(ever_used=round(ever, 4), customer_month_active=round(month_active, 4), ticket_median=round(ticket), pension_on_time_amount_ratio=ratios)

    risk = feat.customer_id.map(design.set_index('customer_id').risk_flag) == 1
    hi, lo = feat.si_arrears_any[risk].mean(), feat.si_arrears_any[~risk].mean()
    assert hi > 1.5 * lo, (hi, lo)
    out['risk_link'] = dict(with_recent_delinquency=round(float(hi), 4), without=round(float(lo), 4))

    meta = pd.read_csv(f/'labels_nonfinancial_metadata.csv', encoding='utf-8-sig')
    m = meta.merge(feat[['customer_id', 'si_arrears_any', 'dp_active_months', 'dp_ever_used']], on='customer_id', validate='one_to_one')
    assert (m.social_insurance_arrears_any == m.si_arrears_any).all()
    np.testing.assert_allclose(m.payment_regularity_z, nl.payment_regularity_z(m.dp_active_months, m.dp_ever_used), rtol=0, atol=1e-12)
    lg = (m.base_logit + np.log(lcfg['bill_arrears_odds_ratio']['value']) * m.bill_arrears_any
          + lcfg['cashflow_logit_per_sd']['value'] * m.cashflow_z
          + np.log(lcfg['social_insurance_arrears_odds_ratio']['value']) * m.social_insurance_arrears_any
          + lcfg['digital_payment_regularity_logit_per_sd']['value'] * m.payment_regularity_z).to_numpy()
    elig = m.eligible.to_numpy() == 1
    a = nl.calibrate_intercept(lg[elig], float(m.design_probability[elig].mean()))
    np.testing.assert_allclose(np.where(elig, expit(lg + a), 0.0), m.design_probability, rtol=0, atol=1e-8)
    out['label_terms'] = 'pass'

    # The original label stays defined by the 207-column result (연체회차 >= 1); new panels never carry it.
    orig = pd.read_csv(f/'base_207.csv', encoding='utf-8-sig', usecols=['식별구분', '결과값(연체회차)']).rename(columns={'식별구분': 'customer_id'})
    merged = profiles[['customer_id', 'label_any_delinquency_12m']].merge(orig, on='customer_id', validate='one_to_one')
    assert ((merged['결과값(연체회차)'] > 0).astype(int) == merged.label_any_delinquency_12m).all()
    for frame in (pay, ins, feat):
        assert not any(c.startswith('label') for c in frame.columns)
    out['original_label'] = 'pass'
    return out


def main():
    cfg = load_cfg()
    lcfg = json.loads((R/'reference/nonfinancial_label.json').read_text(encoding='utf-8'))
    r = {'status': 'PASS', 'legacy': check('data', 0, cfg, lcfg), 'thinfile': check('thinfile', 1, cfg, lcfg)}
    print(json.dumps(r, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
