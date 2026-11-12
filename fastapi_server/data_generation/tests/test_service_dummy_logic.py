"""Fixed-fixture checks for service dummy logic: no generator calls or file writes."""
import json
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from generate import service_dummy_logic as s

ANCHORS = json.loads((Path(__file__).resolve().parents[1]/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))
AS_OF = ANCHORS['as_of_date']


def fixture():
    profiles = pd.DataFrame(dict(customer_id=['THF1', 'THF2', 'THF3'], segment=['wage', 'selfemp', 'freelance']))
    ages = {'THF1': 24, 'THF2': 41, 'THF3': 29}
    months = ['2026-06', '2026-07', '2026-08']
    monthly = pd.DataFrame([dict(customer_id=c, month=m, income_krw=2_000_000, expense_total_krw=1_500_000,
                                 debt_service_krw=100_000 if c == 'THF2' else 0, telecom_late=int(c == 'THF2' and m == '2026-08'))
                            for c in profiles.customer_id for m in months])
    loans = pd.DataFrame(dict(customer_id=['THF2', 'THF2'], account_id=['THF2_L0', 'THF2_L1'], sector=[0, 2], kind=[0, 0],
                              institution_id=[3, 205], balance_thousand=[5000, 1200], age_days=[400, 30],
                              remaining_months=[24, 12], annual_rate=[.06, .11], annual_service_thousand=[2800, 1300]))
    cards = pd.DataFrame(dict(customer_id=['THF1'], account_id=['THF1_C0'], institution_id=[4], age_days=[200], active=[1]))
    usage = pd.DataFrame(dict(customer_id=['THF1'] * 2, month_offset=[0, 1], spend_thousand=[350.5, 0.0], cash_thousand=[20.0, 0.0], debit_thousand=[80.25, 10.0]))
    return profiles, ages, monthly, loans, cards, usage


class LoanClassification(unittest.TestCase):
    """N-05-3 대출 종류와 학습 공통 금리 규칙을 고정 예제로 확인한다."""
    def test_all_kinds_and_card(self):
        expected = ['CREDIT', 'MORTGAGE', 'OTHER', 'OTHER', 'OTHER', 'OTHER', 'OTHER', 'MORTGAGE', 'OTHER']
        self.assertEqual([s.loan_type_code(k, 0) for k in range(9)], expected)
        self.assertEqual(s.loan_type_code(0, 1), 'CARD_LOAN')
        self.assertEqual(s.loan_type_code(1, 1), 'MORTGAGE')

    def test_hash_and_checker(self):
        import hashlib
        for account in ['MEM000001_L0', 'THF2_L1', 'abc']:
            expected = 'variable' if int(hashlib.sha256(account.encode()).hexdigest()[:8], 16) % 2 else 'fixed'
            self.assertEqual(s.rate_type(account), expected)
        rows = pd.DataFrame([dict(account_id='abc', kind=0, sector=1, loan_type_code='CARD_LOAN', rate_type=s.rate_type('abc').upper())])
        self.assertEqual(s.check_loan_classification(rows), [])
        rows.loc[0, 'rate_type'] = 'BAD'
        self.assertTrue(s.check_loan_classification(rows))


class LoanProducts(unittest.TestCase):
    def test_ranges_contain_anchor_and_respect_cap(self):
        for seed in range(20):
            p = s.expand_loan_products(ANCHORS, np.random.default_rng(seed))
            self.assertEqual(s.check_loan_products(p, ANCHORS), [])
            self.assertEqual(len(p), sum(t['n_products'] for t in ANCHORS['product_templates']))

    def test_checker_rejects_rate_above_cap_and_real_names(self):
        p = s.expand_loan_products(ANCHORS, np.random.default_rng(0))
        bad = p.copy(); bad.loc[0, 'rate_max_pct'] = 25.0; bad.loc[1, 'provider_name'] = '실제은행'
        errors = s.check_loan_products(bad, ANCHORS)
        self.assertTrue(any('legal cap' in e for e in errors) and any('fictional' in e for e in errors))


