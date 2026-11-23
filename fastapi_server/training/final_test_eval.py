# FP-144 N-12 최종 성능 지표 — TEST 평가를 한 번만 실행하고, 사전 기준(정의서 10장 C26)과 비교해 결과를 있는 그대로 기록한다.
# 평가 대상: 서버 모델 파일(legacy.joblib·alternative.joblib, 모델 0.2)과 같은 설정의 비교용 실험 모델(단조 제약, 시드 5개).
# 규칙(C26): TEST는 한 번만 본다. 범위를 벗어나도 모델은 고치지 않고 그대로 보고한다. 결과를 본 뒤에 모델·지표·기준·등급 경계를 바꾸지 않는다.
# 학습·내보내기 스크립트(train.py 등)는 TEST를 읽자마자 버린다. TEST 행은 이 파일의 load_eval_split만 읽으며, --confirm-test-once를 줄 때만 읽는다.
# 실행(fastapi_server 폴더에서):
#   리허설(VALID, 기본): python -m training.final_test_eval        # 알려진 VALID 값과 맞는지 먼저 본다. 파일은 만들지 않는다(--out-dir를 주면 저장)
#   최종(TEST, 한 번):    python -m training.final_test_eval --split TEST --confirm-test-once
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import roc_auc_score

from pipeline.feature_catalog import GRADE_BANDS, grade_band
from training import config
from training.data_io import sha256_of
from training.export_eval_scores import LABEL_COLUMNS, MODEL_FEATURES, SHIPPED, scores_from
from training.preprocess import prepare
from training.train import fit_model, load_training_sets

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESULT_DIR = REPO_ROOT / "docs" / "spec"
RESULT_STEM = "final_test_eval_result"
EXPECTED_MODEL_VERSION = "LGBM-BASE-0.2"
TEST_SPLIT = "TEST"
SHIPPED_SEED = config.SEEDS[0]          # 서버 모델 파일은 첫 시드(11)로 학습한 것이다
SHIPPED_FILES = ["legacy.joblib", "alternative.joblib", "legacy.meta.json", "alternative.meta.json"]
PAIRS = [(model, label) for label in LABEL_COLUMNS for model in MODEL_FEATURES]   # (모델, 라벨) 4쌍. 서버에 올린 것은 SHIPPED의 2쌍

# 정의서 10장 C26 사전 기준(TEST를 보기 전에 기록). 이 값은 TEST 결과를 본 뒤에 바꾸지 않는다. tests/test_final_test_eval.py가 C26 본문과 같은지 검사한다.
# (모델, 라벨) → (VALID 5개 시드 평균, TEST 정상 범위 하한, 상한). 범위는 VALID 평균 ±0.05이다.
C26_CRITERIA = {
    ("legacy", "delinq"): (0.6047, 0.555, 0.655),     # 서버: 기존 모델·연체 라벨
    ("alt", "nonfin"): (0.6591, 0.609, 0.709),        # 서버: 대안 모델·비금융 효과 라벨
    ("alt", "delinq"): (0.6078, 0.558, 0.658),        # 실험: 대안 모델·연체 라벨
    ("legacy", "nonfin"): (0.6080, 0.558, 0.658),     # 실험: 기존 모델·비금융 효과 라벨
}
DELINQ_DIFF_LIMIT = 0.04          # 연체 라벨에서 대안−기존 차이가 이 안이면 "차이 없음"(대안 효과를 일부러 넣지 않은 라벨)
PAIR_NAMES = {("legacy", "delinq"): "기존 모델·연체 라벨", ("alt", "nonfin"): "대안 모델·비금융 효과 라벨",
              ("alt", "delinq"): "대안 모델·연체 라벨", ("legacy", "nonfin"): "기존 모델·비금융 효과 라벨"}
SYNTHETIC_NOTICE = "합성 데이터와 합성 라벨 기준이며, 실제 신용평가·대출 심사 결과나 실제 개선을 뜻하지 않는다."


def pair_key(pair: tuple) -> str:
    return f"{pair[0]}_{pair[1]}"


def judge_range(pair: tuple, auc: float | None) -> str:
    """C26 정상 범위와 0.5 초과 여부로 AUC 하나를 판정한다. 범위 밖이어도 모델은 고치지 않고 그대로 보고한다."""
    if auc is None:
        return "계산 못 함(한 클래스뿐)"
    _, low, high = C26_CRITERIA[pair]
    if auc <= 0.5:
        return "0.5 이하(우연 수준 이하)"
    if auc < low:
        return "범위 밖(낮음)"
    if auc > high:
        return "범위 밖(높음)"
    return "범위 안"


