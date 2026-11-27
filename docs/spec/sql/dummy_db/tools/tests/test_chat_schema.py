"""N-07 FP-287 1:1 채팅 표의 구조와 기존 DB용 SQL을 검사한다."""
import unittest
from test_market_schema import db, SQL_DIR, DB_DIR


class ChatSchemaTests(unittest.TestCase):
    """실제 DDL 파서로 회원당 방 하나, 필수 입력, 참조 관계, 빈 초기 상태를 확인한다."""

    def setUp(self):
        """기준 DDL을 생성기의 파서로 읽는다."""
        self.ddl = (SQL_DIR / 'avenue_ddl.sql').read_text(encoding='utf-8-sig')
        self.tables, self.rows = db.parse_ddl(self.ddl)

    def test_room_and_message_contract(self):
        """방은 회원을, 메시지는 방과 보낸 계정을 참조하며 초기 데이터는 없어야 한다."""
        room = self.tables['CHAT_ROOM']
        self.assertEqual(list(room['columns']), [
            'ROOM_ID', 'USER_ID', 'USER_LAST_READ_MESSAGE_ID', 'ADMIN_LAST_READ_MESSAGE_ID',
            'LAST_MESSAGE_AT', 'CREATED_AT'])
        self.assertTrue(room['columns']['ROOM_ID']['identity'])
        self.assertTrue(room['columns']['USER_ID']['required'])
        self.assertEqual({parent for _, _, parent, _ in room['fks']}, {'APP_USER'})
        message = self.tables['CHAT_MESSAGE']
        self.assertEqual(list(message['columns']), [
            'MESSAGE_ID', 'ROOM_ID', 'SENDER_USER_ID', 'SENDER_TYPE_CODE', 'CONTENT', 'CREATED_AT'])
        self.assertTrue(message['columns']['MESSAGE_ID']['identity'])
        self.assertTrue(message['columns']['CONTENT']['required'])
        self.assertEqual({parent for _, _, parent, _ in message['fks']}, {'CHAT_ROOM', 'APP_USER'})
        self.assertEqual(self.rows['CHAT_ROOM'], [])
        self.assertEqual(self.rows['CHAT_MESSAGE'], [])
        self.assertIn('CONSTRAINT UQ_CHR_USER UNIQUE (USER_ID)', self.ddl)

    def test_migration_matches_canonical_ddl(self):
        """기존 DB용 SQL의 표 정의는 기준 DDL과 같고, 자동 적재 묶음에는 연결하지 않는다."""
        migration = (SQL_DIR / 'create_chat_tables.sql').read_text(encoding='utf-8')
        start = self.ddl.index('-- v0.3.2 (C19)')
        end = self.ddl.index('CREATE INDEX IX_CHM_ROOM')
        self.assertIn(self.ddl[start:end], migration)
        self.assertIn('CREATE INDEX IX_CHM_ROOM ON CHAT_MESSAGE (ROOM_ID, MESSAGE_ID);', migration)
        self.assertNotIn('INSERT INTO', migration.upper())
        for name in ('run_all.sql', 'run_seed_only.sql'):
            self.assertNotIn('create_chat_tables.sql', (DB_DIR / name).read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
