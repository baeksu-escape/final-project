"""N-24 정적 JSON 전환 후 상권 표 제거와 나머지 DB 계약을 원천 생성 없이 검사한다."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'build_db.py'
DB_DIR = SCRIPT.parents[1]
SQL_DIR = DB_DIR.parent
SPEC = importlib.util.spec_from_file_location('market_schema_build_db', SCRIPT)
db = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(db)
MARKET_TABLES = {
    'DIM_ADM_DONG', 'DIM_SERVICE_CATEGORY',
    'FACT_DONG_SALES', 'FACT_DONG_STORE', 'FACT_DONG_LIVING_POP',
}


class MarketSchemaTests(unittest.TestCase):
    """N-24 DDL·생성기 메타데이터·배포 SQL의 일치를 고정된 빈 예제로 확인한다."""

    def setUp(self):
        """정본 DDL을 실제 생성기의 파서로 읽는다."""
        self.ddl = (SQL_DIR / 'avenue_ddl.sql').read_bytes()
        self.tables, self.base_rows = db.parse_ddl(self.ddl.decode('utf-8-sig'))

    def test_only_market_tables_are_absent_and_references_resolve(self):
        """상권 표는 없고 다른 기능용 공공통계·회원·평가 표와 참조는 유효해야 한다."""
        self.assertEqual(len(self.tables), 46)
        self.assertFalse(MARKET_TABLES & self.tables.keys())
        for name in ('FACT_HFS_STAT', 'FACT_HFS_WORKER_STAT', 'FACT_INDUSTRY_AGE_INCOME',
                     'FACT_POLICY_RATE', 'APP_USER', 'ASSESSMENT', 'ASSESSMENT_FACTOR'):
            self.assertIn(name, self.tables)
        for table in self.tables.values():
            self.assertNotIn('GEO_ADM_CODE', table['columns'])
            for _, _, parent, _ in table['fks']:
                self.assertIn(parent, self.tables)
        db.validate_rows(self.tables, self.base_rows)

    def test_ddl_copy_report_and_seed_counts_match(self):
        """DDL 사본·해시·보고서의 테이블 목록과 기존 기준 INSERT를 대조한다."""
        self.assertEqual(self.ddl, (DB_DIR / '01_create_tables.sql').read_bytes())
        report = json.loads((DB_DIR / 'seed_report.json').read_text(encoding='utf-8'))
        self.assertEqual(report['ddl_sha256'], hashlib.sha256(self.ddl).hexdigest())
        self.assertEqual(report['table_count'], 46)
        self.assertEqual(set(report['rows']), set(self.tables))
        self.assertEqual(sum(map(len, self.base_rows.values())), 25)

    def test_published_cleanup_and_checks_match_schema(self):
        """배포된 정리·검사 SQL이 제거된 표를 참조하지 않고 46개 표를 다룬다."""
        drop = (DB_DIR / '00_drop_all.sql').read_text(encoding='utf-8')
        check = (DB_DIR / '99_check.sql').read_text(encoding='utf-8')
        self.assertEqual(set(re.findall(r'DROP TABLE (\w+)', drop)), set(self.tables))
        self.assertIn('SELECT 46 AS EXPECTED_TABLES', check)
        counts = dict((name, int(count)) for name, count in re.findall(
            r"SELECT '(\w+)' AS TABLE_NAME, (\d+) AS EXPECTED", check))
        report = json.loads((DB_DIR / 'seed_report.json').read_text(encoding='utf-8'))
        self.assertEqual(counts, report['rows'])
        for name in MARKET_TABLES:
            self.assertNotIn(name, drop)
            self.assertNotIn(name, check)

    def test_generator_uses_current_schema_for_metadata(self):
        """빈 고정 예제를 메모리에서만 처리해 생성기의 표 수가 하드코딩되지 않았음을 확인한다."""
        empty = {name: [] for name in self.tables}
        files, report = db.bundle_files(self.ddl, self.tables, empty, empty, [])
        self.assertEqual(report['table_count'], 46)
        self.assertEqual(files['01_create_tables.sql'], self.ddl)
        self.assertEqual(files['00_drop_all.sql'].decode('utf-8'),
                         (DB_DIR / '00_drop_all.sql').read_text(encoding='utf-8'))
        for name in MARKET_TABLES:
            self.assertNotIn(name, files['99_check.sql'].decode('utf-8'))

    def test_existing_db_cleanup_is_separate_and_limited(self):
        """기존 DB 삭제는 상권 5개만 자식 순서로 다루고 자동 초기화·적재에 포함되지 않는다."""
        script_name = 'drop_unused_market_tables.sql'
        script = (SQL_DIR / script_name).read_text(encoding='utf-8')
        targets = re.findall(r"(?:SELECT \d+ AS step_no, |UNION ALL SELECT \d+, )'(\w+)'", script)
        self.assertEqual(targets, ['FACT_DONG_LIVING_POP', 'FACT_DONG_STORE', 'FACT_DONG_SALES',
                                   'DIM_SERVICE_CATEGORY', 'DIM_ADM_DONG'])
        self.assertIn('ORDER BY step_no', script)
        self.assertIn('SQLCODE != -942', script)
        self.assertNotRegex(script, r"'DROP TABLE [^']*CASCADE")
        for name in ('run_all.sql', 'run_seed_only.sql'):
            self.assertNotIn(script_name, (DB_DIR / name).read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
