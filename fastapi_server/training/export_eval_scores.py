# N-25 모형 성능 비교용 행 단위 평가 점수 내보내기 — 평가 행마다 기존·대안 점수(0~1000)와 정답 라벨 2개를 CSV로 낸다.
# 관리자 화면(FP-185)과 API(FP-184)가 컷오프별 지표·ROC를 이 파일로 계산한다. 기존 집단은 VALID 행만, 씬파일 집단은 모델이 학습하지 않은 집단이라 노출 1인 TRAIN+VALID 행을 쓴다.
# TEST는 읽자마자 버리고 파일에 넣지 않는다(최종 평가 FP-144 때 같은 형식으로 따로 만든다).
# 같은 라벨끼리 비교하려고 라벨마다 두 모델을 TRAIN으로 새로 학습한다(정의서 10장 C20). 서버에 올린 모델 두 개(기존=연체 라벨, 대안=비금융 효과 라벨)는 같은 설정이라 그대로 재현된다.
# 실행(fastapi_server 폴더에서): python -m training.export_eval_scores --data-dir <학습 데이터 폴더>
# 결과: eval_scores.csv(Git 제외, #파일공유로 전달)와 설명 파일 eval_scores.meta.json. --sql-out을 주면 MODEL_EVAL_SAMPLE 적재용 SQL도 만든다(DB 적용은 DB 담당).
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
GROUP_TABLES = {"legacy": config.TABLE_RELATIVE_PATH, "thinfile": config.THINFILE_TABLE_RELATIVE_PATH}
EXPOSURE_COLUMN = config.EXPOSURE_COLUMN
# 평가에 쓰는 분할. 기존 집단은 TRAIN으로 모델을 학습하므로 VALID만, 씬파일은 이 모델들이 학습하지 않은 집단이라 TRAIN+VALID(누수 없음)를 쓴다.
# 씬파일을 학습에 쓰기로 하면 TRAIN 행이 누수가 되므로 VALID만 쓰도록 바꿔야 한다(--thinfile-valid-only).
EVAL_SPLITS = {"legacy": [config.VALID_SPLIT], "thinfile": [config.TRAIN_SPLIT, config.VALID_SPLIT]}
OUTPUT_COLUMNS = ["customer_id", "group", "segment", "data_split", *LABEL_COLUMNS.values(), *SCORE_COLUMNS.values()]
DEFAULT_OUT_PATH = config.DEFAULT_OUT_DIR / "eval_scores.csv"
# MODEL_EVAL_SAMPLE(DDL C10) 적재용: CSV의 직군 이름을 DIM_WORKER_TYPE 코드로, 집단은 대문자 코드로 바꾼다.
SEGMENT_TO_WORKER_TYPE = {"wage": "EMPLOYEE", "selfemp": "SELF_EMPLOYED", "freelance": "FREELANCER"}
LOAD_COLUMNS = ["MODEL_VERSION", "SPLIT_CODE", "GROUP_CODE", "CUSTOMER_REF", "WORKER_TYPE_CODE",
                "LABEL_ANY_DELINQUENCY_12M", "LABEL_NONFIN_EFFECT_12M",
                "SCORE_LEGACY_DELINQ", "SCORE_ALT_DELINQ", "SCORE_LEGACY_NONFIN", "SCORE_ALT_NONFIN"]


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


