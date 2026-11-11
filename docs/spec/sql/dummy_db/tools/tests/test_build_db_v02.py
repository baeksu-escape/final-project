"""N-02-4·N-05 DDL v0.3.1·개인정보·파일 쓰기 전 검사와 원천 매핑을 검증한다."""
import base64
import copy
import csv
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import shutil
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

SCRIPT=Path(__file__).resolve().parents[1]/'build_db_v02.py'
SPEC=importlib.util.spec_from_file_location('build_db_v02',SCRIPT)
db=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(db)
DDL=SCRIPT.parents[1]/'v0_2/01_create_tables.sql'
# 공개 고정 테스트 키다. 실제 개발·운영 키가 아니며 커밋용 시드에 사용하지 않는다.
TEST_AES=bytes(range(32));TEST_HMAC=bytes(range(32,64))
# 공개 고정 테스트 비밀번호다. 실제 시연 비밀번호가 아니다.
TEST_PASSWORD='test-demo-password-not-real'
TEST_ENV={'AVENUE_DEV_AES_KEY':base64.b64encode(TEST_AES).decode(),
          'AVENUE_DEV_HMAC_KEY':base64.b64encode(TEST_HMAC).decode(),
          'AVENUE_DEMO_PASSWORD':TEST_PASSWORD}
KEYTOOL_SPEC=importlib.util.spec_from_file_location('gen_dev_keys',SCRIPT.parent/'gen_dev_keys.py')
keytool=importlib.util.module_from_spec(KEYTOOL_SPEC);KEYTOOL_SPEC.loader.exec_module(keytool)


class KeyToolTests(unittest.TestCase):
    """팀 개발 키 도구: 저장소 밖에만, 덮어쓰지 않고, 값을 출력하지 않는다."""
    def test_writes_two_32_byte_keys_outside_repo_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'dev.env';keytool.write_keys(path)
            values=dict(line.split('=',1) for line in path.read_text(encoding='utf-8').splitlines())
            aes,mac=(base64.b64decode(values[k],validate=True) for k in ['AVENUE_DEV_AES_KEY','AVENUE_DEV_HMAC_KEY'])
            self.assertEqual((len(aes),len(mac)),(32,32));self.assertNotEqual(aes,mac);self.assertEqual(values['AVENUE_DEMO_PASSWORD'],'')
            before=path.read_bytes()
            with self.assertRaises(ValueError):keytool.write_keys(path)
            self.assertEqual(before,path.read_bytes())
            self.assertEqual(db.load_keys(db.read_env_file(path)),(aes,mac))

    def test_inside_repo_rejected_and_values_not_printed(self):
        inside=SCRIPT.parent/'should_not_exist.env'
        with self.assertRaises(ValueError):keytool.write_keys(inside)
        self.assertFalse(inside.exists())
        import io,contextlib,sys
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'dev.env';out=io.StringIO()
            with patch.object(sys,'argv',['gen_dev_keys.py',str(path)]),contextlib.redirect_stdout(out):
                self.assertEqual(keytool.main(),0)
            for line in path.read_text(encoding='utf-8').splitlines():
                value=line.split('=',1)[1]
                if value:self.assertNotIn(value,out.getvalue())


class EnvFileAndDemoTests(unittest.TestCase):
    """--env-file 읽기·저장소 안 거부, 시연 비밀번호·BCrypt·시연 회원 선택 규칙."""
    def test_env_file_read_and_repo_path_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'x.env';path.write_text('# 주석\nAVENUE_DEMO_PASSWORD=abc\n\n',encoding='utf-8')
            self.assertEqual(db.read_env_file(path),{'AVENUE_DEMO_PASSWORD':'abc'})
            path.write_text('NOEQUALS\n',encoding='utf-8')
            with self.assertRaises(ValueError):db.read_env_file(path)
        with self.assertRaises(ValueError):db.read_env_file(SCRIPT.parents[1]/'.env.example')

    def test_demo_password_required_and_not_leaked(self):
        for env in [{},{'AVENUE_DEMO_PASSWORD':''},{'AVENUE_DEMO_PASSWORD':'가'*30}]:
            with self.subTest(n=len(env.get('AVENUE_DEMO_PASSWORD','x'))),self.assertRaises(ValueError) as error:db.load_demo_password(env)
            self.assertNotIn('가가',str(error.exception))
        self.assertEqual(db.load_demo_password(TEST_ENV),TEST_PASSWORD)

    def test_bcrypt_spring_compatible_and_demo_selection(self):
        import bcrypt
        h=db.bcrypt_hash(TEST_PASSWORD);self.assertTrue(h.startswith('$2a$10$'));self.assertEqual(len(h),60)
        self.assertTrue(bcrypt.checkpw(TEST_PASSWORD.encode(),h.encode()));self.assertFalse(bcrypt.checkpw(b'wrong',h.encode()))
        members=[dict(member_id=f'MEM00000{i}',segment=s) for i,s in [(5,'wage'),(2,'wage'),(3,'selfemp'),(9,'freelance'),(4,'freelance')]]
        self.assertEqual(db.demo_members(members),{'MEM000002':'demo_employee','MEM000003':'demo_self','MEM000004':'demo_free'})
        with self.assertRaises(ValueError):db.demo_members(members[:2])
        for login in db.DEMO_LOGIN_IDS.values():self.assertRegex(login,'^[a-z_]{1,30}$')


