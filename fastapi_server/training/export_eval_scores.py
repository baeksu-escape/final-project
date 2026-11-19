# N-25 모형 성능 비교용 행 단위 평가 점수 내보내기 — 평가 행마다 기존·대안 점수(0~1000)와 정답 라벨 2개를 CSV로 낸다.
# 관리자 화면(FP-185)과 API(FP-184)가 컷오프별 지표·ROC를 이 파일로 계산한다. 기존 집단은 VALID 행만, 씬파일 집단은 모델이 학습하지 않은 집단이라 노출 1인 TRAIN+VALID 행을 쓴다.
# TEST는 읽자마자 버리고 파일에 넣지 않는다(최종 평가 FP-144 때 같은 형식으로 따로 만든다).
# 같은 라벨끼리 비교하려고 라벨마다 두 모델을 TRAIN으로 새로 학습한다(정의서 10장 C20). 서버에 올린 모델 두 개(기존=연체 라벨, 대안=비금융 효과 라벨)는 같은 설정이라 그대로 재현된다.
# 실행(fastapi_server 폴더에서): python -m training.export_eval_scores --data-dir <학습 데이터 폴더>
# 결과: eval_scores.csv(Git 제외, #파일공유로 전달)와 설명 파일 eval_scores.meta.json. 서비스 연결·DB 적재는 하지 않는다.
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import roc_auc_score

from training import config
from training.data_io import load_train_valid, sha256_of
from training.explain import to_score
from training.preprocess import prepare
from training.train import fit_model

LABEL_COLUMNS = {"delinq": "label_any_delinquency_12m", "nonfin": "label_nonfin_effect_12m"}
MODEL_FEATURES = {"legacy": config.LEGACY_FEATURES, "alt": config.ALTERNATIVE_FEATURES}
# 점수 열 이름: score_<모델>_<학습·평가 라벨>. legacy_delinq와 alt_nonfin이 서버에 올린 모델이다.
SCORE_COLUMNS = {(model, label): f"score_{model}_{label}" for label in LABEL_COLUMNS for model in MODEL_FEATURES}
SHIPPED = {("legacy", "delinq"): "legacy.joblib", ("alt", "nonfin"): "alternative.joblib"}
GROUP_TABLES = {"legacy": config.TABLE_RELATIVE_PATH, "thinfile": Path("1_model") / "thinfile_model_table.csv"}
EXPOSURE_COLUMN = "eval_future_credit_exposure"
# 평가에 쓰는 분할. 기존 집단은 TRAIN으로 모델을 학습하므로 VALID만, 씬파일은 이 모델들이 학습하지 않은 집단이라 TRAIN+VALID(누수 없음)를 쓴다.
# 씬파일을 학습에 쓰기로 하면 TRAIN 행이 누수가 되므로 VALID만 쓰도록 바꿔야 한다(--thinfile-valid-only).
EVAL_SPLITS = {"legacy": [config.VALID_SPLIT], "thinfile": [config.TRAIN_SPLIT, config.VALID_SPLIT]}
OUTPUT_COLUMNS = ["customer_id", "group", "segment", "data_split", *LABEL_COLUMNS.values(), *SCORE_COLUMNS.values()]
DEFAULT_OUT_PATH = config.DEFAULT_OUT_DIR / "eval_scores.csv"


def log_odds(model, frame: pd.DataFrame, features: list) -> np.ndarray:
    """모델의 불량 log-odds(raw score)."""
    return np.asarray(model.predict(frame[features], raw_score=True), dtype=float)


def scores_from(model, frame: pd.DataFrame, features: list) -> pd.Series:
    """log-odds를 서비스와 같은 식(명세서 O-3)으로 0~1000 정수 점수로 바꾼다."""
    return pd.Series([to_score(value) for value in log_odds(model, frame, features)], index=frame.index)


def prepare_group(table_path: Path, group: str = "legacy") -> pd.DataFrame:
    """학습 표를 읽어(TEST 제외) 학습과 같은 전처리를 한다. 전처리가 직군을 부호로 바꾸므로 원래 이름을 segment_name 열에 남긴다.
    씬파일 집단은 eval_future_credit_exposure = 1인 고객만 평가에 쓴다(0인 고객은 라벨이 항상 0이라 가짜 패턴을 만든다, 정의서 5장)."""
    raw = load_train_valid(table_path)
    if group == "thinfile":
        if EXPOSURE_COLUMN not in raw.columns:
            sys.exit(f"씬파일 표에 {EXPOSURE_COLUMN} 열이 없다(데이터 버전이 맞는지 확인)")
        kept = raw[raw[EXPOSURE_COLUMN] == 1]
        dropped = raw[raw[EXPOSURE_COLUMN] != 1]
        excluded = {split: int((dropped[config.SPLIT_COLUMN] == split).sum()) for split in (config.TRAIN_SPLIT, config.VALID_SPLIT)}
        raw = kept
    else:
        excluded = {config.TRAIN_SPLIT: 0, config.VALID_SPLIT: 0}
    prepared = prepare(raw)
    prepared.attrs["excluded_rows"] = excluded
    prepared["segment_name"] = raw["segment"].to_numpy()
    return prepared


