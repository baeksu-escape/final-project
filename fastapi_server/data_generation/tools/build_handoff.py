"""Hand-off bundle for the modelling team: one customer-level table per cohort plus sorted folders.

Run after the full generation (README order) from the package root:
    python -m tools.build_handoff --out ../avenue_training_data
Does not change any generated file. The output folder must not exist yet and must be outside the
package (not the package, not inside it, not a folder containing it), and must not be a symbolic
link (a link is refused even with --overwrite; pass the real folder). To rebuild an earlier bundle
pass --overwrite: the folder must hold exactly the files this tool wrote, as listed with their
SHA256 in .handoff_bundle. If any file is extra, missing or changed, nothing is deleted. Only the
listed files (and directories left empty) are removed; there is no recursive delete. Layout:
  1_model/      legacy_model_table.csv, thinfile_model_table.csv, model_table_columns.csv
  2_detail/     monthly panels, ledgers and the source tables the model tables were built from
  3_reference/  design values, summaries and check outputs (never model inputs)
  docs/         data dictionary and rule documents
Every file in data/ and thinfile/ must be assigned to exactly one folder; an unassigned new
file stops the build so nothing is silently dropped. The model tables are checked against
their source files value by value. A column becomes a feature only if it comes from an allowed
source table and the data dictionary lists it as a delivery field of that table; any other column
is `unclassified` and stops the build.
N-12 v3.5.13: 기본 학습은 input_features_12m.csv의 12개월 집계다. 기존 6개월 열·값은
compatibility_only(보존·참고용)로 남긴다. profiles의 기존 연간·자산·설계 열 제외 정책은 유지한다.
"""
from pathlib import Path
import argparse, hashlib, json, shutil
import numpy as np
import pandas as pd
from generate.build_input_features_6m import COLUMNS as SIX_MONTH_COLUMNS

ROOT = Path(__file__).resolve().parents[1]
LEAK = '결과값(연체회차)'                      # future delinquency months: source of the original label
THIN_PLACEHOLDERS = ['PRE_LMT', 'PRE_RT']      # thin-file placeholders (DATA_SPEC.md): always 0, dropped from the thin table
FRONT_COLS = ['customer_id', 'dataset', 'cohort', 'segment']   # column order only
ID_COLS = ['customer_id']
GROUP_COLS = ['dataset', 'cohort']                              # evaluation grouping, never features
LABELS = ['label_any_delinquency_12m', 'label_nonfin_effect_12m']

DETAIL = {
    'data': ['base_207.csv', 'profiles.csv', 'monthly_history.csv', 'scenarios.csv', 'digital_payment_monthly.csv',
             'social_insurance_monthly.csv', 'nonfinancial_source_features.csv', 'labels_nonfinancial.csv', 'input_features_6m.csv', 'input_features_12m.csv'],
    'thinfile': ['base_207.csv', 'model_inputs.csv', 'profiles.csv', 'monthly_history.csv', 'scenarios.csv',
                 'digital_payment_monthly.csv', 'social_insurance_monthly.csv', 'nonfinancial_source_features.csv',
                 'labels_nonfinancial.csv', 'loans.csv', 'cards.csv', 'delinquencies.csv', 'card_monthly.csv',
                 'card_account_monthly.csv', 'loan_monthly_budget.csv', 'ui_credit_summary.csv', 'input_features_6m.csv', 'input_features_12m.csv'],
}
REFERENCE = {
    'data': ['labels_nonfinancial_metadata.csv', 'effective_config.json', 'segment_summary.csv', 'validation.json',
             'nonfinancial_sources_summary.json', 'rho_sensitivity.csv', 'expense_sensitivity.csv', 'anomaly_log.csv', 'anomaly_log_12m.csv'],
    'thinfile': ['labels_nonfinancial_metadata.csv', 'target_metadata.csv', 'plan.csv', 'availability.csv',
                 'cohort_summary.csv', 'generation_summary.json', 'column_dictionary_207.csv', 'anomaly_log.csv', 'anomaly_log_12m.csv'],
}
DOCS = ['DATA_DICTIONARY.csv', 'DATA_SPEC.md', 'THINFILE.md', 'NONFINANCIAL_LABEL.md', 'NONFINANCIAL_SOURCES.md',
        'CHANGES.md']   # v3.5.12: version history goes with the bundle so the modelling team can see what changed
