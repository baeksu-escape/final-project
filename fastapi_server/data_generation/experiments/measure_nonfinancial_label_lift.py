"""AUC lift of nonfinancial features for both labels (effect-size check, not a model).

Logistic regression, stratified 5-fold cross-validation repeated 3 times (seeds 0, 1, 2).
Feature sets:
  financial      : the 8 financial 207-column features used for the label's base logit
  +v3.4 nonfin   : telecom/utility late months, months with negative liquid balance, income CV
  +v3.5 sources  : pension/health arrears months, any social insurance arrears,
                   payment active months, ever used, payment amount / income
Thin-file rows are restricted to customers with future credit exposure (the only ones who can be positive).
The delivered label is one random draw. To separate the effect size from draw luck, the label is also
redrawn 20 times from its saved design probability (labels_nonfinancial_metadata.csv) and the total lift
is averaged ("expected"). Writes nonfinancial_label_lift/summary.csv and summary.json.
Check ranges: reference/nonfinancial_label.json.
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

R = Path(__file__).resolve().parents[1]
V34 = ['telecom_late_months', 'utility_late_months', 'months_liquid_negative', 'income_cv']
V35 = ['np_arrears_months', 'hi_arrears_months', 'si_arrears_any', 'dp_active_months', 'dp_ever_used', 'dp_amount_to_income']
SEEDS = [0, 1, 2]
REDRAWS = 20


def load(folder, cfg, thinfile):
    f = R/folder
    read = lambda n: pd.read_csv(f/n, encoding='utf-8-sig')
    base = read('base_207.csv').rename(columns={'식별구분': 'customer_id'})[['customer_id'] + cfg['financial_features']]
    d = read('profiles.csv').merge(base, on='customer_id', validate='one_to_one')
    d = d.merge(read('nonfinancial_source_features.csv'), on='customer_id', validate='one_to_one')
    d = d.merge(read('labels_nonfinancial.csv'), on='customer_id', validate='one_to_one')
    if thinfile:
        meta = read('target_metadata.csv')[['customer_id', 'future_credit_exposure']]
        d = d.merge(meta, on='customer_id', validate='one_to_one')
        d = d[d.future_credit_exposure == 1].reset_index(drop=True)
    for c in cfg['log1p_features']:
        d[c] = np.log1p(d[c].clip(lower=0))
    return d


def cv_auc(x, y, seed):
    model = make_pipeline(SimpleImputer(strategy='median', keep_empty_features=True), StandardScaler(), LogisticRegression(max_iter=3000))
    aucs = []
    for tr, te in StratifiedKFold(5, shuffle=True, random_state=seed).split(x, y):
        model.fit(x[tr], y[tr])
        aucs.append(roc_auc_score(y[te], model.predict_proba(x[te])[:, 1]))
    return float(np.mean(aucs))


def main():
    cfg = json.loads((R/'reference/nonfinancial_label.json').read_text(encoding='utf-8'))
    fin = cfg['financial_features']
    sets = {'financial': fin, 'financial+v3.4': fin + V34, 'financial+v3.4+v3.5': fin + V34 + V35}
    rows = []
    for group, folder, thin in [('legacy', 'data', False), ('thinfile', 'thinfile', True)]:
        d = load(folder, cfg, thin)
        for label in ['label_any_delinquency_12m', cfg['label_column']]:
            y = d[label].to_numpy()
            for name, cols in sets.items():
                x = d[cols].astype(float).to_numpy()
                for seed in SEEDS:
                    rows.append(dict(group=group, label=label, features=name, seed=seed, n=len(d),
                                     positive_rate=float(y.mean()), auc=cv_auc(x, y, seed)))
    m = pd.DataFrame(rows)
    s = m.groupby(['group', 'label', 'features'], sort=False).auc.mean().unstack('features')
    s['lift_v3.4'] = s['financial+v3.4'] - s['financial']
    s['lift_total'] = s['financial+v3.4+v3.5'] - s['financial']
    s['lift_v3.5_increment'] = s['financial+v3.4+v3.5'] - s['financial+v3.4']
    out = R/'nonfinancial_label_lift'; out.mkdir(exist_ok=True)
    m.to_csv(out/'runs.csv', index=False)
    s.round(4).to_csv(out/'summary.csv')
    rng = cfg['expected_auc_lift_check']
    check = {}
    for g, key in [('legacy', 'overall'), ('thinfile', 'thin_file')]:
        lift = float(s.loc[(g, cfg['label_column']), 'lift_total'])
        lo, hi = rng[key]
        check[g] = dict(lift_total=round(lift, 4), range=[lo, hi], within=bool(lo <= lift <= hi),
                        original_label_lift_total=round(float(s.loc[(g, 'label_any_delinquency_12m'), 'lift_total']), 4))
    for g, folder, thin in [('legacy', 'data', False), ('thinfile', 'thinfile', True)]:
        d = load(folder, cfg, thin)
        meta = pd.read_csv(R/folder/'labels_nonfinancial_metadata.csv', encoding='utf-8-sig')
        p = d[['customer_id']].merge(meta, on='customer_id', validate='one_to_one').design_probability.to_numpy()
        x0, x1 = d[fin].astype(float).to_numpy(), d[sets['financial+v3.4+v3.5']].astype(float).to_numpy()
        lifts = []
        for k in range(REDRAWS):
            y = (np.random.default_rng(np.random.SeedSequence([cfg['seed'], 218, k])).random(len(p)) < p).astype(int)
            lifts.append(cv_auc(x1, y, 0) - cv_auc(x0, y, 0))
        lo, hi = check[g]['range']
        check[g]['expected_lift_total'] = dict(mean=round(float(np.mean(lifts)), 4), sd=round(float(np.std(lifts)), 4),
                                               p5=round(float(np.percentile(lifts, 5)), 4), p95=round(float(np.percentile(lifts, 95)), 4),
                                               redraws=REDRAWS, within=bool(lo <= np.mean(lifts) <= hi))
    (out/'summary.json').write_text(json.dumps(check, indent=2), encoding='utf-8')
    print(s.round(4).to_string())
    print(json.dumps(check, indent=2))


if __name__ == '__main__':
    main()
