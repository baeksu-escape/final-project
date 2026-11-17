# N-12-2 학습 전처리 (정의서 10장 C8 이상치 상한, C19 전처리 (나), C13 구조적 결측).
# 서비스(pipeline/feature_builder.py)와 같은 규칙으로 값을 결측으로 두고, 남은 결측은 모델(LightGBM)이 처리한다.
import numpy as np
import pandas as pd

from training import config


def encode_categories(df: pd.DataFrame) -> pd.DataFrame:
    """범주형 5개를 고정 부호표(config.CATEGORY_CODES)의 번호로 바꾼다. 표에 없는 값·결측은 -1이다(LightGBM이 결측으로 본다)."""
    out = df.copy()
    for column, values in config.CATEGORY_CODES.items():
        if column not in out.columns:    # 기존 모델 입력처럼 일부 범주형이 없는 표도 받는다
            continue
        out[column] = out[column].map({v: i for i, v in enumerate(values)}).fillna(-1).astype("int32")
    return out


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    """C8 상한 밖 값을 결측으로 두고, 그 값으로 만드는 파생 열도 결측으로 둔 뒤 범주형을 부호화한다(전처리 (나)).
    파생 열은 다시 계산하지 않는다. 월별 원천이 없어 재계산할 수 없는 열이 있어서다(C19).
    """
    out = df.copy()
    out.loc[out["income_svc_12m_krw"] > config.INCOME_SUM_MAX_KRW, "income_svc_12m_krw"] = np.nan
    out.loc[out["expense_avg_month_krw"] > config.EXPENSE_AVG_MAX_KRW, "expense_avg_month_krw"] = np.nan
    out.loc[out["debt_service_current_krw"] < config.DEBT_SERVICE_MIN_KRW, "debt_service_current_krw"] = np.nan

    income_missing = out["income_svc_12m_krw"].isna()
    expense_missing = out["expense_avg_month_krw"].isna()
    debt_missing = out["debt_service_current_krw"].isna()
    out.loc[income_missing, config.DERIVED_FROM_INCOME] = np.nan
    out.loc[expense_missing, config.DERIVED_FROM_EXPENSE] = np.nan
    out.loc[debt_missing, config.DERIVED_FROM_DEBT] = np.nan
    out.loc[income_missing | expense_missing | debt_missing, config.DERIVED_FROM_ANY_INPUT] = np.nan
    return encode_categories(out)