def judge_diff(label_key: str, diff: float) -> str:
    """같은 라벨에서 대안−기존 AUC 차이를 C26 기준으로 판정한다. 연체 라벨은 ±0.04면 차이 없음, 비금융 효과 라벨은 +면 설계 효과 재현."""
    if label_key == "delinq":
        if abs(diff) <= DELINQ_DIFF_LIMIT:
            return "차이 없음(±0.04 안)"
        return "대안 높음(+0.04 초과)" if diff > 0 else "대안 낮음(-0.04 미만)"
    return "설계한 효과 재현(+방향)" if diff > 0 else "설계한 효과 미재현(0 이하)"


def auc_info(labels: pd.Series, scores) -> dict:
    """행 수·양성 수·AUC. 한 클래스뿐이면 AUC는 None(직군별 결과에서 양성이 적을 때)."""
    positives = int(labels.sum())
    auc = round(float(roc_auc_score(labels, scores)), 4) if labels.nunique() == 2 else None
    return {"rows": int(len(labels)), "positives": positives, "auc": auc}


def auc_by_group(frame: pd.DataFrame, scores: pd.Series, label: str, column: str) -> dict:
    """집단 열(직군·씬파일 cohort)별 AUC와 양성 건수. 양성이 적은 집단은 값이 많이 흔들린다."""
    return {str(name): auc_info(part[label], scores.loc[part.index]) for name, part in frame.groupby(column)}


def grade_ratio(scores) -> dict:
    """CUT-0.3 경계로 등급을 나눈 건수와 비율. 경계는 VALID로 정한 값이며 TEST에서는 비율만 확인한다."""
    codes = [grade_band(int(score)) for score in scores]
    total = len(codes)
    return {band["gradeBandCode"]: {"count": codes.count(band["gradeBandCode"]),
                                    "ratio": round(codes.count(band["gradeBandCode"]) / total, 4)} for band in GRADE_BANDS}


def read_sums(path: Path) -> dict:
    """SHA256SUMS.txt('해시 *파일명' 줄)를 {파일명: 해시}로 읽는다."""
    sums = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            digest, name = line.split(maxsplit=1)
            sums[name.lstrip("*").strip()] = digest.lower()
    return sums


def verify_shipped(model_dir: Path) -> dict:
    """서버 모델 파일 4개의 해시가 SHA256SUMS.txt와 같고 meta.json이 모델 0.2인지 확인한다. 다르면 TEST를 열기 전에 멈춘다."""
    sums_path = model_dir / "SHA256SUMS.txt"
    if not sums_path.exists():
        sys.exit(f"SHA256SUMS.txt가 없다: {sums_path}")
    sums = read_sums(sums_path)
    hashes = {}
    for name in SHIPPED_FILES:
        path = model_dir / name
        if not path.exists() or name not in sums:
            sys.exit(f"서버 모델 파일이나 해시 기록이 없다: {name}")
        hashes[name] = sha256_of(path)
        if hashes[name] != sums[name]:
            sys.exit(f"{name}의 해시가 SHA256SUMS.txt와 다르다. 서버 모델 파일을 확인하기 전에는 평가하지 않는다")
    for name in ("legacy.meta.json", "alternative.meta.json"):
        version = json.loads((model_dir / name).read_text(encoding="utf-8")).get("model_version")
        if version != EXPECTED_MODEL_VERSION:
            sys.exit(f"{name}의 model_version이 {version}이다({EXPECTED_MODEL_VERSION}이어야 한다). 평가하지 않는다")
    return hashes


def check_not_done(result_json: Path, rerun_reason: str | None) -> str | None:
    """TEST는 한 번만 본다. 결과 파일이 이미 있으면 --rerun-reason(평가 코드 오류를 고친 재실행 이유)이 있어야 하고, 이전 파일의 해시를 돌려준다."""
    if not result_json.exists():
        return None
    if not rerun_reason:
        sys.exit(f"TEST 결과 파일이 이미 있다: {result_json}\nTEST는 한 번만 본다(C26). 평가 코드 오류를 고친 재실행이면 같은 모델·코드로 --rerun-reason \"<이유>\"를 준다")
    return sha256_of(result_json)


