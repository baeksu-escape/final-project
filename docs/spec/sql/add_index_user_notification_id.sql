-- D-23·DDL C19 회원별 알림 번호 커서 페이지 조회용 인덱스. 이미 있으면 건너뛰어 다시 실행해도 된다.
DECLARE
    v_index_count PLS_INTEGER;
BEGIN
    SELECT COUNT(*)
      INTO v_index_count
      FROM USER_INDEXES
     WHERE INDEX_NAME = 'IX_UNT_USER_NOTI_ID';

    IF v_index_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_UNT_USER_NOTI_ID ON USER_NOTIFICATION (USER_ID, NOTIFICATION_ID)';
    END IF;
END;
/
