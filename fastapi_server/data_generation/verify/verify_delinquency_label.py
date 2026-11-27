"""N-12-2 v3.7.0 연체 라벨 검증과 데이터 확인 기준(정의서 C32 ⑤) 점검. 읽기 전용.

두 집단: 원래 라벨 보존, 효과 항목 재계산, 설계 확률·라벨 재현, 씬파일 model_inputs 라벨 일치.
기존 집단: C32 ⑤ 기준을 하나씩 PASS/FAIL로 보여 주고 하나라도 FAIL이면 오류로 끝낸다.
  '소득이 비슷한 사람끼리'는 소득 5분위 안에서 구한 값을 인원으로 가중 평균한 것이고,
  지출-상환 부담률 순위상관도 5분위 안의 상관을 평균한다(11/26 임시 계산과 같은 방식). 전체 상관은 참고로만 낸다.
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
from scipy.special import expit
from sklearn.metrics import roc_auc_score
from generate import delinquency_label as dl
from generate.build_delinquency_label import LEDGER_COLUMNS
from generate.nonfinancial_label import draw_labels

R = Path(__file__).resolve().parents[1]
# 소득이 비슷한 사람끼리 설계 방향(+)을 확인하는 효과 항목. 소득 자체(log2_income)는 5분위로 묶으므로 제외한다.
DIRECTION_EFFECTS = ['dsr', 'balance_to_income', 'expense_ratio', 'deficit_months', 'zero_income_months', 'card_utilization',
                     'private_lender', 'new_loans_90d', 'cash_advance']


def read(path):
    return pd.read_csv(path, encoding='utf-8-sig', float_precision='round_trip')


def load(folder, cfg):
    f = R/folder
    profiles = read(f/'profiles.csv')
    base = read(f/'base_207.csv').rename(columns={'식별구분': 'customer_id'})
    frame = profiles.merge(base[['customer_id', cfg['original_label_source']] + LEDGER_COLUMNS], on='customer_id', how='left', validate='one_to_one')
    meta = read(f/'labels_delinquency_metadata.csv')
    assert list(meta.customer_id) == list(frame.customer_id), (folder, 'metadata rows')
    return frame, meta


def check_integrity(folder, seed_offset, cfg):
    frame, meta = load(folder, cfg)
    label = frame[cfg['label_column']].to_numpy()
    assert np.array_equal((frame[cfg['original_label_source']].to_numpy() > 0).astype(int), meta.original_label), (folder, 'original label')
    np.testing.assert_allclose(dl.effect_logit(frame, cfg['effects']), meta.effect_logit, rtol=0, atol=1e-9)
    eligible = meta.eligible.to_numpy() == 1
    logit = (meta.original_logit + meta.effect_logit).to_numpy()
    probability = meta.design_probability.to_numpy()
    # 절편은 저장하지 않으므로 대상 고객의 확률에서 되돌려, 모두 같은 값인지 확인한다.
    intercept = dl.logit_from_probability(probability[eligible]) - logit[eligible]
    assert np.ptp(intercept[(probability[eligible] > 1e-6) & (probability[eligible] < 1 - 1e-6)]) < 1e-6, (folder, 'one intercept')
    np.testing.assert_allclose(probability[eligible], expit(logit[eligible] + np.median(intercept)), rtol=0, atol=1e-8)
    assert (probability[~eligible] == 0).all() and (label[~eligible] == 0).all(), (folder, 'ineligible rows')
    assert abs(probability[eligible].mean() - meta.original_label[eligible].mean()) < 1e-6, (folder, 'target rate')
    rng = np.random.default_rng(np.random.SeedSequence([cfg['seed']['value'], 217, seed_offset]))
    assert np.array_equal(draw_labels(probability, rng.random(len(probability))), label), (folder, 'label redraw')
    if (R/folder/'model_inputs.csv').exists():
        inputs = read(R/folder/'model_inputs.csv').set_index('customer_id')[cfg['label_column']]
        assert np.array_equal(inputs.loc[frame.customer_id], label), (folder, 'model_inputs label')
    return dict(rows=int(len(frame)), eligible=int(eligible.sum()), original_rate=round(float(meta.original_label[eligible].mean()), 4),
                new_rate=round(float(label[eligible].mean()), 4))


def check_criteria(cfg):
    """C32 ⑤ 데이터 확인 기준(기존 집단)."""
    frame, meta = load('data', cfg)
    y = frame[cfg['label_column']].to_numpy()
    income = frame.annual_income_krw.to_numpy(float)
    dsr = frame.annual_debt_service_krw.to_numpy(float) / income
    expense = frame.expense_ratio.to_numpy(float) * income
    quintile = pd.qcut(income, 5, labels=False)
    values = dl.effect_values(frame)
    within = {name: float(sum(roc_auc_score(y[quintile == q], values[name].to_numpy()[quintile == q]) * (quintile == q).sum()
                                  for q in range(5)) / len(y)) for name in DIRECTION_EFFECTS}
    corr_within = float(np.mean([pd.Series(expense[quintile == q]).rank().corr(pd.Series(dsr[quintile == q]).rank()) for q in range(5)]))
    deficit = frame.deficit_months.to_numpy()
    results = [
        ('연체 라벨 양성 9.4~10.4%', float(y.mean()), 0.094 <= y.mean() <= 0.104),
        ('설계 확률 AUC 0.75~0.80', float(roc_auc_score(y, meta.design_probability)), 0.75 <= roc_auc_score(y, meta.design_probability) <= 0.80),
        *[(f'소득 비슷한 사람끼리 AUC ≥ 0.50: {name}', value, value >= 0.50) for name, value in within.items()],
        ('상환액 > 소득 0%', float(np.mean(dsr > 1)), not (dsr > 1).any()),
        ('지출 > 소득 0%', float(np.mean(frame.expense_ratio > 1)), not (frame.expense_ratio > 1).any()),
        ('상환 부담률 70% 초과 ≤ 4%', float(np.mean(dsr > 0.7)), np.mean(dsr > 0.7) <= 0.04),
        ('6개월 이상 적자 ≤ 20%', float(np.mean(deficit >= 6)), np.mean(deficit >= 6) <= 0.20),
        ('12개월 적자 ≤ 8%', float(np.mean(deficit == 12)), np.mean(deficit == 12) <= 0.08),
        ('지출-상환 부담률 순위상관 |r| ≤ 0.1 (소득 5분위 평균)', corr_within, abs(corr_within) <= 0.1),
        ('월소득 중앙 325만~345만 원', float(np.median(income) / 12), 3_250_000 <= np.median(income) / 12 <= 3_450_000),
    ]
    reference = dict(expense_dsr_rank_corr_all=round(float(pd.Series(expense).rank().corr(pd.Series(dsr).rank())), 4),
                     monthly_expense_median=round(float(np.median(expense) / 12)),
                     positive_rate_by_segment={str(k): round(float(v), 4) for k, v in frame.groupby('segment')[cfg['label_column']].mean().items()},
                     positive_rate_by_age={str(k): round(float(v), 4) for k, v in frame.groupby(pd.cut(frame.age, [19, 29, 39, 49, 59, 69]), observed=True)[cfg['label_column']].mean().items()})
    return [dict(criterion=name, value=round(float(value), 4), result='PASS' if ok else 'FAIL') for name, value, ok in results], reference


def main():
    cfg = json.loads((R/'reference/delinquency_label.json').read_text(encoding='utf-8'))
    report = {'legacy': check_integrity('data', 0, cfg), 'thinfile': check_integrity('thinfile', 1, cfg)}
    report['criteria'], report['reference'] = check_criteria(cfg)
    failed = [c['criterion'] for c in report['criteria'] if c['result'] == 'FAIL']
    report['status'] = 'FAIL' if failed else 'PASS'
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if failed:
        raise SystemExit(f'criteria failed: {failed}')


if __name__ == '__main__':
    main()
