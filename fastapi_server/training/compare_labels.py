# FP-130 두 모델의 AUC를 같은 라벨로 맞춰 비교한다(VALID까지만, TEST는 읽지 않는다).
# 기존 모델 정답(label_any_delinquency_12m)과 대안 모델 정답(label_nonfin_effect_12m)은 서로 다른 라벨이라,
# 라벨이 다른 AUC를 그대로 빼면 안 된다. 두 모델을 두 라벨에서 각각 평가해 같은 라벨끼리 비교한다.
# 실행(fastapi_server 폴더에서): python -m training.compare_labels [--data-dir <학습 데이터 폴더>]
import argparse
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_auc_score

from training import config
from training.preprocess import prepare
from training.train import fit_model, load_train_valid

LABELS = ["label_any_delinquency_12m", "label_nonfin_effect_12m"]
MODEL_FEATURES = {"기존 18개": config.LEGACY_FEATURES, "대안 38개": config.ALTERNATIVE_FEATURES}


def main() -> None:
    parser = argparse.ArgumentParser(description="기존·대안 모델을 같은 라벨로 맞춰 VALID AUC 비교")
    parser.add_argument("--data-dir", type=Path, default=config.DEFAULT_DATA_DIR)
    args = parser.parse_args()
    table_path = args.data_dir / config.TABLE_RELATIVE_PATH
    if not table_path.exists():
        sys.exit(f"학습 표가 없다: {table_path}")

    data = prepare(load_train_valid(table_path))
    train = data[data[config.SPLIT_COLUMN] == config.TRAIN_SPLIT]
    valid = data[data[config.SPLIT_COLUMN] == config.VALID_SPLIT]
    same = float((valid[LABELS[0]] == valid[LABELS[1]]).mean())
    print(f"TRAIN {len(train)}행, VALID {len(valid)}행 (TEST 사용 안 함). 두 라벨 값이 같은 비율(VALID): {same:.3f}")

    for label in LABELS:
        print(f"\n[평가 라벨 = {label}] VALID AUC (시드 {len(config.SEEDS)}개 평균 ± 표준편차)")
        by_model = {}
        for name, features in MODEL_FEATURES.items():
            aucs = np.array([roc_auc_score(valid[label], fit_model(train, features, label, seed).predict_proba(valid[features])[:, 1])
                             for seed in config.SEEDS])
            by_model[name] = aucs
            print(f"  {name}: {aucs.mean():.4f} ± {aucs.std(ddof=1):.4f}")
        diff = by_model["대안 38개"] - by_model["기존 18개"]
        print(f"  대안 − 기존 (시드별): 평균 {diff.mean():+.4f}, 최소 {diff.min():+.4f}, 최대 {diff.max():+.4f}")


if __name__ == "__main__":
    main()
