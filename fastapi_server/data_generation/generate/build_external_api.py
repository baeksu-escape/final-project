"""Dummy external financial / telecom / payment / public-insurance / credit-bureau / utility API responses for members.

Requires build_members.py output. Responses are derived from the same member
ledgers, so API data agrees with the member's monthly inputs.
"""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd
from generate.service_dummy_logic import (make_financial_responses, make_telecom_responses, check_external,
                                          make_payment_responses, make_insurance_responses, check_nonfinancial_external,
                                          make_credit_bureau_responses, make_utility_responses, check_new_external)

ROOT = Path(__file__).resolve().parents[1]


def run(base, seed=20261103):
    anchors = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))
    as_of = anchors['as_of_date']
    m = Path(base)/'members'
    if not (m/'members.csv').exists():
        raise FileNotFoundError('run python -m generate.build_members first')
    read = lambda p: pd.read_csv(m/p, encoding='utf-8-sig')
    members, loans, cards, usage, telecom = read('members.csv'), read('ledgers/loans.csv'), read('ledgers/cards.csv'), read('ledgers/card_monthly.csv'), read('ledgers/telecom_monthly.csv')
    rng = np.random.default_rng(np.random.SeedSequence([seed, 215, 0]))
    fin = make_financial_responses(members, loans, cards, usage, as_of)
    tel_src = telecom.rename(columns={'member_id': 'customer_id'})
    identity = {k: k for k in members.member_id}
    tel = make_telecom_responses(members, tel_src, identity, anchors['telecom'], as_of, rng)
    errors = check_external(fin, tel, members, loans, tel_src, identity, as_of)
    pay_led = pd.read_csv(m/'ledgers/digital_payment_monthly.csv', encoding='utf-8-sig')
    ins_led = pd.read_csv(m/'ledgers/social_insurance_monthly.csv', encoding='utf-8-sig', keep_default_na=False)
    pay = make_payment_responses(members, pay_led, as_of)
    ins = make_insurance_responses(members, ins_led, as_of)
    errors += check_nonfinancial_external(pay, ins, members, pay_led, ins_led)
    # v3.5.7: credit bureau (207 fields) and utility bills. Utility amounts use their own random stream
    # so the existing telecom/payment/insurance responses stay byte-identical.
    bureau = read('ledgers/credit_bureau.csv')
    util_src = read('ledgers/utility_monthly.csv').rename(columns={'member_id': 'customer_id'})
    cb = make_credit_bureau_responses(members, bureau, as_of)
    util = make_utility_responses(members, util_src, identity, anchors['utility'], as_of,
                                  np.random.default_rng(np.random.SeedSequence([seed, 216, 0])))
    errors += check_new_external(cb, util, members, bureau, util_src, identity, as_of, anchors['credit_bureau']['excluded_columns']['value'])
    if errors:
        raise ValueError('; '.join(errors))
    out = Path(base)/'external_api'; out.mkdir(parents=True, exist_ok=True)
    for name, rows in [('financial_responses.jsonl', fin), ('telecom_responses.jsonl', tel),
                       ('payment_responses.jsonl', pay), ('public_insurance_responses.jsonl', ins),
                       ('credit_bureau_responses.jsonl', cb), ('utility_responses.jsonl', util)]:
        with open(out/name, 'w', encoding='utf-8') as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'external_api: {len(fin)} financial, {len(tel)} telecom, {len(pay)} payment, {len(ins)} public insurance, '
          f'{len(cb)} credit bureau, {len(util)} utility responses')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default=str(ROOT/'service_dummy'))
    ap.add_argument('--seed', type=int, default=20261103)
    a = ap.parse_args(); run(a.base, a.seed)
