-- ====================================================================
-- N-25 모형 성능 비교 — 모델 0.3의 두 모델 AUC를 같은 라벨로 맞춘 값을 METRICS_JSON에 더한다 (FP-285, 0.2는 update_model_metrics_same_label_lgbm_base_0_2.sql)
-- 대상: MODEL_ARTIFACT의 LGBM-BASE-0.3 두 행(trad_legacy, alt_legacy). AUC_VALID·AUC_TEST·파일 해시와 METRICS_JSON의 기존 항목은 바꾸지 않는다.
--
-- 왜 필요한가
--  - AUC_VALID는 각 모델이 자기 정답 라벨로 잰 값이라(기존=연체 라벨, 대안=비금융 효과 라벨) 나란히 비교하면 틀린 비교가 된다(피처 정의서 10장 C20).
--  - 그래서 같은 라벨끼리 비교하는 값(연체 라벨: 기존 0.6749 / 대안 0.6750, 비금융 효과 라벨: 기존 0.7193 / 대안 0.7383)을
--    METRICS_JSON의 same_label_comparison에 더한다. 두 행에 같은 값이 들어간다.
--
-- 값의 출처와 한계
--  - docs/spec/model_v03_valid_check_c36.json의 VALID 값(시드 5개 평균±표준편차, 학습 표 SHA 앞 8자리 814d6d2d, 정의서 C37).
--  - 라벨마다 두 모델을 새로 학습한 실험값이라 서버에 올린 모델 자체의 AUC가 아니다. 연체 라벨에서 대안은 기존과 구분되지 않는다(+0.0001).
--    비금융 효과 라벨의 차이(+0.0190)는 합성 데이터에 설계해 넣은 효과가 반영된 값이다. 0.2의 같은 값(+0.0511)과는 데이터·라벨이 달라 직접 비교하지 않는다.
--
-- 이 SQL은 JSON_MERGEPATCH로 same_label_comparison 키만 더한다. 그래서 0.3 등록 SQL이 넣은 METRICS_JSON의 기존 항목(label, valid_auc_* 등)은 그대로 남는다.
-- 먼저 0.3 등록 SQL을 실행해 두 행이 있어야 한다(없으면 멈춘다). 다시 실행해도 같은 키를 같은 값으로 덮어써서 결과가 같다.
-- 오류가 나면 두 행이 함께 취소된다. 공용 DB는 PR 작성자가 병합 후 실행하고 DB 변경 채널에 남긴다(sql README 「공용 DB 적용 규칙」). SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON
SET DEFINE OFF

DECLARE
    PROCEDURE add_comparison(p_name VARCHAR2, p_patch CLOB) IS
    BEGIN
        UPDATE MODEL_ARTIFACT
           SET METRICS_JSON = JSON_MERGEPATCH(NVL(METRICS_JSON, '{}'), p_patch RETURNING CLOB)
         WHERE MODEL_VERSION = 'LGBM-BASE-0.3' AND ARTIFACT_NAME = p_name;
        IF SQL%ROWCOUNT <> 1 THEN
            RAISE_APPLICATION_ERROR(-20184, 'MODEL_ARTIFACT ' || p_name || ' 행이 없습니다. 0.3 등록 SQL을 먼저 실행하세요');
        END IF;
        DBMS_OUTPUT.PUT_LINE('MODEL_ARTIFACT ' || p_name || ': same_label_comparison 추가');
    END;
