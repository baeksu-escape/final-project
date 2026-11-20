# N-12-2·N-14 기존·대안 모델 학습 스크립트(임시 베이스라인) — TRAIN으로 학습하고 VALID로 평가한다. TEST는 쓰지 않는다.
# 실행(fastapi_server 폴더에서): python -m training.train --data-dir <학습 데이터 폴더>
# 결과: artifacts/ 에 모델 파일(.joblib, Git 제외)과 설명 파일(.meta.json). 점수·등급 변환과 서비스 연결(FP-141)은 하지 않는다.
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
import sklearn
from sklearn.metrics import roc_auc_score

from training import config
from training.data_io import load_thinfile_train_valid, load_train_valid, sha256_of  # noqa: F401  (compare_labels.py 등이 training.train에서 가져가는 이름도 유지)
from training.preprocess import prepare


def fit_model(train: pd.DataFrame, features: list, label: str, seed: int, monotone: dict | None = None) -> lgb.LGBMClassifier:
    """모델 하나를 학습한다. monotone(피처 이름 → +1/-1)을 주면 그 피처에만 단조 제약을 걸고, 없으면 제약 없이 지금까지와 같게 학습한다."""
    params = dict(config.LGBM_PARAMS)
    if monotone:
        params["monotone_constraints"] = [monotone.get(name, 0) for name in features]
    model = lgb.LGBMClassifier(random_state=seed, **params)
    model.fit(train[features], train[label],
              categorical_feature=[c for c in features if c in config.CATEGORICAL_FEATURES])
    return model


def load_training_sets(data_dir: Path, with_thinfile: bool = False) -> tuple:
    """학습·검증 표를 전처리해서 (TRAIN, 기존 집단 VALID, 씬파일 VALID 또는 None, 표 정보)를 돌려준다. TEST는 읽자마자 버린다.
    with_thinfile면 TRAIN에 씬파일(노출 1) TRAIN 행을 더한다. 씬파일 TRAIN은 학습에 쓰이므로 평가에는 쓰지 않고 씬파일 VALID만 따로 돌려준다."""
    legacy_path = data_dir / config.TABLE_RELATIVE_PATH
    if not legacy_path.exists():
        sys.exit(f"학습 표가 없다: {legacy_path}")
    legacy = prepare(load_train_valid(legacy_path))
    train = legacy[legacy[config.SPLIT_COLUMN] == config.TRAIN_SPLIT]
    valid = legacy[legacy[config.SPLIT_COLUMN] == config.VALID_SPLIT]
    info = {"table_sha256": sha256_of(legacy_path), "train_rows_legacy": int(len(train)), "valid_rows": int(len(valid))}
    if not with_thinfile:
        return train, valid, None, info
    thinfile_path = data_dir / config.THINFILE_TABLE_RELATIVE_PATH
    if not thinfile_path.exists():
        sys.exit(f"씬파일 표가 없다: {thinfile_path}")
    thinfile = prepare(load_thinfile_train_valid(thinfile_path))
    thin_train = thinfile[thinfile[config.SPLIT_COLUMN] == config.TRAIN_SPLIT]
    thin_valid = thinfile[thinfile[config.SPLIT_COLUMN] == config.VALID_SPLIT]
    info.update({"thinfile_table_sha256": sha256_of(thinfile_path), "train_rows_thinfile": int(len(thin_train)), "valid_rows_thinfile": int(len(thin_valid))})
    return pd.concat([train, thin_train], ignore_index=True), valid, thin_valid, info