class AtomicWriteTests(unittest.TestCase):
    """쓰기 중 실패하면 기존 파일이 그대로이고 임시 파일이 남지 않는다."""
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.out=Path(self.temp.name)
        (self.out/'a.sql').write_bytes(b'old-a');(self.out/'b.sql').write_bytes(b'old-b')
        self.files={'a.sql':b'new-a','b.sql':b'new-b','c.sql':b'new-c'}

    def tearDown(self):self.temp.cleanup()

    def state(self):return {p.name:p.read_bytes() for p in self.out.iterdir()}

    def test_failure_while_writing_temps(self):
        real=tempfile.NamedTemporaryFile;calls=[]
        def flaky(*a,**k):
            calls.append(1)
            if len(calls)==3:raise OSError('흉내 낸 쓰기 실패')
            return real(*a,**k)
        with patch.object(db.tempfile,'NamedTemporaryFile',side_effect=flaky),self.assertRaises(OSError):
            db.write_all_or_nothing(self.out,self.files)
        self.assertEqual(self.state(),{'a.sql':b'old-a','b.sql':b'old-b'})

    def test_failure_while_replacing_restores_old_files(self):
        real=Path.replace
        def flaky(path,target):
            if path.name.startswith('b.sql.') and path.name.endswith('.tmp') and '.bak' not in path.name:raise OSError('흉내 낸 교체 실패')
            return real(path,target)
        with patch.object(Path,'replace',flaky),self.assertRaises(OSError):
            db.write_all_or_nothing(self.out,self.files)
        self.assertEqual(self.state(),{'a.sql':b'old-a','b.sql':b'old-b'})

    def test_success_replaces_all(self):
        db.write_all_or_nothing(self.out,self.files)
        self.assertEqual(self.state(),self.files)


class RunAllRuleTests(unittest.TestCase):
    """저장소 run_all.sql 규칙: 시드 SQL이 없으면 실행을 막는 안내 파일, 시드가 있으면 그 시드를 모두 적재하는 생성기 출력이어야 한다."""
    def test_repo_run_all_matches_seed_state(self):
        folder=DDL.parent;seeds=sorted(p.name for p in folder.glob('[1-8][0-9]_seed_*.sql'))
        run=(folder/'run_all.sql').read_text(encoding='utf-8')
        if seeds:
            for name in ['00_drop_all.sql','01_create_tables.sql',*seeds,'99_check.sql']:self.assertIn('@@'+name,run)
        else:
            self.assertNotIn('@@',run);self.assertIn('EXIT FAILURE',run)


