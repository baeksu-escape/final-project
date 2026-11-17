# FP-131 학습 표 검증·기본 통계 보고서 — 분할별 행 수, 라벨 양성 비율, 결측, C8 상한 초과, 숫자 피처 요약, 범주 분포, 피처 목록 일치를 마크다운으로 만든다.
# TEST 분할은 행 수만 세고 값은 보지 않는다(TRAIN·VALID만 분석). 만든 파일은 사람이 고치지 않고 이 스크립트로 다시 만든다.
# 실행(fastapi_server 폴더에서): python -m training.data_report [--data-dir <학습 데이터 폴더>] [--out <파일>]
import argparse
import sys
from datetime import date
from pathlib import Path

import pandas as pd

from pipeline import feature_catalog
from training import config
from training.data_io import load_train_valid, sha256_of
from training.preprocess import prepare

DEFAULT_REPORT_PATH = config.FASTAPI_ROOT.parent / "docs" / "spec" / "training_data_report.md"
NUMERIC_FEATURES = [f for f in config.ALTERNATIVE_FEATURES if f not in config.CATEGORICAL_FEATURES]
INPUT_LIMITS = [  # (열, 설명, 상한 초과/미만 판정) — 정의서 C8과 같은 상수
    ("income_svc_12m_krw", f"> {config.INCOME_SUM_MAX_KRW:,}", lambda s: s > config.INCOME_SUM_MAX_KRW),
    ("expense_avg_month_krw", f"> {config.EXPENSE_AVG_MAX_KRW:,}", lambda s: s > config.EXPENSE_AVG_MAX_KRW),
    ("debt_service_current_krw", f"< {config.DEBT_SERVICE_MIN_KRW}", lambda s: s < config.DEBT_SERVICE_MIN_KRW),
]


def md_table(headers: list, rows: list) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    lines += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows]
    return "\n".join(lines)


def missing_counts(df: pd.DataFrame, features: list) -> dict:
    """피처별 결측 수."""
    return {f: int(df[f].isna().sum()) for f in features}


def limit_violation_counts(df: pd.DataFrame) -> dict:
    """C8 상한 초과·음수인 행 수(열 이름 → 행 수)와 하나라도 걸린 행 수(`any`)."""
    flags = {column: rule(df[column]).fillna(False) for column, _, rule in INPUT_LIMITS}
    counts = {column: int(flag.sum()) for column, flag in flags.items()}
    counts["any"] = int(pd.concat(flags.values(), axis=1).any(axis=1).sum())
    return counts


def _format_number(value: float) -> str:
    return f"{value:,.4g}" if abs(value) < 1e5 else f"{value:,.0f}"


def numeric_summary(df: pd.DataFrame, features: list) -> list:
    """숫자 피처별 [최소, 25%, 중앙값, 75%, 최대, 평균] (결측 제외)."""
    rows = []
    for f in features:
        q = df[f].quantile([0, 0.25, 0.5, 0.75, 1.0])
        rows.append([f] + [_format_number(v) for v in q] + [_format_number(df[f].mean())])
    return rows


def label_check(df: pd.DataFrame, label: str) -> dict:
    """라벨 열 검증(FP-130): 값이 0/1뿐인지, 결측 수, 양성 수와 비율. 결측이 있으면 `ok`가 False다."""
    column = df[label]
    non_missing = column.dropna()
    values_ok = bool(non_missing.isin([0, 1]).all())
    missing = int(column.isna().sum())
    positives = int((non_missing == 1).sum())
    return {"rows": int(len(column)), "missing": missing, "values_ok": values_ok, "positives": positives,
            "positive_rate": positives / len(column) if len(column) else float("nan"),
            "ok": values_ok and missing == 0}


