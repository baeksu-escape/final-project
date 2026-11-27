"""N-12-2 v3.7.0 연체 라벨을 다시 만든다(원래 라벨에 상환 부담·잔액·소득 등의 효과를 더함).

extend.py(data/)와 build_thinfile.py(thinfile/) 다음, build_nonfinancial_labels.py·build_data_split.py 전에 실행한다. 집단마다:
  profiles.csv                  label_any_delinquency_12m 열만 새 값으로 바꾼다(다른 열은 그대로)
  model_inputs.csv(씬파일)      같은 라벨 열을 맞춘다
  segment_summary.csv·cohort_summary.csv  label_rate를 맞춘다
  labels_delinquency_metadata.csv  원래 라벨·설계 확률(scope: reference, 모델 입력 아님)
원래 라벨은 base_207의 '결과값(연체회차)'에서 읽으므로 여러 번 실행해도 같은 결과다.
설정: reference/delinquency_label.json
"""
from pathlib import Path
import argparse, ast, copy, json
import numpy as np
import pandas as pd
from scipy.special import expit
from generate import delinquency_label as dl
from generate.nonfinancial_label import calibrate_intercept, draw_labels

ROOT = Path(__file__).resolve().parents[1]
LEDGER_COLUMNS = ['CL0631905', 'LA0099212', 'L22000900', 'CF1231605']


def read(path):
    # round_trip: 다시 저장해도 라벨 밖의 실수 값이 마지막 자리까지 그대로이게 한다.
    return pd.read_csv(path, encoding='utf-8-sig', float_precision='round_trip')


def write(frame, path):
    frame.to_csv(path, index=False, encoding='utf-8-sig')


def replay_original():
    """원본 학원 생성기를 다시 실행해 라벨을 만들 때의 지역 변수를 받는다(원본 파일은 고치지 않는다).
    generate()의 마지막 return만 locals() 반환으로 바꾼다. build_loan_extension.py와 같은 방식이다."""
    path = ROOT/'reference/academy/generate_dataset_original.py'
    tree = ast.parse(path.read_text(encoding='utf-8'))
    functions = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'generate']
    if len(functions) != 1 or not isinstance(functions[0].body[-1], ast.Return):
        raise RuntimeError('Expected exactly one generate() function ending with return in the bundled source')
    replay = copy.deepcopy(functions[0])
    replay.body[-1] = ast.Return(value=ast.Call(func=ast.Name(id='locals', ctx=ast.Load()), args=[], keywords=[]))
    nodes = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom, ast.Assign))] + [replay]
    module = ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[]))
    namespace = {'__file__': str(ROOT/'reference/replay.py')}
    exec(compile(module, str(path), 'exec'), namespace)
    values = namespace['generate']()
    needed = {'logit', 'risk', 'loan_num', 'result', 'target'}
    if needed - set(values):
        raise RuntimeError(f'Replay state is incomplete: {sorted(needed - set(values))}')
    return values


def legacy_logits(ids, original, cfg):
    """기존 집단의 원본 logit(잡음 포함)과 잡음 제외 값. 재실행 라벨이 base_207과 같은지 먼저 확인한다."""
    v = replay_original()
    index = ids.str[3:].astype(int).to_numpy() - 1
    if not np.array_equal((np.asarray(v['target'])[index] > 0).astype(int), original):
        raise RuntimeError('replayed labels differ from base_207; the source data does not match the bundled generator')
    noisy = np.asarray(v['logit'], float)[index]
    formula = cfg['original_formula']
    clean = dl.noiseless_original_logit(np.asarray(v['risk'])[index], np.asarray(v['result']['DQ1200001'])[index],
                                        np.asarray(v['loan_num'])[index], formula)
    noise = noisy - clean
    if len(noise) > 1000 and not (abs(noise.mean()) < 0.05 and abs(noise.std() - formula['noise_sd']) < 0.05):
        raise RuntimeError(f'original formula in config does not match the generator (noise mean {noise.mean():.3f}, sd {noise.std():.3f})')
    return noisy, clean


def build(folder, cfg, seed_offset, thinfile):
    folder = Path(folder)
    profiles = read(folder/'profiles.csv')
    base = read(folder/'base_207.csv').rename(columns={'식별구분': 'customer_id'})
    frame = profiles.merge(base[['customer_id', cfg['original_label_source']] + LEDGER_COLUMNS], on='customer_id', how='left', validate='one_to_one')
    original = (frame[cfg['original_label_source']].to_numpy() > 0).astype(int)
    effect = dl.effect_logit(frame, cfg['effects'])
    if thinfile:
        meta = read(folder/'target_metadata.csv')
        meta = frame[['customer_id']].merge(meta, on='customer_id', how='left', validate='one_to_one')
        eligible = meta.future_credit_exposure.to_numpy() == 1
        # 씬파일은 잡음 없는 값을 따로 저장하지 않아, 설계 확률(잡음 포함)의 logit을 원본 logit과 바탕값에 함께 쓴다.
        noisy = np.where(eligible, dl.logit_from_probability(meta.target_design_probability), 0.0)
        clean = noisy
    else:
        eligible = np.ones(len(frame), bool)
        noisy, clean = legacy_logits(frame.customer_id, original, cfg)
    target = float(original[eligible].mean())
    logit = noisy + effect
    intercept = calibrate_intercept(logit[eligible], target)
    probability = np.where(eligible, expit(logit + intercept), 0.0)
    rng = np.random.default_rng(np.random.SeedSequence([cfg['seed']['value'], 217, seed_offset]))
    label = draw_labels(probability, rng.random(len(probability)))

    column = cfg['label_column']
    profiles[column] = label
    write(profiles, folder/'profiles.csv')
    write(pd.DataFrame(dict(customer_id=frame.customer_id, original_label=original, eligible=eligible.astype(int),
                            original_logit=noisy, effect_logit=effect, base_logit=clean + effect + intercept,
                            design_probability=probability)), folder/'labels_delinquency_metadata.csv')
    if (folder/'model_inputs.csv').exists():
        inputs = read(folder/'model_inputs.csv')
        inputs[column] = inputs.customer_id.map(profiles.set_index('customer_id')[column])
        write(inputs, folder/'model_inputs.csv')
    for name, key in (('segment_summary.csv', 'segment'), ('cohort_summary.csv', 'cohort')):
        if (folder/name).exists():
            summary = read(folder/name)
            summary['label_rate'] = summary[key].map(profiles.groupby(key)[column].mean())
            write(summary, folder/name)
    return dict(folder=str(folder), rows=int(len(frame)), eligible=int(eligible.sum()), target_rate=target,
                positive_rate=float(label[eligible].mean()), intercept=float(intercept))


def run(data=ROOT/'data', thinfile=ROOT/'thinfile'):
    cfg = json.loads((ROOT/'reference/delinquency_label.json').read_text(encoding='utf-8'))
    summary = [build(data, cfg, 0, False), build(thinfile, cfg, 1, True)]
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data', default=str(ROOT/'data'))
    ap.add_argument('--thinfile', default=str(ROOT/'thinfile'))
    a = ap.parse_args(); run(a.data, a.thinfile)
