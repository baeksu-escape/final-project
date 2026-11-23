-- ====================================================================
-- N-25 모형 성능 비교 — 두 모델의 AUC를 같은 라벨로 맞춘 값을 METRICS_JSON에 더한다 (FP-235, FP-216 후속)
-- 대상: MODEL_ARTIFACT의 LGBM-BASE-0.1 두 행(trad_legacy, alt_legacy). AUC_VALID·AUC_TEST·파일 해시는 바꾸지 않는다.
--
-- 왜 필요한가
--  - AUC_VALID는 각 모델이 자기 정답 라벨로 잰 값이다(기존 0.6064=연체 라벨, 대안 0.6565=비금융 효과 라벨).
--    라벨이 다른 두 값을 나란히 놓고 비교하면 틀린 비교가 된다(피처 정의서 10장 C20).
--  - 그래서 같은 라벨끼리 비교하는 값(연체 라벨: 기존 0.6049 / 대안 0.5991, 비금융 효과 라벨: 기존 0.6102 / 대안 0.6533)을
--    METRICS_JSON의 same_label_comparison에 더한다. 두 행에 같은 값이 들어간다.
--
-- 값의 출처와 한계
--  - fastapi_server의 training/compare_labels.py와 같은 계산(VALID, 시드 5개 평균±표준편차, TEST 미사용). 학습 표 SHA 앞 8자리 79511b5d.
--  - 라벨마다 두 모델을 새로 학습한 실험값이라 서버에 올린 모델 자체의 AUC가 아니다(예: 연체 라벨 칸의 대안 0.5991은
--    "대안 피처로 연체 라벨을 학습한 모델"의 값). 비금융 효과 라벨의 차이(+0.043)는 합성 데이터에 설계해 넣은 효과가 반영된 값이다.
--  - 최종 발표 값은 FP-144(TEST)로 확정한다.
--
-- 먼저 register_model_lgbm_base_0_1.sql을 실행해 두 행이 있어야 한다(없으면 멈춘다). 다시 실행해도 같은 결과가 된다.
-- 두 행의 METRICS_JSON을 통째로 바꾼다. 기존 항목(label, valid_auc_mean 등)은 그대로 들어 있고 same_label_comparison만 더해졌다.
-- 공용 DB는 PR 작성자가 병합 후 실행하고 DB 변경 채널에 남긴다(sql README 「공용 DB 적용 규칙」). SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
SET SERVEROUTPUT ON

DECLARE
    PROCEDURE set_metrics(p_name VARCHAR2, p_metrics CLOB) IS
    BEGIN
        UPDATE MODEL_ARTIFACT SET METRICS_JSON = p_metrics WHERE MODEL_VERSION = 'LGBM-BASE-0.1' AND ARTIFACT_NAME = p_name;
        IF SQL%ROWCOUNT <> 1 THEN
            RAISE_APPLICATION_ERROR(-20112, 'MODEL_ARTIFACT ' || p_name || ' 행이 없습니다. register_model_lgbm_base_0_1.sql을 먼저 실행하세요');
        END IF;
        DBMS_OUTPUT.PUT_LINE('MODEL_ARTIFACT ' || p_name || ': METRICS_JSON 갱신');
    END;