class PrivacyTests(unittest.TestCase):
    """정해진 암호문 포맷과 HMAC 정규화·키 오류 비노출을 검증한다."""
    def test_gcm_format_random_iv_unicode_and_tag(self):
        """같은 UTF-8 값도 IV가 다르며 태그 변경은 인증 실패해야 한다."""
        text='합성 테스트 이름'
        ea,eb=db.encrypt_text(text,TEST_AES),db.encrypt_text(text,TEST_AES)
        self.assertTrue(ea.startswith('v1:'));self.assertEqual(db.decrypt_text(ea,{'v1':TEST_AES}),text)
        a=base64.b64decode(ea[3:]);b=base64.b64decode(eb[3:])
        self.assertNotEqual(a[:12],b[:12]);self.assertEqual(len(a),12+len(text.encode())+16)
        self.assertEqual(AESGCM(TEST_AES).decrypt(a[:12],a[12:],None).decode(),text)
        with self.assertRaises(InvalidTag): AESGCM(TEST_AES).decrypt(a[:12],a[12:-1]+bytes([a[-1]^1]),None)
        with self.assertRaises(ValueError):db.encrypt_text(text,b'0'*16)

    def test_key_version_prefix_unknown_version_rejected(self):
        """v0.3.1 (E2) 모르는 버전·접두어 없는 값은 복호화하지 않고 오류로 멈춘다. HMAC에는 접두어가 없다."""
        value=db.encrypt_text('합성',TEST_AES)
        for bad in ['v2'+value[2:],value[3:]]:
            with self.subTest(bad=bad[:3]),self.assertRaises(ValueError):db.decrypt_text(bad,{'v1':TEST_AES})
        self.assertRegex(db.search_hmac('a@example.com','email',TEST_HMAC),'^[0-9a-f]{64}$')

    def test_hmac_normalization_and_separate_keys(self):
        """대소문자·공백·전화 구분 문자가 검색 HMAC에 영향을 주지 않는지 본다."""
        self.assertEqual(db.search_hmac(' A@Example.COM ','email',TEST_HMAC),db.search_hmac('a@example.com','email',TEST_HMAC))
        h=db.search_hmac('010-0000-0001','phone',TEST_HMAC)
        self.assertEqual(h,db.search_hmac('01000000001','phone',TEST_HMAC));self.assertRegex(h,'^[0-9a-f]{64}$')
        self.assertNotEqual(h,db.search_hmac('01000000001','phone',TEST_AES))
        with self.assertRaises(ValueError):db.search_hmac('test','unsupported',TEST_HMAC)

    def test_missing_invalid_short_and_equal_keys_do_not_leak(self):
        """키 오류는 명확하지만 원래 환경변수 값은 포함하지 않아야 한다."""
        for env in [{},{'AVENUE_DEV_AES_KEY':'DO-NOT-PRINT-THIS'},
                    {**TEST_ENV,'AVENUE_DEV_AES_KEY':base64.b64encode(b'short').decode()},
                    {**TEST_ENV,'AVENUE_DEV_HMAC_KEY':TEST_ENV['AVENUE_DEV_AES_KEY']}]:
            with self.subTest(keys=list(env)),self.assertRaises(ValueError) as error: db.load_keys(env)
            self.assertNotIn('DO-NOT-PRINT-THIS',str(error.exception))
        self.assertEqual(db.load_keys(TEST_ENV),(TEST_AES,TEST_HMAC))

    def test_key_length_boundaries(self):
        """AES는 정확히 32바이트, HMAC은 32바이트 이상인지 환경변수 형식으로 경계를 검사한다."""
        for name,lengths in [('AVENUE_DEV_AES_KEY',[0,1,31,33]),('AVENUE_DEV_HMAC_KEY',[0,1,31])]:
            for size in lengths:
                env={**TEST_ENV,name:base64.b64encode(b'x'*size).decode()}
                with self.subTest(name=name,size=size),self.assertRaises(ValueError):db.load_keys(env)
        env={**TEST_ENV,'AVENUE_DEV_HMAC_KEY':base64.b64encode(b'x'*33).decode()}
        self.assertEqual(len(db.load_keys(env)[1]),33)


class AssetSupplementTests(unittest.TestCase):
    """기존 난수를 소비하지 않는 별도 자산 출력이 원천 값을 보존하는지 확인한다."""
    def test_original_asset_values_and_coverage(self):
        """회원별 원천 자산을 그대로 옮기며 누락·중복 원천은 거부한다."""
        import pandas as pd
        path=SCRIPT.parents[5]/'fastapi_server/data_generation/generate/service_dummy_logic.py'
        spec=importlib.util.spec_from_file_location('service_dummy_v02_test',path)
        logic=importlib.util.module_from_spec(spec);spec.loader.exec_module(logic)
        profiles=pd.DataFrame(dict(customer_id=['A','B'],asset_total_krw=[123,456]))
        got=logic.make_v02_asset_snapshots(profiles,{'A':'MEM000001','B':'MEM000002'},'2026-08')
        self.assertEqual(got.total_asset_amt.tolist(),[123,456]);self.assertEqual(got.base_month.tolist(),['2026-08']*2)
        for bad in [profiles.iloc[:1],pd.concat([profiles,profiles.iloc[:1]])]:
            with self.assertRaises(ValueError):logic.make_v02_asset_snapshots(bad,{'A':'MEM000001','B':'MEM000002'},'2026-08')