def shap_top(model, valid: pd.DataFrame, features: list, count: int = 8) -> dict:
    """VALID 앞 200행의 평균 |SHAP| 상위 항목. 모델이 쓴 기여도일 뿐 인과관계가 아니다."""
    values = shap.TreeExplainer(model).shap_values(valid[features].head(200))
    values = values[1] if isinstance(values, list) else values
    ranked = pd.Series(np.abs(values).mean(axis=0), index=features).sort_values(ascending=False).head(count)
    return {name: round(float(v), 4) for name, v in ranked.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description="기존·대안 모델 학습(임시 베이스라인, TEST 미사용)")
    parser.add_argument("--data-dir", type=Path, default=config.DEFAULT_DATA_DIR, help="학습 데이터 폴더(1_model/ 이 들어 있는 폴더)")
    parser.add_argument("--out-dir", type=Path, default=config.DEFAULT_OUT_DIR, help="모델·설명 파일을 저장할 폴더")
    parser.add_argument("--with-thinfile", action="store_true", help="씬파일(노출 1) TRAIN 행을 학습에 더한다(결측을 학습시키는 c안). 씬파일 TRAIN은 평가에 쓰지 않는다")
    parser.add_argument("--monotone", action="store_true", help="config.MONOTONE_CONSTRAINTS의 피처에 단조 제약을 건다(후보 A)")
    parser.add_argument("--model-version", default=config.MODEL_VERSION, help="설명 파일에 적을 모델 버전(기본은 config 값, 0.2를 만들 때만 바꾼다)")
    args = parser.parse_args()
    monotone = config.MONOTONE_CONSTRAINTS if args.monotone else None

    train, valid, thin_valid, data_info = load_training_sets(args.data_dir, args.with_thinfile)
    thin_text = f" + 씬파일 TRAIN {data_info['train_rows_thinfile']}행, 씬파일 VALID {len(thin_valid)}행" if args.with_thinfile else ""
    print(f"TRAIN {len(train)}행, VALID {len(valid)}행{thin_text} (TEST 사용 안 함), 단조 제약 {'켬' if monotone else '끔'}")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    for name, spec in config.MODELS.items():
        features, label = spec["features"], spec["label"]
        aucs, thin_aucs = [], []
        for seed in config.SEEDS:
            model = fit_model(train, features, label, seed, monotone)
            aucs.append(roc_auc_score(valid[label], model.predict_proba(valid[features])[:, 1]))
            if thin_valid is not None:
                thin_aucs.append(roc_auc_score(thin_valid[label], model.predict_proba(thin_valid[features])[:, 1]))
        saved = fit_model(train, features, label, config.SEEDS[0], monotone)
        mean_auc, std_auc = float(np.mean(aucs)), float(np.std(aucs, ddof=1))
        print(f"{name}: 피처 {len(features)}개, 라벨 {label}, 양성 비율 {train[label].mean():.3f}, "
              f"VALID AUC {mean_auc:.4f} ± {std_auc:.4f}")
        if thin_aucs:
            print(f"    씬파일 VALID AUC {np.mean(thin_aucs):.4f} ± {np.std(thin_aucs, ddof=1):.4f}")

        joblib.dump(saved, args.out_dir / f"{name}.joblib")
        meta = {
            "model": name,
            "model_version": args.model_version,
            "feature_set_version": config.FEATURE_SET_VERSION,
            "algorithm_name": config.ALGORITHM_NAME,
            "label": label,
            "features": features,
            "category_codes": config.CATEGORY_CODES,
            "lgbm_params": config.LGBM_PARAMS,
            "seeds": config.SEEDS,
            "saved_model_seed": config.SEEDS[0],
            "c8_limits": {"income_sum_max_krw": config.INCOME_SUM_MAX_KRW,
                          "expense_avg_max_krw": config.EXPENSE_AVG_MAX_KRW,
                          "debt_service_min_krw": config.DEBT_SERVICE_MIN_KRW},
            "preprocess": "C8 상한 밖 값과 파생 열을 결측으로 둠(정의서 C19 전처리 (나)), 범주형은 고정 부호표, 남은 결측은 모델이 처리",
            "options": {"with_thinfile": bool(args.with_thinfile), "monotone": bool(monotone)},
            "monotone_constraints": dict(monotone) if monotone else None,
            "data": {"table_sha256": data_info["table_sha256"], "train_rows": int(len(train)), "valid_rows": int(len(valid)),
                     **{key: value for key, value in data_info.items() if "thinfile" in key or key == "train_rows_legacy"}},
            "valid_auc": {"mean": round(mean_auc, 4), "std": round(std_auc, 4), "by_seed": [round(float(a), 4) for a in aucs]},
            "valid_auc_thinfile": ({"mean": round(float(np.mean(thin_aucs)), 4), "std": round(float(np.std(thin_aucs, ddof=1)), 4),
                                    "by_seed": [round(float(a), 4) for a in thin_aucs]} if thin_aucs else None),
            "shap_top_mean_abs": shap_top(saved, valid, features),
            "library_versions": {"lightgbm": lgb.__version__, "shap": shap.__version__,
                                 "scikit-learn": sklearn.__version__, "pandas": pd.__version__, "numpy": np.__version__},
            "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "note": "임시 베이스라인. 합성 데이터, 튜닝 없음, TEST 미사용. 점수·SHAP은 실제 신용평가 결과나 인과관계가 아니다."
                    + (" 씬파일(노출 1) TRAIN을 학습에 포함했다(valid_auc는 기존 집단 VALID 기준, 씬파일은 valid_auc_thinfile)." if args.with_thinfile else "")
                    + (" 방향이 분명한 피처에 단조 제약을 걸었다(monotone_constraints)." if monotone else ""),
        }
        (args.out_dir / f"{name}.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장 위치: {args.out_dir}")


if __name__ == "__main__":
    main()