def build_rows(models: dict, groups: dict, eval_splits: dict | None = None) -> pd.DataFrame:
    """집단별 표에서 평가 분할(EVAL_SPLITS)의 행만 골라 정답 라벨과 모델별 점수를 붙인다.
    models는 (모델, 라벨) → 학습한 모델, groups는 집단 이름 → prepare_group 결과. TEST는 prepare_group이 이미 버려서 여기에 없다."""
    splits_by_group = eval_splits or EVAL_SPLITS
    parts = []
    for group, frame in groups.items():
        valid = frame[frame[config.SPLIT_COLUMN].isin(splits_by_group[group])].copy()
        valid["group"] = group
        for (model_name, label_key), model in models.items():
            valid[SCORE_COLUMNS[(model_name, label_key)]] = scores_from(model, valid, MODEL_FEATURES[model_name])
        valid["segment"] = valid["segment_name"]     # 점수를 낸 뒤에 부호로 바뀐 segment를 원래 직군 이름으로 되돌린다
        parts.append(valid[OUTPUT_COLUMNS])
    return pd.concat(parts, ignore_index=True)


def group_auc(rows: pd.DataFrame) -> dict:
    """점수 열마다 자기 라벨에 대한 AUC(정수로 자른 점수 기준, 점수가 낮을수록 불량)를 집단별로 센다. 파일에 든 행 전체가 대상이다."""
    result = {}
    for group, part in rows.groupby("group", sort=False):
        result[group] = {}
        for (model_name, label_key), column in SCORE_COLUMNS.items():
            labels = part[LABEL_COLUMNS[label_key]]
            result[group][column] = round(float(roc_auc_score(labels, -part[column])), 4) if labels.nunique() == 2 else None
    return result


def count_summary(rows: pd.DataFrame) -> dict:
    """집단·직군별 행 수와 라벨별 양성 수 — 받는 쪽이 건수를 맞춰 볼 수 있게 설명 파일에 남긴다."""
    summary = {}
    for group, part in rows.groupby("group", sort=False):
        by_segment = {str(segment): int(count) for segment, count in part["segment"].value_counts().sort_index().items()}
        by_split = {str(split): int(count) for split, count in part["data_split"].value_counts().sort_index().items()}
        summary[group] = {"rows": int(len(part)), "by_split": by_split, "by_segment": by_segment,
                          "positives": {label: int(part[label].sum()) for label in LABEL_COLUMNS.values()}}
    return summary


