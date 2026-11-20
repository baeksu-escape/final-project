# FP-141 N-12-2·N-14 실제 모델 점수 — 재욱 님이 학습한 LightGBM 베이스라인(합성 데이터, 임시)으로 기존·대안 점수와 SHAP을 낸다.
# 응답 모양은 Mock(pipeline/mock_scorer.score_features)과 같다: {traditional, alternative, shap}. 그래서 라우터·Spring은 그대로다.
# 점수 환산·SHAP·합 규칙은 training/explain.py(FP-138)를, 모델 입력은 training/interface.py(to_model_input)를 그대로 쓴다.
# 점수·SHAP은 실제 신용평가 결과나 인과관계가 아니다. 화면에는 "작용한 정도"로만 보여 준다.
import hashlib
import json
import logging
from pathlib import Path

import joblib

from pipeline.feature_catalog import REAL_FEATURE_SET_VERSION, REAL_MODEL_VERSION, grade_band, is_real_model_version
from training.explain import AlternativeExplainer, score_one

log = logging.getLogger("avenue.prediction")

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "artifacts"


class ModelScorer:
    """기존(legacy)·대안(alternative) 모델 한 묶음. 서버가 시작할 때 한 번 만들어 재사용한다(SHAP 설명기 만드는 데 시간이 걸린다)."""

    def __init__(self, legacy_model=None, alternative_model=None, version: str = REAL_MODEL_VERSION):
        self.legacy_model = legacy_model
        self.explainer = AlternativeExplainer(alternative_model) if alternative_model is not None else None
        # FP-237 이 묶음의 모델 버전(meta.json의 model_version). 준비 안 됐으면 None.
        self.version = version if self.ready else None

    @property
    def ready(self) -> bool:
        return self.legacy_model is not None and self.explainer is not None

    def score_features(self, features: dict) -> dict:
        """피처 dict(build_features 결과) → Mock과 같은 모양의 기존·대안 점수와 SHAP. baseScore + Σ shapScore = 대안 점수."""
        legacy = score_one(self.legacy_model, features, "legacy")
        alternative = self.explainer.explain(features)
        return {
            "traditional": _model_score(legacy),
            "alternative": _model_score(alternative),
            "shap": {"baseScore": alternative["baseScore"], "factors": alternative["factors"]},
        }


def _model_score(result: dict) -> dict:
    """explain/score_one 결과 → 응답의 모델 한쪽 모양. 등급은 서비스 등급 구간(CUT-0.1)으로 매긴다."""
    return {"scorableYn": "Y", "score": result["score"], "gradeBandCode": grade_band(result["score"]),
            "defaultProb": result["defaultProb"]}


def _bundle_version(directory: Path) -> str | None:
    """FP-237 두 설명 파일(legacy·alternative.meta.json)에서 이 묶음의 모델 버전을 정한다. 쓸 수 없는 묶음이면 None.
    - 피처 세트가 적혀 있으면 서비스 피처 세트(FS-V1)와 같아야 한다(피처 목록·순서가 코드에 있어서).
    - 모델 버전은 LGBM-BASE-숫자.숫자 모양이어야 하고 두 파일이 같아야 한다(다른 학습의 파일이 섞이면 안 됨).
    - 어느 파일에도 버전이 없으면(옛 묶음) 기본값 REAL_MODEL_VERSION으로 본다."""
    versions = set()
    for name in ("legacy", "alternative"):
        path = directory / f"{name}.meta.json"
        if not path.exists():
            continue
        meta = json.loads(path.read_text(encoding="utf-8"))
        feature_set = meta.get("feature_set_version")
        if feature_set is not None and feature_set != REAL_FEATURE_SET_VERSION:
            log.warning("model meta feature set mismatch file=%s value=%s", path.name, feature_set)
            return None
        if "model_version" in meta:
            if not is_real_model_version(meta["model_version"]):
                log.warning("model meta version not allowed file=%s value=%s", path.name, meta["model_version"])
                return None
            versions.add(meta["model_version"])
    if len(versions) > 1:
        log.warning("model meta versions differ between files values=%s", sorted(versions))
        return None
    return versions.pop() if versions else REAL_MODEL_VERSION


HASH_LIST_FILE = "SHA256SUMS.txt"


def _hashes_match(directory: Path) -> bool:
    """모델 묶음에 들어 있는 SHA256SUMS.txt가 artifacts/에 있으면, 적힌 파일마다 해시를 대조한다(joblib을 열기 전에).
    목록 파일이 없으면 통과(로컬 개발 편의). 적힌 파일이 없거나 해시가 다르면 False — 받은 묶음이 아닌 파일은 열지 않는다."""
    hash_list = directory / HASH_LIST_FILE
    if not hash_list.exists():
        return True
    wrong = []
    for line in hash_list.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 2:
            continue
        expected, name = parts[0].lower(), parts[1].lstrip("*")
        path = directory / name
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            wrong.append(name)
    if wrong:
        log.warning("model hash mismatch files=%s — 실제 모델 요청은 503", wrong)
    return not wrong


def load_from_artifacts(directory: Path = ARTIFACT_DIR) -> ModelScorer:
    """artifacts/의 legacy.joblib·alternative.joblib을 불러온다. 파일이 없거나 실패하면 준비 안 된 ModelScorer(점수 요청은 503).
    joblib은 불러올 때 파일 안의 코드가 실행될 수 있으므로 팀이 공유한 묶음(해시 확인)만 이 폴더에 둔다."""
    files = {name: directory / f"{name}.joblib" for name in ("legacy", "alternative")}
    missing = [path.name for path in files.values() if not path.exists()]
    if missing:
        log.warning("model files not found dir=%s missing=%s — 실제 모델 요청은 503", directory, missing)
        return ModelScorer()
    if not _hashes_match(directory):
        return ModelScorer()
    version = _bundle_version(directory)
    if version is None:
        return ModelScorer()
    try:
        scorer = ModelScorer(joblib.load(files["legacy"]), joblib.load(files["alternative"]), version)
    except Exception as error:   # 버전이 다른 라이브러리로 만든 파일 등 — 서버는 켜 두고 503으로 알린다
        log.error("model load failed type=%s", type(error).__name__)
        return ModelScorer()
    log.info("model loaded version=%s featureSet=%s", version, REAL_FEATURE_SET_VERSION)
    return scorer


_scorer: ModelScorer | None = None


def get_scorer() -> ModelScorer:
    """서버 전체에서 같은 모델 묶음을 쓴다. 처음 부를 때 한 번만 불러온다(main.py가 시작할 때 미리 부른다)."""
    global _scorer
    if _scorer is None:
        _scorer = load_from_artifacts()
    return _scorer
