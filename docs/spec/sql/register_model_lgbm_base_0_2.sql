-- ====================================================================
-- N-25 모형 성능 비교의 근거 기록 — 실제 모델 LGBM-BASE-0.2(재욱 11/20, 단조 제약 재학습)를 등록한다 (FP-237 2차)
-- MODEL_REGISTRY 1행(0.2, CANDIDATE, FS-V1) + MODEL_ARTIFACT 2행(기존 trad_legacy, 대안 alt_legacy)
-- 서비스는 바뀌지 않는다: ACTIVE는 그대로다. 0.2로 켜는 것은 activate_model_lgbm_base_0_2.sql이 따로 한다.
--
-- 값의 출처 (11/20 범영 확인)
--  - 모델 묶음: 디스코드 #파일공유 avenue_model_files_20261120_v02.zip. SHA256SUMS.txt 4줄을 직접 대조해 모두 일치했다.
--    두 meta.json의 model_version = LGBM-BASE-0.2, feature_set_version = FS-V1. FastAPI가 이 묶음을 0.2로 불러와 점수를 내는 것도 확인했다.
--  - 학습 데이터: 0.1과 같은 학습 표(SHA 앞 8자리 79511b5d, 두 meta.json의 data.table_sha256)라 DATASET_VERSION 새 행 없이
--    register_model_lgbm_base_0_1.sql이 넣은 행(avenue_training_legacy_table v1)을 그대로 가리킨다.
--  - AUC_VALID: 서버에 올린 모델(seed 11)의 검증 AUC(기존 0.6071 / 대안 0.6554). 5개 seed 평균·표준편차와 단조 제약 8개는 METRICS_JSON.
--    두 값은 라벨이 다르므로 나란히 비교하지 않는다(같은 라벨 비교는 재욱 님 후속 SQL이 METRICS_JSON에 더한다).
--  - AUC_TEST: 비워 둔다(FP-144).
--
-- 실행 순서: (0.1 등록이 끝난 DB) 이 파일(미리 해 둬도 됨) → 서버 PC 파일을 0.2 묶음으로 교체·/v1/health 확인 → 바로 activate_model_lgbm_base_0_2.sql
--   (파일 교체와 전환 SQL 사이에는 점수 요청이 409라, 공용 DB는 두 단계를 연달아 사용자가 없는 시간에 한다)
-- 다시 실행해도 된다: 이미 있는 행은 건너뛴다. 공용 DB는 PR 작성자가 병합 후 실행하고 DB 변경 채널에 남긴다(sql README 「공용 DB 적용 규칙」).
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON

DECLARE
    v_cnt        PLS_INTEGER;
    v_dataset_id DATASET_VERSION.DATASET_VERSION_ID%TYPE;

    PROCEDURE add_artifact(p_name VARCHAR2, p_uri VARCHAR2, p_sha VARCHAR2, p_auc NUMBER, p_metrics CLOB) IS
        v_n PLS_INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_n FROM MODEL_ARTIFACT WHERE MODEL_VERSION = 'LGBM-BASE-0.2' AND ARTIFACT_NAME = p_name;
        IF v_n > 0 THEN
            DBMS_OUTPUT.PUT_LINE('MODEL_ARTIFACT ' || p_name || ': 이미 있음, 건너뜀');
            RETURN;
        END IF;
        INSERT INTO MODEL_ARTIFACT (MODEL_VERSION, ARTIFACT_NAME, FILE_URI, FILE_SHA256, TRAIN_DATASET_VERSION_ID, AUC_VALID, AUC_TEST, METRICS_JSON)
        VALUES ('LGBM-BASE-0.2', p_name, p_uri, p_sha, v_dataset_id, p_auc, NULL, p_metrics);
        DBMS_OUTPUT.PUT_LINE('MODEL_ARTIFACT ' || p_name || ': 추가');
    END;
