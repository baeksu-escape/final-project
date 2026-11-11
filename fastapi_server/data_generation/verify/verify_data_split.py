"""N-25·N-26 v3.6.0 학습·검증·시험 분리(data_split.csv) 독립 검증 in data/ and thinfile/. Read-only.

전 고객이 한 번씩, TRAIN/VALID/TEST 세 값만, 직군 x 기존 라벨 칸마다 비율 건수(내림 + 큰 나머지)와 정확히 같은지,
같은 seed로 다시 나누면 결과가 같은지 확인한다. 보조 라벨·씬파일 cohort 분포는 기록만 한다.
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
from generate.build_data_split import assign_splits

ROOT = Path(__file__).resolve().parents[1]
SPLITS = ['TRAIN', 'VALID', 'TEST']


def expected_counts(n, ratios):
    """생성기와 별도로 칸 건수를 계산한다: 각 구분의 정확한 몫을 내림하고, 남는 수는 나머지가 큰 구분부터 1씩 준다."""
    shares = np.array([n * ratios[s] for s in SPLITS])
    base = np.floor(shares).astype(int)
    rest = n - base.sum()
    for i in sorted(range(3), key=lambda k: (base[k] - shares[k], k))[:rest]:
        base[i] += 1
    return dict(zip(SPLITS, base.tolist()))


def main():
    cfg = json.loads((ROOT/'reference/data_split.json').read_text(encoding='utf-8'))
    ratios, strata, seed = cfg['ratios']['value'], cfg['strata']['value'], cfg['seed']['value']
    report = {'ratios': ratios, 'strata': strata, 'seed': seed}
    for i, folder in enumerate(('data', 'thinfile')):
        prof = pd.read_csv(ROOT/folder/'profiles.csv', encoding='utf-8-sig')
        split = pd.read_csv(ROOT/folder/cfg['output_file'], encoding='utf-8-sig')
        assert list(split.columns) == ['customer_id', 'data_split'], folder
        assert split.customer_id.is_unique and len(split) == len(prof) and set(split.customer_id) == set(prof.customer_id), (folder, 'every customer once')
        assert split.data_split.isin(SPLITS).all(), (folder, 'values')
        assert list(split.customer_id) == list(prof.customer_id), (folder, 'same row order as profiles')
        t = prof.merge(split, on='customer_id', validate='one_to_one')
        for key, g in t.groupby(strata):
            got = g.data_split.value_counts().reindex(SPLITS, fill_value=0).to_dict()
            assert got == expected_counts(len(g), ratios), (folder, key, got)
        again = assign_splits(prof[['customer_id'] + strata], ratios, strata, np.random.default_rng([seed, i]))
        pd.testing.assert_frame_equal(again, split, check_dtype=False, obj=f'{folder} rerun')
        lab = cfg['strata']['value'][1]
        rows = {s: dict(n=int((t.data_split == s).sum()), label_rate=round(float(t.loc[t.data_split == s, lab].mean()), 4)) for s in SPLITS}
        nonfin = pd.read_csv(ROOT/folder/'labels_nonfinancial.csv', encoding='utf-8-sig').set_index('customer_id').label_nonfin_effect_12m
        for s in SPLITS:
            rows[s]['label_nonfin_effect_rate'] = round(float(nonfin.loc[t.customer_id[t.data_split == s]].mean()), 4)
        if 'cohort' in t:
            rows['cohort_test_counts'] = t[t.data_split == 'TEST'].cohort.value_counts().sort_index().to_dict()
        rows['smallest_stratum_test'] = int(min(expected_counts(len(g), ratios)['TEST'] for _, g in t.groupby(strata)))
        report[folder] = rows
    report['status'] = 'PASS'
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