def category_counts(df: pd.DataFrame) -> list:
    """범주형 열별 값 개수와 부호표에 없는 값·결측 수."""
    rows = []
    for column, values in config.CATEGORY_CODES.items():
        counts = df[column].value_counts(dropna=False)
        known = ", ".join(f"{v}={int(counts.get(v, 0)):,}" for v in values)
        other = int(len(df) - sum(int(counts.get(v, 0)) for v in values))
        rows.append([f"`{column}`", known, other])
    return rows


def catalog_difference() -> dict:
    """학습 피처 목록과 서비스 피처 사전(FS-DRAFT 39개)의 차이. 기대: 서비스에만 LRZ021201(C9)이 있다."""
    return {
        "only_service": sorted(set(feature_catalog.ALTERNATIVE_CODES) - set(config.ALTERNATIVE_FEATURES)),
        "only_training": sorted(set(config.ALTERNATIVE_FEATURES) - set(feature_catalog.ALTERNATIVE_CODES)),
    }


def build_report(raw_all: pd.DataFrame, table_sha: str) -> str:
    split_counts = raw_all[config.SPLIT_COLUMN].value_counts()
    data = raw_all[raw_all[config.SPLIT_COLUMN].isin([config.TRAIN_SPLIT, config.VALID_SPLIT])]
    train = data[data[config.SPLIT_COLUMN] == config.TRAIN_SPLIT]
    cleaned = prepare(data)
    labels = [spec["label"] for spec in config.MODELS.values()]
    label_rows, label_warnings = [], []
    for label in labels:
        for split in [config.TRAIN_SPLIT, config.VALID_SPLIT]:
            check = label_check(data[data[config.SPLIT_COLUMN] == split], label)
            label_rows.append([f"`{label}`", split, f"{check['rows']:,}", "예" if check["values_ok"] else "아니오",
                               check["missing"], f"{check['positives']:,}", f"{check['positive_rate']:.3f}"])
            if not check["ok"]:
                label_warnings.append(f"- **경고:** `{label}` {split}에서 0/1이 아닌 값이 있거나 결측이 있다(위 표 확인).")

    out = [
        "# 학습 데이터 기본 통계 보고서 (생성 파일)",
        "",
        f"- 생성일 {date.today().isoformat()}, 학습 표 SHA-256 앞 8자리 `{table_sha[:8]}`. 합성 데이터이며 실제 개인·금융 데이터가 아니다.",
        "- `python -m training.data_report`로 만든 파일이다. 직접 고치지 않고 스크립트를 다시 실행해 갱신한다(FP-131).",
        "- 분석은 TRAIN·VALID만 쓴다. TEST는 행 수만 센다(성능 비교는 최종 평가에서 한 번만).",
        "",
        "## 1. 분할과 라벨",
        md_table(["분할", "행 수", f"`{labels[0]}` 양성 비율", f"`{labels[1]}` 양성 비율"],
                 [[s, f"{int(split_counts.get(s, 0)):,}"] + (
                     [f"{data[data[config.SPLIT_COLUMN] == s][label].mean():.3f}" for label in labels]
                     if s != "TEST" else ["(보지 않음)", "(보지 않음)"])
                  for s in [config.TRAIN_SPLIT, config.VALID_SPLIT, "TEST"]]),
        "",
        f"- 라벨 정의: 기존 모델 `{labels[0]}`, 대안 모델 `{labels[1]}`(정의서 2-1).",
        f"- TRAIN·VALID 합계 {len(data):,}행, 직군(`segment`)별 행 수: "
        + ", ".join(f"{k}={int(v):,}" for k, v in data["segment"].value_counts().items()) + ".",
        "",
        "### 라벨 검증 (FP-130)",
        md_table(["라벨", "분할", "행 수", "값이 0/1뿐", "결측", "양성 수", "양성 비율"], label_rows),
        "",
        *(label_warnings or ["- 두 라벨 모두 TRAIN·VALID에서 값이 0/1뿐이고 결측이 없다."]),
        "- TEST는 행 수만 센다. 데이터 README가 직군 × 연체 라벨 층화 분할이라고 설명하며, TEST 양성 비율은 최종 평가(FP-144) 때 확인한다.",
        "",
        "## 2. 결측 (TRAIN + VALID)",
    ]
    raw_missing = missing_counts(data, config.ALTERNATIVE_FEATURES)
    after_missing = missing_counts(cleaned, config.ALTERNATIVE_FEATURES)
    shown = [f for f in config.ALTERNATIVE_FEATURES if raw_missing[f] or after_missing[f]]
    out += [md_table(["피처", "원본 결측", "비율", "전처리 (나) 적용 후 결측", "비율"],
                     [[f"`{f}`", f"{raw_missing[f]:,}", f"{raw_missing[f] / len(data):.1%}",
                       f"{after_missing[f]:,}", f"{after_missing[f] / len(data):.1%}"] for f in shown]),
            "",
            f"- 위 표에 없는 피처 {len(config.ALTERNATIVE_FEATURES) - len(shown)}개는 두 경우 모두 결측이 없다.",
            "- 전처리 (나)(정의서 C19): C8 상한 밖 값·결측 입력과 그 파생 열을 결측으로 둔다. 구조적 결측(`*_on_time_rate`)은 채우지 않는다(C13).",
            "",
            "## 3. C8 이상치 상한 (TRAIN + VALID, 정의서 10장 C8)"]
    violations = limit_violation_counts(data)
    out += [md_table(["열", "판정", "행 수", "비율"],
                     [[f"`{c}`", text, f"{violations[c]:,}", f"{violations[c] / len(data):.2%}"] for c, text, _ in INPUT_LIMITS]
                     + [["하나라도 해당", "", f"{violations['any']:,}", f"{violations['any'] / len(data):.2%}"]]),
            "",
            "## 4. 숫자 피처 요약 (TRAIN, 전처리 전 원본 값)",
            md_table(["피처", "최소", "25%", "중앙값", "75%", "최대", "평균"], numeric_summary(train, NUMERIC_FEATURES)),
            "",
            "## 5. 범주형 값 분포 (TRAIN + VALID)",
            md_table(["열", "값별 행 수", "부호표에 없는 값·결측"], category_counts(data)),
            "",
            "## 6. 피처 목록 일치 (DB 기준 확인용)"]
    diff = catalog_difference()
    out += [f"- 학습 피처: 기존 {len(config.LEGACY_FEATURES)}개, 대안 {len(config.ALTERNATIVE_FEATURES)}개.",
            f"- 서비스 피처 사전(FS-DRAFT 39개)에만 있는 것: {diff['only_service'] or '없음'}. (기대값: `LRZ021201` 하나, 정의서 C9로 모델에서 뺌)",
            f"- 학습에만 있는 것: {diff['only_training'] or '없음'}. (기대값: 없음)",
            ""]
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser(description="학습 표 기본 통계 보고서(TEST는 행 수만)")
    parser.add_argument("--data-dir", type=Path, default=config.DEFAULT_DATA_DIR)
    parser.add_argument("--out", type=Path, default=DEFAULT_REPORT_PATH)
    args = parser.parse_args()
    table_path = args.data_dir / config.TABLE_RELATIVE_PATH
    if not table_path.exists():
        sys.exit(f"학습 표가 없다: {table_path}")

    split_only = pd.read_csv(table_path, usecols=[config.SPLIT_COLUMN])   # 분할별 행 수만 센다(TEST 값은 읽지 않는다)
    trainable = load_train_valid(table_path)           # 필요한 열이 없으면 이름을 알리고 멈춘다
    report = build_report(pd.concat([trainable, split_only[split_only[config.SPLIT_COLUMN] == "TEST"]]), sha256_of(table_path))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(report, encoding="utf-8")
    print(f"보고서 저장: {args.out}")


if __name__ == "__main__":
    main()
