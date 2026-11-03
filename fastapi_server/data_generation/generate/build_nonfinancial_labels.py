"""Add the nonfinancial-effect label next to the original labels (never replaces them).

Run after extend.py (data/), build_thinfile.py (thinfile/) and build_nonfinancial_sources.py. Writes, per dataset:
  labels_nonfinancial.csv          customer_id, label_nonfin_effect_12m   (scope: delivery)
  labels_nonfinancial_metadata.csv customer_id, design probability, ...   (scope: reference, never a model input)
Parameters and sources: reference/nonfinancial_label.json, docs/NONFINANCIAL_LABEL.md
"""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd
from generate import nonfinancial_label as nl

ROOT = Path(__file__).resolve().parents[1]


def build(folder, cfg, seed_offset, thinfile):
    folder = Path(folder)
    profiles = pd.read_csv(folder/'profiles.csv', encoding='utf-8-sig')
    base = pd.read_csv(folder/'base_207.csv', encoding='utf-8-sig').rename(columns={'식별구분': 'customer_id'})
    frame = profiles.merge(base[['customer_id'] + cfg['financial_features']], on='customer_id', validate='one_to_one')
    src = pd.read_csv(folder/'nonfinancial_source_features.csv', encoding='utf-8-sig')
    frame = frame.merge(src[['customer_id', 'si_arrears_any', 'dp_active_months', 'dp_ever_used']], on='customer_id', validate='one_to_one')
    if thinfile:
        meta = pd.read_csv(folder/'target_metadata.csv', encoding='utf-8-sig')
        frame = frame.merge(meta[['customer_id', 'future_credit_exposure']], on='customer_id', validate='one_to_one')
        eligible = frame.future_credit_exposure.to_numpy() == 1
    else:
        eligible = np.ones(len(frame), bool)
    y = frame.label_any_delinquency_12m.to_numpy()
    x = nl.financial_matrix(frame, cfg['financial_features'], cfg['log1p_features'])
    base_logit = nl.base_logit(x, y, fit_mask=eligible)
    bill = ((frame.telecom_late_months > 0) | (frame.utility_late_months > 0)).astype(int).to_numpy()
    cf = nl.cashflow_z(frame.months_liquid_negative, frame.income_cv)
    si = frame.si_arrears_any.to_numpy()
    dpz = nl.payment_regularity_z(frame.dp_active_months, frame.dp_ever_used)
    extra = np.log(cfg['social_insurance_arrears_odds_ratio']['value']) * si + cfg['digital_payment_regularity_logit_per_sd']['value'] * dpz
    target = float(y[eligible].mean())
    prob = nl.effect_probability(base_logit, bill, cf, cfg['bill_arrears_odds_ratio']['value'],
                                 cfg['cashflow_logit_per_sd']['value'], target, mask=eligible, extra_logit=extra)
    rng = np.random.default_rng(np.random.SeedSequence([cfg['seed'], 216, seed_offset]))
    label = nl.draw_labels(prob, rng.random(len(prob)))
    out = pd.DataFrame({'customer_id': frame.customer_id, cfg['label_column']: label})
    out.to_csv(folder/'labels_nonfinancial.csv', index=False, encoding='utf-8-sig')
    pd.DataFrame(dict(customer_id=frame.customer_id, base_logit=base_logit, bill_arrears_any=bill, cashflow_z=cf,
                      social_insurance_arrears_any=si, payment_regularity_z=dpz,
                      eligible=eligible.astype(int), design_probability=prob)).to_csv(
        folder/'labels_nonfinancial_metadata.csv', index=False, encoding='utf-8-sig')
    return dict(folder=str(folder), rows=len(out), target_rate=target, positive_rate=float(label.mean()),
                bill_arrears_rate=float(bill.mean()), social_insurance_arrears_rate=float(si.mean()))


def run(data=ROOT/'data', thinfile=ROOT/'thinfile'):
    cfg = json.loads((ROOT/'reference/nonfinancial_label.json').read_text(encoding='utf-8'))
    summary = [build(data, cfg, 0, False), build(thinfile, cfg, 1, True)]
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=str(ROOT/'data'))
    ap.add_argument('--thinfile', default=str(ROOT/'thinfile'))
    a = ap.parse_args(); run(a.data, a.thinfile)
