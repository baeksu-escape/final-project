# N-12-2 학습 표 읽기 공통 함수 — 학습(train.py)·비교(compare_labels.py)·보고서(data_report.py)가 함께 쓴다.
# lightgbm·shap 없이 쓸 수 있게 pandas·표준 라이브러리만 가져온다(보고서만 만들 때 학습 라이브러리가 필요 없도록 train.py에서 분리).
import hashlib
import sys
from pathlib import Path

import pandas as pd

from training import config


def sha256_of(path: Path) -> str:
    """학습 표 파일의 SHA-256 — 어떤 파일로 학습했는지 설명 파일에 남긴다."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_train_valid(table_path: Path) -> pd.DataFrame:
    """학습 표를 읽고 TRAIN·VALID 행만 남긴다(TEST 행은 바로 버린다). 필요한 열이 없으면 이름을 알리고 멈춘다."""
    df = pd.read_csv(table_path)
    needed = {config.SPLIT_COLUMN}
    for spec in config.MODELS.values():
        needed.update(spec["features"])
        needed.add(spec["label"])
    missing = sorted(needed - set(df.columns))
    if missing:
        sys.exit(f"학습 표에 없는 열이 있다(데이터 버전이 맞는지 확인): {missing}")
    return df[df[config.SPLIT_COLUMN].isin([config.TRAIN_SPLIT, config.VALID_SPLIT])].copy()