def check_shipped(models: dict, legacy_valid: pd.DataFrame, model_dir: Path) -> dict:
    """서버에 올린 모델 파일과 같은 모델이 재현됐는지 VALID 점수가 같은지로 확인한다(파일이 없으면 확인 못 함으로 적는다)."""
    result = {}
    for (model_name, label_key), file_name in SHIPPED.items():
        path = model_dir / file_name
        if not path.exists():
            result[file_name] = "파일 없음(확인 못 함)"
            continue
        features = MODEL_FEATURES[model_name]
        same = np.allclose(log_odds(models[(model_name, label_key)], legacy_valid, features),
                           log_odds(joblib.load(path), legacy_valid, features), atol=1e-9)
        result[file_name] = "같음" if same else "다름"
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="N-25 행 단위 평가 점수 내보내기(기존 집단 VALID, 씬파일 TRAIN+VALID), TEST 미사용")
    parser.add_argument("--data-dir", type=Path, default=config.DEFAULT_DATA_DIR, help="학습 데이터 폴더(1_model/ 이 들어 있는 폴더)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH, help="저장할 CSV 경로")
    parser.add_argument("--model-dir", type=Path, default=config.DEFAULT_OUT_DIR, help="서버 모델 파일(.joblib) 폴더, 재현 확인용")
    parser.add_argument("--skip-thinfile", action="store_true", help="thinfile 집단을 빼고 기존 집단만 낸다")
    parser.add_argument("--thinfile-valid-only", action="store_true", help="thinfile도 VALID 행만 낸다(thinfile을 학습에 쓰는 모델일 때)")
    args = parser.parse_args()

    tables = {name: args.data_dir / path for name, path in GROUP_TABLES.items() if not (args.skip_thinfile and name == "thinfile")}
    for path in tables.values():
        if not path.exists():
            sys.exit(f"학습 표가 없다: {path}")
    groups = {name: prepare_group(path, name) for name, path in tables.items()}
    train = groups["legacy"][groups["legacy"][config.SPLIT_COLUMN] == config.TRAIN_SPLIT]
    seed = config.SEEDS[0]
    print(f"기존 집단 TRAIN {len(train)}행으로 모델 4개 학습(시드 {seed}, TEST 사용 안 함)")
    models = {(model_name, label_key): fit_model(train, MODEL_FEATURES[model_name], LABEL_COLUMNS[label_key], seed)
              for label_key in LABEL_COLUMNS for model_name in MODEL_FEATURES}

    eval_splits = dict(EVAL_SPLITS, thinfile=[config.VALID_SPLIT]) if args.thinfile_valid_only else EVAL_SPLITS
    rows = build_rows(models, groups, eval_splits)
    legacy_valid = groups["legacy"][groups["legacy"][config.SPLIT_COLUMN] == config.VALID_SPLIT]
    shipped = check_shipped(models, legacy_valid, args.model_dir)
    aucs, counts = group_auc(rows), count_summary(rows)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    rows.to_csv(args.out, index=False, encoding="utf-8")
    meta = {
        "file": args.out.name, "file_sha256": sha256_of(args.out), "eval_splits": {name: eval_splits[name] for name in groups}, "rows": int(len(rows)),
        "columns": OUTPUT_COLUMNS, "score_columns": {column: {"model": model_name, "trained_and_evaluated_label": LABEL_COLUMNS[label_key]}
                                                      for (model_name, label_key), column in SCORE_COLUMNS.items()},
        "score_scale": "0~1000 정수, 높을수록 좋음(서비스와 같은 명세서 O-3 환산). 컷오프는 이 점수에 건다",
        "seed": seed, "feature_set_version": config.FEATURE_SET_VERSION, "model_version_of_shipped_models": config.MODEL_VERSION,
        "shipped_models": {"score_legacy_delinq": "legacy.joblib", "score_alt_nonfin": "alternative.joblib"},
        "shipped_models_reproduced": shipped, "counts": counts, "auc_by_score_column": aucs,
        "excluded_rows": {name: frame.attrs.get("excluded_rows") for name, frame in groups.items()},
        "tables_sha256_8": {name: sha256_of(path)[:8] for name, path in tables.items()},
        "library_versions": {"lightgbm": lgb.__version__, "scikit-learn": sklearn.__version__, "pandas": pd.__version__, "numpy": np.__version__},
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": ("라벨마다 두 모델을 기존 집단 TRAIN으로 새로 학습한 값이라 같은 라벨끼리 비교할 수 있다. score_legacy_delinq와 score_alt_nonfin 외의 두 열은 서버에 올린 모델이 아니다. "
                 "thinfile 행은 기존 집단으로 학습한 모델을 적용한 결과다. 이 모델들은 thinfile을 학습하지 않았으므로 TRAIN 행도 평가에 써도 누수가 없지만(표본을 늘리려는 것), thinfile을 학습에 쓰는 모델이 생기면 VALID만 써야 한다. "
                 "eval_future_credit_exposure = 1인 고객만 넣었다(0인 고객은 라벨이 항상 0이라 제외, 정의서 5장, excluded_rows). 씬파일 라벨은 기존 집단과 생성 방식이 달라 집단별로 따로 본다. "
                 "AUC는 시드 하나(11)의 값이라 METRICS_JSON의 5개 시드 평균과 다르다(연체 라벨에서 시드 11의 대안 AUC는 5개 시드 중 가장 높다). 정수 점수 기준이라 확률 기준과 소수 넷째 자리가 다를 수 있다. "
                 "TEST 행은 들어 있지 않다(최종 평가 FP-144). 합성 데이터이며 실제 신용평가 결과가 아니다."),
    }
    args.out.with_suffix(".meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"저장: {args.out} ({len(rows)}행, TEST 없음)")
    for group, info in counts.items():
        print(f"  {group}: {info['rows']}행 {info['by_split']} {info['by_segment']} 양성 {info['positives']}")
        for column, auc in aucs[group].items():
            print(f"    {column}: AUC {auc}")
    print(f"서버 모델 재현 확인: {shipped}")


if __name__ == "__main__":
    main()
