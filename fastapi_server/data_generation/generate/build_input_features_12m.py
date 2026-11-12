"""N-05-2·N-12 회원이 제공하는 최근 완결 12개월의 모델 입력 집계를 만든다.
v3.6.0: 같은 파일 뒤쪽에 서비스 입력 규칙과 같은 정의의 열(SVC_COLUMNS)을 붙인다. 기존 열·값·이상치 기록은 그대로다."""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd
from generate.input_feature_logic import aggregate_input_features, service_view_features
from generate.synthesis_logic import inject_anomalies

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ['customer_id', 'income_12m_krw', 'expense_12m_krw', 'debt_service_12m_krw', 'expense_ratio_12m', 'dsr_12m',
           'income_cv_12m', 'zero_income_months_12m', 'deficit_months_12m', 'worst_month_net_cash_12m_krw',
           'dp_payment_amount_12m_krw', 'dp_amount_to_income_12m']
# v3.6.0 서비스 정의 열: 소득만 달마다(급여소득자는 기준월 소득을 12개월로 펼침), 지출은 평균 월 지출, 상환은 기준월 상환액.
SVC_COLUMNS = ['income_svc_12m_krw', 'income_cv_svc_12m', 'zero_income_months_svc_12m', 'expense_avg_month_krw',
               'debt_service_current_krw', 'expense_ratio_svc_12m', 'dsr_svc_12m', 'deficit_months_svc_12m',
               'worst_month_net_cash_svc_12m_krw']


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


def service_features_12m(monthly, profiles, months):
    """N-05-2 v3.6.0 서비스 정의 열을 고객 순서를 맞춰 만든다. 직군은 profiles.segment를 쓴다."""
    return service_view_features(monthly, profiles[['customer_id', 'segment']], months)[['customer_id'] + SVC_COLUMNS]


def anomaly_spec(name='anomaly_injection_12m.json'):
    """기존 6개월 주입과 분리된 12개월 시연 설정을 읽는다. v3.6.0 서비스 정의 열은 별도 파일(anomaly_injection_12m_svc.json)이다."""
    return json.loads((ROOT/'reference'/name).read_text(encoding='utf-8'))


def run(folders=('data', 'thinfile')):
    """N-12 두 학습 집단에 12개월 집계와 독립 이상치 기록을 저장한다. 서비스 더미는 변경하지 않는다."""
    months = input_months()
    spec = anomaly_spec()
    svc_spec = anomaly_spec('anomaly_injection_12m_svc.json')
    for i, folder in enumerate(folders):
        d = ROOT/folder
        monthly = pd.read_csv(d/'monthly_history.csv', encoding='utf-8-sig')
        payment = pd.read_csv(d/'digital_payment_monthly.csv', encoding='utf-8-sig')
        f = input_features_12m(monthly, payment, months)
        f, log = inject_anomalies(f, spec, np.random.default_rng([spec['seed']['value'], i]))
        # v3.6.0: 기존 열 주입이 끝난 뒤 서비스 정의 열을 붙이고 별도 seed로 따로 주입한다(기존 열·기록 불변).
        profiles = pd.read_csv(d/'profiles.csv', encoding='utf-8-sig', usecols=['customer_id', 'segment'])
        svc = service_features_12m(monthly, profiles, months)
        svc, svc_log = inject_anomalies(svc, svc_spec, np.random.default_rng([svc_spec['seed']['value'], i]))
        f = f.merge(svc, on='customer_id', how='left', validate='one_to_one')
        f.to_csv(d/spec['target_file'], index=False, encoding='utf-8-sig')
        log.to_csv(d/spec['log_file'], index=False, encoding='utf-8-sig')
        svc_log.to_csv(d/svc_spec['log_file'], index=False, encoding='utf-8-sig')
        print(f'{folder}/input_features_12m.csv: {len(f)} customers, months {months[0]}~{months[-1]}, {len(log)} + {len(svc_log)} (svc) anomaly cells')


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    run()