class Members(unittest.TestCase):
    def build(self, seed=1):
        profiles, ages, monthly, *_ = fixture()
        rng = np.random.default_rng(seed)
        members, ids = s.make_members(profiles, ages, ANCHORS['members'], AS_OF, rng)
        inputs = s.make_monthly_inputs(monthly, members, ids, ANCHORS['members'], AS_OF, rng)
        return members, ids, inputs, monthly

    def test_members_and_input_dates(self):
        for seed in range(30):
            members, ids, inputs, monthly = self.build(seed)
            self.assertEqual(s.check_members(members, inputs, AS_OF, 20261030, 20261101), [])
            self.assertEqual(len(inputs), len(monthly))
            self.assertNotIn('label_any_delinquency_12m', members.columns)
            self.assertNotIn('cohort', members.columns)

    def test_backfilled_months_use_signup_date(self):
        members, ids, inputs, _ = self.build(3)
        late_signup = members.signup_date.max()
        m = members.loc[members.signup_date == late_signup, 'member_id'].iloc[0]
        rows = inputs[inputs.member_id == m]
        month_end = pd.PeriodIndex(rows.month, freq='M').to_timestamp(how='end').normalize()
        early = month_end + pd.Timedelta(days=ANCHORS['members']['input_delay_days']['max']) < pd.Timestamp(late_signup)
        self.assertTrue((rows.input_date[np.asarray(early)] == late_signup).all())

    def test_same_seed_rejected(self):
        members, _, inputs, _ = self.build()
        self.assertIn('member seed must differ from training seed', s.check_members(members, inputs, AS_OF, 7, 7))

    def test_remap_ledger_rewrites_embedded_ids(self):
        _, ids, _, _ = self.build()
        _, _, _, loans, _, _ = fixture()
        r = s.remap_ledger(loans, ids)
        self.assertTrue(all(a.startswith(m + '_L') for a, m in zip(r.account_id, r.member_id)))


