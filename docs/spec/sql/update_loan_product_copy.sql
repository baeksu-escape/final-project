-- N-37-1 기존 DB의 대출 상품 설명 문구와 특징만 현재 22·24번 시드 기준으로 교체한다.
-- 상품 ID·코드 대응을 먼저 확인하며 상품 기본 정보 중 지정한 6개 문구 열과 상품 특징만 변경한다.
-- SQL*Plus/SQLcl에서 대상 스키마 소유자로 단독 실행한다. 미커밋 업무가 없는 별도 세션을 사용한다.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
SET DEFINE OFF

DECLARE
    v_count PLS_INTEGER;
    v_product_id LOAN_PRODUCT.PRODUCT_ID%TYPE;
    v_update_total PLS_INTEGER := 0;
    v_feature_total PLS_INTEGER := 0;
BEGIN
    -- LP001~LP017 전부 있고, PRODUCT_ID가 22번 시드 대응과 같아야 한다.
    SELECT COUNT(*) INTO v_count FROM LOAN_PRODUCT WHERE PRODUCT_CODE IN ('LP001', 'LP002', 'LP003', 'LP004', 'LP005', 'LP006', 'LP007', 'LP008', 'LP009', 'LP010', 'LP011', 'LP012', 'LP013', 'LP014', 'LP015', 'LP016', 'LP017');
    IF v_count <> 17 THEN RAISE_APPLICATION_ERROR(-20001, 'LP001~LP017 상품 17개가 모두 있어야 합니다'); END IF;
    FOR expected IN (
        SELECT 1 AS product_id, 'LP001' AS product_code FROM DUAL
        UNION ALL SELECT 2 AS product_id, 'LP002' AS product_code FROM DUAL
        UNION ALL SELECT 3 AS product_id, 'LP003' AS product_code FROM DUAL
        UNION ALL SELECT 4 AS product_id, 'LP004' AS product_code FROM DUAL
        UNION ALL SELECT 5 AS product_id, 'LP005' AS product_code FROM DUAL
        UNION ALL SELECT 6 AS product_id, 'LP006' AS product_code FROM DUAL
        UNION ALL SELECT 7 AS product_id, 'LP007' AS product_code FROM DUAL
        UNION ALL SELECT 8 AS product_id, 'LP008' AS product_code FROM DUAL
        UNION ALL SELECT 9 AS product_id, 'LP009' AS product_code FROM DUAL
        UNION ALL SELECT 10 AS product_id, 'LP010' AS product_code FROM DUAL
        UNION ALL SELECT 11 AS product_id, 'LP011' AS product_code FROM DUAL
        UNION ALL SELECT 12 AS product_id, 'LP012' AS product_code FROM DUAL
        UNION ALL SELECT 13 AS product_id, 'LP013' AS product_code FROM DUAL
        UNION ALL SELECT 14 AS product_id, 'LP014' AS product_code FROM DUAL
        UNION ALL SELECT 15 AS product_id, 'LP015' AS product_code FROM DUAL
        UNION ALL SELECT 16 AS product_id, 'LP016' AS product_code FROM DUAL
        UNION ALL SELECT 17 AS product_id, 'LP017' AS product_code FROM DUAL
    ) LOOP
        SELECT PRODUCT_ID INTO v_product_id FROM LOAN_PRODUCT WHERE PRODUCT_CODE = expected.product_code;
        IF v_product_id <> expected.product_id THEN
            RAISE_APPLICATION_ERROR(-20002, '상품 ID·코드 대응이 22번 시드와 다릅니다: ' || expected.product_code);
        END IF;
    END LOOP;

    -- 22번 시드의 문구 6개 열만 갱신한다. 금리·한도·기간·점수·ID 등은 수정하지 않는다.
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '든든 일반 신용대출', SUMMARY = '직군에 관계없이 쓸 수 있는 시연용 신용대출입니다.', DESCRIPTION = '급여소득자·자영업자·프리랜서가 함께 비교해 볼 수 있는 일반 신용대출 예시입니다.'||CHR(10)||'직군을 가리지 않는 기본형이라 처음 대출 조건을 가늠해 볼 때 기준으로 삼기 좋습니다.'||CHR(10)||'시연용 수치로 금리는 연 4.51~9.76%, 한도는 최대 9,500만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원리금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 1 AND PRODUCT_CODE = 'LP001';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '안심 일반 신용대출', SUMMARY = '필요한 만큼 나눠 갚는 시연용 신용대출입니다.', DESCRIPTION = '월 상환 계획을 먼저 세운 뒤 조건을 비교해 보도록 만든 일반 신용대출 예시입니다.'||CHR(10)||'매달 같은 금액을 나눠 갚는 구조라 생활비 계획과 맞춰 보기 쉽습니다.'||CHR(10)||'시연용 수치로 금리는 연 4.66~9.73%, 한도는 최대 7,600만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원리금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 2 AND PRODUCT_CODE = 'LP002';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '가까운 일반 신용대출', SUMMARY = '모바일 신청 흐름을 보여 주는 시연용 신용대출입니다.', DESCRIPTION = '신청 화면의 흐름을 따라가며 조건을 확인해 보는 용도의 일반 신용대출 예시입니다.'||CHR(10)||'같은 점수대의 다른 상품과 나란히 놓고 비교하는 참고 자료로 쓰입니다.'||CHR(10)||'시연용 수치로 금리는 연 4.36~10.27%, 한도는 최대 8,500만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원리금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 3 AND PRODUCT_CODE = 'LP003';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '월급 든든 직장인 대출', SUMMARY = '급여소득자를 위한 시연용 신용대출입니다.', DESCRIPTION = '재직 중인 급여소득자를 대상으로 가정한 직장인 신용대출 예시입니다.'||CHR(10)||'매달 들어오는 급여를 바탕으로 상환 계획을 짜 보는 시연용 상품입니다.'||CHR(10)||'시연용 수치로 금리는 연 4.07~8.99%, 한도는 최대 12,800만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원리금균등', ELIGIBILITY_TEXT = '급여소득자 대상(시연용)', REQUIRED_DOCUMENTS = '재직증명서·급여 명세서' WHERE PRODUCT_ID = 4 AND PRODUCT_CODE = 'LP004';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '직장인 플러스 신용대출', SUMMARY = '직장인이 비교해 볼 수 있는 시연용 신용대출입니다.', DESCRIPTION = '소득이 꾸준한 직장인이 여러 상품을 견주어 보도록 만든 신용대출 예시입니다.'||CHR(10)||'급여소득자를 대상으로 한 상품으로, 같은 직군의 다른 상품과 조건을 견주는 데 쓰입니다.'||CHR(10)||'시연용 수치로 금리는 연 3.75~8.57%, 한도는 최대 12,400만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원리금균등', ELIGIBILITY_TEXT = '급여소득자 대상(시연용)', REQUIRED_DOCUMENTS = '재직증명서·소득금액증명원' WHERE PRODUCT_ID = 5 AND PRODUCT_CODE = 'LP005';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '사장님 사업자 대출', SUMMARY = '자영업자를 위한 시연용 사업자 신용대출입니다.', DESCRIPTION = '매출 흐름을 참고해 사업 자금을 알아보는 자영업자용 신용대출 예시입니다.'||CHR(10)||'이자를 내다가 만기에 원금을 한 번에 갚는 구조라 월 부담은 상대적으로 작을 수 있지만 만기 자금 계획이 중요합니다.'||CHR(10)||'시연용 수치로 금리는 연 5.81~9.93%, 한도는 최대 8,600만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '만기일시', ELIGIBILITY_TEXT = '자영업자 대상(시연용)', REQUIRED_DOCUMENTS = '사업자등록증·매출 내역' WHERE PRODUCT_ID = 6 AND PRODUCT_CODE = 'LP006';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '사장님 성장 대출', SUMMARY = '사업 규모를 키우려는 자영업자를 위한 시연용 대출입니다.', DESCRIPTION = '운영 중인 사업의 자금 계획을 점검해 보는 자영업자용 신용대출 예시입니다.'||CHR(10)||'만기에 원금을 갚는 방식이므로 매출이 줄어드는 달의 현금흐름도 함께 살펴보는 것이 좋습니다.'||CHR(10)||'시연용 수치로 금리는 연 5.66~10.72%, 한도는 최대 9,000만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '만기일시', ELIGIBILITY_TEXT = '자영업자 대상(시연용)', REQUIRED_DOCUMENTS = '사업자등록증·부가세 신고 내역' WHERE PRODUCT_ID = 7 AND PRODUCT_CODE = 'LP007';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '새싹 저축은행 대출', SUMMARY = '금융 이력이 짧은 사람도 살펴볼 수 있는 시연용 대출입니다.', DESCRIPTION = '금융 이력이 길지 않은 사람을 염두에 둔 저축은행 신용대출 예시입니다.'||CHR(10)||'점수 조건이 낮은 대신 금리 범위가 넓어, 상한 금리 기준으로 상환 부담을 따져 보아야 합니다.'||CHR(10)||'시연용 수치로 금리는 연 7.62~18.33%, 한도는 최대 4,700만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원리금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 8 AND PRODUCT_CODE = 'LP008';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '한걸음 저축은행 대출', SUMMARY = '소액이 필요한 사람을 위한 시연용 대출입니다.', DESCRIPTION = '저축은행 신용대출의 조건을 비교해 보도록 만든 예시입니다.'||CHR(10)||'모든 직군을 대상으로 가정했으며, 금리 범위가 넓은 편이라 실제 부담은 조건에 따라 크게 달라질 수 있습니다.'||CHR(10)||'시연용 수치로 금리는 연 7.67~18.22%, 한도는 최대 4,200만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원리금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 9 AND PRODUCT_CODE = 'LP009';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '이음 저축은행 대출', SUMMARY = '꾸준히 갚아 나가는 계획을 세우는 시연용 대출입니다.', DESCRIPTION = '꾸준히 갚아 나가는 계획을 세워 보는 용도의 저축은행 신용대출 예시입니다.'||CHR(10)||'다른 저축은행 상품과 금리와 한도를 나란히 놓고 차이를 확인하는 참고 자료입니다.'||CHR(10)||'시연용 수치로 금리는 연 7.37~18.58%, 한도는 최대 4,000만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원리금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 10 AND PRODUCT_CODE = 'LP010';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '마을 상호금융 대출', SUMMARY = '지역 금융기관을 가정한 시연용 신용대출입니다.', DESCRIPTION = '지역 금융기관의 상호금융 신용대출을 가정한 예시입니다.'||CHR(10)||'원금을 매달 같은 금액씩 갚는 방식이라 초반 상환액이 크고 갈수록 줄어드는 특징이 있습니다.'||CHR(10)||'시연용 수치로 금리는 연 5.28~10.76%, 한도는 최대 4,300만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 11 AND PRODUCT_CODE = 'LP011';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '이웃 상호금융 대출', SUMMARY = '가까운 금융기관을 가정한 시연용 신용대출입니다.', DESCRIPTION = '가까운 금융기관의 상호금융 신용대출을 가정한 예시입니다.'||CHR(10)||'같은 업권의 다른 상품과 비교하며 월 상환액 변화를 살펴볼 수 있습니다.'||CHR(10)||'시연용 수치로 금리는 연 5.28~10.33%, 한도는 최대 3,800만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 12 AND PRODUCT_CODE = 'LP012';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '간편 카드론', SUMMARY = '카드 이용 정보를 바탕으로 하는 시연용 단기 대출입니다.', DESCRIPTION = '카드 이용 내역을 참고하는 단기 카드론 예시입니다.'||CHR(10)||'기간이 짧고 만기에 원금을 갚는 구조라 금리와 만기 자금 계획을 꼼꼼히 확인해야 합니다.'||CHR(10)||'시연용 수치로 금리는 연 6.4~19.31%, 한도는 최대 3,700만 원, 기간은 2~36개월입니다.', REPAYMENT_METHOD = '만기일시', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·카드 이용 내역' WHERE PRODUCT_ID = 13 AND PRODUCT_CODE = 'LP013';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '빠른 카드론', SUMMARY = '급할 때 비교해 보는 시연용 카드론입니다.', DESCRIPTION = '급하게 자금이 필요한 상황을 가정한 카드론 예시입니다.'||CHR(10)||'상환 기간이 짧은 만큼 이자 부담과 만기 일정을 먼저 따져 보아야 하는 상품입니다.'||CHR(10)||'시연용 수치로 금리는 연 7.15~19.32%, 한도는 최대 3,600만 원, 기간은 2~36개월입니다.', REPAYMENT_METHOD = '만기일시', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·카드 이용 내역' WHERE PRODUCT_ID = 14 AND PRODUCT_CODE = 'LP014';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '유연 카드론', SUMMARY = '상환 기간을 비교해 보는 시연용 카드론입니다.', DESCRIPTION = '상환 기간에 따라 부담이 어떻게 달라지는지 비교해 보도록 만든 카드론 예시입니다.'||CHR(10)||'같은 카드론 가운데 한도가 가장 높게 설정되어 있어 조건 차이를 확인하기 좋습니다.'||CHR(10)||'시연용 수치로 금리는 연 6.96~19.51%, 한도는 최대 4,600만 원, 기간은 2~36개월입니다.', REPAYMENT_METHOD = '만기일시', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·카드 이용 내역' WHERE PRODUCT_ID = 15 AND PRODUCT_CODE = 'LP015';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '캐피탈 신용대출 스탠다드', SUMMARY = '할부·리스 금융사를 가정한 시연용 신용대출입니다.', DESCRIPTION = '할부와 리스를 다루는 금융사를 가정한 캐피탈 신용대출 예시입니다.'||CHR(10)||'원금을 매달 같은 금액씩 갚는 방식이며 금리 범위가 높은 편이라 상환 계획을 먼저 확인해야 합니다.'||CHR(10)||'시연용 수치로 금리는 연 9.46~19.44%, 한도는 최대 4,600만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 16 AND PRODUCT_CODE = 'LP016';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    UPDATE LOAN_PRODUCT SET PRODUCT_NAME = '캐피탈 신용대출 라이트', SUMMARY = '가볍게 비교해 보는 시연용 캐피탈 신용대출입니다.', DESCRIPTION = '캐피탈 신용대출을 가볍게 비교해 보도록 만든 예시입니다.'||CHR(10)||'원금균등 상환이라 시간이 지날수록 월 부담이 줄고, 금리 상한이 높아 조건을 꼼꼼히 살펴야 합니다.'||CHR(10)||'시연용 수치로 금리는 연 8.81~19.64%, 한도는 최대 3,600만 원, 기간은 12~60개월입니다.', REPAYMENT_METHOD = '원금균등', ELIGIBILITY_TEXT = '모든 직군 대상(시연용)', REQUIRED_DOCUMENTS = '신분증 사본·소득 증빙' WHERE PRODUCT_ID = 17 AND PRODUCT_CODE = 'LP017';
    v_update_total := v_update_total + SQL%ROWCOUNT;
    IF v_update_total <> 17 THEN RAISE_APPLICATION_ERROR(-20003, '대출 상품 문구 갱신 행 수가 17개가 아닙니다'); END IF;

    -- LOAN_PRODUCT_FEATURE는 대상 상품 17개만 교체한다. DDL상 이 표를 참조하는 외부 FK는 없다.
    DELETE FROM LOAN_PRODUCT_FEATURE WHERE PRODUCT_ID IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (1, 1, '직군 구분 없이 신청 가능');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (1, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (2, 1, '상환 계획 확인 후 비교');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (2, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (3, 1, '모바일 신청 화면 시연');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (3, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (4, 1, '급여소득자 대상');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (4, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (5, 1, '급여소득자 대상');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (5, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (6, 1, '자영업자 대상');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (6, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (7, 1, '자영업자 대상');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (7, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (8, 1, '직군 구분 없이 신청 가능');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (8, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (9, 1, '직군 구분 없이 신청 가능');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (9, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (10, 1, '직군 구분 없이 신청 가능');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (10, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (11, 1, '직군 구분 없이 신청 가능');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (11, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (12, 1, '직군 구분 없이 신청 가능');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (12, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (13, 1, '단기 상환 구조');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (13, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (14, 1, '단기 상환 구조');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (14, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (15, 1, '단기 상환 구조');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (15, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (16, 1, '직군 구분 없이 신청 가능');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (16, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (17, 1, '직군 구분 없이 신청 가능');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    INSERT INTO LOAN_PRODUCT_FEATURE (PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT) VALUES (17, 2, '시연용 가상 상품');
    v_feature_total := v_feature_total + SQL%ROWCOUNT;
    IF v_feature_total <> 34 THEN RAISE_APPLICATION_ERROR(-20004, '상품 특징 입력 행 수가 34개가 아닙니다'); END IF;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 적용 결과: LP001~LP017의 문구 일부를 확인한다.
SELECT PRODUCT_ID, PRODUCT_CODE, PRODUCT_NAME, SUMMARY, SUBSTR(DESCRIPTION, 1, 100) AS DESCRIPTION_PREVIEW,
       REPAYMENT_METHOD, ELIGIBILITY_TEXT, REQUIRED_DOCUMENTS
  FROM LOAN_PRODUCT
 WHERE PRODUCT_CODE IN ('LP001', 'LP002', 'LP003', 'LP004', 'LP005', 'LP006', 'LP007', 'LP008', 'LP009', 'LP010', 'LP011', 'LP012', 'LP013', 'LP014', 'LP015', 'LP016', 'LP017')
 ORDER BY PRODUCT_ID;

-- 적용 결과: 대상 상품의 특징 행 수와 내용을 확인한다.
SELECT COUNT(*) AS FEATURE_ROW_COUNT
  FROM LOAN_PRODUCT_FEATURE
 WHERE PRODUCT_ID IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);

SELECT PRODUCT_ID, DISPLAY_ORDER, FEATURE_TEXT
  FROM LOAN_PRODUCT_FEATURE
 WHERE PRODUCT_ID IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17)
 ORDER BY PRODUCT_ID, DISPLAY_ORDER;