# profile columns that describe how the row was designed, not the customer
THIN_DESIGN_COLS = ['is_thinfile_scenario', 'label_origin']
# v3.5.13: 기존 profiles의 연간·설계·자산·스냅샷 열은 계속 상세 원천에만 둔다.
# 기본 학습은 명시적인 input_features_12m 열이며 6개월 열은 보존·참고용이다.
NOT_SERVICE_AVAILABLE = ['annual_income_krw', 'annual_debt_service_krw', 'dsr', 'expense_ratio', 'income_cv', 'income_decile',
                         'deficit_months', 'zero_income_months', 'worst_month_net_cash_krw', 'snapshot_dsr',
                         'asset_total_krw', 'liquid_assets_krw', 'net_assets_krw', 'annual_shortfall_krw',
                         'ending_liquid_balance_krw', 'min_liquid_balance_krw', 'months_liquid_negative',
                         'shortfall_to_liquid_ratio', 'exceeds_drawdown_limit', 'liquid_assets_insufficient',
                         'dp_amount_to_income']
# v3.5.7: lender offer fields of the 207 columns (offered limit / rate at application). Members have no offer and the
# dummy credit bureau API does not return them, so they leave the legacy model table too (thin-file: always-0 placeholders).
OFFER_COLS = ['PRE_LMT', 'PRE_RT']


def read(folder, name):
    return pd.read_csv(ROOT/folder/name, encoding='utf-8-sig')


def model_table(group):
    """N-12 서비스에서 재현 가능한 고객별 모델 표를 만든다. 기본 12개월 집계는 라벨 앞에 두고 기존 열의 값·상대 순서를 유지한다."""
    folder = 'data' if group == 'legacy' else 'thinfile'
    base = read(folder, 'base_207.csv').rename(columns={'식별구분': 'customer_id'}).drop(columns=[LEAK]).copy()
    prof = read(folder, 'profiles.csv')
    feat = read(folder, 'nonfinancial_source_features.csv')
    lab = read(folder, 'labels_nonfinancial.csv')
    six = read(folder, 'input_features_6m.csv')
    twelve = read(folder, 'input_features_12m.csv')
    prof = prof.drop(columns=[c for c in NOT_SERVICE_AVAILABLE if c in prof.columns])
    feat = feat.drop(columns=[c for c in NOT_SERVICE_AVAILABLE if c in feat.columns])
    if group == 'thinfile':
        mi = read(folder, 'model_inputs.csv').set_index('customer_id')
        base = base.set_index('customer_id').copy()
        for c in [c for c in mi.columns if c in base.columns]:
            base[c] = mi[c].reindex(base.index)                 # unobserved values become null
        base = base.drop(columns=THIN_PLACEHOLDERS)          # all-null after removing the placeholder; some models fail on it
        base['credit_usage_available'] = mi.credit_usage_available.reindex(base.index)
        base = base.reset_index().copy()
        prof = prof.drop(columns=THIN_DESIGN_COLS)
        meta = read(folder, 'target_metadata.csv')[['customer_id', 'future_credit_exposure']]
        meta = meta.rename(columns={'future_credit_exposure': 'eval_future_credit_exposure'})
    t = prof.merge(base, on='customer_id', validate='one_to_one', suffixes=('', '_207'))
    t = t.merge(feat, on='customer_id', validate='one_to_one').merge(six, on='customer_id', validate='one_to_one')
    t = t.merge(lab, on='customer_id', validate='one_to_one').copy()
    if group == 'thinfile':
        t = t.merge(meta, on='customer_id', validate='one_to_one')
    else:
        t = t.drop(columns=OFFER_COLS).assign(cohort='legacy')
    t = t.assign(dataset=group).copy()
    # N-12 이미 제공 중인 간편결제 12개월 합계는 값이 같은지 확인하고 기존 위치·출처를 유지한다.
    overlap = [c for c in twelve.columns if c in t.columns and c != 'customer_id']
    pd.testing.assert_frame_equal(t.set_index('customer_id').loc[twelve.customer_id, overlap].reset_index(drop=True),
                                  twelve[overlap].reset_index(drop=True), check_dtype=False, check_names=False)
    new_columns = [c for c in twelve.columns if c not in t.columns]
    t = t.merge(twelve[['customer_id'] + new_columns], on='customer_id', validate='one_to_one')
    front = FRONT_COLS
    tail = LABELS + (['eval_future_credit_exposure'] if group == 'thinfile' else [])
    middle = [c for c in t.columns if c not in front + tail]
    old_middle = [c for c in middle if c not in new_columns]
    return t[front + old_middle + new_columns + tail]