class ExternalApi(unittest.TestCase):
    def test_responses_consistent_with_ledgers_and_consent(self):
        """v3.6.0: 동의 표시와 무관하게 모든 회원이 OK 응답을 받고, OK가 아닌 응답은 짝 검사가 거부한다."""
        profiles, ages, monthly, loans, cards, usage = fixture()
        rng = np.random.default_rng(5)
        members, ids = s.make_members(profiles, ages, ANCHORS['members'], AS_OF, rng)
        members['external_data_consent'] = [1, 1, 0]
        L, C, U = s.remap_ledger(loans, ids), s.remap_ledger(cards, ids), s.remap_ledger(usage, ids, 'none')
        fin = s.make_financial_responses(members, L, C, U, AS_OF)
        tel = s.make_telecom_responses(members, monthly, ids, ANCHORS['telecom'], AS_OF, rng)
        self.assertEqual(s.check_external(fin, tel, members, L, monthly, ids, AS_OF), [])
        by = {r['member_id']: r for r in fin}
        self.assertEqual(sum(l['balance_krw'] for l in by[ids['THF2']]['loans']), 6_200_000)
        # v3.6.0: 시연 시작 시 비동의 회원도 기관 응답은 OK + 데이터다(동의 확인은 목 서버가 요청 시점에 한다).
        self.assertEqual([r['status'] for r in fin + tel], ['OK'] * 6)
        self.assertEqual(len({r['member_id']: r for r in tel}[ids['THF3']]['bills']), monthly[monthly.customer_id == 'THF3'].shape[0])
        broken = [dict(r) for r in fin]; broken[2]['status'] = 'CONSENT_REQUIRED'
        self.assertTrue(s.check_external(broken, tel, members, L, monthly, ids, AS_OF))
        self.assertEqual(by[ids['THF1']]['card_usage'][0]['period_end'], AS_OF)
        bills = {b['bill_month']: b for b in {r['member_id']: r for r in tel}[ids['THF2']]['bills']}
        self.assertEqual(bills['2026-08']['payment_status'], 'late')
        self.assertEqual(bills['2026-07']['payment_status'], 'on_time')

    def test_bill_values_of_initially_consenting_members_unchanged(self):
        """v3.6.0: 비동의 회원 청구서를 추가해도 동의 회원의 청구서 값(난수 순서)은 바뀌지 않는다."""
        profiles, ages, monthly, loans, cards, usage = fixture()
        members, ids = s.make_members(profiles, ages, ANCHORS['members'], AS_OF, np.random.default_rng(5))
        members['external_data_consent'] = [1, 0, 1]
        mixed = s.make_telecom_responses(members, monthly, ids, ANCHORS['telecom'], AS_OF, np.random.default_rng(9))
        # 비동의 회원의 월 원천을 빼면 그 회원은 난수를 쓰지 않는다 = v3.5.13까지의 난수 사용과 같다.
        late_member = [c for c, m in ids.items() if m == members.member_id.iloc[1]][0]
        first = s.make_telecom_responses(members, monthly[monthly.customer_id != late_member], ids, ANCHORS['telecom'], AS_OF,
                                         np.random.default_rng(9))
        first = [r for r in first if r['member_id'] != members.member_id.iloc[1]]
        self.assertEqual([r['member_id'] for r in mixed], list(members.member_id))
        by = {r['member_id']: r for r in mixed}
        for r in first:
            self.assertEqual(by[r['member_id']]['bills'], r['bills'])

    def test_checker_detects_tampered_status(self):
        profiles, ages, monthly, loans, cards, usage = fixture()
        rng = np.random.default_rng(6)
        members, ids = s.make_members(profiles, ages, ANCHORS['members'], AS_OF, rng)
        members['external_data_consent'] = 1
        L = s.remap_ledger(loans, ids)
        fin = s.make_financial_responses(members, L, s.remap_ledger(cards, ids), s.remap_ledger(usage, ids, 'none'), AS_OF)
        tel = s.make_telecom_responses(members, monthly, ids, ANCHORS['telecom'], AS_OF, rng)
        tel[1]['bills'][-1]['payment_status'] = 'on_time'
        self.assertTrue(s.check_external(fin, tel, members, L, monthly, ids, AS_OF))

    def test_checker_detects_duplicate_missing_and_unknown_responses(self):
        profiles, ages, monthly, loans, cards, usage = fixture()
        rng = np.random.default_rng(7)
        members, ids = s.make_members(profiles, ages, ANCHORS['members'], AS_OF, rng)
        L = s.remap_ledger(loans, ids)
        fin = s.make_financial_responses(members, L, s.remap_ledger(cards, ids), s.remap_ledger(usage, ids, 'none'), AS_OF)
        tel = s.make_telecom_responses(members, monthly, ids, ANCHORS['telecom'], AS_OF, rng)
        check = lambda f, t: s.check_external(f, t, members, L, monthly, ids, AS_OF)
        self.assertEqual(check(fin, tel), [])
        self.assertTrue(check(fin + [fin[0]], tel))                   # duplicate only, no member missing
        self.assertTrue(check(fin[:-1] + [fin[0]], tel))              # duplicate + missing
        self.assertTrue(check(fin, tel + [dict(tel[0], member_id='MEM999999')]))   # unknown member


class SixMonthInputs(unittest.TestCase):
    """회원은 최근 완결 12개월을 입력한다(v3.5.11, v3.5.7~v3.5.10은 6개월). 클래스 이름은 기존 이름을 유지한다."""
    MONTHS = [f'{y}-{m:02d}' for y, m in [(2025, 9), (2025, 10), (2025, 11), (2025, 12)] + [(2026, k) for k in range(1, 9)]]

    def build(self, seed=0, extra_months=()):
        profiles, ages, _, *_ = fixture()
        monthly = pd.DataFrame([dict(customer_id=c, month=m, income_krw=1_000_000, expense_total_krw=700_000, debt_service_krw=0)
                                for c in profiles.customer_id for m in list(extra_months) + self.MONTHS])
        rng = np.random.default_rng(seed)
        members, ids = s.make_members(profiles, ages, ANCHORS['members'], AS_OF, rng)
        return members, s.make_monthly_inputs(monthly, members, ids, ANCHORS['members'], AS_OF, rng)

    def test_only_input_months_are_kept(self):
        want = ANCHORS['members']['input_months']['value']
        self.assertEqual(want, self.MONTHS)
        members, inputs = self.build()
        self.assertEqual(len(inputs), 12 * len(members))
        self.assertEqual(s.check_members(members, inputs, AS_OF, 20261030, 20261101, input_months=want), [])

    def test_months_outside_input_months_are_dropped(self):
        # 원천에 입력 기간보다 앞선 달이 있어도 회원 입력에는 입력 기간 12개월만 남는다.
        want = ANCHORS['members']['input_months']['value']
        members, inputs = self.build(extra_months=['2025-07', '2025-08'])
        self.assertEqual(sorted(inputs.month.unique()), want)
        self.assertEqual(len(inputs), 12 * len(members))
        self.assertEqual(s.check_members(members, inputs, AS_OF, 20261030, 20261101, input_months=want), [])

    def test_missing_month_is_reported(self):
        want = ANCHORS['members']['input_months']['value']
        members, inputs = self.build()
        short = inputs[~((inputs.member_id == inputs.member_id.iloc[0]) & (inputs.month == '2026-05'))]
        self.assertIn('every member must enter exactly the input months', s.check_members(members, short, AS_OF, 20261030, 20261101, input_months=want))


