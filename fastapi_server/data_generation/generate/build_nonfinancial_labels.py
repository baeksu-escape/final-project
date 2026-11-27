"""Add the nonfinancial-effect label next to the original labels (never replaces them).

Run after extend.py (data/), build_thinfile.py (thinfile/), build_delinquency_label.py and build_nonfinancial_sources.py. Writes, per dataset:
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
    # v3.7.0 바탕값은 새 연체 라벨의 설계 logit이다(build_delinquency_label.py). 금융 특성에 다시 적합하지 않으므로
    # 잔액·상환액처럼 거의 같은 두 값의 계수가 반대로 나뉘지 않고, 새 라벨의 효과가 그대로 전달된다.
    design = pd.read_csv(folder/'labels_delinquency_metadata.csv', encoding='utf-8-sig', usecols=['customer_id', 'base_logit'])
    frame = profiles.merge(design, on='customer_id', validate='one_to_one')
    src = pd.read_csv(folder/'nonfinancial_source_features.csv', encoding='utf-8-sig')
    frame = frame.merge(src[['customer_id', 'si_arrears_any', 'dp_active_months', 'dp_ever_used']], on='customer_id', validate='one_to_one')
    if thinfile:
        meta = pd.read_csv(folder/'target_metadata.csv', encoding='utf-8-sig')
        frame = frame.merge(meta[['customer_id', 'future_credit_exposure']], on='customer_id', validate='one_to_one')
        eligible = frame.future_credit_exposure.to_numpy() == 1
    else:
        eligible = np.ones(len(frame), bool)
    y = frame.label_any_delinquency_12m.to_numpy()
    base_logit = frame.base_logit.to_numpy(float)
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
