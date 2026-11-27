-- ====================================================================
-- N-25 모형 성능 비교의 근거 기록 — 실제 모델 LGBM-BASE-0.3(데이터 v3.7.0, 단조 제약 19개)을 등록한다 (FP-285, 정의서 10장 C32~C40)
-- DATASET_VERSION 1행(v3.7.0 학습 표) + MODEL_REGISTRY 1행(0.3, CANDIDATE, FS-V1) + MODEL_ARTIFACT 2행(기존 trad_legacy, 대안 alt_legacy)
-- 서비스는 바뀌지 않는다: ACTIVE는 그대로다. 0.3으로 켜는 것은 activate_model_lgbm_base_0_3.sql이 따로 한다.
--
-- 값의 출처
--  - 학습 표: 데이터 v3.7.0의 1_model/legacy_model_table.csv. SHA-256·139,347행·252열을 직접 계산했고, 해시가 두 모델 meta.json의 data.table_sha256과 같다.
--  - 모델 파일: 디스코드 #파일공유 avenue_model_files_20261127_v03.zip의 legacy.joblib·alternative.joblib. 해시는 정의서 C37 기록과 TEST 평가 결과(final_test_eval_result_v03.json)의 값과 같다.
--  - AUC_VALID·AUC_TEST: 서버에 올리는 모델(seed 11)의 검증·시험 AUC. TEST는 11/27 한 번만 실행했다(C39). 5개 seed 값과 단조 제약은 METRICS_JSON.
--    두 모델의 값은 라벨이 다르므로 나란히 비교하지 않는다(같은 라벨 비교는 update_model_metrics_same_label_lgbm_base_0_3.sql).
--
-- 실행 순서: add_cutoff_cut_0_4.sql → 이 파일 → load_model_eval_sample_lgbm_base_0_3.sql → update_model_metrics_same_label_lgbm_base_0_3.sql
--   (여기까지는 서비스에 영향이 없다) → 서버 PC 파일을 0.3 묶음으로 교체·/v1/health 확인 → 바로 activate_model_lgbm_base_0_3.sql → activate_cutoff_cut_0_4.sql
-- 다시 실행해도 된다: 이미 있는 행은 건너뛴다. 공용 DB는 PR 작성자가 병합 후 실행하고 DB 변경 채널에 남긴다(sql README 「공용 DB 적용 규칙」).
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON
SET DEFINE OFF

DECLARE
    c_dataset_name CONSTANT DATASET_VERSION.DATASET_NAME%TYPE := 'avenue_training_legacy_table';
    c_version_no   CONSTANT DATASET_VERSION.VERSION_NO%TYPE   := 2;
    c_table_sha    CONSTANT DATASET_VERSION.FILE_SHA256%TYPE  := '814d6d2d2af488dc82809ff357932ac7403ab38b1456c9249424b2487e0eeed9';
    v_cnt        PLS_INTEGER;
    v_dataset_id DATASET_VERSION.DATASET_VERSION_ID%TYPE;
    v_sha        DATASET_VERSION.FILE_SHA256%TYPE;

    PROCEDURE add_artifact(p_name VARCHAR2, p_uri VARCHAR2, p_sha VARCHAR2, p_auc_valid NUMBER, p_auc_test NUMBER, p_metrics CLOB) IS
        v_n PLS_INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_n FROM MODEL_ARTIFACT WHERE MODEL_VERSION = 'LGBM-BASE-0.3' AND ARTIFACT_NAME = p_name;
        IF v_n > 0 THEN
            DBMS_OUTPUT.PUT_LINE('MODEL_ARTIFACT ' || p_name || ': 이미 있음, 건너뜀');
            RETURN;
        END IF;
        INSERT INTO MODEL_ARTIFACT (MODEL_VERSION, ARTIFACT_NAME, FILE_URI, FILE_SHA256, TRAIN_DATASET_VERSION_ID, AUC_VALID, AUC_TEST, METRICS_JSON)
        VALUES ('LGBM-BASE-0.3', p_name, p_uri, p_sha, v_dataset_id, p_auc_valid, p_auc_test, p_metrics);
        DBMS_OUTPUT.PUT_LINE('MODEL_ARTIFACT ' || p_name || ': 추가');
    END;
