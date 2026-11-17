"""N-05-3·N-05-4·N-05-8 실제 DDL의 자산·대출 확인 상태를 고정 예제로 검증한다."""
import copy
import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'build_db.py'
DDL = SCRIPT.parents[1] / '01_create_tables.sql'
CANONICAL_DDL = DDL.parent.parent / 'avenue_ddl.sql'
SPEC = importlib.util.spec_from_file_location('no_loan_schema_build_db', SCRIPT)
db = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(db)


class NoLoanSchemaTests(unittest.TestCase):
    """N-05-3·N-05-4·N-05-8 외부 패키지·원천 데이터·DB 없이 스키마 계약을 검사한다."""

    def setUp(self):
        """실제 DDL을 파싱하고 대상 열 검사와 무관한 회원 FK만 분리한다."""
        tables, _ = db.parse_ddl(DDL.read_text(encoding='utf-8-sig'))
        table = copy.deepcopy(tables['USER_ASSET_SNAPSHOT'])
        table['fks'] = []
        self.tables = {'USER_ASSET_SNAPSHOT': table}

    def validate_example(self, amount, flag):
        """고정 합성 행 하나로 실제 생성기의 타입·길이·CHECK 검사를 실행한다."""
        row = dict(ASSET_ID=1, USER_ID=1, BASE_MONTH='2026-08',
                   TOTAL_ASSET_AMT=amount, NO_LOAN_YN=flag)
        return db.validate_rows(self.tables, {'USER_ASSET_SNAPSHOT': [row]})

    def test_ddl_files_are_byte_identical(self):
        """정본과 더미 DB DDL이 줄바꿈을 포함해 바이트 단위로 일치해야 한다."""
        self.assertEqual(CANONICAL_DDL.read_bytes(), DDL.read_bytes())

    def test_nullable_columns_and_allowed_values(self):
        """미입력 NULL과 명시적 0원·양수, Y/N의 모든 조합을 보존한다."""
        columns = self.tables['USER_ASSET_SNAPSHOT']['columns']
        for name in ('TOTAL_ASSET_AMT', 'NO_LOAN_YN'):
            self.assertFalse(columns[name]['required'])
            self.assertIsNone(columns[name]['default'])
        self.assertEqual(columns['NO_LOAN_YN']['type'], 'CHAR')
        self.assertEqual(columns['NO_LOAN_YN']['length'], 1)
        for amount in (None, 0, 12345):
            for flag in (None, 'Y', 'N'):
                with self.subTest(amount=amount, flag=flag):
                    result = self.validate_example(amount, flag)['USER_ASSET_SNAPSHOT'][0]
                    self.assertEqual(result['TOTAL_ASSET_AMT'], amount)
                    self.assertEqual(result['NO_LOAN_YN'], flag)

    def test_negative_assets_are_rejected(self):
        """대출 확인 상태와 관계없이 기존 자산 음수 방지 CHECK를 유지한다."""
        for flag in (None, 'Y', 'N'):
            with self.subTest(flag=flag), self.assertRaisesRegex(ValueError, 'CK_UAS_AMT'):
                self.validate_example(-1, flag)

    def test_invalid_flags_are_rejected(self):
        """한 글자라도 Y/N 이외의 값은 대출 상태 CHECK에서 거부한다."""
        for flag in ('X', 'y', 'n', '0'):
            with self.subTest(flag=flag), self.assertRaisesRegex(ValueError, 'CK_UAS_NO_LOAN'):
                self.validate_example(None, flag)

    def test_long_flags_are_rejected(self):
        """Y/N으로 시작해도 한 글자를 넘는 값은 열 길이 검사에서 거부한다."""
        for flag in ('YY', 'NN', 'YES', 'NO'):
            with self.subTest(flag=flag), self.assertRaisesRegex(ValueError, 'NO_LOAN_YN.*길이'):
                self.validate_example(0, flag)


if __name__ == '__main__':
    unittest.main()