class SchemaTests(unittest.TestCase):
    """DDL v0.3.1 47개 테이블과 SQL NULL·복합 제약을 검증한다."""
    def setUp(self):
        """각 테스트에 독립 DDL 정의·기준 행을 제공한다."""
        self.tables,self.base=db.parse_ddl(DDL.read_text(encoding='utf-8-sig'))

    def test_received_ddl_and_base_inserts(self):
        """기준 INSERT 25행과 선택 기능 세 개가 실제 DDL에 있는지 확인한다."""
        self.assertEqual(len(self.tables),47);self.assertIn('USER_UTILITY_PAYMENT',self.tables);self.assertEqual(sum(map(len,self.base.values())),25)
        db.validate_rows(self.tables,self.base)
        self.assertIn('LOAN_PRODUCT_FEATURE',self.tables)
        self.assertIn('TERM_TEXT',self.tables['LOAN_PRODUCT']['columns'])
        self.assertIn('RATE_AVG_PCT',self.tables['SCORE_BAND_OFFER']['columns'])

    def test_unknown_check_column_and_syntax_rejected(self):
        """DDL 오타·미지원 구문을 UNKNOWN으로 넘기지 않는다."""
        for ddl in ["CREATE TABLE X(A NUMBER(2), CONSTRAINT CK_X CHECK(B >= 0));",
                    "CREATE TABLE X(A NUMBER(2), CONSTRAINT CK_X CHECK(UNSUPPORTED(A)=1));",
                    "CREATE TABLE X(A NUMBER(2), CONSTRAINT CK_X CHECK(A));",
                    "CREATE TABLE X(A NUMBER(2) CHECK(A >= 0));"]:
            with self.assertRaises(ValueError): db.parse_ddl(ddl)

    def test_active_unique_indexes(self):
        """ACTIVE 상태는 한 개만 가능하고 비활성 행들은 조건부 UNIQUE에서 제외된다."""
        for table,key in [('SCORE_CUTOFF_VERSION','CUTOFF_VERSION'),('MODEL_REGISTRY','MODEL_VERSION')]:
            rows=copy.deepcopy(self.base);extra=dict(rows[table][0]);extra[key]='OTHER';rows[table].append(extra)
            with self.assertRaises(ValueError):db.validate_rows(self.tables,rows)
            extra['STATUS_CODE']='RETIRED';db.validate_rows(self.tables,rows)

    def test_rate_avg_null_and_bounds_minmax_not_null(self):
        """평균 NULL은 허용하지만 범위 밖 평균과 NULL 최소·최대는 거부한다."""
        import datetime as dt
        good=dict(OFFER_ID=1,MIN_SCORE=0,MAX_SCORE=1000,RATE_MIN_PCT=5,RATE_MAX_PCT=10,RATE_AVG_PCT=None,LIMIT_AMT=1,BASE_DATE=dt.date(2026,9,18))
        for average,minimum,maximum,valid in [(None,5,10,True),(5,5,10,True),(10,5,10,True),(4,5,10,False),(11,5,10,False),(7,None,10,False),(7,5,None,False)]:
            rows=copy.deepcopy(self.base);rows['SCORE_BAND_OFFER']=[dict(good,RATE_AVG_PCT=average,RATE_MIN_PCT=minimum,RATE_MAX_PCT=maximum)]
            with self.subTest(average=average,minimum=minimum,maximum=maximum):
                if valid: db.validate_rows(self.tables,rows)
                else:
                    with self.assertRaises(ValueError):db.validate_rows(self.tables,rows)

    def test_complex_null_checks(self):
        """서비스 기준월과 간편결제의 관측 값 조건이 NULL 우회를 허용하지 않는지 본다."""
        checks=dict(self.tables['ASSESSMENT']['checks'])
        expr=checks['CK_ASM_INPUT_BASE_MONTH']
        self.assertFalse(expr.evaluate({'DATASET_CODE':'SERVICE','INPUT_BASE_MONTH':None}))
        self.assertTrue(expr.evaluate({'DATASET_CODE':'SYNTH_LEGACY','INPUT_BASE_MONTH':None}))
        self.assertFalse(expr.evaluate({'DATASET_CODE':'SYNTH_LEGACY','INPUT_BASE_MONTH':'2026-08'}))
        expr=dict(self.tables['USER_EASYPAY_USAGE']['checks'])['CK_UEU_VALUES']
        self.assertFalse(expr.evaluate(dict(OBSERVATION_STATUS_CODE='OBSERVED',PAYMENT_COUNT=None,PAYMENT_AMT=None,ACTIVE_DAYS=None)))
        self.assertTrue(expr.evaluate(dict(OBSERVATION_STATUS_CODE='MISSING',PAYMENT_COUNT=None,PAYMENT_AMT=None,ACTIVE_DAYS=None)))

    def test_unpaid_conversion_and_paid_date_checks(self):
        """v0.3.1 (U3) late+납부일 없음은 UNPAID가 되고, 상태·납부일 CHECK가 통신비·공과금 모두에서 실제로 평가된다."""
        import datetime as dt
        bill=dict(bill_month='2026-01',billed_amount_krw=1000,due_date='2026-01-20',paid_date=None,payment_status='late')
        rows=db.map_bill_rows([dict(member_id='MEM000001',status='OK',bills=[bill,dict(bill,bill_month='2026-02',paid_date='2026-02-25'),
            dict(bill,bill_month='2026-03',paid_date='2026-03-10',payment_status='on_time')])],
            {'MEM000001':1},{('MEM000001','UTILITY_BILL'):7},'UTILITY_BILL',dt.date(2026,9,18))
        self.assertEqual([r['PAYMENT_STATUS_CODE'] for r in rows],['UNPAID','LATE','ON_TIME'])
        self.assertEqual(db.map_bill_rows([dict(member_id='MEM000002',status='OK',bills=[bill])],{'MEM000002':2},{},'UTILITY_BILL',None),[])
        due=dt.date(2026,1,20)
        for table,cname in [('USER_TELECOM_PAYMENT','CK_UTP_PAID_DATE'),('USER_UTILITY_PAYMENT','CK_UUP_PAID_DATE')]:
            expr=dict(self.tables[table]['checks'])[cname]
            for status,paid,ok in [('UNPAID',None,True),('UNPAID',due,False),('ON_TIME',due,True),('ON_TIME',None,False),
                                   ('ON_TIME',due+dt.timedelta(1),False),('LATE',due+dt.timedelta(1),True),('LATE',None,False),('LATE',due,False)]:
                with self.subTest(table=table,status=status,paid=paid):
                    self.assertIs(expr.evaluate(dict(PAYMENT_STATUS_CODE=status,PAID_DATE=paid,DUE_DATE=due)),ok)

    def test_composite_unique_fk_precision_length(self):
        """NULL을 포함한 UNIQUE, 복합 FK, 자릿수와 문자열 길이를 독립 작은 표로 확인한다."""
        ddl="""CREATE TABLE P(A NUMBER(2), B NUMBER(2), CONSTRAINT PK_P PRIMARY KEY(A,B));
        CREATE TABLE C(A NUMBER(2), B NUMBER(2), S VARCHAR2(2 CHAR), N NUMBER(4,2),
        CONSTRAINT UK_C UNIQUE(A,B), CONSTRAINT FK_C FOREIGN KEY(A,B) REFERENCES P(A,B));"""
        tables,rows=db.parse_ddl(ddl);rows['P']=[dict(A=1,B=2)];rows['C']=[dict(A=1,B=2,S='가나',N=db.Decimal('1.23'))]
        db.validate_rows(tables,rows)
        for change in [dict(A=2),dict(S='가나다'),dict(N=db.Decimal('1.234')),dict(N=100)]:
            bad=copy.deepcopy(rows);bad['C'][0].update(change)
            with self.assertRaises(ValueError): db.validate_rows(tables,bad)
        rows['C']=[dict(A=None,B=None),dict(A=None,B=None)];db.validate_rows(tables,rows)
        rows['C']=[dict(A=1,B=None),dict(A=1,B=None)]
        with self.assertRaises(ValueError):db.validate_rows(tables,rows)

    def test_ciphertext_length_uses_actual_encoded_size(self):
        """암호화 후 Base64 길이가 DDL 열 길이를 넘으면 거부한다."""
        ddl='CREATE TABLE X (NAME_ENC VARCHAR2(50 CHAR) NOT NULL);'
        tables,rows=db.parse_ddl(ddl);rows['X']=[{'NAME_ENC':db.encrypt_text('합성 이름'*20,TEST_AES)}]
        with self.assertRaises(ValueError):db.validate_rows(tables,rows)

    def test_missing_keys_write_nothing(self):
        """키가 없으면 입력을 읽거나 출력 폴더를 만들기 전에 중단한다."""
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'new'
            with self.assertRaises(ValueError):db.generate(Path(temp)/'missing',out,DDL,{})
            self.assertFalse(out.exists())

    def test_current_payment_integer_conservation(self):
        """배분 반올림으로 기준월 상환 합계가 달라지지 않게 한다."""
        loans=[dict(annual_service_krw=1,balance_krw=10),dict(annual_service_krw=1,balance_krw=20)]
        self.assertEqual(db.allocate_current_payment(5,loans),[3,2])
        with self.assertRaises(ValueError):db.allocate_current_payment(1,[])

    def test_drop_guard_and_utf8_entrypoint(self):
        """옛 DB 가드는 첫 DROP 전에 오류 종료하며 저장소 실행 방지 안내는 UTF-8 한글을 유지한다."""
        files,_=db.bundle_files(DDL.read_bytes(),self.tables,self.base,{n:[] for n in self.tables},[])
        drop=files['00_drop_all.sql'].decode('utf-8')
        self.assertLess(drop.index('WHENEVER SQLERROR EXIT FAILURE'),drop.index('RAISE_APPLICATION_ERROR'))
        self.assertLess(drop.index('RAISE_APPLICATION_ERROR'),drop.index('DROP TABLE'))
        self.assertIn('FROM USER_TABLES',drop)
        for name in db.LEGACY_TABLE_MARKERS:self.assertIn("'"+name+"'",drop)
        self.assertIn('END;\n/\n',drop)
        run=(DDL.parent/'run_all.sql').read_text(encoding='utf-8')
        self.assertIn('시드',run);self.assertNotIn('?',run);self.assertIn('EXIT FAILURE',run)

    def test_missing_demo_password_writes_nothing(self):
        """키는 있어도 시연 비밀번호가 없으면 출력 폴더를 만들기 전에 중단한다."""
        env={k:v for k,v in TEST_ENV.items() if k!='AVENUE_DEMO_PASSWORD'}
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'new'
            with self.assertRaisesRegex(ValueError,'AVENUE_DEMO_PASSWORD'):db.generate(Path(temp)/'missing',out,DDL,env)
            self.assertFalse(out.exists())