FEATURE_SOURCES = {'base_207', 'model_inputs', 'profiles', 'nonfinancial_source_features', 'input_features_6m', 'input_features_12m'}
EVAL_COLS = ['eval_future_credit_exposure']


def origins(group):
    """모델 표의 열마다 출처를 기록해 사전·역할 검증에 사용한다. 병합과 같은 순서로 먼저 나온 출처를 유지한다."""
    folder = 'data' if group == 'legacy' else 'thinfile'
    out = {}
    names = ['profiles', 'base_207'] + (['model_inputs'] if group == 'thinfile' else []) + ['nonfinancial_source_features', 'input_features_6m', 'input_features_12m', 'labels_nonfinancial']
    for n in names:
        cols = pd.read_csv(ROOT/folder/f'{n}.csv', encoding='utf-8-sig', nrows=0).rename(columns={'식별구분': 'customer_id'}).columns
        for c in cols:
            out.setdefault(c, n)
    if group == 'thinfile':
        out['credit_usage_available'] = 'model_inputs'
    return out


def column_roles(tables, dictionary, org=None):
    """N-12 출처·사전 검사를 통과한 열만 학습 피처로 분류한다. 6개월은 보존·참고용이며 미분류 열은 거부한다."""
    d = dictionary.drop_duplicates('field').set_index('field')
    delivery = set(map(tuple, dictionary.loc[dictionary.scope == 'delivery', ['table', 'field']].itertuples(index=False, name=None)))
    org = {g: origins(g) for g in tables} if org is None else org
    rows = []
    for c in dict.fromkeys(c for t in tables.values() for c in t.columns):
        sources = {org[g].get(c) for g, t in tables.items() if c in t.columns}
        if c in ID_COLS:
            role = 'id'
        elif c in GROUP_COLS:
            role = 'group'
        elif c in LABELS:
            role = 'label'
        elif c in EVAL_COLS:
            role = 'eval_only'
        elif sources and sources <= FEATURE_SOURCES and all((s, c) in delivery for s in sources):
            # N-12 사전·출처 검사를 통과한 기존 6개월 열만 호환용으로 남긴다.
            role = 'compatibility_only' if c in SIX_MONTH_COLUMNS[1:] and sources == {'input_features_6m'} else 'feature'
        else:
            role = 'unclassified'
        src = d.loc[c] if c in d.index else None
        rows.append(dict(column=c, role=role,
                         in_legacy=int(c in tables['legacy'].columns), in_thinfile=int(c in tables['thinfile'].columns),
                         description=(src['description'] if src is not None else ''),
                         unit=(src['unit'] if src is not None else ''),
                         source_table=(src['table'] if src is not None else '')))
    r = pd.DataFrame(rows)
    note = {'customer_id': '고객 ID. 피처로 쓰지 않는다', 'dataset': 'legacy 또는 thinfile', 'cohort': '씬파일 집단 구분(기존 집단은 legacy). 집단별 평가에 쓰고 피처로 쓰지 않는다',
            'segment': '직군 wage/selfemp/freelance. 피처로 써도 된다', 'eval_future_credit_exposure': '씬파일 평가 대상 표시(1이면 양성이 될 수 있음). 피처로 쓰지 않는다',
            }
    r['note'] = r.column.map(note).fillna('')
    r.loc[r.role == 'compatibility_only', 'note'] = '12개월이 기본 학습. 6개월은 기존 값 보존·참고용이며 기본 학습에서 제외'
    r.loc[r.source_table == 'input_features_12m', 'note'] = '기본 학습용 12개월 집계. 학습 전 결측·이상치 처리 필요'
    bad = r[r.role == 'unclassified'].column.tolist()
    if bad:
        raise ValueError(f'unclassified columns (add them to DATA_DICTIONARY.csv as delivery fields or to an explicit role list): {bad}')
    return r


