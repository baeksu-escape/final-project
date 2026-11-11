"""N-25·N-26 v3.6.0 학습·검증·시험 분리(data_split)를 고객 ID 단위로 만든다.

profiles.csv의 직군(segment) x 기존 라벨(label_any_delinquency_12m) 칸마다 고정 seed로 섞어 70/15/15로 나눈다.
data/·thinfile/ 집단마다 따로 나누고, 결과는 각 폴더의 data_split.csv(customer_id, data_split)다.
값은 DDL v0.2 ASSESSMENT.DATA_SPLIT_CODE와 같은 TRAIN/VALID/TEST다. 다른 생성 파일은 바꾸지 않는다.
"""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SPLITS = ['TRAIN', 'VALID', 'TEST']


def config():
    """reference/data_split.json의 비율·seed·층화 열을 읽고 비율 합이 1인지 확인한다."""
    cfg = json.loads((ROOT/'reference/data_split.json').read_text(encoding='utf-8'))
    ratios = cfg['ratios']['value']
    if list(ratios) != SPLITS or abs(sum(ratios.values()) - 1) > 1e-12 or min(ratios.values()) <= 0:
        raise ValueError('ratios must be positive TRAIN/VALID/TEST summing to 1')
    return cfg


def split_counts(n, ratios):
    """칸 크기 n을 비율대로 나눈 정수 건수. 내림한 뒤 남는 수를 큰 나머지 순(같으면 TRAIN·VALID·TEST 순)으로 준다."""
    exact = [n * ratios[s] for s in SPLITS]
    counts = [int(np.floor(x)) for x in exact]
    order = sorted(range(len(SPLITS)), key=lambda i: (-(exact[i] - counts[i]), i))
    for i in order[:n - sum(counts)]:
        counts[i] += 1
    return dict(zip(SPLITS, counts))


def assign_splits(profiles, ratios, strata, rng):
    """N-25 칸마다 고객 ID를 정렬한 뒤 섞어 앞에서부터 TRAIN·VALID·TEST를 붙인다. 고객 한 명은 한 구분에만 들어간다."""
    if not profiles.customer_id.is_unique:
        raise ValueError('customer_id must be unique')
    if profiles[strata].isna().any().any():
        raise ValueError('strata columns must not be null')
    parts = []
    for _, g in profiles.groupby(strata, sort=True):
        ids = rng.permutation(np.sort(g.customer_id.to_numpy()))
        c = split_counts(len(ids), ratios)
        labels = np.repeat(SPLITS, [c[s] for s in SPLITS])
        parts.append(pd.DataFrame(dict(customer_id=ids, data_split=labels)))
    out = pd.concat(parts, ignore_index=True)
    return profiles[['customer_id']].merge(out, on='customer_id', how='left', validate='one_to_one')


def run(folders=('data', 'thinfile')):
    """N-25 두 학습 집단의 data_split.csv를 쓴다."""
    cfg = config()
    strata = cfg['strata']['value']
    for i, folder in enumerate(folders):
        prof = pd.read_csv(ROOT/folder/'profiles.csv', encoding='utf-8-sig', usecols=['customer_id'] + strata)
        out = assign_splits(prof, cfg['ratios']['value'], strata, np.random.default_rng([cfg['seed']['value'], i]))
        out.to_csv(ROOT/folder/cfg['output_file'], index=False, encoding='utf-8-sig')
        print(f'{folder}/{cfg["output_file"]}: ' + ', '.join(f'{s} {int((out.data_split == s).sum())}' for s in SPLITS))


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    run()
