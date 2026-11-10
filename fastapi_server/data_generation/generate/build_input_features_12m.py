"""N-05-2·N-12 회원이 제공하는 최근 완결 12개월의 모델 입력 집계를 만든다."""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd
from generate.input_feature_logic import aggregate_input_features
from generate.synthesis_logic import inject_anomalies

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ['customer_id', 'income_12m_krw', 'expense_12m_krw', 'debt_service_12m_krw', 'expense_ratio_12m', 'dsr_12m',
           'income_cv_12m', 'zero_income_months_12m', 'deficit_months_12m', 'worst_month_net_cash_12m_krw',
           'dp_payment_amount_12m_krw', 'dp_amount_to_income_12m']


def input_months():
    """기본 모델 집계 기간이 회원 입력 기간 전체 12개월과 같은지 확인한다."""
    members = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))['members']
    months = members['model_feature_months']['value']
    if len(months) != 12 or months != members['input_months']['value']:
        raise ValueError('model_feature_months must equal the 12 member input months')
    return months


def input_features_12m(monthly, payment, months):
    """월별 입력을 연율화 없이 집계한다. 0소득의 비율은 NULL로 남긴다."""
    entered = monthly[monthly.month.isin(months)]
    if entered[['income_krw', 'expense_total_krw', 'debt_service_krw']].isna().any().any():
        raise ValueError('entered monthly amounts must be observed, zero is valid')
    return aggregate_input_features(monthly, payment, months, 12)[COLUMNS]


def anomaly_spec():
    """기존 6개월 주입과 분리된 12개월 시연 설정을 읽는다."""
    return json.loads((ROOT/'reference/anomaly_injection_12m.json').read_text(encoding='utf-8'))


def run(folders=('data', 'thinfile')):
    """N-12 두 학습 집단에 12개월 집계와 독립 이상치 기록을 저장한다. 서비스 더미는 변경하지 않는다."""
    months = input_months()
    spec = anomaly_spec()
    for i, folder in enumerate(folders):
        d = ROOT/folder
        monthly = pd.read_csv(d/'monthly_history.csv', encoding='utf-8-sig')
        payment = pd.read_csv(d/'digital_payment_monthly.csv', encoding='utf-8-sig')
        f = input_features_12m(monthly, payment, months)
        f, log = inject_anomalies(f, spec, np.random.default_rng([spec['seed']['value'], i]))
        f.to_csv(d/spec['target_file'], index=False, encoding='utf-8-sig')
        log.to_csv(d/spec['log_file'], index=False, encoding='utf-8-sig')
        print(f'{folder}/input_features_12m.csv: {len(f)} customers, months {months[0]}~{months[-1]}, {len(log)} anomaly cells')


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    run()