@unittest.skipUnless(os.environ.get('AVENUE_TEST_SERVICE_DUMMY'),'별도 재생성한 서비스 더미 경로가 필요함')
class FullSourceTests(unittest.TestCase):
    """고정 공개 테스트 키로 전체 원천 매핑·제약·출력과 실패 시 무쓰기를 검증한다."""
    def test_full_source_and_invalid_output_untouched(self):
        """400명 직군별 소득 행 수·암호문 복원과 DDL 불일치 시 출력 보존을 확인한다."""
        source=Path(os.environ['AVENUE_TEST_SERVICE_DUMMY'])
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'valid';report=db.generate(source,out,DDL,TEST_ENV)
            self.assertEqual(report['rows']['APP_USER'],401)  # 더미 회원 400 + 관리자 시연 계정 1
            self.assertEqual(report['rows']['USER_EXPENSE_ITEM'],400)
            self.assertEqual(report['rows']['USER_ASSET_SNAPSHOT'],400)
            self.assertEqual(report['rows']['ASSESSMENT'],0);self.assertEqual(report['omitted_missing_ddl'],[])
            tables,base=db.parse_ddl(DDL.read_text(encoding='utf-8-sig'))
            _,generated,_=db.build_seed_rows(source,tables,base,db.load_keys(TEST_ENV))
            income=generated['USER_INCOME_MONTH']
            members=db.read_csv(source/'members/members.csv');expected=sum(1 if m['segment']=='wage' else 12 for m in members)
            self.assertEqual(len(income),expected)
            self.assertEqual(report['table_count'],47)
            consenting={m['member_id'] for m in members if m['external_data_consent']=='1'}
            ids={int(m['member_id'][3:]) for m in members if m['member_id'] in consenting}
            utility=generated['USER_UTILITY_PAYMENT']
            self.assertEqual({r['USER_ID'] for r in utility},ids);self.assertEqual(len(utility),12*len(ids))
            self.assertTrue(all(r['SOURCE_CODE']=='IMPORTED' and r['CONSENT_ID'] for r in utility))
            self.assertEqual(report['unpaid']['USER_UTILITY_PAYMENT'],sum(r['PAYMENT_STATUS_CODE']=='UNPAID' for r in utility))
            # 시연 계정 3명: 직군별 첫 회원, LOGIN_ID 중복 없음, BCrypt 검증, 출력 어디에도 비밀번호 원문 없음
            import bcrypt
            all_demo=[*db.DEMO_LOGIN_IDS.values(),db.DEMO_ADMIN_LOGIN_ID]
            self.assertEqual(report['demo_login_ids'],sorted(all_demo))
            seed=(out/'10_seed_app_user.sql').read_text(encoding='utf-8')
            for login in all_demo:self.assertEqual(seed.count("'"+login+"'"),1)
            hashes=[h for h in __import__('re').findall(r"'(\$2a\$10\$[./A-Za-z0-9]{53})'",seed)]
            self.assertEqual(len(hashes),4)
            for h in hashes:self.assertTrue(bcrypt.checkpw(TEST_PASSWORD.encode(),h.encode()))
            for p in out.iterdir():self.assertNotIn(TEST_PASSWORD.encode(),p.read_bytes(),p.name)
            _,demo_rows,_=db.build_seed_rows(source,tables,base,db.load_keys(TEST_ENV),TEST_PASSWORD)
            logins=[r['LOGIN_ID'] for r in demo_rows['APP_USER']];self.assertEqual(len(logins),len(set(logins)))
            self.assertEqual(sum(r['PASSWORD_HASH'] is not None for r in demo_rows['APP_USER']),4)
            admin=[r for r in demo_rows['APP_USER'] if r['ROLE_CODE']=='ROLE_ADMIN']
            self.assertEqual(len(admin),1);admin=admin[0]
            self.assertEqual(admin['USER_ID'],max(int(m['member_id'][3:]) for m in members)+1)
            self.assertEqual((admin['LOGIN_ID'],admin['BIRTH_YEAR'],admin['WORKER_TYPE_CODE'],admin['PHONE_ENC'],admin['DUMMY_YN']),('demo_admin',None,None,None,'Y'))
            self.assertEqual(db.decrypt_text(admin['EMAIL_ENC'],{'v1':TEST_AES}),'demo-admin@avenue.example')
            self.assertEqual(admin['EMAIL_HMAC'],db.search_hmac('demo-admin@avenue.example','email',TEST_HMAC))
            self.assertTrue(bcrypt.checkpw(TEST_PASSWORD.encode(),admin['PASSWORD_HASH'].encode()))
            for name,table_rows in demo_rows.items():
                if name!='APP_USER':self.assertFalse(any(r.get('USER_ID')==admin['USER_ID'] for r in table_rows),name)
            self.assertIn("'APP_USER' AS TABLE_NAME, 401 AS EXPECTED",(out/'99_check.sql').read_text(encoding='utf-8'))
            # 저장소 v0_2처럼 안내용 run_all.sql이 있는 폴더에 쓰면 시드를 적재하는 run_all.sql로 바뀐다.
            stub=Path(temp)/'stub';stub.mkdir();shutil.copy(DDL.parent/'run_all.sql',stub/'run_all.sql')
            if '@@' not in (stub/'run_all.sql').read_text(encoding='utf-8'):
                db.generate(source,stub,DDL,TEST_ENV)
                self.assertIn('@@10_seed_app_user.sql',(stub/'run_all.sql').read_text(encoding='utf-8'))
            for row in generated['APP_USER']:
                plain=db.decrypt_text(row['EMAIL_ENC'],{'v1':TEST_AES})
                for col in ['NAME_ENC','PHONE_ENC','EMAIL_ENC']:self.assertTrue(row[col].startswith('v1:'))
                for col in ['PHONE_HMAC','EMAIL_HMAC']:self.assertRegex(row[col],'^[0-9a-f]{64}$')
                self.assertEqual(db.search_hmac(plain,'email',TEST_HMAC),row['EMAIL_HMAC'])
                self.assertLessEqual(len(row['NAME_ENC']),tables['APP_USER']['columns']['NAME_ENC']['length'])
            original={p.name:p.read_bytes() for p in out.iterdir()}
            bad=Path(temp)/'bad.sql';bad.write_text(DDL.read_text(encoding='utf-8-sig').replace('NAME_ENC               VARCHAR2(500 CHAR)','NAME_ENC               VARCHAR2(5 CHAR)'),encoding='utf-8')
            with self.assertRaises(ValueError):db.generate(source,out,bad,TEST_ENV)
            self.assertEqual(original,{p.name:p.read_bytes() for p in out.iterdir()})
            self.assertEqual((out/'01_create_tables.sql').read_bytes(),DDL.read_bytes())
            # N-05 저장소의 배포 보조 SQL도 실제 생성 결과와 함께 갱신됐는지 확인한다.
            for filename in ['00_drop_all.sql','99_check.sql']:
                self.assertEqual((out/filename).read_bytes(),(DDL.parent/filename).read_bytes(),filename)
            with self.assertRaises(ValueError):db.generate(source,SCRIPT.parents[1],DDL,TEST_ENV)
            changed_source=Path(temp)/'changed_source';shutil.copytree(source,changed_source)
            path=changed_source/'members/member_monthly_inputs.csv';monthly=db.read_csv(path);monthly[0]['month']='2024-01'
            with path.open('w',encoding='utf-8',newline='') as handle:
                writer=csv.DictWriter(handle,fieldnames=list(monthly[0]));writer.writeheader();writer.writerows(monthly)
            with self.assertRaises(ValueError):db.generate(changed_source,out,DDL,TEST_ENV)
            self.assertEqual(original,{p.name:p.read_bytes() for p in out.iterdir()})

    def test_consent_status_variants_all_member_loans_and_score_bands(self):
        """기관 전원 OK와 종전 미동의 응답이 같은 시드를 만들고 전 회원 상환·점수대 조건을 지키는지 본다."""
        source=Path(os.environ['AVENUE_TEST_SERVICE_DUMMY'])
        tables,base=db.parse_ddl(DDL.read_text(encoding='utf-8-sig'))
        members=db.read_csv(source/'members/members.csv');consenting={m['member_id'] for m in members if m['external_data_consent']=='1'}
        original_read=db.read_responses

        def responses(all_ok):
            """시작 미동의 회원의 응답 상태·내용만 바꿔 응답 상태가 동의로 오인되지 않는지 검증한다."""
            def read(path,filename):
                result=copy.deepcopy(original_read(path,filename))
                sample=next(r for r in result if r['member_id'] in consenting)
                for row in result:
                    if row['member_id'] in consenting:continue
                    if all_ok:
                        row.update({k:copy.deepcopy(v) for k,v in sample.items() if k not in ('member_id','as_of_date','provider')})
                        row['status']='OK'
                    else:row['status']='CONSENT_REQUIRED'
                return result
            return read

        variants=[]
        for all_ok in [False,True]:
            with patch.object(db,'read_responses',side_effect=responses(all_ok)):
                rows,generated,_=db.build_seed_rows(source,tables,base,db.load_keys(TEST_ENV))
            db.validate_rows(tables,rows)
            for r in generated['APP_USER']:
                for col in ['NAME_ENC','PHONE_ENC','EMAIL_ENC']:r.pop(col)
            variants.append(generated)
        self.assertEqual(*variants)
        generated=variants[0];ids={m['member_id']:int(m['member_id'][3:]) for m in members}
        monthly=db.read_csv(source/'members/member_monthly_inputs.csv')
        manual=[]
        for m in members:
            loans=[r for r in generated['USER_LOAN'] if r['USER_ID']==ids[m['member_id']]]
            expected=int(next(r['debt_service_krw'] for r in monthly if r['member_id']==m['member_id'] and r['month']==db.BASE_MONTH))
            self.assertEqual(sum(r['MONTHLY_PAYMENT_AMT'] for r in loans),expected)
            for r in loans:
                self.assertEqual(r['SOURCE_CODE'],'IMPORTED' if m['member_id'] in consenting else 'MANUAL')
                if m['member_id'] not in consenting:self.assertIsNone(r.get('CONSENT_ID'));manual.append(r)
        self.assertGreater(sum(r['MONTHLY_PAYMENT_AMT'] for r in manual),0)
        consent_by={r['CONSENT_ID']:r for r in generated['USER_CONSENT']}
        for name in ['USER_TELECOM_PAYMENT','USER_UTILITY_PAYMENT','USER_EASYPAY_USAGE','USER_SOCIAL_INSURANCE_PAYMENT','USER_CREDIT_PROFILE']:
            for r in generated[name]:
                consent=consent_by[r['CONSENT_ID']]
                self.assertEqual(consent['AGREED_YN'],'Y');self.assertEqual(consent['USER_ID'],r['USER_ID'])
        offers=generated['SCORE_BAND_OFFER'];self.assertEqual(len(offers),3)
        self.assertEqual(len({(r['RATE_MIN_PCT'],r['RATE_MAX_PCT'],r['LIMIT_AMT']) for r in offers}),3)
        for offer in offers:
            products=[r for r in generated['LOAN_PRODUCT'] if r['MIN_ALT_SCORE']<=offer['MIN_SCORE']]
            self.assertEqual(offer['RATE_MIN_PCT'],min(r['RATE_MIN_PCT'] for r in products))
            self.assertEqual(offer['RATE_MAX_PCT'],max(r['RATE_MAX_PCT'] for r in products))
            self.assertEqual(offer['LIMIT_AMT'],max(r['LIMIT_MAX_AMT'] for r in products))
        bad=copy.deepcopy(generated);bad['USER_LOAN'][0]['MONTHLY_PAYMENT_AMT']+=1
        with self.assertRaisesRegex(ValueError,'전 회원 기준월 상환 합계'):
            db.source_checks(source,members,monthly,bad,ids)


if __name__=='__main__':unittest.main()
