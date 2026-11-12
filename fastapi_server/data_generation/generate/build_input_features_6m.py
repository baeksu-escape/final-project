"""6-month aggregates of the figures a service member enters (income, living expense, debt service), for both cohorts.

v3.5.7. 기존 최근 완결 6개월 집계를 호환용으로 보존한다(v3.5.13). v3.5.11부터 회원 입력은
12개월(members.input_months)이고, 보존·참고용 집계 기간은 members.model_feature_months_6m(6개월)가 정한다.
Reads monthly_history.csv and digital_payment_monthly.csv; writes input_features_6m.csv
next to them. Does not change any other file. Run after build_nonfinancial_sources.
"""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd
from generate.synthesis_logic import inject_anomalies
from generate.input_feature_logic import aggregate_input_features

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ['customer_id', 'income_6m_krw', 'expense_6m_krw', 'debt_service_6m_krw', 'expense_ratio_6m', 'dsr_6m',
           'income_cv_6m', 'zero_income_months_6m', 'deficit_months_6m', 'worst_month_net_cash_6m_krw',
           'dp_payment_amount_6m_krw', 'dp_amount_to_income_6m']


def input_months():
    """N-05-2 호환용 6개월 집계 기간을 읽는다. 기본 학습 기간 12개월과 분리해 기존 값을 보존한다."""
    a = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))
    return a['members']['model_feature_months_6m']['value']


def input_features_6m(monthly, payment, months):
    """N-05-2 기존 6개월 입력 집계를 공통 수식으로 계산한다. 0소득의 비율은 NULL로 남긴다."""
    return aggregate_input_features(monthly, payment, months, 6)[COLUMNS]


def anomaly_spec():
    """전처리 시연용 결측·이상치 설정(reference/anomaly_injection.json)을 읽는다."""
    return json.loads((ROOT/'reference/anomaly_injection.json').read_text(encoding='utf-8'))


def run(folders=('data', 'thinfile')):
    months = input_months()
    spec = anomaly_spec()
    for i, folder in enumerate(folders):
        d = ROOT/folder
        monthly = pd.read_csv(d/'monthly_history.csv', encoding='utf-8-sig')
        payment = pd.read_csv(d/'digital_payment_monthly.csv', encoding='utf-8-sig')
        f = input_features_6m(monthly, payment, months)
        # v3.5.10: 계산한 뒤 저장하기 전에 전처리 시연용 결측·이상치를 넣고 원래 값을 기록 파일에 남긴다.
        f, log = inject_anomalies(f, spec, np.random.default_rng([spec['seed']['value'], i]))
        f.to_csv(d/spec['target_file'], index=False, encoding='utf-8-sig')
        log.to_csv(d/spec['log_file'], index=False, encoding='utf-8-sig')
        print(f'{folder}/input_features_6m.csv: {len(f)} customers, months {months[0]}~{months[-1]}, {len(log)} anomaly cells')


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    run()