def git_state() -> dict:
    """평가에 쓴 코드의 커밋 해시와 작업 트리가 깨끗한지. 결과보다 코드가 먼저 커밋됐다는 기록이 된다."""
    def run(*args):
        return subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=True).stdout.strip()
    try:
        return {"commit": run("rev-parse", "HEAD"), "working_tree_clean": run("status", "--porcelain") == ""}
    except (OSError, subprocess.CalledProcessError):
        return {"commit": None, "working_tree_clean": None}


def load_eval_split(table_path: Path, split: str, group: str = "legacy", confirmed_test: bool = False) -> pd.DataFrame:
    """평가할 분할의 행만 읽고 학습과 같은 전처리를 한다. TEST는 confirmed_test(--confirm-test-once)가 있을 때만 읽는다.
    씬파일 집단은 eval_future_credit_exposure = 1인 고객만 쓴다(정의서 5장). 직군 원래 이름은 segment_name 열에 남긴다."""
    if split == TEST_SPLIT and not confirmed_test:
        raise PermissionError("TEST는 --confirm-test-once 없이 읽지 않는다")
    raw = pd.read_csv(table_path)
    needed = {config.SPLIT_COLUMN, "segment", *LABEL_COLUMNS.values(), *config.ALTERNATIVE_FEATURES}
    if group == "thinfile":
        needed |= {config.EXPOSURE_COLUMN, "cohort"}
    missing = sorted(needed - set(raw.columns))
    if missing:
        sys.exit(f"표에 없는 열이 있다(데이터 버전이 맞는지 확인): {missing}")
    raw = raw[raw[config.SPLIT_COLUMN] == split]
    if group == "thinfile":
        raw = raw[raw[config.EXPOSURE_COLUMN] == 1]
    prepared = prepare(raw)
    prepared["segment_name"] = raw["segment"].to_numpy()
    if group == "thinfile":
        prepared["cohort"] = raw["cohort"].to_numpy()
    return prepared


def train_models(train: pd.DataFrame) -> dict:
    """(모델, 라벨, 시드) → 모델. 4쌍을 TRAIN으로 시드 5개씩 단조 제약(모델 0.2와 같은 설정)으로 학습한다."""
    return {(model, label, seed): fit_model(train, MODEL_FEATURES[model], LABEL_COLUMNS[label], seed, config.MONOTONE_CONSTRAINTS)
            for model, label in PAIRS for seed in config.SEEDS}


def proba(model, frame: pd.DataFrame, model_name: str) -> pd.Series:
    """불량 확률(양성 확률). AUC는 이 값으로 센다(5개 시드 평균 VALID 값과 같은 방식)."""
    return pd.Series(model.predict_proba(frame[MODEL_FEATURES[model_name]])[:, 1], index=frame.index)


def evaluate_group(frame: pd.DataFrame, models: dict, shipped: dict, judged: bool = True) -> dict:
    """한 집단의 평가: 서버 모델 AUC, 4쌍 5시드 AUC, 같은 라벨 차이, 판정. shipped는 {(모델, 라벨): 서버 모델 파일에서 읽은 모델}.
    judged=False(씬파일)는 C26 정상 범위가 기존 집단 기준이라 판정하지 않고 값만 참고로 남긴다."""
    five, per_seed = {}, {}
    for pair in PAIRS:
        model_name, label_key = pair
        aucs = np.array([roc_auc_score(frame[LABEL_COLUMNS[label_key]], proba(models[(*pair, seed)], frame, model_name)) for seed in config.SEEDS])
        per_seed[pair_key(pair)] = [round(float(value), 4) for value in aucs]
        five[pair] = aucs
    five_info = {pair_key(pair): {"mean": round(float(aucs.mean()), 4), "std": round(float(aucs.std(ddof=1)), 4), "by_seed": per_seed[pair_key(pair)]}
                 for pair, aucs in five.items()}
    shipped_info = {pair_key(pair): auc_info(frame[LABEL_COLUMNS[pair[1]]], proba(model, frame, pair[0])) for pair, model in shipped.items()}
    diffs = {}
    for label_key in LABEL_COLUMNS:
        diff = five[("alt", label_key)] - five[("legacy", label_key)]
        diffs[label_key] = {"mean": round(float(diff.mean()), 4), "min": round(float(diff.min()), 4), "max": round(float(diff.max()), 4),
                            "verdict": judge_diff(label_key, float(diff.mean())) if judged else "참고(C26 판정 기준은 기존 집단에만 적용)"}
    judgement = {}
    for pair in PAIRS if judged else []:
        entry = {"range": [C26_CRITERIA[pair][1], C26_CRITERIA[pair][2]], "valid_mean_reference": C26_CRITERIA[pair][0],
                 "five_seed_mean": five_info[pair_key(pair)]["mean"], "five_seed_verdict": judge_range(pair, five_info[pair_key(pair)]["mean"])}
        if pair in SHIPPED:
            value = shipped_info[pair_key(pair)]["auc"]
            entry.update({"shipped_auc": value, "shipped_verdict": judge_range(pair, value)})
        judgement[pair_key(pair)] = entry
    return {"rows": int(len(frame)), "shipped_auc": shipped_info, "five_seed_auc": five_info, "same_label_diff": diffs, "judgement": judgement}