BEGIN
    -- 사전 확인: FS-V1 피처 세트가 있어야 한다(FK)
    SELECT COUNT(*) INTO v_cnt FROM FEATURE_SET_VERSION WHERE FEATURE_SET_VERSION = 'FS-V1';
    IF v_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20181, 'FS-V1 피처 세트가 없습니다. add_fs_v1_feature_set.sql을 먼저 실행하세요');
    END IF;

    -- 1) 학습 데이터 v3.7.0 (RAW 1행, 0.1·0.2가 쓴 v1은 그대로 둔다)
    BEGIN
        SELECT DATASET_VERSION_ID, FILE_SHA256 INTO v_dataset_id, v_sha
          FROM DATASET_VERSION WHERE DATASET_NAME = c_dataset_name AND VERSION_NO = c_version_no;
        IF v_sha <> c_table_sha THEN
            RAISE_APPLICATION_ERROR(-20182, 'DATASET_VERSION ' || c_dataset_name || ' v' || c_version_no || '의 파일 해시가 다릅니다. 어떤 데이터인지 확인하세요');
        END IF;
        DBMS_OUTPUT.PUT_LINE('DATASET_VERSION: 이미 있음(ID ' || v_dataset_id || '), 건너뜀');
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            INSERT INTO DATASET_VERSION (DATASET_NAME, VERSION_NO, STAGE_CODE, PARENT_DATASET_VERSION_ID, SOURCE_DESC, COLLECTION_BASIS,
                                         FILE_URI, FILE_SHA256, ROW_COUNT, COLUMN_COUNT, NOTE, CREATED_BY_NAME)
            VALUES (c_dataset_name, c_version_no, 'RAW', NULL,
                    '합성 학습 데이터 v3.7.0(11/26 생성) 중 모델 학습 표. 교육용 합성 원본의 직군 해당 139,347명, 분할 TRAIN 97,543 / VALID 20,903 / TEST 20,901(v3.6.1의 12,000명은 TRAIN). 연체 라벨 재설계(정의서 C32)',
                    '교육용 합성 원본을 팀이 확장 생성한 데이터라 실제 개인·금융 정보가 없다. 교육용 프로젝트 안에서만 쓴다',
                    '디스코드 #파일공유 avenue_training_data_v3_7_0.zip / 1_model/legacy_model_table.csv',
                    c_table_sha,
                    139347, 252,
                    '정제 파일은 따로 저장하지 않는다. 학습 때 메모리에서 C8 상한 밖 값과 파생 열을 결측으로 두고(피처 정의서 C19 (나)), 범주형은 고정 부호표로 바꾼다',
                    '재욱')
            RETURNING DATASET_VERSION_ID INTO v_dataset_id;
            DBMS_OUTPUT.PUT_LINE('DATASET_VERSION: 추가(ID ' || v_dataset_id || ')');
    END;

    -- 2) 모델 행 (CANDIDATE — 서비스는 아직 바뀌지 않는다)
    SELECT COUNT(*) INTO v_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = 'LGBM-BASE-0.3';
    IF v_cnt = 0 THEN
        INSERT INTO MODEL_REGISTRY (MODEL_VERSION, ALGORITHM_NAME, FEATURE_SET_VERSION, STATUS_CODE, TRAINED_AT, NOTE)
        VALUES ('LGBM-BASE-0.3', 'LightGBM', 'FS-V1', 'CANDIDATE', TIMESTAMP '2026-11-26 08:35:14',
                'LightGBM 0.3(합성 데이터 v3.7.0, 튜닝 없음). 연체 라벨 재설계, 방향이 분명한 피처 19개 단조 제약. 학습 시각은 UTC');
        DBMS_OUTPUT.PUT_LINE('MODEL_REGISTRY LGBM-BASE-0.3: 추가(CANDIDATE)');
    ELSE
        DBMS_OUTPUT.PUT_LINE('MODEL_REGISTRY LGBM-BASE-0.3: 이미 있음, 건너뜀');
    END IF;

    -- 3) 모델 파일 2개
    add_artifact('trad_legacy',
                 '디스코드 #파일공유 avenue_model_files_20261127_v03.zip / legacy.joblib',
                 '2afa3e925dc40da41dce2c07046c54f23b0d6d13c822086fc02c34758bb54f36',
                 0.6748, 0.6830,
                 q'[{"model":"legacy","meta_sha256":"19b46ee1619387557269d6a5572710891bb74a4c61695474ac120dcc532c1187","label":"label_any_delinquency_12m","feature_count":18,"valid_auc_mean":0.6749,"valid_auc_std":0.0005,"valid_auc_by_seed":[0.6748,0.6741,0.6754,0.6754,0.675],"test_auc_mean":0.6835,"test_auc_std":0.0006,"test_auc_by_seed":[0.683,0.6845,0.6836,0.6832,0.6834],"seeds":[11,22,33,44,55],"saved_model_seed":11,"train_rows":97543,"valid_rows":20903,"test_rows":20901,"lgbm_params":{"n_estimators":300,"learning_rate":0.05,"num_leaves":31,"colsample_bytree":0.8},"monotone_constraints":{"expense_ratio_svc_12m":1,"dsr_svc_12m":1,"deficit_months_svc_12m":1,"worst_month_net_cash_svc_12m_krw":-1,"DQ1200001":1,"CL0631905":1,"income_svc_12m_krw":-1,"expense_avg_month_krw":1,"debt_balance_krw":1,"debt_service_current_krw":1,"L00000001":1,"L22000900":1,"LA0099212":1,"CF1231605":1,"zero_income_months_svc_12m":1,"telecom_late_months":1,"telecom_on_time_streak":-1,"utility_late_months":1,"dp_payment_count_12m":-1},"library_versions":{"lightgbm":"4.6.0","shap":"0.51.0","scikit-learn":"1.9.1","pandas":"3.0.5","numpy":"2.4.6"},"trained_at":"2026-11-26T08:35:09+00:00"}]');
    add_artifact('alt_legacy',
                 '디스코드 #파일공유 avenue_model_files_20261127_v03.zip / alternative.joblib',
                 'bde7d5338de7e9fcc6b11ea0e029e3ccd0b13ec32ad7d02d7db5f2370cc0397f',
                 0.7389, 0.7476,
                 q'[{"model":"alternative","meta_sha256":"6795cdaedf475d114ed4669eb88a90501f020e9422a4036314ed461f78c69afd","label":"label_nonfin_effect_12m","feature_count":38,"valid_auc_mean":0.7383,"valid_auc_std":0.0005,"valid_auc_by_seed":[0.7389,0.7382,0.7388,0.7376,0.738],"test_auc_mean":0.748,"test_auc_std":0.0006,"test_auc_by_seed":[0.7476,0.7473,0.7488,0.7479,0.7481],"seeds":[11,22,33,44,55],"saved_model_seed":11,"train_rows":97543,"valid_rows":20903,"test_rows":20901,"lgbm_params":{"n_estimators":300,"learning_rate":0.05,"num_leaves":31,"colsample_bytree":0.8},"monotone_constraints":{"expense_ratio_svc_12m":1,"dsr_svc_12m":1,"deficit_months_svc_12m":1,"worst_month_net_cash_svc_12m_krw":-1,"DQ1200001":1,"CL0631905":1,"income_svc_12m_krw":-1,"expense_avg_month_krw":1,"debt_balance_krw":1,"debt_service_current_krw":1,"L00000001":1,"L22000900":1,"LA0099212":1,"CF1231605":1,"zero_income_months_svc_12m":1,"telecom_late_months":1,"telecom_on_time_streak":-1,"utility_late_months":1,"dp_payment_count_12m":-1},"library_versions":{"lightgbm":"4.6.0","shap":"0.51.0","scikit-learn":"1.9.1","pandas":"3.0.5","numpy":"2.4.6"},"trained_at":"2026-11-26T08:35:14+00:00"}]');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: 0.3은 CANDIDATE, 모델 파일 2행(AUC_VALID 0.6748/0.7389, AUC_TEST 0.6830/0.7476), 두 행이 v2 학습 데이터 ID를 가리킨다
SELECT DATASET_VERSION_ID, DATASET_NAME, VERSION_NO, ROW_COUNT, COLUMN_COUNT, SUBSTR(FILE_SHA256, 1, 8) AS SHA8 FROM DATASET_VERSION ORDER BY DATASET_VERSION_ID;
SELECT MODEL_VERSION, FEATURE_SET_VERSION, STATUS_CODE, TRAINED_AT FROM MODEL_REGISTRY ORDER BY MODEL_VERSION;
SELECT MODEL_VERSION, ARTIFACT_NAME, TRAIN_DATASET_VERSION_ID, AUC_VALID, AUC_TEST, SUBSTR(FILE_SHA256, 1, 8) AS SHA8
  FROM MODEL_ARTIFACT ORDER BY MODEL_VERSION, ARTIFACT_NAME;