BEGIN
    add_comparison('trad_legacy',
                   q'[{"same_label_comparison":{"basis":"VALID","seeds":[11,22,33,44,55],"same_label_share_valid":0.839,"note":"라벨마다 두 모델을 새로 학습해 같은 라벨에서 비교한 실험값(VALID, 단조 제약 19개 적용). 서버에 올린 모델의 AUC_VALID(각 모델의 자기 라벨 값)와는 다른 실험이다. 연체 라벨에는 대안 데이터 효과를 넣지 않아 대안이 기존보다 낫지 않은 것이 정상이다. 비금융 효과 라벨은 합성 데이터에 설계해 넣은 효과가 반영된 라벨이라 대안 모델이 실제로 더 좋다는 근거가 아니다. TEST(11/27 1회, 정의서 C39) 5개 시드 평균: 연체 라벨 기존 0.6835/대안 0.6821, 비금융 효과 라벨 기존 0.7290/대안 0.7480","model_options":{"monotone":true,"with_thinfile":false,"monotone_set":"v03"},"by_label":{"label_any_delinquency_12m":{"legacy":{"mean":0.6749,"std":0.0005,"by_seed":[0.6748,0.6741,0.6754,0.6754,0.675]},"alternative":{"mean":0.675,"std":0.0006,"by_seed":[0.6752,0.674,0.6755,0.6749,0.6751]},"diff_alt_minus_legacy_mean":0.0001},"label_nonfin_effect_12m":{"legacy":{"mean":0.7193,"std":0.0005,"by_seed":[0.7192,0.7188,0.7201,0.719,0.7195]},"alternative":{"mean":0.7383,"std":0.0005,"by_seed":[0.7389,0.7382,0.7388,0.7376,0.738]},"diff_alt_minus_legacy_mean":0.019}}}}]');
    add_comparison('alt_legacy',
                   q'[{"same_label_comparison":{"basis":"VALID","seeds":[11,22,33,44,55],"same_label_share_valid":0.839,"note":"라벨마다 두 모델을 새로 학습해 같은 라벨에서 비교한 실험값(VALID, 단조 제약 19개 적용). 서버에 올린 모델의 AUC_VALID(각 모델의 자기 라벨 값)와는 다른 실험이다. 연체 라벨에는 대안 데이터 효과를 넣지 않아 대안이 기존보다 낫지 않은 것이 정상이다. 비금융 효과 라벨은 합성 데이터에 설계해 넣은 효과가 반영된 라벨이라 대안 모델이 실제로 더 좋다는 근거가 아니다. TEST(11/27 1회, 정의서 C39) 5개 시드 평균: 연체 라벨 기존 0.6835/대안 0.6821, 비금융 효과 라벨 기존 0.7290/대안 0.7480","model_options":{"monotone":true,"with_thinfile":false,"monotone_set":"v03"},"by_label":{"label_any_delinquency_12m":{"legacy":{"mean":0.6749,"std":0.0005,"by_seed":[0.6748,0.6741,0.6754,0.6754,0.675]},"alternative":{"mean":0.675,"std":0.0006,"by_seed":[0.6752,0.674,0.6755,0.6749,0.6751]},"diff_alt_minus_legacy_mean":0.0001},"label_nonfin_effect_12m":{"legacy":{"mean":0.7193,"std":0.0005,"by_seed":[0.7192,0.7188,0.7201,0.719,0.7195]},"alternative":{"mean":0.7383,"std":0.0005,"by_seed":[0.7389,0.7382,0.7388,0.7376,0.738]},"diff_alt_minus_legacy_mean":0.019}}}}]');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: 두 행 모두 same_label_comparison이 있고(네 값), AUC_VALID·AUC_TEST는 등록 때 값 그대로
SELECT ARTIFACT_NAME, AUC_VALID, AUC_TEST,
       JSON_VALUE(METRICS_JSON, '$.same_label_comparison.by_label.label_any_delinquency_12m.legacy.mean') AS DELINQ_LEGACY,
       JSON_VALUE(METRICS_JSON, '$.same_label_comparison.by_label.label_any_delinquency_12m.alternative.mean') AS DELINQ_ALT,
       JSON_VALUE(METRICS_JSON, '$.same_label_comparison.by_label.label_nonfin_effect_12m.legacy.mean') AS NONFIN_LEGACY,
       JSON_VALUE(METRICS_JSON, '$.same_label_comparison.by_label.label_nonfin_effect_12m.alternative.mean') AS NONFIN_ALT
  FROM MODEL_ARTIFACT WHERE MODEL_VERSION = 'LGBM-BASE-0.3' ORDER BY ARTIFACT_NAME;