class BureauAndUtilityApi(unittest.TestCase):
    """v3.5.7: dummy credit bureau (207 fields, nulls kept) and utility bill responses."""
    def setup(self):
        members = pd.DataFrame(dict(member_id=['MEM000001', 'MEM000002', 'MEM000003'], external_data_consent=[1, 1, 0]))
        bureau = pd.DataFrame(dict(member_id=members.member_id, CB=[3.0, np.nan, np.nan], SP=[0.0, np.nan, 1.0],
                                   L00000002=[5000, 0, 1200], cb_available=[1, 0, 0], credit_history_days=[900, 0, 40]))
        monthly = pd.DataFrame([dict(customer_id=m, month=mo, utility_late=int(m == 'MEM000001' and mo == '2026-07'))
                                for m in members.member_id for mo in ['2026-07', '2026-08']])
        ids = {m: m for m in members.member_id}
        cb = s.make_credit_bureau_responses(members, bureau, AS_OF)
        util = s.make_utility_responses(members, monthly, ids, ANCHORS['utility'], AS_OF, np.random.default_rng(0))
        return members, bureau, monthly, ids, cb, util

    def test_responses_follow_ledger_and_consent(self):
        """v3.6.0: 신용평가사·공과금 응답도 동의와 무관하게 모든 회원 OK다."""
        members, bureau, monthly, ids, cb, util = self.setup()
        excluded = ANCHORS['credit_bureau']['excluded_columns']['value']
        self.assertEqual(s.check_new_external(cb, util, members, bureau, monthly, ids, AS_OF, excluded), [])
        self.assertEqual([r['status'] for r in cb], ['OK', 'OK', 'OK'])         # v3.6.0: 동의와 무관
        self.assertEqual(cb[0]['credit_info']['CB'], 3)
        self.assertIsNone(cb[1]['credit_info']['CB'])              # unobserved stays null, never the placeholder 5
        self.assertEqual(cb[2]['credit_info']['SP'], 1)
        self.assertEqual([r['status'] for r in util], ['OK'] * 3)
        late = [b for b in util[0]['bills'] if b['bill_month'] == '2026-07'][0]
        self.assertEqual((late['payment_status'], util[0]['provider']), ('late', 'dummy_utility_api'))

    def test_checker_rejects_label_source_and_tampering(self):
        members, bureau, monthly, ids, cb, util = self.setup()
        excluded = ANCHORS['credit_bureau']['excluded_columns']['value']
        leak = bureau.assign(**{'결과값(연체회차)': 0})
        self.assertTrue(s.check_new_external(cb, util, members, leak, monthly, ids, AS_OF, excluded))
        cb[0]['credit_info']['CB'] = 5
        self.assertTrue(s.check_new_external(cb, util, members, bureau, monthly, ids, AS_OF, excluded))
        _, _, _, _, cb2, util2 = self.setup()
        util2[0]['bills'][0]['payment_status'] = 'on_time' if util2[0]['bills'][0]['payment_status'] == 'late' else 'late'
        self.assertTrue(s.check_new_external(cb2, util2, members, bureau, monthly, ids, AS_OF, excluded))


if __name__ == '__main__':
    unittest.main()