def reproduction_check(models: dict, shipped: dict, valid_frame: pd.DataFrame) -> dict:
    """서버 모델 파일이 같은 설정·시드 11로 다시 학습한 모델과 같은지 VALID 행으로 확인한다(TEST는 쓰지 않는다)."""
    result = {}
    for pair, model in shipped.items():
        features = MODEL_FEATURES[pair[0]]
        again = models[(*pair, SHIPPED_SEED)]
        same = np.allclose(model.predict(valid_frame[features], raw_score=True), again.predict(valid_frame[features], raw_score=True), atol=1e-9)
        result[pair_key(pair)] = "같음" if same else "다름"
    return result


def legacy_group_report(frame: pd.DataFrame, models: dict, shipped: dict) -> dict:
    """기존 집단 평가에 직군별 AUC와 등급 비율을 더한다. 직군별·등급 비율은 서버 모델 파일 2개로 본다."""
    report = evaluate_group(frame, models, shipped)
    report["by_segment"] = {pair_key(pair): auc_by_group(frame, proba(model, frame, pair[0]), LABEL_COLUMNS[pair[1]], "segment_name")
                            for pair, model in shipped.items()}
    report["grade_ratio"] = {pair[0]: grade_ratio(scores_from(model, frame, MODEL_FEATURES[pair[0]])) for pair, model in shipped.items()}
    return report


def thinfile_report(frame: pd.DataFrame, models: dict, shipped: dict) -> dict:
    """씬파일 집단 평가: 전체와 cohort별(양성 건수 포함). 평가 표본에 이력이 긴 비교군(young_established)이 섞여 있다."""
    report = evaluate_group(frame, models, shipped, judged=False)
    report["by_cohort"] = {pair_key(pair): auc_by_group(frame, proba(model, frame, pair[0]), LABEL_COLUMNS[pair[1]], "cohort")
                           for pair, model in shipped.items()}
    report["cohort_rows"] = {str(name): int(count) for name, count in frame["cohort"].value_counts().sort_index().items()}
    report["grade_ratio"] = {pair[0]: grade_ratio(scores_from(model, frame, MODEL_FEATURES[pair[0]])) for pair, model in shipped.items()}
    return report