BEGIN
    -- 사전 확인 1: FS-V1 피처 세트가 있어야 한다(FK). 0.1 등록 때와 같은 기준 데이터
    SELECT COUNT(*) INTO v_cnt FROM FEATURE_SET_VERSION WHERE FEATURE_SET_VERSION = 'FS-V1';
    IF v_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20131, 'FS-V1 피처 세트가 없습니다. add_fs_v1_feature_set.sql을 먼저 실행하세요');
    END IF;

    -- 사전 확인 2: 0.1 등록 때 넣은 학습 데이터 행(같은 학습 표)을 재사용한다
    BEGIN
        SELECT DATASET_VERSION_ID INTO v_dataset_id
          FROM DATASET_VERSION
         WHERE DATASET_NAME = 'avenue_training_legacy_table' AND VERSION_NO = 1
           AND FILE_SHA256 = '79511b5d04273ccea0ef9a8eb83d1def17959de08eb1847c7febce1232a969d3';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20132, '학습 데이터 행이 없습니다. register_model_lgbm_base_0_1.sql을 먼저 실행하세요');
    END;

    -- 1) 모델 행 (CANDIDATE — 서비스는 아직 0.1)
    SELECT COUNT(*) INTO v_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = 'LGBM-BASE-0.2';
    IF v_cnt = 0 THEN
        INSERT INTO MODEL_REGISTRY (MODEL_VERSION, ALGORITHM_NAME, FEATURE_SET_VERSION, STATUS_CODE, TRAINED_AT, NOTE)
        VALUES ('LGBM-BASE-0.2', 'LightGBM', 'FS-V1', 'CANDIDATE', TIMESTAMP '2026-11-20 01:44:09',
                'LightGBM 0.2(합성 데이터, 튜닝 없음). 0.1과 같은 학습 표에 방향이 분명한 피처 8개 단조 제약. 학습 시각은 UTC');
        DBMS_OUTPUT.PUT_LINE('MODEL_REGISTRY LGBM-BASE-0.2: 추가(CANDIDATE)');
    ELSE
        DBMS_OUTPUT.PUT_LINE('MODEL_REGISTRY LGBM-BASE-0.2: 이미 있음, 건너뜀');
    END IF;

    -- 2) 모델 파일 2개
    add_artifact('trad_legacy',
                 '디스코드 #파일공유 avenue_model_files_20261120_v02.zip / legacy.joblib',
                 '88e4ff34d26f62b32b77d823e2711c961992dc925de4eb7da8b8252d31421494',
                 0.6071,
                 q'[{"model":"legacy","meta_sha256":"34744810a2e005f6fcc1240793796fe088815868eed7f89428129392e37dfc1a","label":"label_any_delinquency_12m","feature_count":18,"valid_auc_mean":0.6047,"valid_auc_std":0.0043,"valid_auc_by_seed":[0.6071,0.6051,0.5997,0.6013,0.6103],"seeds":[11,22,33,44,55],"saved_model_seed":11,"train_rows":8400,"valid_rows":1800,"lgbm_params":{"n_estimators":300,"learning_rate":0.05,"num_leaves":31,"colsample_bytree":0.8},"monotone_constraints":{"expense_ratio_svc_12m":1,"dsr_svc_12m":1,"deficit_months_svc_12m":1,"worst_month_net_cash_svc_12m_krw":-1,"DQ1200001":1,"CL0631905":1,"income_svc_12m_krw":-1,"expense_avg_month_krw":1},"library_versions":{"lightgbm":"4.6.0","shap":"0.51.0","scikit-learn":"1.9.1","pandas":"3.0.5","numpy":"2.4.6"},"trained_at":"2026-11-20T01:44:07+00:00"}]');
    add_artifact('alt_legacy',
                 '디스코드 #파일공유 avenue_model_files_20261120_v02.zip / alternative.joblib',
                 'f676753436f6d6ef7d189dcf1fcf5c54533ed7324c0a577ae057c80dc9971e17',
                 0.6554,
                 q'[{"model":"alternative","meta_sha256":"2cf611a3291d470ac58c6ae5106783361f781ad53891b438226e2ef329019d8c","label":"label_nonfin_effect_12m","feature_count":38,"valid_auc_mean":0.6591,"valid_auc_std":0.0054,"valid_auc_by_seed":[0.6554,0.6605,0.654,0.6676,0.658],"seeds":[11,22,33,44,55],"saved_model_seed":11,"train_rows":8400,"valid_rows":1800,"lgbm_params":{"n_estimators":300,"learning_rate":0.05,"num_leaves":31,"colsample_bytree":0.8},"monotone_constraints":{"expense_ratio_svc_12m":1,"dsr_svc_12m":1,"deficit_months_svc_12m":1,"worst_month_net_cash_svc_12m_krw":-1,"DQ1200001":1,"CL0631905":1,"income_svc_12m_krw":-1,"expense_avg_month_krw":1},"library_versions":{"lightgbm":"4.6.0","shap":"0.51.0","scikit-learn":"1.9.1","pandas":"3.0.5","numpy":"2.4.6"},"trained_at":"2026-11-20T01:44:09+00:00"}]');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: 모델 3행(DEV-DUMMY·0.1·0.2), 0.2는 CANDIDATE. 모델 파일 4행(0.1 두 행 + 0.2 두 행), 0.2 두 행은 0.1과 같은 학습 데이터 ID
SELECT MODEL_VERSION, FEATURE_SET_VERSION, STATUS_CODE, TRAINED_AT FROM MODEL_REGISTRY ORDER BY MODEL_VERSION;
SELECT MODEL_VERSION, ARTIFACT_NAME, TRAIN_DATASET_VERSION_ID, AUC_VALID, AUC_TEST, SUBSTR(FILE_SHA256, 1, 8) AS SHA8
  FROM MODEL_ARTIFACT ORDER BY MODEL_VERSION, ARTIFACT_NAME;
