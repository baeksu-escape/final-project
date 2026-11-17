# FP-135 모델 입력 규격 — 서비스가 만든 피처 dict를 학습한 모델이 받는 한 행 표로 바꾼다.
# 서비스(pipeline/feature_builder.build_features)의 dict에서 없는 값은 None이다. 모델 입력에서는 NaN(결측)이며 0으로 채우지 않는다.
# 열 순서와 범주형 부호는 학습 때와 같아야 하므로 config.py의 목록을 그대로 쓴다(README 「모델 입력·출력 규격」).
# 출력은 model.predict_proba(X)[:, 1] = 불량(양성) 확률이다. 점수 변환(명세서 O-3)은 모델 밖 서비스에서 한다.
import pandas as pd

from training import config
from training.preprocess import encode_categories


def to_model_input(feature_dict: dict, model_name: str) -> pd.DataFrame:
    """피처 dict를 model_name("legacy" 또는 "alternative") 모델의 입력 한 행으로 바꾼다.
    dict에 모델 피처 키가 없으면 오류로 멈춘다(없는 값은 키가 아니라 None으로 보낸다). 모델에 쓰지 않는 키는 무시한다.
    """
    features = config.MODELS[model_name]["features"]
    missing_keys = [name for name in features if name not in feature_dict]
    if missing_keys:
        raise ValueError(f"피처 dict에 없는 키: {missing_keys}")
    row = {name: feature_dict[name] for name in features}
    frame = encode_categories(pd.DataFrame([row], columns=features))
    numeric = [name for name in features if name not in config.CATEGORICAL_FEATURES]
    frame[numeric] = frame[numeric].apply(pd.to_numeric).astype("float64")   # None은 NaN이 된다. 숫자가 아닌 문자열은 오류로 멈춘다
    return frame
