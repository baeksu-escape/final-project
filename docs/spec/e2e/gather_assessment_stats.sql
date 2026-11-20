-- ====================================================================
-- FP-143 평가 표 통계 갱신 — explain_assessment_queries.sql을 실행하기 전에 필요할 때만 한 번 실행한다.
-- 바꾸는 것: Oracle이 실행 계획을 고를 때 보는 통계(행 수 등)만 새로 모은다. 표의 데이터(행)는 바꾸지 않는다.
-- 왜: 평가 행 수가 많이 바뀐 뒤 옛 통계가 남아 있으면, 실행 계획 점검이 실제와 다른 계획을 보여 줄 수 있다.
-- ⚠️ 로컬 DB에서만 실행한다. 통계가 바뀌면 이 DB를 쓰는 다른 쿼리의 실행 계획도 바뀔 수 있다(공용 DB에서는 실행하지 않는다).
--       DBMS_STATS는 실행 전후에 스스로 COMMIT하므로, 이 창에서 커밋하지 않은 작업이 있으면 같이 커밋된다(새 창에서 실행).
-- SQL Developer에서 F5(스크립트 실행)로 실행한다.
-- ====================================================================
BEGIN
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'ASSESSMENT');
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'ASSESSMENT_FACTOR');
END;
/

-- 확인: LAST_ANALYZED가 방금 시각
SELECT TABLE_NAME, NUM_ROWS, LAST_ANALYZED FROM USER_TABLES
 WHERE TABLE_NAME IN ('ASSESSMENT', 'ASSESSMENT_FACTOR') ORDER BY TABLE_NAME;