def render_load_sql(rows: pd.DataFrame, model_version: str, csv_sha256: str) -> str:
    """평가 점수 행을 MODEL_EVAL_SAMPLE에 넣는 SQL 글로 바꾼다. 이미 그 모델 버전의 행이 있으면 멈추고(한 번만 적재), 500행마다 커밋한다."""
    counts = rows.groupby(["group", "data_split"], sort=False).size()
    count_text = ", ".join(f"{group}/{split} {int(count)}" for (group, split), count in counts.items())
    lines = [
        "-- ====================================================================",
        "-- N-25 모형 성능 비교용 평가 표본 적재 — MODEL_EVAL_SAMPLE(DDL C10)에 고객별 기존·대안 모델 점수와 정답 라벨을 넣는다 (FP-235)",
        f"-- 모델 버전 {model_version}, 행 수: {len(rows)}, 집단/분할별: {count_text}",
        f"-- 원본: training/export_eval_scores.py가 만든 eval_scores.csv(SHA-256 {csv_sha256}). CSV는 Git에 없다(받는 쪽은 이 SQL로 만든 표를 읽는다).",
        ("-- 기존 집단은 VALID만, 씬파일은 노출 1인(eval_future_credit_exposure = 1) TRAIN+VALID이며 TEST는 없다(최종 평가 FP-144)."
         if "TRAIN" in set(rows.loc[rows["group"] == "thinfile", "data_split"]) or "thinfile" not in set(rows["group"]) else
         "-- 기존 집단·씬파일 모두 VALID만이다(씬파일 노출 1, 씬파일 TRAIN은 모델 학습에 써서 평가에서 뺐다). TEST는 없다(최종 평가 FP-144)."),
        "-- 점수 4개: 연체 라벨로 학습·평가한 기존·대안, 비금융 효과 라벨로 학습·평가한 기존·대안(0~1000). 서버 모델은 SCORE_LEGACY_DELINQ와 SCORE_ALT_NONFIN뿐이다.",
        "-- 한 번만 실행한다: 이 모델 버전의 행이 이미 있으면 오류로 멈춘다(다시 넣으려면 먼저 해당 행을 지운다). 표가 없으면 create_model_eval_sample.sql을 먼저 실행한다.",
        "-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다. 공용 DB는 DB 담당이 실행한다.",
        "-- ====================================================================",
        "SET DEFINE OFF",
        "WHENEVER SQLERROR EXIT FAILURE ROLLBACK",
        "DECLARE",
        "    v_cnt PLS_INTEGER;",
        "BEGIN",
        f"    SELECT COUNT(*) INTO v_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = '{model_version}';",
        "    IF v_cnt <> 1 THEN",
        f"        RAISE_APPLICATION_ERROR(-20114, 'MODEL_REGISTRY에 {model_version} 행이 없습니다. 모델 등록 SQL을 먼저 실행하세요');",
        "    END IF;",
        f"    SELECT COUNT(*) INTO v_cnt FROM MODEL_EVAL_SAMPLE WHERE MODEL_VERSION = '{model_version}';",
        "    IF v_cnt > 0 THEN",
        f"        RAISE_APPLICATION_ERROR(-20115, '이미 {model_version} 평가 표본이 ' || v_cnt || '행 있습니다. 다시 넣으려면 먼저 지우세요');",
        "    END IF;",
        "END;",
        "/",
    ]
    column_text = ", ".join(LOAD_COLUMNS)
    for number, row in enumerate(rows.itertuples(index=False), 1):
        values = [f"'{model_version}'", f"'{row.data_split}'", f"'{row.group.upper()}'", f"'{row.customer_id}'", f"'{SEGMENT_TO_WORKER_TYPE[row.segment]}'",
                  str(int(getattr(row, LABEL_COLUMNS["delinq"]))), str(int(getattr(row, LABEL_COLUMNS["nonfin"])))]
        values += [str(int(getattr(row, column))) for column in SCORE_COLUMNS.values()]
        lines.append(f"INSERT INTO MODEL_EVAL_SAMPLE ({column_text}) VALUES ({', '.join(values)});")
        if number % 500 == 0:
            lines.append("COMMIT;")
    lines += ["COMMIT;", "",
              "-- 확인: 집단·분할별 행 수가 위 머리말과 같아야 한다.",
              "SELECT GROUP_CODE, SPLIT_CODE, COUNT(*) AS ROW_COUNT FROM MODEL_EVAL_SAMPLE GROUP BY GROUP_CODE, SPLIT_CODE ORDER BY GROUP_CODE, SPLIT_CODE;", ""]
    return "\n".join(lines)


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
    parser.add_argument("--sql-out", type=Path, default=None, help="MODEL_EVAL_SAMPLE 적재용 SQL을 저장할 경로(주면 CSV와 함께 만든다)")
    parser.add_argument("--thinfile-valid-only", action="store_true", help="thinfile도 VALID 행만 낸다(thinfile을 학습에 쓰는 모델일 때)")
    parser.add_argument("--with-thinfile", action="store_true", help="씬파일(노출 1) TRAIN 행을 학습에 더해 모델을 학습한다(train.py와 같은 설정). 씬파일은 VALID 행만 내므로 --thinfile-valid-only가 자동으로 켜진다")
    parser.add_argument("--monotone", action="store_true", help="config.MONOTONE_CONSTRAINTS에 단조 제약을 걸어 학습한다(train.py와 같은 설정)")
    parser.add_argument("--model-version", default=config.MODEL_VERSION, help="설명 파일·적재 SQL에 적을 모델 버전(기본은 config 값, 0.2를 만들 때만 바꾼다)")
    args = parser.parse_args()
    if args.with_thinfile and args.skip_thinfile:
        sys.exit("--with-thinfile은 씬파일 표가 필요해서 --skip-thinfile과 함께 쓸 수 없다")
    monotone = config.MONOTONE_CONSTRAINTS if args.monotone else None
    thinfile_valid_only = args.thinfile_valid_only or args.with_thinfile      # 학습에 쓴 씬파일 TRAIN 행은 평가에 쓰면 누수다

    tables = {name: args.data_dir / path for name, path in GROUP_TABLES.items() if not (args.skip_thinfile and name == "thinfile")}
    for path in tables.values():
        if not path.exists():
            sys.exit(f"학습 표가 없다: {path}")
    groups = {name: prepare_group(path, name) for name, path in tables.items()}
    train = groups["legacy"][groups["legacy"][config.SPLIT_COLUMN] == config.TRAIN_SPLIT]
    if args.with_thinfile:
        thin = groups["thinfile"]
        train = pd.concat([train, thin[thin[config.SPLIT_COLUMN] == config.TRAIN_SPLIT]], ignore_index=True)
    seed = config.SEEDS[0]
    print(f"TRAIN {len(train)}행(씬파일 TRAIN {'포함' if args.with_thinfile else '제외'})으로 모델 4개 학습(시드 {seed}, 단조 제약 {'켬' if monotone else '끔'}, TEST 사용 안 함)")
    models = {(model_name, label_key): fit_model(train, MODEL_FEATURES[model_name], LABEL_COLUMNS[label_key], seed, monotone)
              for label_key in LABEL_COLUMNS for model_name in MODEL_FEATURES}

    eval_splits = dict(EVAL_SPLITS, thinfile=[config.VALID_SPLIT]) if thinfile_valid_only else EVAL_SPLITS
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
        "seed": seed, "feature_set_version": config.FEATURE_SET_VERSION, "model_version_of_shipped_models": args.model_version,
        "options": {"with_thinfile": bool(args.with_thinfile), "monotone": bool(monotone), "thinfile_valid_only": bool(thinfile_valid_only)},
        "monotone_constraints": dict(monotone) if monotone else None,
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

    if args.sql_out is not None:
        args.sql_out.parent.mkdir(parents=True, exist_ok=True)
        args.sql_out.write_text(render_load_sql(rows, args.model_version, meta["file_sha256"]), encoding="utf-8", newline="\n")
        print(f"적재 SQL 저장: {args.sql_out}")
    print(f"저장: {args.out} ({len(rows)}행, TEST 없음)")
    for group, info in counts.items():
        print(f"  {group}: {info['rows']}행 {info['by_split']} {info['by_segment']} 양성 {info['positives']}")
        for column, auc in aucs[group].items():
            print(f"    {column}: AUC {auc}")
    print(f"서버 모델 재현 확인: {shipped}")


if __name__ == "__main__":
    main()
