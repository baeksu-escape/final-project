# FP-130 두 모델의 AUC를 같은 라벨로 맞춰 비교한다(VALID까지만, TEST는 읽지 않는다).
# 기존 모델 정답(label_any_delinquency_12m)과 대안 모델 정답(label_nonfin_effect_12m)은 서로 다른 라벨이라,
# 라벨이 다른 AUC를 그대로 빼면 안 된다. 두 모델을 두 라벨에서 각각 평가해 같은 라벨끼리 비교한다.
# 실행(fastapi_server 폴더에서): python -m training.compare_labels [--data-dir <학습 데이터 폴더>]
import argparse
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_auc_score

from training import config
from training.train import fit_model, load_training_sets

LABELS = ["label_any_delinquency_12m", "label_nonfin_effect_12m"]
MODEL_FEATURES = {"기존 18개": config.LEGACY_FEATURES, "대안 38개": config.ALTERNATIVE_FEATURES}


def main() -> None:
    parser = argparse.ArgumentParser(description="기존·대안 모델을 같은 라벨로 맞춰 VALID AUC 비교")
    parser.add_argument("--data-dir", type=Path, default=config.DEFAULT_DATA_DIR)
    parser.add_argument("--with-thinfile", action="store_true", help="씬파일(노출 1) TRAIN 행을 학습에 더한다(train.py와 같은 설정)")
    parser.add_argument("--monotone", action="store_true", help="config.MONOTONE_CONSTRAINTS에 단조 제약을 건다(train.py와 같은 설정)")
    args = parser.parse_args()
    monotone = config.MONOTONE_CONSTRAINTS if args.monotone else None

    train, valid, thin_valid, _ = load_training_sets(args.data_dir, args.with_thinfile)
    same = float((valid[LABELS[0]] == valid[LABELS[1]]).mean())
    print(f"TRAIN {len(train)}행, VALID {len(valid)}행 (TEST 사용 안 함). 두 라벨 값이 같은 비율(VALID): {same:.3f}")

    for label in LABELS:
        print(f"\n[평가 라벨 = {label}] VALID AUC (시드 {len(config.SEEDS)}개 평균 ± 표준편차)")
        by_model = {}
        for name, features in MODEL_FEATURES.items():
            models = [fit_model(train, features, label, seed, monotone) for seed in config.SEEDS]
            aucs = np.array([roc_auc_score(valid[label], model.predict_proba(valid[features])[:, 1]) for model in models])
            by_model[name] = aucs
            print(f"  {name}: {aucs.mean():.4f} ± {aucs.std(ddof=1):.4f}")
            if thin_valid is not None:
                thin = np.array([roc_auc_score(thin_valid[label], model.predict_proba(thin_valid[features])[:, 1]) for model in models])
                print(f"    씬파일 VALID({len(thin_valid)}행): {thin.mean():.4f} ± {thin.std(ddof=1):.4f}")
        diff = by_model["대안 38개"] - by_model["기존 18개"]
        print(f"  대안 − 기존 (시드별): 평균 {diff.mean():+.4f}, 최소 {diff.min():+.4f}, 최대 {diff.max():+.4f}")


if __name__ == "__main__":
    main()
