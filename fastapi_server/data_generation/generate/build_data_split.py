"""N-25·N-26 v3.6.0 학습·검증·시험 분리(data_split)를 고객 ID 단위로 만든다.

profiles.csv의 직군(segment) x 연체 라벨(label_any_delinquency_12m) 칸마다 고정 seed로 섞어 70/15/15로 나눈다.
v3.7.0: 기존 집단은 이전 버전 고객(reference/previous_cohort_ids.csv)을 모두 TRAIN에 두고, 씬파일은 원래 라벨로 층화한다.
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


def assign_splits(profiles, ratios, strata, rng, keep_train=None):
    """N-25 칸마다 고객 ID를 정렬한 뒤 섞어 앞에서부터 TRAIN·VALID·TEST를 붙인다. 고객 한 명은 한 구분에만 들어간다.
    keep_train(v3.7.0)을 주면 그 ID는 항상 TRAIN이고, 칸 전체 크기 비율의 VALID·TEST를 나머지 ID에서만 뽑는다."""
    if not profiles.customer_id.is_unique:
        raise ValueError('customer_id must be unique')
    if profiles[strata].isna().any().any():
        raise ValueError('strata columns must not be null')
    parts = []
    for key, g in profiles.groupby(strata, sort=True):
        ids = np.sort(g.customer_id.to_numpy())
        c = split_counts(len(ids), ratios)
        if keep_train is None:
            ids = rng.permutation(ids)
            labels = np.repeat(SPLITS, [c[s] for s in SPLITS])
        else:
            kept = np.array([i in keep_train for i in ids], bool)
            new = rng.permutation(ids[~kept])
            held = c['VALID'] + c['TEST']
            if len(new) < held:
                raise ValueError(f'stratum {key}: only {len(new)} new customers for {held} VALID/TEST rows')
            ids = np.concatenate([new, ids[kept]])
            labels = np.repeat(['VALID', 'TEST', 'TRAIN'], [c['VALID'], c['TEST'], len(ids) - held])
        parts.append(pd.DataFrame(dict(customer_id=ids, data_split=labels)))
    out = pd.concat(parts, ignore_index=True)
    return profiles[['customer_id']].merge(out, on='customer_id', how='left', validate='one_to_one')


def strata_frame(folder, strata, use_original_label):
    """층화에 쓸 표를 읽는다. use_original_label이면 라벨 열을 다시 만들기 전의 원래 라벨로 바꾼다(씬파일 분할 유지)."""
    prof = pd.read_csv(folder/'profiles.csv', encoding='utf-8-sig', usecols=['customer_id'] + strata)
    if use_original_label:
        meta = pd.read_csv(folder/'labels_delinquency_metadata.csv', encoding='utf-8-sig', usecols=['customer_id', 'original_label'])
        original = prof.customer_id.map(meta.set_index('customer_id').original_label)
        if original.isna().any():
            raise ValueError('original_label is missing for some customers')
        prof['label_any_delinquency_12m'] = original.astype(int)
    return prof


def keep_train_ids(cfg, folder):
    """항상 TRAIN에 둘 ID 집합. 설정에 없는 폴더는 None(이전 방식)이다."""
    name = cfg['keep_train']['value'].get(str(folder))
    if name is None:
        return None
    return set(pd.read_csv(ROOT/'reference'/name, encoding='utf-8').customer_id)


def run(folders=('data', 'thinfile')):
    """N-25 두 학습 집단의 data_split.csv를 쓴다."""
    cfg = config()
    strata = cfg['strata']['value']
    for i, folder in enumerate(folders):
        prof = strata_frame(ROOT/folder, strata, folder in cfg['original_label_strata']['value'])
        out = assign_splits(prof, cfg['ratios']['value'], strata, np.random.default_rng([cfg['seed']['value'], i]), keep_train_ids(cfg, folder))
        out.to_csv(ROOT/folder/cfg['output_file'], index=False, encoding='utf-8-sig')
        print(f'{folder}/{cfg["output_file"]}: ' + ', '.join(f'{s} {int((out.data_split == s).sum())}' for s in SPLITS))


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    run()