def check(tables):
    """N-12 고객 누락·미래값 누수를 막고 두 기간의 모델 열을 원천 값과 대조한다."""
    for group, t in tables.items():
        folder = 'data' if group == 'legacy' else 'thinfile'
        prof = read(folder, 'profiles.csv')
        assert t.customer_id.is_unique and len(t) == len(prof) and set(t.customer_id) == set(prof.customer_id), group
        assert LEAK not in t.columns, 'label source column must not be in the model table'
        assert not any(c.endswith('_207') for c in t.columns), 'duplicate columns between profiles and base_207'
        assert not set(NOT_SERVICE_AVAILABLE + OFFER_COLS) & set(t.columns), 'a column members cannot provide is in the model table'
        for name in ['profiles.csv', 'nonfinancial_source_features.csv', 'input_features_6m.csv', 'input_features_12m.csv', 'labels_nonfinancial.csv'] + (['model_inputs.csv'] if group == 'thinfile' else ['base_207.csv']):
            src = read(folder, name).rename(columns={'식별구분': 'customer_id'})
            cols = [c for c in src.columns if c in t.columns and c != 'customer_id']
            a = t.set_index('customer_id').loc[src.customer_id, cols].reset_index(drop=True)
            b = src[cols].reset_index(drop=True)
            pd.testing.assert_frame_equal(a, b, check_dtype=False, check_names=False, obj=f'{group}:{name}')
        if group == 'thinfile':
            # remaining 207 columns are copied unchanged; overlaid ones were compared with model_inputs above
            src = read(folder, 'base_207.csv').rename(columns={'식별구분': 'customer_id'})
            mi_cols = set(read(folder, 'model_inputs.csv').columns)
            cols = [c for c in src.columns if c not in mi_cols | set(THIN_PLACEHOLDERS) | {LEAK, 'customer_id'}]
            a = t.set_index('customer_id').loc[src.customer_id, cols].reset_index(drop=True)
            pd.testing.assert_frame_equal(a, src[cols].reset_index(drop=True), check_dtype=False, obj='thinfile:base_207.csv')
            assert not set(THIN_PLACEHOLDERS) & set(t.columns)
            assert t.eval_future_credit_exposure.isin([0, 1]).all()


MARKER = '.handoff_bundle'


def _files(folder):
    return {p.relative_to(folder).as_posix() for p in folder.rglob('*') if p.is_file() or p.is_symlink()}


def _sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write_marker(out):
    """Record every file written (relative path -> SHA256). Written last."""
    files = {f: _sha(out/f) for f in sorted(_files(out)) if f != MARKER}
    (out/MARKER).write_text(json.dumps(dict(tool='tools/build_handoff.py', files=files), ensure_ascii=False, indent=1), encoding='utf-8')