BEGIN
    set_metrics('trad_legacy',
                q'[{"model":"legacy","meta_sha256":"7d6b40bc86cb3eb62c761cc7cc62fb7b68f7a91b7fc9510cc4c25efc637fbb29","label":"label_any_delinquency_12m","feature_count":18,"valid_auc_mean":0.6049,"valid_auc_std":0.0026,"valid_auc_by_seed":[0.6064,0.6023,0.6019,0.6073,0.6067],"seeds":[11,22,33,44,55],"saved_model_seed":11,"train_rows":8400,"valid_rows":1800,"lgbm_params":{"n_estimators":300,"learning_rate":0.05,"num_leaves":31,"colsample_bytree":0.8},"library_versions":{"lightgbm":"4.6.0","shap":"0.51.0","scikit-learn":"1.9.1","pandas":"3.0.5","numpy":"2.4.6"},"trained_at":"2026-11-16T11:19:48+00:00","same_label_comparison":{"basis":"VALID","seeds":[11,22,33,44,55],"same_label_share_valid":0.832,"note":"라벨마다 두 모델을 새로 학습해 같은 라벨에서 비교한 실험값(VALID, TEST 미사용). 서버에 올린 모델의 AUC_VALID(각 모델의 자기 라벨 값)와는 다른 실험이다. 비금융 효과 라벨은 합성 데이터에 설계해 넣은 효과가 반영된 라벨이라 대안 모델이 실제로 더 좋다는 근거가 아니다. 최종 값은 FP-144(TEST)로 확정한다","by_label":{"label_any_delinquency_12m":{"legacy":{"mean":0.6049,"std":0.0026,"by_seed":[0.6064,0.6023,0.6019,0.6073,0.6067]},"alternative":{"mean":0.5991,"std":0.0124,"by_seed":[0.6183,0.587,0.5927,0.5933,0.6041]},"diff_alt_minus_legacy_mean":-0.0058},"label_nonfin_effect_12m":{"legacy":{"mean":0.6102,"std":0.0016,"by_seed":[0.6085,0.6096,0.6095,0.6109,0.6127]},"alternative":{"mean":0.6533,"std":0.0051,"by_seed":[0.6565,0.6483,0.6479,0.6592,0.6548]},"diff_alt_minus_legacy_mean":0.0431}}}}]');
    set_metrics('alt_legacy',
                q'[{"model":"alternative","meta_sha256":"8db2ececc75f8f2ff587ba3516eb69cb1a3df0a75bd0e1574b44091d73158788","label":"label_nonfin_effect_12m","feature_count":38,"valid_auc_mean":0.6533,"valid_auc_std":0.0051,"valid_auc_by_seed":[0.6565,0.6483,0.6479,0.6592,0.6548],"seeds":[11,22,33,44,55],"saved_model_seed":11,"train_rows":8400,"valid_rows":1800,"lgbm_params":{"n_estimators":300,"learning_rate":0.05,"num_leaves":31,"colsample_bytree":0.8},"library_versions":{"lightgbm":"4.6.0","shap":"0.51.0","scikit-learn":"1.9.1","pandas":"3.0.5","numpy":"2.4.6"},"trained_at":"2026-11-16T11:19:49+00:00","same_label_comparison":{"basis":"VALID","seeds":[11,22,33,44,55],"same_label_share_valid":0.832,"note":"라벨마다 두 모델을 새로 학습해 같은 라벨에서 비교한 실험값(VALID, TEST 미사용). 서버에 올린 모델의 AUC_VALID(각 모델의 자기 라벨 값)와는 다른 실험이다. 비금융 효과 라벨은 합성 데이터에 설계해 넣은 효과가 반영된 라벨이라 대안 모델이 실제로 더 좋다는 근거가 아니다. 최종 값은 FP-144(TEST)로 확정한다","by_label":{"label_any_delinquency_12m":{"legacy":{"mean":0.6049,"std":0.0026,"by_seed":[0.6064,0.6023,0.6019,0.6073,0.6067]},"alternative":{"mean":0.5991,"std":0.0124,"by_seed":[0.6183,0.587,0.5927,0.5933,0.6041]},"diff_alt_minus_legacy_mean":-0.0058},"label_nonfin_effect_12m":{"legacy":{"mean":0.6102,"std":0.0016,"by_seed":[0.6085,0.6096,0.6095,0.6109,0.6127]},"alternative":{"mean":0.6533,"std":0.0051,"by_seed":[0.6565,0.6483,0.6479,0.6592,0.6548]},"diff_alt_minus_legacy_mean":0.0431}}}}]');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: 두 행 모두 same_label_comparison이 있고(1), AUC_VALID는 그대로(trad_legacy 0.6064 / alt_legacy 0.6565)
SELECT ARTIFACT_NAME, AUC_VALID, AUC_TEST,
       JSON_VALUE(METRICS_JSON, '$.same_label_comparison.by_label.label_any_delinquency_12m.legacy.mean') AS DELINQ_LEGACY,
       JSON_VALUE(METRICS_JSON, '$.same_label_comparison.by_label.label_any_delinquency_12m.alternative.mean') AS DELINQ_ALT,
       JSON_VALUE(METRICS_JSON, '$.same_label_comparison.by_label.label_nonfin_effect_12m.legacy.mean') AS NONFIN_LEGACY,
       JSON_VALUE(METRICS_JSON, '$.same_label_comparison.by_label.label_nonfin_effect_12m.alternative.mean') AS NONFIN_ALT
  FROM MODEL_ARTIFACT WHERE MODEL_VERSION = 'LGBM-BASE-0.1' ORDER BY ARTIFACT_NAME;
