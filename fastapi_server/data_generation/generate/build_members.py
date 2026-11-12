"""Dummy registered members for the service. Never used for training.

Source rows come from the thin-file generator run with a separate member seed in a
temporary directory; labels and cohort design fields are dropped. Outputs go to
service_dummy/members/, separate from data/ and thinfile/. v3.5.11부터 회원 입력은 최근 완결
12개월이며 학습용 집계 기간과 독립적이다. The credit fields a credit bureau would return (207 columns without the
label source and offer placeholders, unobserved values null) are kept as a ledger for the
dummy credit bureau API, with a utility (공과금) ledger for the dummy utility API.
"""
from pathlib import Path
import argparse, json, tempfile
import numpy as np
import pandas as pd
from generate.loan_classification import loan_type_code, rate_type, check_loan_classification
from generate import build_thinfile
from generate import nonfinancial_sources as ns
from generate.build_nonfinancial_sources import generate_frames, load_cfg
from generate.service_dummy_logic import make_members, make_monthly_inputs, remap_ledger, check_members
from generate.service_dummy_logic import make_v02_asset_snapshots

ROOT = Path(__file__).resolve().parents[1]
TRAINING_SEEDS = {20261030, 20261029}   # build_thinfile default, extension_config seed


def credit_bureau_ledger(base207, model_inputs, ccfg):
    """207 credit fields per member as a credit bureau would return them: the model_inputs.csv null
    rule is applied (CB=5 placeholder -> null etc.), the label source and offer placeholders are removed,
    and the credit-history fields are appended."""
    b = base207.set_index('customer_id').copy()
    mi = model_inputs.set_index('customer_id')
    for c in [c for c in mi.columns if c in b.columns]:
        b[c] = mi[c].reindex(b.index)
    b = b.drop(columns=ccfg['excluded_columns']['value'])
    for c in ccfg['extra_fields']['value']:
        b[c] = mi[c].reindex(b.index)
    return b.reset_index()


def run(out, per_cohort=None, seed=None):
    anchors = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))
    cfg = anchors['members']; as_of = anchors['as_of_date']
    seed = cfg['seed'] if seed is None else seed
    per_cohort = cfg['per_cohort'] if per_cohort is None else per_cohort
    if seed in TRAINING_SEEDS:
        raise ValueError('member seed must differ from training seeds')
    with tempfile.TemporaryDirectory() as tmp:
        build_thinfile.run(tmp, per_cohort, seed)
        t = Path(tmp)
        read = lambda name: pd.read_csv(t/f'{name}.csv', encoding='utf-8-sig')
        profiles, plan, monthly = read('profiles'), read('plan'), read('monthly_history')
        loans, cards, card_monthly = read('loans'), read('cards'), read('card_monthly')
        base207 = pd.read_csv(t/'base_207.csv', encoding='utf-8-sig').rename(columns={'식별구분': 'customer_id'})
        mi = read('model_inputs')
    base = base207[['customer_id', 'SP', 'DQ1200001']]
    bureau = credit_bureau_ledger(base207, mi, anchors['credit_bureau'])
    # v3.5.0: 간편결제·사회보험 원천 (same rules as training data, member seed, offset 2). Design draws are dropped.
    scfg = load_cfg()
    payment, insurance, _, _ = generate_frames(profiles, monthly[['customer_id', 'month', 'expense_total_krw']], base, scfg, 2, seed=seed)
    src_errors = ns.check_payment(payment, scfg['months']) + ns.check_insurance(insurance, scfg['months'], scfg['as_of_date'])
    if src_errors:
        raise ValueError('; '.join(src_errors))
    rng = np.random.default_rng(np.random.SeedSequence([seed, 214, 0]))
    members, ids = make_members(profiles[['customer_id', 'segment']], dict(zip(plan.customer_id, plan.age)), cfg, as_of, rng)
    inputs = make_monthly_inputs(monthly, members, ids, cfg, as_of, rng)
    errors = check_members(members, inputs, as_of, training_seed=20261030, member_seed=seed, input_months=cfg['input_months']['value'])
    if errors:
        raise ValueError('; '.join(errors))
    out = Path(out)/'members'; (out/'ledgers').mkdir(parents=True, exist_ok=True)
    members.to_csv(out/'members.csv', index=False, encoding='utf-8-sig')
    inputs.to_csv(out/'member_monthly_inputs.csv', index=False, encoding='utf-8-sig')
    # N-05-4 v0.2 전용 보조 출력이다. 기존 파일의 행·값·순서는 유지한다.
    make_v02_asset_snapshots(profiles, ids, cfg['input_months']['value'][-1]).to_csv(
        out/'member_asset_snapshots_v02.csv', index=False, encoding='utf-8-sig')
    # Ledgers behind the dummy external APIs (same member IDs).
    # N-05-3 회원 계좌 ID를 기준으로 대출 종류와 금리 방식을 결정한다.
    loan_ledger = remap_ledger(loans, ids)
    loan_ledger['loan_type_code'] = [loan_type_code(k, s) for k, s in zip(loan_ledger.kind, loan_ledger.sector)]
    loan_ledger['rate_type'] = [rate_type(a).upper() for a in loan_ledger.account_id]
    errors = check_loan_classification(loan_ledger)
    if errors:
        raise ValueError('; '.join(errors))
    loan_ledger.to_csv(out/'ledgers/loans.csv', index=False, encoding='utf-8-sig')
    remap_ledger(cards, ids).to_csv(out/'ledgers/cards.csv', index=False, encoding='utf-8-sig')
    remap_ledger(card_monthly, ids, account_prefix_col='none').to_csv(out/'ledgers/card_monthly.csv', index=False, encoding='utf-8-sig')
    remap_ledger(monthly[['customer_id', 'month', 'telecom_late']], ids, account_prefix_col='none').to_csv(out/'ledgers/telecom_monthly.csv', index=False, encoding='utf-8-sig')
    remap_ledger(monthly[['customer_id', 'month', 'utility_late']], ids, account_prefix_col='none').to_csv(out/'ledgers/utility_monthly.csv', index=False, encoding='utf-8-sig')
    remap_ledger(bureau, ids, account_prefix_col='none').to_csv(out/'ledgers/credit_bureau.csv', index=False, encoding='utf-8-sig')
    remap_ledger(payment, ids, account_prefix_col='none').to_csv(out/'ledgers/digital_payment_monthly.csv', index=False, encoding='utf-8-sig')
    remap_ledger(insurance, ids, account_prefix_col='none').to_csv(out/'ledgers/social_insurance_monthly.csv', index=False, encoding='utf-8-sig')
    print(f'members.csv: {len(members)} members, member_monthly_inputs.csv: {len(inputs)} rows')
    return members


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(ROOT/'service_dummy'))
    ap.add_argument('--per-cohort', type=int)
    ap.add_argument('--seed', type=int)
    a = ap.parse_args(); run(a.out, a.per_cohort, a.seed)