def render_markdown(result: dict) -> str:
    """결과 요약 md. C26 보고 문구(합성 데이터 한계, 양성 건수 흔들림, 씬파일 비교군 혼합)를 항상 넣는다."""
    split = result["split"]
    lines = [f"# {split} 평가 결과 (모델 {result['model_version']})", "",
             f"> {SYNTHETIC_NOTICE}", "",
             f"- 실행: {result['generated_at']} / 코드 커밋 {result['provenance']['commit']} (작업 트리 깨끗함: {result['provenance']['working_tree_clean']})",
             f"- 사전 기준: 정의서 10장 C26. 기준은 결과를 본 뒤에 바꾸지 않았다. 범위를 벗어난 값도 그대로 보고한다.",
             f"- 평가 행 수: 기존 집단 {result['legacy_group']['rows']}행, 씬파일(노출 1) {result['thinfile']['rows']}행", ""]
    for title, key in (("기존 집단", "legacy_group"), ("씬파일 집단(노출 1)", "thinfile")):
        group = result[key]
        judged = bool(group["judgement"])
        if judged:
            lines += [f"## {title} AUC", "", "| 모델·라벨 | 서버 모델 파일(시드 11) | 5개 시드 평균 ± 표준편차 | 정상 범위 | 판정(5개 시드 평균) |", "|---|---|---|---|---|"]
        else:
            lines += [f"## {title} AUC (참고 값, C26 정상 범위는 기존 집단 기준이라 판정하지 않음)", "", "| 모델·라벨 | 서버 모델 파일(시드 11) | 5개 시드 평균 ± 표준편차 |", "|---|---|---|"]
        for pair in PAIRS:
            name = pair_key(pair)
            shipped = group["shipped_auc"].get(name)
            five = group["five_seed_auc"][name]
            if judged:
                judge = group["judgement"][name]
                shipped_text = f"{shipped['auc']} ({judge['shipped_verdict']})" if shipped else "-"
                lines.append(f"| {PAIR_NAMES[pair]} | {shipped_text} | {five['mean']} ± {five['std']} | {judge['range'][0]}~{judge['range'][1]} | {judge['five_seed_verdict']} |")
            else:
                lines.append(f"| {PAIR_NAMES[pair]} | {shipped['auc'] if shipped else '-'} | {five['mean']} ± {five['std']} |")
        lines += ["", "같은 라벨 대안-기존 차이(5개 시드 평균, 최소~최대):", ""]
        for label_key, diff in group["same_label_diff"].items():
            lines.append(f"- {label_key}: {diff['mean']:+.4f} ({diff['min']:+.4f}~{diff['max']:+.4f}) → {diff['verdict']}")
        lines += [""]
    lines += ["## 직군별 AUC (서버 모델 파일, 양성 건수 함께)", "", "프리랜서·자영업자는 양성이 적어 값이 많이 흔들린다.", "",
              "| 모델·라벨 | 직군 | 행 수 | 양성 | AUC |", "|---|---|---|---|---|"]
    for name, groups in result["legacy_group"]["by_segment"].items():
        for segment, info in groups.items():
            lines.append(f"| {name} | {segment} | {info['rows']} | {info['positives']} | {info['auc']} |")
    lines += ["", "## 씬파일 cohort별 AUC (서버 모델 파일, 양성 건수 함께)", "",
              "씬파일 평가 표본에는 이력이 긴 비교군(`young_established`)이 섞여 있다.", "",
              "| 모델·라벨 | cohort | 행 수 | 양성 | AUC |", "|---|---|---|---|---|"]
    for name, groups in result["thinfile"]["by_cohort"].items():
        for cohort, info in groups.items():
            lines.append(f"| {name} | {cohort} | {info['rows']} | {info['positives']} | {info['auc']} |")
    lines += ["", "## CUT-0.3 등급 비율 (경계 0~653 / 654~726 / 727~1000, 비율만 확인)", "", "| 집단 | 모델 | CAUTION | STANDARD | GOOD |", "|---|---|---|---|---|"]
    for title, key in (("기존 집단", "legacy_group"), ("씬파일", "thinfile")):
        for model_name, ratios in result[key]["grade_ratio"].items():
            lines.append(f"| {title} | {model_name} | " + " | ".join(f"{ratios[code]['ratio'] * 100:.1f}% ({ratios[code]['count']})" for code in ("CAUTION", "STANDARD", "GOOD")) + " |")
    lines += ["", f"서버 모델 파일 재현 확인(VALID, 같은 설정·시드 11): {result['reproduction_on_valid']}", ""]
    if result.get("rerun"):
        lines += [f"재실행 이유: {result['rerun']['reason']} (이전 결과 파일 해시 {result['rerun']['previous_result_sha256']})", ""]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="FP-144 TEST 평가(정의서 C26 사전 기준). 기본은 VALID 리허설이고, TEST는 --confirm-test-once를 줄 때 한 번만 읽는다")
    parser.add_argument("--split", choices=["VALID", TEST_SPLIT], default="VALID", help="평가할 분할(기본 VALID = 리허설)")
    parser.add_argument("--confirm-test-once", action="store_true", help="TEST를 한 번만 읽겠다는 확인(TEST에만 필요)")
    parser.add_argument("--rerun-reason", default=None, help="TEST 결과가 이미 있을 때, 평가 코드 오류를 고쳐 같은 모델·코드로 다시 돌리는 이유")
    parser.add_argument("--data-dir", type=Path, default=config.DEFAULT_DATA_DIR, help="학습 데이터 폴더(1_model/ 이 들어 있는 폴더)")
    parser.add_argument("--model-dir", type=Path, default=config.DEFAULT_OUT_DIR, help="서버 모델 파일 폴더")
    parser.add_argument("--out-dir", type=Path, default=None, help="결과 json·md 저장 폴더(TEST 기본 docs/spec, VALID 리허설은 주지 않으면 저장하지 않음)")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")        # Windows 콘솔(cp949)에서 ±·→ 같은 기호 출력이 실패하지 않게 한다

    is_test = args.split == TEST_SPLIT
    if is_test and not args.confirm_test_once:
        print("TEST는 한 번만 평가한다(정의서 C26). 읽지 않고 끝낸다. 리허설은 --split VALID, 최종은 --split TEST --confirm-test-once")
        return
    out_dir = args.out_dir if args.out_dir else (DEFAULT_RESULT_DIR if is_test else None)
    stem = RESULT_STEM if is_test else f"{RESULT_STEM}_valid_rehearsal"
    previous_hash = check_not_done(out_dir / f"{stem}.json", args.rerun_reason) if (is_test and out_dir) else None
    provenance = git_state()
    if is_test and provenance["working_tree_clean"] is not True:
        sys.exit("작업 트리가 깨끗하지 않거나 git 상태를 읽지 못했다. TEST는 평가 코드를 먼저 커밋한 뒤에 본다")

    model_hashes = verify_shipped(args.model_dir)
    shipped = {pair: joblib.load(args.model_dir / file_name) for pair, file_name in SHIPPED.items()}
    legacy_path, thinfile_path = (args.data_dir / config.TABLE_RELATIVE_PATH), (args.data_dir / config.THINFILE_TABLE_RELATIVE_PATH)
    for path in (legacy_path, thinfile_path):
        if not path.exists():
            sys.exit(f"학습 표가 없다: {path}")

    train, valid, _, _ = load_training_sets(args.data_dir)           # TRAIN·VALID만 읽는다(TEST는 이 로더가 버린다)
    print(f"TRAIN {len(train)}행으로 4쌍 × 시드 {len(config.SEEDS)}개 학습(단조 제약)")
    models = train_models(train)
    reproduction = reproduction_check(models, shipped, valid)        # 재현 확인은 VALID로 한다(TEST를 열기 전에 확인)
    print(f"서버 모델 파일 재현 확인(VALID): {reproduction}")
    if "다름" in reproduction.values() and is_test:
        sys.exit("서버 모델 파일이 같은 설정으로 재현되지 않는다. TEST를 열기 전에 중단한다")

    print(f"{args.split} 행을 읽어 평가한다")
    legacy_frame = load_eval_split(legacy_path, args.split, "legacy", args.confirm_test_once)
    thin_frame = load_eval_split(thinfile_path, args.split, "thinfile", args.confirm_test_once)
    result = {
        "split": args.split, "model_version": EXPECTED_MODEL_VERSION, "synthetic_notice": SYNTHETIC_NOTICE,
        "criteria": {"source": "정의서 10장 C26", "ranges": {pair_key(pair): list(values[1:]) for pair, values in C26_CRITERIA.items()},
                     "delinq_diff_limit": DELINQ_DIFF_LIMIT},
        "legacy_group": legacy_group_report(legacy_frame, models, shipped),
        "thinfile": thinfile_report(thin_frame, models, shipped),
        "reproduction_on_valid": reproduction, "model_files_sha256": model_hashes,
        "tables_sha256_8": {"legacy": sha256_of(legacy_path)[:8], "thinfile": sha256_of(thinfile_path)[:8]},
        "provenance": provenance, "settings": {"seeds": config.SEEDS, "monotone_constraints": config.MONOTONE_CONSTRAINTS, "shipped_seed": SHIPPED_SEED},
        "library_versions": {"lightgbm": lgb.__version__, "scikit-learn": sklearn.__version__, "pandas": pd.__version__, "numpy": np.__version__},
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if args.rerun_reason and is_test:
        result["rerun"] = {"reason": args.rerun_reason, "previous_result_sha256": previous_hash}

    markdown = render_markdown(result)
    print(markdown)
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{stem}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
        (out_dir / f"{stem}.md").write_text(markdown, encoding="utf-8", newline="\n")
        print(f"저장: {out_dir / (stem + '.json')}, {out_dir / (stem + '.md')}")


if __name__ == "__main__":
    main()
