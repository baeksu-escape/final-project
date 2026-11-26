# 모델 0.3 학습 설정과 사전 기준(정의서 C33) 점검 코드 검사. 작은 합성 표만 쓰며 학습 데이터·모델 파일·DB 없이 실행한다.
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import copy
import json
import unittest

from training import check_v03, config, train
from tests.test_training_options import DataDirCase, make_table


class ConfigTests(unittest.TestCase):
    def test_v03_adds_c33_and_c36_features_and_keeps_v02(self):
        added = set(config.MONOTONE_CONSTRAINTS_V03) - set(config.MONOTONE_CONSTRAINTS)
        c33 = {"debt_balance_krw", "debt_service_current_krw", "L00000001", "L22000900", "LA0099212", "CF1231605", "zero_income_months_svc_12m"}
        c36 = {"telecom_late_months": 1, "telecom_on_time_streak": -1, "utility_late_months": 1, "dp_payment_count_12m": -1}
        self.assertEqual(added, c33 | set(c36))
        self.assertTrue(all(config.MONOTONE_CONSTRAINTS_V03[name] == 1 for name in c33))
        for name, sign in c36.items():
            self.assertEqual(config.MONOTONE_CONSTRAINTS_V03[name], sign, name)
        self.assertTrue(set(c36) <= set(config.ALTERNATIVE_EXTRA_FEATURES))    # 기존 모델에는 영향이 없다
        for name, sign in config.MONOTONE_CONSTRAINTS.items():
            self.assertEqual(config.MONOTONE_CONSTRAINTS_V03[name], sign, name)
        self.assertEqual((len(config.MONOTONE_CONSTRAINTS), len(config.MONOTONE_CONSTRAINTS_V03)), (8, 19))
        self.assertTrue((set(config.MONOTONE_CONSTRAINTS_V03) - set(c36)) <= set(config.LEGACY_FEATURES))


class CaseTests(unittest.TestCase):
    def test_base_cases_use_every_model_feature(self):
        self.assertEqual(set(check_v03.BASE), set(config.ALTERNATIVE_FEATURES))
        for _, case, reference, sign in check_v03.direction_cases():
            self.assertEqual(set(case), set(config.ALTERNATIVE_FEATURES))
            self.assertIn(sign, (1, -1))
        self.assertEqual(len(check_v03.direction_cases()), 8)

    def test_added_loan_changes_debt_and_cash_flow_together(self):
        loan = check_v03.with_added_loan()
        self.assertEqual((loan["L00000001"], loan["debt_balance_krw"], loan["debt_service_current_krw"]), (1, 20_000_000, 400_000))
        self.assertAlmostEqual(loan["dsr_svc_12m"], 400_000 / check_v03.SALARY)
        self.assertEqual(loan["worst_month_net_cash_svc_12m_krw"], check_v03.BASE["worst_month_net_cash_svc_12m_krw"] - 400_000)
        self.assertEqual(loan["deficit_months_svc_12m"], 0)

    def test_double_debt_selects_borrowers_and_doubles(self):
        frame = make_table(30, 7, with_exposure=False)
        frame.loc[:9, "debt_balance_krw"] = 0
        has, more = check_v03.double_debt(frame)
        self.assertEqual(len(has), 20)
        self.assertTrue((more.debt_balance_krw == has.debt_balance_krw * 2).all())
        self.assertTrue((more.worst_month_net_cash_svc_12m_krw == has.worst_month_net_cash_svc_12m_krw - has.debt_service_current_krw).all())

    def test_personas_build_service_features(self):
        people = check_v03.persona_features()
        self.assertEqual(list(people), ["낮음", "평균", "좋음"])
        self.assertEqual(people["낮음"]["zero_income_months_svc_12m"], 2)
        self.assertEqual(people["평균"]["debt_balance_krw"], 22_000_000)
        self.assertEqual(people["좋음"]["CL0631905"], 10.0)

    def test_wrong_directions_ignores_no_change(self):
        scores = {"up": (700, 690, 1), "same": (690, 690, -1), "bad": (700, 690, -1)}
        self.assertEqual(check_v03.wrong_directions(scores), ["bad"])


def passing() -> dict:
    """모든 기준을 통과하는 측정값."""
    seed = str(check_v03.SHIPPED_SEED)
    auc = lambda value: {"mean": value}
    return {"double_debt_change": {k: {"mean": -5.0} for k in config.MODELS},
            "added_loan_change": {k: {seed: 0} for k in config.MODELS},
            "wrong_directions": {k: {seed: []} for k in config.MODELS},
            "persona_scores": {"alternative": {seed: {"낮음": 500, "평균": 650, "좋음": 750}}},
            "auc": {"legacy": {"label_any_delinquency_12m": auc(0.70), "label_nonfin_effect_12m": auc(0.68)},
                    "alternative": {"label_any_delinquency_12m": auc(0.705), "label_nonfin_effect_12m": auc(0.72)}}}


class JudgeTests(unittest.TestCase):
    def failed(self, measured):
        return sorted({row["id"] for row in check_v03.judge(measured) if row["result"] == "FAIL"})

    def test_all_pass(self):
        self.assertEqual(self.failed(passing()), [])
        self.assertEqual(len(check_v03.judge(passing())), 11)

    def test_each_criterion_can_fail(self):
        seed = str(check_v03.SHIPPED_SEED)
        changes = {
            "a": lambda m: m["double_debt_change"]["legacy"].update(mean=0.0),
            "b": lambda m: m["added_loan_change"]["alternative"].update({seed: 1}),
            "c": lambda m: m["wrong_directions"]["legacy"].update({seed: ["급여 -90%"]}),
            "d": lambda m: m["persona_scores"]["alternative"][seed].update({"평균": 750}),
            "e": lambda m: (m["auc"]["legacy"]["label_any_delinquency_12m"].update(mean=0.61), m["auc"]["alternative"]["label_any_delinquency_12m"].update(mean=0.61)),
            "f": lambda m: m["auc"]["alternative"]["label_any_delinquency_12m"].update(mean=0.73),
        }
        for key, change in changes.items():
            measured = copy.deepcopy(passing())
            change(measured)
            self.assertEqual(self.failed(measured), [key], key)


class EndToEndTests(DataDirCase):
    def test_check_runs_on_a_small_table_without_test_rows(self):
        out = self.data_dir.parent / "check.json"
        self.run_main(check_v03, ["--data-dir", str(self.data_dir), "--out", str(out)])
        report = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual(report["split"], "VALID")
        self.assertEqual(report["data"]["valid_rows"], int((self.legacy[config.SPLIT_COLUMN] == "VALID").sum()))
        self.assertEqual(len(report["results"]), 11)

    def test_train_option_uses_v03_constraints_and_records_the_set(self):
        self.run_main(train, ["--data-dir", str(self.data_dir), "--out-dir", str(self.out_dir), "--monotone-set", "v03", "--model-version", "LGBM-BASE-0.3"])
        meta = json.loads((self.out_dir / "alternative.meta.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["monotone_constraints"], config.MONOTONE_CONSTRAINTS_V03)
        self.assertEqual(meta["options"], {"with_thinfile": False, "monotone": True, "monotone_set": "v03"})
        self.assertEqual(meta["model_version"], "LGBM-BASE-0.3")


if __name__ == "__main__":
    unittest.main()
