"""D-23·D-25 알림 데이터 없이 저장 구조만 준비했는지 검사한다."""
import unittest
from test_market_schema import db, SQL_DIR, DB_DIR


class NotificationSchemaTests(unittest.TestCase):
    """실제 DDL 파서로 알림의 필수 입력·회원 참조·빈 초기 상태를 확인한다."""

    def test_notification_contract_and_empty_initial_state(self):
        """알림은 자동 생성 ID와 회원 FK를 가지며 초기 데이터는 없어야 한다."""
        ddl = (SQL_DIR / 'avenue_ddl.sql').read_text(encoding='utf-8-sig')
        tables, rows = db.parse_ddl(ddl)
        table = tables['USER_NOTIFICATION']
        self.assertEqual(list(table['columns']), [
            'NOTIFICATION_ID', 'USER_ID', 'NOTIFICATION_TYPE_CODE', 'TITLE',
            'CONTENT', 'LINK_URL', 'READ_AT', 'CREATED_AT'])
        self.assertTrue(table['columns']['NOTIFICATION_ID']['identity'])
        self.assertTrue(table['columns']['USER_ID']['required'])
        self.assertFalse(table['columns']['READ_AT']['required'])
        self.assertTrue(any(parent == 'APP_USER' for _, _, parent, _ in table['fks']))
        self.assertEqual(rows['USER_NOTIFICATION'], [])
        migration = (SQL_DIR / 'create_user_notification.sql').read_text(encoding='utf-8')
        body = ddl[ddl.index('CREATE TABLE USER_NOTIFICATION'):ddl.index('-- 설정값 (신고 자동 숨김')]
        self.assertIn(body, migration)
        self.assertNotIn('INSERT INTO', migration.upper())
        for name in ('run_all.sql', 'run_seed_only.sql'):
            self.assertNotIn('create_user_notification.sql', (DB_DIR / name).read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