def prepare_output(out, overwrite, root=ROOT):
    """Return a resolved, empty-or-missing output path, or raise without deleting anything.
    A symbolic link given as --out is refused before resolving, so --overwrite never follows it."""
    given = Path(out)
    if given.is_symlink():                               # checked before resolve(), which would hide the link
        raise FileExistsError(f'{given} is a symbolic link; pass the real folder path instead. Not deleting anything')
    out = given.resolve()
    root = Path(root).resolve()
    if out == root or out.is_relative_to(root) or root.is_relative_to(out):
        raise ValueError(f'--out must be outside the package (not the package, inside it, or a folder containing it): {out}')
    if not out.exists():
        return out
    if not overwrite:
        raise FileExistsError(f'{out} already exists. Use a new folder, or pass --overwrite to rebuild a bundle this tool made')
    if not out.is_dir():
        raise FileExistsError(f'{out} is not a plain folder; not deleting it')
    try:
        listed = json.loads((out/MARKER).read_text(encoding='utf-8'))['files']
    except Exception:
        raise FileExistsError(f'{out} has no valid {MARKER}; not deleting it')
    present = _files(out) - {MARKER}
    if set(listed) != present:
        raise FileExistsError(f'{out} differs from the files build_handoff wrote (extra {sorted(present - set(listed))[:5]}, '
                              f'missing {sorted(set(listed) - present)[:5]}); not deleting anything')
    for rel, digest in listed.items():
        p = out/rel
        if p.is_symlink() or not p.resolve().is_relative_to(out) or _sha(p) != digest:
            raise FileExistsError(f'{out}/{rel} was changed after build_handoff wrote it; not deleting anything')
    for rel in listed:                                   # delete only what the tool wrote
        (out/rel).unlink()
    (out/MARKER).unlink()
    for d in sorted((p for p in out.rglob('*') if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()
    if not any(out.iterdir()):
        out.rmdir()
    return out


def run(out, overwrite=False):
    out = Path(out)
    for folder in ('data', 'thinfile'):
        present = {p.name for p in (ROOT/folder).iterdir() if p.is_file()}
        assigned = set(DETAIL[folder]) | set(REFERENCE[folder])
        if present - assigned or assigned - present:
            raise ValueError(f'{folder}: unassigned {sorted(present - assigned)}, missing {sorted(assigned - present)}')
    tables = {g: model_table(g) for g in ('legacy', 'thinfile')}
    check(tables)
    roles = column_roles(tables, pd.read_csv(ROOT/'docs/DATA_DICTIONARY.csv', encoding='utf-8-sig'))
    out = prepare_output(out, overwrite)
    (out/'1_model').mkdir(parents=True)
    shutil.copy2(ROOT/'tools'/'handoff_README.md', out/'README.md')
    for g, t in tables.items():
        t.to_csv(out/'1_model'/f'{g}_model_table.csv', index=False, encoding='utf-8-sig')
    roles.to_csv(out/'1_model'/'model_table_columns.csv', index=False, encoding='utf-8-sig')
    for top, spec in (('2_detail', DETAIL), ('3_reference', REFERENCE)):
        for folder, names in spec.items():
            dst = out/top/('legacy' if folder == 'data' else 'thinfile'); dst.mkdir(parents=True, exist_ok=True)
            for n in names:
                shutil.copy2(ROOT/folder/n, dst/n)
    lift = ROOT/'nonfinancial_label_lift'
    if lift.exists():
        shutil.copytree(lift, out/'3_reference'/'nonfinancial_label_lift')
    (out/'docs').mkdir()
    for n in DOCS:
        shutil.copy2(ROOT/'docs'/n, out/'docs'/n)
    write_marker(out)
    summary = {g: dict(rows=len(t), columns=len(t.columns), label_rates={l: round(float(t[l].mean()), 4) for l in LABELS}) for g, t in tables.items()}
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, help='new folder for the bundle (must not exist)')
    ap.add_argument('--overwrite', action='store_true', help='rebuild a bundle folder previously made by this tool')
    a = ap.parse_args(); run(a.out, a.overwrite)
