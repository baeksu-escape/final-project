# FP-141 N-12-2·N-14 실제 모델 점수 — 재욱 님이 학습한 LightGBM 베이스라인(합성 데이터, 임시)으로 기존·대안 점수와 SHAP을 낸다.
# 응답 모양은 Mock(pipeline/mock_scorer.score_features)과 같다: {traditional, alternative, shap}. 그래서 라우터·Spring은 그대로다.
# 점수 환산·SHAP·합 규칙은 training/explain.py(FP-138)를, 모델 입력은 training/interface.py(to_model_input)를 그대로 쓴다.
# 점수·SHAP은 실제 신용평가 결과나 인과관계가 아니다. 화면에는 "작용한 정도"로만 보여 준다.
import json
import logging
from pathlib import Path

import joblib

from pipeline.feature_catalog import REAL_FEATURE_SET_VERSION, REAL_MODEL_VERSION, grade_band
from training.explain import AlternativeExplainer, score_one

log = logging.getLogger("avenue.prediction")

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "artifacts"


class ModelScorer:
    """기존(legacy)·대안(alternative) 모델 한 묶음. 서버가 시작할 때 한 번 만들어 재사용한다(SHAP 설명기 만드는 데 시간이 걸린다)."""

    def __init__(self, legacy_model=None, alternative_model=None):
        self.legacy_model = legacy_model
        self.explainer = AlternativeExplainer(alternative_model) if alternative_model is not None else None

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


def _meta_matches(path: Path) -> bool:
    """설명 파일에 모델 버전·피처 세트가 적혀 있으면 서비스 값과 같은지 본다(재욱 님 새 묶음부터 들어감). 없으면 통과."""
    if not path.exists():
        return True
    meta = json.loads(path.read_text(encoding="utf-8"))
    expected = {"model_version": REAL_MODEL_VERSION, "feature_set_version": REAL_FEATURE_SET_VERSION}
    wrong = {key: meta[key] for key, value in expected.items() if key in meta and meta[key] != value}
    if wrong:
        log.warning("model meta mismatch file=%s values=%s", path.name, wrong)
    return not wrong


def load_from_artifacts(directory: Path = ARTIFACT_DIR) -> ModelScorer:
    """artifacts/의 legacy.joblib·alternative.joblib을 불러온다. 파일이 없거나 실패하면 준비 안 된 ModelScorer(점수 요청은 503).
    joblib은 불러올 때 파일 안의 코드가 실행될 수 있으므로 팀이 공유한 묶음(해시 확인)만 이 폴더에 둔다."""
    files = {name: directory / f"{name}.joblib" for name in ("legacy", "alternative")}
    missing = [path.name for path in files.values() if not path.exists()]
    if missing:
        log.warning("model files not found dir=%s missing=%s — %s 요청은 503", directory, missing, REAL_MODEL_VERSION)
        return ModelScorer()
    if not all(_meta_matches(directory / f"{name}.meta.json") for name in files):
        return ModelScorer()
    try:
        scorer = ModelScorer(joblib.load(files["legacy"]), joblib.load(files["alternative"]))
    except Exception as error:   # 버전이 다른 라이브러리로 만든 파일 등 — 서버는 켜 두고 503으로 알린다
        log.error("model load failed type=%s", type(error).__name__)
        return ModelScorer()
    log.info("model loaded version=%s featureSet=%s", REAL_MODEL_VERSION, REAL_FEATURE_SET_VERSION)
    return scorer


_scorer: ModelScorer | None = None


def get_scorer() -> ModelScorer:
    """서버 전체에서 같은 모델 묶음을 쓴다. 처음 부를 때 한 번만 불러온다(main.py가 시작할 때 미리 부른다)."""
    global _scorer
    if _scorer is None:
        _scorer = load_from_artifacts()
    return _scorer
