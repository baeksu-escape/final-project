-- ====================================================================
-- N-25 모형 성능 비교의 근거 기록 — 실제 모델 LGBM-BASE-0.1의 학습 데이터·모델 파일을 기록한다 (FP-216)
-- DATASET_VERSION 1행(학습 표 원본) + MODEL_ARTIFACT 2행(기존 모델 trad_legacy, 대안 모델 alt_legacy)
--
-- 값의 출처 (11/18 범영 확인)
--  - 학습 표: 디스코드 #파일공유 avenue_training_data_v3_6_1.zip 안의 1_model/legacy_model_table.csv
--    SHA-256·12,000행·252열을 직접 계산했고, 해시가 두 모델 meta.json의 data.table_sha256과 같다(이 표로 학습했다는 증거).
--  - 모델 파일: 디스코드 #파일공유 avenue_model_files_20261117b.zip의 legacy.joblib·alternative.joblib.
--    해시는 묶음의 SHA256SUMS.txt 값이고, FastAPI가 켜질 때 같은 값으로 대조한다(PR #77).
--  - AUC_VALID: 서버에 올린 모델(seed 11)의 검증 AUC. 5개 seed 평균·표준편차는 METRICS_JSON에 둔다.
--  - AUC_TEST: 비워 둔다. TEST는 최종 평가(FP-144) 때 한 번만 본다.
--
-- 결정 (11/18 범영)
--  - 학습 코드는 전처리(결측·C8 상한)를 메모리에서만 하고 정제 파일을 저장하지 않는다.
--    그래서 실제로 있는 파일만 RAW 1행으로 기록하고, 전처리 방식은 NOTE에 글로 남긴다(PROCESSED 행 없음).
--  - FILE_URI에는 개인 PC 경로가 아니라 팀 공유 위치(디스코드 #파일공유 파일 이름)를 쓴다.
--
-- 다시 실행해도 된다: 이미 있는 행은 건너뛴다(DATASET_NAME+VERSION_NO, MODEL_VERSION+ARTIFACT_NAME 기준).
-- 모델 전환(activate_model_lgbm_base_0_1.sql)과는 따로다. 이 SQL은 기록만 하고 ACTIVE를 바꾸지 않는다.
-- 적용한 DB에서는 dummy_db/99_check.sql의 DATASET_VERSION·MODEL_ARTIFACT 기대값(0)과 실제(1·2)가 다르게 나오는 것이 정상이다.
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
SET SERVEROUTPUT ON

DECLARE
    c_dataset_name CONSTANT DATASET_VERSION.DATASET_NAME%TYPE := 'avenue_training_legacy_table';
    c_version_no   CONSTANT DATASET_VERSION.VERSION_NO%TYPE   := 1;
    v_model_cnt  PLS_INTEGER;
    v_dataset_id DATASET_VERSION.DATASET_VERSION_ID%TYPE;

    PROCEDURE add_artifact(p_name VARCHAR2, p_uri VARCHAR2, p_sha VARCHAR2, p_auc NUMBER, p_metrics CLOB) IS
        v_cnt PLS_INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_cnt FROM MODEL_ARTIFACT WHERE MODEL_VERSION = 'LGBM-BASE-0.1' AND ARTIFACT_NAME = p_name;
        IF v_cnt > 0 THEN
            DBMS_OUTPUT.PUT_LINE('MODEL_ARTIFACT ' || p_name || ': 이미 있음, 건너뜀');
            RETURN;
        END IF;
        INSERT INTO MODEL_ARTIFACT (MODEL_VERSION, ARTIFACT_NAME, FILE_URI, FILE_SHA256, TRAIN_DATASET_VERSION_ID, AUC_VALID, AUC_TEST, METRICS_JSON)
        VALUES ('LGBM-BASE-0.1', p_name, p_uri, p_sha, v_dataset_id, p_auc, NULL, p_metrics);
        DBMS_OUTPUT.PUT_LINE('MODEL_ARTIFACT ' || p_name || ': 추가');
    END;
BEGIN
    -- 사전 확인: 모델 행이 있어야 한다(FK_MAF_MODEL). avenue_ddl.sql 기준 데이터에 CANDIDATE로 들어 있다
    SELECT COUNT(*) INTO v_model_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = 'LGBM-BASE-0.1';
    IF v_model_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20111, 'MODEL_REGISTRY에 LGBM-BASE-0.1 행이 없습니다. add_fs_v1_feature_set.sql을 먼저 실행하세요');
    END IF;

    -- 1) 학습 데이터 (RAW 1행)
    BEGIN
        SELECT DATASET_VERSION_ID INTO v_dataset_id
          FROM DATASET_VERSION WHERE DATASET_NAME = c_dataset_name AND VERSION_NO = c_version_no;
        DBMS_OUTPUT.PUT_LINE('DATASET_VERSION: 이미 있음(ID ' || v_dataset_id || '), 건너뜀');
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            INSERT INTO DATASET_VERSION (DATASET_NAME, VERSION_NO, STAGE_CODE, PARENT_DATASET_VERSION_ID, SOURCE_DESC, COLLECTION_BASIS,
                                         FILE_URI, FILE_SHA256, ROW_COUNT, COLUMN_COUNT, NOTE, CREATED_BY_NAME)
            VALUES (c_dataset_name, c_version_no, 'RAW', NULL,
                    '팀 자체 생성 합성 학습 데이터 v3.6.1(학습 값은 v3.6.0과 같음, 11/13 생성) 중 모델 학습 표. 직군×연체 라벨 층화 분할 TRAIN 8,400 / VALID 1,800 / TEST 1,800',
                    '팀이 직접 만든 합성 데이터라 실제 개인·금융 정보가 없고 외부 라이선스 제약이 없다. 교육용 프로젝트 안에서만 쓴다',
                    '디스코드 #파일공유 avenue_training_data_v3_6_1.zip / 1_model/legacy_model_table.csv',
                    '79511b5d04273ccea0ef9a8eb83d1def17959de08eb1847c7febce1232a969d3',
                    12000, 252,
                    '정제 파일은 따로 저장하지 않는다. 학습 때 메모리에서 C8 상한 밖 값과 파생 열을 결측으로 두고(피처 정의서 C19 (나)), 범주형은 고정 부호표로 바꾼다. TEST 행은 학습·검증에 쓰지 않는다',
                    '범영')
            RETURNING DATASET_VERSION_ID INTO v_dataset_id;
            DBMS_OUTPUT.PUT_LINE('DATASET_VERSION: 추가(ID ' || v_dataset_id || ')');
    END;

    -- 2) 모델 파일 2개
    add_artifact('trad_legacy',
                 '디스코드 #파일공유 avenue_model_files_20261117b.zip / legacy.joblib',
                 'c528d86e486ec409056439d4495c60e7fe523f5173e4126b168d61e4fffb9aad',
                 0.6064,
                 q'[{"model":"legacy","meta_sha256":"7d6b40bc86cb3eb62c761cc7cc62fb7b68f7a91b7fc9510cc4c25efc637fbb29","label":"label_any_delinquency_12m","feature_count":18,"valid_auc_mean":0.6049,"valid_auc_std":0.0026,"valid_auc_by_seed":[0.6064,0.6023,0.6019,0.6073,0.6067],"seeds":[11,22,33,44,55],"saved_model_seed":11,"train_rows":8400,"valid_rows":1800,"lgbm_params":{"n_estimators":300,"learning_rate":0.05,"num_leaves":31,"colsample_bytree":0.8},"library_versions":{"lightgbm":"4.6.0","shap":"0.51.0","scikit-learn":"1.9.1","pandas":"3.0.5","numpy":"2.4.6"},"trained_at":"2026-11-16T11:19:48+00:00"}]');
    add_artifact('alt_legacy',
                 '디스코드 #파일공유 avenue_model_files_20261117b.zip / alternative.joblib',
                 'f44af13793ed174b6b554b206218ef9df68db5a34101ea83851f59a76c6ddff5',
                 0.6565,
                 q'[{"model":"alternative","meta_sha256":"8db2ececc75f8f2ff587ba3516eb69cb1a3df0a75bd0e1574b44091d73158788","label":"label_nonfin_effect_12m","feature_count":38,"valid_auc_mean":0.6533,"valid_auc_std":0.0051,"valid_auc_by_seed":[0.6565,0.6483,0.6479,0.6592,0.6548],"seeds":[11,22,33,44,55],"saved_model_seed":11,"train_rows":8400,"valid_rows":1800,"lgbm_params":{"n_estimators":300,"learning_rate":0.05,"num_leaves":31,"colsample_bytree":0.8},"library_versions":{"lightgbm":"4.6.0","shap":"0.51.0","scikit-learn":"1.9.1","pandas":"3.0.5","numpy":"2.4.6"},"trained_at":"2026-11-16T11:19:49+00:00"}]');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: 학습 데이터 1행, 모델 파일 2행(trad_legacy 0.6064 / alt_legacy 0.6565, 둘 다 같은 학습 데이터 ID)
SELECT DATASET_VERSION_ID, DATASET_NAME, VERSION_NO, STAGE_CODE, ROW_COUNT, COLUMN_COUNT, SUBSTR(FILE_SHA256, 1, 8) AS SHA8 FROM DATASET_VERSION ORDER BY DATASET_VERSION_ID;
SELECT MODEL_VERSION, ARTIFACT_NAME, TRAIN_DATASET_VERSION_ID, AUC_VALID, AUC_TEST, SUBSTR(FILE_SHA256, 1, 8) AS SHA8 FROM MODEL_ARTIFACT ORDER BY ARTIFACT_NAME;
