"""N-05·N-37 서비스 더미를 현재 DDL에 맞춰 검증한 뒤 SQL 묶음으로 만든다.

환경변수 키가 없거나 DDL·원천 대조가 실패하면 출력 파일을 쓰지 않는다. 옛 생성기는 실행·수정하지 않는다.
"""
import argparse
import base64
import csv
import datetime as dt
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sys
import tempfile

BASE_MONTH = '2026-08'  # TODO(D-16): 급여소득자 기준월은 팀 합의 전 원천 마지막 달로 고정한다.
JOB_MAP = {'wage': 'EMPLOYEE', 'selfemp': 'SELF_EMPLOYED', 'freelance': 'FREELANCER'}
# N-37 시연용 최소점수 가정이다. 실제 금융기관의 심사 조건이 아니다.
PRODUCT_MIN_SCORES = {'0': 780, '5': 665, '1': 0, '2': 0, '3': 0}
LEGACY_TABLE_MARKERS = ('APP_MEMBER', 'MEMBER_MONTHLY_INPUT', 'MEMBER_LOAN', 'EXTERNAL_API_RESPONSE')
KEY_VERSION = 'v1'  # v0.3.1 (E2) 암호문 키 버전 접두어
# 시연 계정: 직군별로 회원 ID 정렬 후 첫 회원. 비밀번호 원문은 AVENUE_DEMO_PASSWORD에서만 받는다.
DEMO_LOGIN_IDS = {'wage': 'demo_employee', 'selfemp': 'demo_self', 'freelance': 'demo_free'}
DEMO_ADMIN_LOGIN_ID = 'demo_admin'  # N-01-5 관리자 시연 계정(새 행, 같은 시연 비밀번호)
BCRYPT_ROUNDS = 10  # Spring BCryptPasswordEncoder 기본 cost, $2a$


def sql_tokens(text):
    """문자열·주석을 구별해 제한된 Oracle DDL·CHECK를 안전하게 토큰화한다. Python eval은 사용하지 않는다."""
    pattern = re.compile(r"\s+|--[^\n]*|/\*[\s\S]*?\*/|'(?:''|[^'])*'|[A-Za-z_][A-Za-z_0-9$#]*|\d+(?:\.\d+)?|<>|!=|<=|>=|\|\||[(),;=<>+*/.-]")
    tokens = []
    pos = 0
    for match in pattern.finditer(text):
        if text[pos:match.start()].strip():
            raise ValueError('지원하지 않는 SQL 토큰')
        value = match.group(); pos = match.end()
        if value.isspace() or value.startswith(('--', '/*')):
            continue
        if value.startswith("'"):
            tokens.append(('string', value[1:-1].replace("''", "'")))
        elif value[0].isdigit():
            tokens.append(('number', Decimal(value)))
        else:
            tokens.append(('symbol', value.upper()))
    if text[pos:].strip():
        raise ValueError('지원하지 않는 SQL 끝부분')
    return tokens


def split_items(tokens):
    """괄호 안 쉼표와 열·제약 경계의 쉼표를 구별한다."""
    result, item, depth = [], [], 0
    for token in tokens:
        value = token[1] if token[0] == 'symbol' else None
        if value == ',' and depth == 0:
            result.append(item); item = []; continue
        depth += (value == '(') - (value == ')')
        item.append(token)
    if depth != 0:
        raise ValueError('SQL 괄호 불균형')
    if item:
        result.append(item)
    return result


def enclosed(tokens, start):
    """시작 괄호의 내용과 닫힌 다음 위치를 반환한다."""
    if tokens[start] != ('symbol', '('):
        raise ValueError('SQL 괄호가 필요함')
    depth = 1
    for i in range(start + 1, len(tokens)):
        if tokens[i] == ('symbol', '('): depth += 1
        if tokens[i] == ('symbol', ')'): depth -= 1
        if depth == 0:
            return tokens[start+1:i], i+1
    raise ValueError('닫히지 않은 SQL 괄호')


def sql_and(a, b):
    """Oracle CHECK의 NULL(UNKNOWN)을 보존하는 AND다."""
    return False if a is False or b is False else None if a is None or b is None else True


def sql_or(a, b):
    """Oracle CHECK의 NULL(UNKNOWN)을 보존하는 OR다."""
    return True if a is True or b is True else None if a is None or b is None else False


class CheckExpression:
    """DDL CHECK를 제한된 AST로 읽어 길이·허용값·범위·복합 NULL 조건을 검사한다."""
    def __init__(self, tokens):
        """지원하지 않는 구문은 무시하지 않고 초기화 단계에서 거부한다."""
        self.tokens, self.pos = tokens, 0
        self.tree = self.expression()
        if self.pos != len(tokens):
            raise ValueError('지원하지 않는 CHECK 표현식')

    def take(self, value):
        """문자열 리터럴을 SQL 키워드로 오인하지 않게 구별한다."""
        if self.pos < len(self.tokens) and self.tokens[self.pos] == ('symbol', value):
            self.pos += 1; return True
        return False

    def need(self, value):
        """예상한 구문 요소가 없으면 사전 검사를 중단한다."""
        if not self.take(value):
            raise ValueError('CHECK 구문 불일치: ' + value)

    def expression(self):
        """OR보다 AND를 먼저 묶어 Oracle 우선순위를 따른다."""
        node = self.conjunction()
        while self.take('OR'): node = ('OR', node, self.conjunction())
        return node

    def conjunction(self):
        """연속된 AND 조건을 묶는다."""
        node = self.predicate()
        while self.take('AND'): node = ('AND', node, self.predicate())
        return node

    def predicate(self):
        """비교·범위·목록·NULL·JSON 조건을 해석한다."""
        if self.take('NOT'): return ('NOT', self.predicate())
        left = self.value()
        if self.take('IS'):
            neg = self.take('NOT')
            if self.take('NULL'): node = ('ISNULL', left)
            elif self.take('JSON'): node = ('ISJSON', left)
            else: raise ValueError('지원하지 않는 IS 조건')
            return ('NOT', node) if neg else node
        neg = self.take('NOT')
        if self.take('IN'):
            self.need('('); values = [self.value()]
            while self.take(','): values.append(self.value())
            self.need(')'); node = ('IN', left, values)
        elif self.take('LIKE'):
            pattern = self.value()
            has_escape = self.take('ESCAPE')
            escape = self.value() if has_escape else ('LITERAL', None)
            node = ('LIKE', left, pattern, escape, ('LITERAL', has_escape))
        elif self.take('BETWEEN'):
            low = self.value(); self.need('AND'); node = ('BETWEEN', left, low, self.value())
        else:
            for op in ['=', '<>', '!=', '<=', '>=', '<', '>']:
                if self.take(op): return (op, left, self.value())
            if neg: raise ValueError('지원하지 않는 NOT 조건')
            return left
        return ('NOT', node) if neg else node

    def value(self):
        """문자열 연결을 비교보다 먼저 해석한다."""
        node = self.atom()
        while self.take('||'): node = ('CONCAT', node, self.atom())
        return node

    def atom(self):
        """시드 검증에 필요한 상수·열·함수와 괄호 조건을 해석한다."""
        if self.take('('):
            node = self.expression(); self.need(')'); return node
        if self.take('-'): return ('NEG', self.atom())
        if self.pos >= len(self.tokens): raise ValueError('CHECK 값 누락')
        kind, value = self.tokens[self.pos]; self.pos += 1
        if kind in ('string', 'number'): return ('LITERAL', None if kind == 'string' and value == '' else value)
        if value == 'NULL': return ('LITERAL', None)
        if value == 'SYSTIMESTAMP': return ('LITERAL', dt.datetime(2026, 9, 18))
        if self.take('('):
            if value not in ('LENGTH', 'REGEXP_LIKE', 'TO_CHAR'): raise ValueError('지원하지 않는 CHECK 함수: ' + value)
            args = [self.value()]
            while self.take(','): args.append(self.value())
            self.need(')')
            if len(args) != (2 if value == 'REGEXP_LIKE' else 1): raise ValueError('CHECK 함수 인자 수 오류: ' + value)
            return (value, *args)
        return ('COLUMN', value)

    def evaluate(self, row, tree=None):
        """NULL 비교를 UNKNOWN으로 평가한다. 오류 메시지에는 시드 원문 값을 포함하지 않는다."""
        tree = self.tree if tree is None else tree
        op = tree[0]
        if op == 'LITERAL': return tree[1]
        if op == 'COLUMN': return row.get(tree[1])
        values = [self.evaluate(row, x) for x in tree[1:]] if op != 'IN' else [self.evaluate(row, tree[1])]
        if op == 'AND': return sql_and(*values)
        if op == 'OR': return sql_or(*values)
        if op == 'NOT': return None if values[0] is None else not values[0]
        if op == 'ISNULL': return values[0] is None
        if op == 'ISJSON':
            if values[0] is None: return None
            try: json.loads(values[0]); return True
            except (ValueError, TypeError): return False
        if op == 'IN':
            options = [self.evaluate(row, x) for x in tree[2]]
            return None if values[0] is None else True if values[0] in options else None if None in options else False
        if op == 'CONCAT':
            result = ''.join('' if x is None else str(x) for x in values)
            return result or None
        if op == 'LIKE':
            value, pattern, escape, has_escape = values
            if value is None or pattern is None or (has_escape and escape is None): return None
            if has_escape and (not isinstance(escape, str) or len(escape) != 1):
                raise ValueError('LIKE ESCAPE는 한 글자여야 합니다')
            regex, pos = [], 0
            while pos < len(pattern):
                char = pattern[pos]; pos += 1
                if has_escape and char == escape:
                    if pos == len(pattern) or pattern[pos] not in ('%', '_', escape):
                        raise ValueError('지원하지 않는 LIKE ESCAPE 패턴')
                    regex.append(re.escape(pattern[pos])); pos += 1
                elif char == '%': regex.append('.*')
                elif char == '_': regex.append('.')
                else: regex.append(re.escape(char))
            return re.fullmatch(''.join(regex), str(value), re.DOTALL) is not None
        if any(x is None for x in values): return None
        if op == 'TO_CHAR':
            number = Decimal(str(values[0]))
            if not number.is_finite() or number != number.to_integral_value():
                raise ValueError('TO_CHAR는 정수 한 개만 지원합니다')
            return str(int(number))
        if op == 'NEG': return -values[0]
        if op == 'LENGTH': return len(values[0])
        if op == 'REGEXP_LIKE': return bool(re.search(values[1], str(values[0])))
        if op == 'BETWEEN': return values[1] <= values[0] <= values[2]
        a, b = values
        if op == '=': return a == b
        if op in ('<>', '!='): return a != b
        if op == '<': return a < b
        if op == '>': return a > b
        if op == '<=': return a <= b
        if op == '>=': return a >= b
        raise ValueError('지원하지 않는 CHECK 연산')

    def columns(self, tree=None):
        """CHECK가 참조하는 열 이름을 수집해 미정의 열이 UNKNOWN으로 통과하지 못하게 한다."""
        tree=self.tree if tree is None else tree
        if tree[0]=='COLUMN': return {tree[1]}
        if tree[0]=='LITERAL': return set()
        children=list(tree[1:]) if tree[0]!='IN' else [tree[1]]+tree[2]
        return set().union(*(self.columns(child) for child in children))


def parse_ddl(text):
    """받은 DDL에서 열·기본값·길이·CHECK·PK·UNIQUE·FK와 내장 기준 시드를 읽는다."""
    statements = []
    for statement in split_statements(sql_tokens(text)):
        if statement:
            if statement[0][1] in {'ALTER','DROP','UPDATE','DELETE','MERGE','EXEC','BEGIN'}:
                raise ValueError('받은 DDL의 미지원 변경문은 검수 후 반영해야 합니다')
            statements.append(statement)
    tables, names = {}, set()
    for tokens in statements:
        if tokens[:2] != [('symbol', 'CREATE'), ('symbol', 'TABLE')]: continue
        name = tokens[2][1]; body, _ = enclosed(tokens, 3)
        if name in tables: raise ValueError('DDL 테이블 이름 중복: ' + name)
        table = dict(columns={}, keys=[], fks=[], checks=[], indexes=[])
        for item in split_items(body):
            if item[0] == ('symbol', 'CONSTRAINT'):
                cname = item[1][1]
                if cname in names: raise ValueError('DDL 제약 이름 중복: ' + cname)
                names.add(cname); rest = item[2:]; kind = rest[0][1]
                if kind == 'CHECK':
                    expr, _ = enclosed(rest, 1); table['checks'].append((cname, CheckExpression(expr)))
                elif kind in ('PRIMARY', 'UNIQUE', 'FOREIGN'):
                    offset = 2 if kind in ('PRIMARY', 'FOREIGN') else 1
                    cols, end = enclosed(rest, offset); cols = [x[0][1] for x in split_items(cols)]
                    if kind == 'FOREIGN':
                        if rest[end] != ('symbol', 'REFERENCES'): raise ValueError('FK 참조 구문 불일치')
                        parent = rest[end+1][1]; pc, _ = enclosed(rest, end+2)
                        table['fks'].append((cname, cols, parent, [x[0][1] for x in split_items(pc)]))
                    else: table['keys'].append((cname, cols, kind == 'PRIMARY'))
                else: raise ValueError('지원하지 않는 DDL 제약: ' + cname)
                continue
            col, typ = item[0][1], item[1][1]
            if typ not in ('NUMBER', 'VARCHAR2', 'CHAR', 'DATE', 'TIMESTAMP', 'CLOB'): raise ValueError('지원하지 않는 열 타입: ' + name + '.' + col)
            precision, scale, length, unit = None, 0, None, 'CHAR'
            if len(item) > 2 and item[2] == ('symbol', '('):
                args, _ = enclosed(item, 2)
                if typ == 'NUMBER':
                    values = [int(x[1]) for x in args if x[0] == 'number']; precision = values[0]; scale = values[1] if len(values)>1 else 0
                else:
                    length = int(args[0][1]); unit = args[1][1] if len(args)>1 else 'BYTE'
            symbols = [x[1] for x in item if x[0] == 'symbol']
            if set(symbols) & {'CHECK','REFERENCES','UNIQUE','PRIMARY'}:
                raise ValueError('미지원 인라인 제약은 검수 후 반영해야 합니다: '+name+'.'+col)
            default = None
            if 'DEFAULT' in symbols and 'GENERATED' not in symbols:
                at = item.index(('symbol', 'DEFAULT')); default = CheckExpression([item[at+1]]).evaluate({})
            if col in table['columns']: raise ValueError('DDL 열 이름 중복: ' + name + '.' + col)
            table['columns'][col] = dict(type=typ, length=length, unit=unit, precision=precision, scale=scale,
                                         required=any(item[i:i+2] == [('symbol','NOT'),('symbol','NULL')] for i in range(len(item)-1)),
                                         identity='IDENTITY' in symbols, default=default)
        for cname,expr in table['checks']:
            if expr.columns()-set(table['columns']): raise ValueError('CHECK 참조 열 없음: '+cname)
            if expr.tree[0] not in {'AND','OR','NOT','ISNULL','ISJSON','IN','BETWEEN','REGEXP_LIKE','LIKE','=','<>','!=','<','>','<=','>='}:
                raise ValueError('CHECK는 논리 조건이어야 함: '+cname)
        for cname,cols,*_ in table['keys']+table['fks']:
            if set(cols)-set(table['columns']): raise ValueError('제약 참조 열 없음: '+cname)
        tables[name] = table
    for tokens in statements:
        if tokens[:3] != [('symbol','CREATE'),('symbol','UNIQUE'),('symbol','INDEX')]: continue
        cname=tokens[3][1];name=tokens[5][1];body,_=enclosed(tokens,6);expressions=[]
        for item in split_items(body):
            condition=None
            if item[0]==('symbol','CASE'):
                if item[1]!=('symbol','WHEN') or item[-1]!=('symbol','END') or ('symbol','ELSE') in item:
                    raise ValueError('지원하지 않는 UNIQUE INDEX CASE: '+cname)
                at=item.index(('symbol','THEN'));condition=CheckExpression(item[2:at]);value=CheckExpression(item[at+1:-1])
            else: value=CheckExpression(item)
            columns=value.columns() | (condition.columns() if condition else set())
            if columns-set(tables[name]['columns']): raise ValueError('인덱스 참조 열 없음: '+cname)
            expressions.append((condition,value))
        tables[name]['indexes'].append((cname,expressions))
    rows = {name: [] for name in tables}
    for tokens in statements:
        if tokens[:2] != [('symbol','INSERT'),('symbol','INTO')]: continue
        name = tokens[2][1]; at = 3
        if tokens[at] == ('symbol','('):
            cols, at = enclosed(tokens, at); cols = [x[0][1] for x in split_items(cols)]
        else: cols = list(tables[name]['columns'])
        if tokens[at] != ('symbol','VALUES'): raise ValueError('지원하지 않는 기준 INSERT')
        values, _ = enclosed(tokens, at+1); values = split_items(values)
        if len(cols) != len(values): raise ValueError('기준 INSERT 열 수 불일치: ' + name)
        rows[name].append(dict(zip(cols, [CheckExpression(v).evaluate({}) for v in values])))
    return tables, rows


def split_statements(tokens):
    """문자열 안 세미콜론을 보존하며 SQL 문장을 나눈다."""
    statement = []
    for token in tokens:
        if token == ('symbol', ';'):
            yield statement; statement = []
        else: statement.append(token)
    if statement: yield statement


def validate_rows(tables, rows):
    """DDL의 타입·길이·NOT NULL·모든 CHECK와 복합 키·참조 무결성을 파일 쓰기 전에 검사한다."""
    if set(rows) != set(tables): raise ValueError('DDL과 시드 테이블 목록 불일치')
    complete = {}
    for name, table in tables.items():
        complete[name] = []
        for index, original in enumerate(rows[name], 1):
            if set(original)-set(table['columns']): raise ValueError(name + ': DDL에 없는 시드 열')
            row = {c: original.get(c, spec['default']) for c,spec in table['columns'].items()}
            row = {c: None if v == '' else v for c,v in row.items()}
            for col, spec in table['columns'].items():
                value = row[col]; label = f'{name}.{col} 행 {index}'
                if value is None:
                    if spec['required'] and not spec['identity']: raise ValueError(label + ': NULL 불가')
                    continue
                if spec['type'] in ('VARCHAR2', 'CHAR', 'CLOB'):
                    if not isinstance(value,str): raise ValueError(label + ': 문자열 필요')
                    size = len(value.encode('utf-8')) if spec['unit']=='BYTE' else len(value)
                    if spec['length'] and size>spec['length']: raise ValueError(label + ': 길이 초과')
                elif spec['type'] == 'NUMBER':
                    number = Decimal(str(value))
                    if not number.is_finite() or (spec['precision'] and abs(number)>=Decimal(10)**(spec['precision']-spec['scale'])):
                        raise ValueError(label + ': NUMBER 자릿수 초과')
                    if number != number.quantize(Decimal(1).scaleb(-spec['scale'])): raise ValueError(label + ': NUMBER 소수 자릿수 초과')
                elif not isinstance(value,(dt.date,dt.datetime)): raise ValueError(label + ': 날짜 타입 필요')
            for cname, expr in table['checks']:
                if expr.evaluate(row) is False: raise ValueError(f'{name} 행 {index}: CHECK {cname} 위반')
            complete[name].append(row)
        for cname, cols, primary in table['keys']:
            seen = set()
            for row in complete[name]:
                key = tuple(row[c] for c in cols)
                if primary and None in key: raise ValueError(name + ': PK NULL ' + cname)
                if not primary and all(v is None for v in key): continue
                if key in seen: raise ValueError(name + ': 키 중복 ' + cname)
                seen.add(key)
        for cname,expressions in table['indexes']:
            seen=set()
            for row in complete[name]:
                key=tuple(value.evaluate(row) if condition is None or condition.evaluate(row) is True else None for condition,value in expressions)
                if all(v is None for v in key): continue
                if key in seen: raise ValueError(name+': UNIQUE INDEX 중복 '+cname)
                seen.add(key)
    for name, table in tables.items():
        for cname, cols, parent, pc in table['fks']:
            if parent not in tables or any(c not in tables[parent]['columns'] for c in pc): raise ValueError('DDL FK 대상 없음: ' + cname)
            if pc not in [key_cols for _,key_cols,_ in tables[parent]['keys']]: raise ValueError('FK 대상은 PK·UNIQUE여야 함: '+cname)
            keys = {tuple(r[c] for c in pc) for r in complete[parent]}
            for row in complete[name]:
                key = tuple(row[c] for c in cols)
                if None not in key and key not in keys: raise ValueError(name + ': FK 위반 ' + cname)
    return complete


def load_keys(environ=None):
    """N-02-4 환경변수 두 개에서만 별도 AES·HMAC 키를 읽는다. 오류에 키·환경변수 값은 포함하지 않는다."""
    environ = os.environ if environ is None else environ
    keys = []
    for name in ['AVENUE_DEV_AES_KEY', 'AVENUE_DEV_HMAC_KEY']:
        value = environ.get(name)
        if not value: raise ValueError(name + ' 환경변수(Base64)가 필요합니다')
        try: key = base64.b64decode(value, validate=True)
        except (ValueError, TypeError): raise ValueError(name + ': 올바른 Base64가 필요합니다') from None
        if name=='AVENUE_DEV_AES_KEY' and len(key)!=32: raise ValueError(name + ': 32바이트 키가 필요합니다')
        if name=='AVENUE_DEV_HMAC_KEY' and len(key)<32: raise ValueError(name + ': 최소 32바이트 키가 필요합니다')
        keys.append(key)
    if hmac.compare_digest(*keys): raise ValueError('AES와 HMAC 키는 서로 달라야 합니다')
    return tuple(keys)


def repo_root():
    """이 스크립트에서 위로 올라가며 .git이 있는 저장소 루트를 찾는다."""
    here = Path(__file__).resolve()
    for folder in here.parents:
        if (folder/'.git').exists(): return folder
    raise ValueError('저장소 루트(.git)를 찾지 못했습니다')


def read_env_file(path):
    """KEY=VALUE 형식 env 파일을 읽는다. 저장소 안 파일은 거부하고, 오류에 값은 넣지 않는다."""
    target = Path(path).resolve(); root = repo_root()
    if target == root or root in target.parents: raise ValueError('env 파일은 저장소 밖에 두어야 합니다')
    values = {}
    for line in target.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#'): continue
        name, sep, value = line.partition('=')
        if not sep: raise ValueError('env 파일 형식은 KEY=VALUE여야 합니다')
        values[name.strip()] = value.strip()
    return values


def load_demo_password(environ=None):
    """N-01 시연 계정 비밀번호 원문을 AVENUE_DEMO_PASSWORD에서만 읽는다. 값은 오류에 넣지 않는다."""
    environ = os.environ if environ is None else environ
    value = environ.get('AVENUE_DEMO_PASSWORD')
    if not value: raise ValueError('AVENUE_DEMO_PASSWORD(시연 계정 비밀번호)가 필요합니다')
    if len(value.encode('utf-8')) > 72: raise ValueError('AVENUE_DEMO_PASSWORD는 BCrypt 한도 72바이트 이하여야 합니다')
    return value


def bcrypt_hash(password):
    """Spring BCryptPasswordEncoder와 호환되는 $2a$ cost 10 해시를 만든다."""
    import bcrypt
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(BCRYPT_ROUNDS, b'2a')).decode('ascii')


def demo_members(members):
    """직군별로 회원 ID 정렬 후 첫 회원을 시연 계정으로 고른다."""
    chosen = {}
    for m in sorted(members, key=lambda r: r['member_id']):
        chosen.setdefault(m['segment'], m['member_id'])
    if set(chosen) != set(DEMO_LOGIN_IDS): raise ValueError('직군마다 시연 회원이 1명씩 있어야 함')
    return {code: DEMO_LOGIN_IDS[seg] for seg, code in chosen.items()}


def encrypt_text(text, aes_key):
    """N-02-4 UTF-8 값을 12바이트 난수 IV의 AES-256-GCM으로 암호화하고 "v1:" + Base64(IV+암호문+16바이트 태그)를 반환한다(v0.3.1 E2)."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if len(aes_key)!=32: raise ValueError('AES-256-GCM에는 32바이트 키가 필요합니다')
    iv = os.urandom(12)
    return KEY_VERSION + ':' + base64.b64encode(iv + AESGCM(aes_key).encrypt(iv, text.encode('utf-8'), None)).decode('ascii')


def decrypt_text(value, keys_by_version):
    """v0.3.1 (E2) 첫 ':' 앞 키 버전으로 키를 골라 복호화한다. 모르는 버전·접두어 없음은 오류로 멈춘다(Spring 참고용·테스트용)."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    version, sep, body = value.partition(':')
    if not sep or version not in keys_by_version: raise ValueError('알 수 없는 암호문 키 버전')
    raw = base64.b64decode(body, validate=True)
    return AESGCM(keys_by_version[version]).decrypt(raw[:12], raw[12:], None).decode('utf-8')


def search_hmac(text, kind, hmac_key):
    """N-02-4 이메일 trim+소문자, 휴대폰 숫자만 정규화 후 별도 HMAC-SHA256을 64자 소문자로 반환한다."""
    if kind not in ('email','phone'): raise ValueError('HMAC 정규화 종류는 email 또는 phone이어야 합니다')
    value = text.strip().lower() if kind=='email' else re.sub(r'[^0-9]', '', text)
    return hmac.new(hmac_key, value.encode('utf-8'), hashlib.sha256).hexdigest()


def read_csv(path):
    """지정된 합성 원천 CSV만 읽고 빈 값을 None으로 보존한다."""
    with Path(path).open(encoding='utf-8-sig', newline='') as handle:
        return [{k: None if v=='' else v for k,v in row.items()} for row in csv.DictReader(handle)]


def read_responses(source, filename):
    """서비스 더미의 기관 응답 JSONL 한 종류를 읽는다."""
    with (source/'external_api'/filename).open(encoding='utf-8-sig') as handle:
        return [json.loads(line) for line in handle if line.strip()]


def rounded(value):
    """원 단위 스냅샷은 명세의 ROUND_HALF_UP 규칙으로 정수화한다."""
    return int(Decimal(str(value)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def allocate_current_payment(total, loans):
    """기준월 입력 상환액을 원장의 연 상환액 비중으로 배분하고 합계를 원 단위까지 보존한다."""
    if not loans:
        if total: raise ValueError('기준월 상환액은 있지만 대출 원장이 없음')
        return []
    weights = [int(x['annual_service_krw']) for x in loans]
    if sum(weights)==0: weights = [int(x['balance_krw']) for x in loans]
    if sum(weights)==0: weights = [1]*len(loans)
    denominator = sum(weights)
    values = [total*w//denominator for w in weights]
    order = sorted(range(len(loans)), key=lambda i: (-(total*weights[i] % denominator), i))
    for i in order[:total-sum(values)]: values[i] += 1
    return values


def estimate_card_limit(bureau):
    """N-05 카드 한도는 총신용공여에서 대출잔액을 빼 천원에서 원으로 환산한다.
    원천 값이 없거나 결과가 음수면 NULL로 둔다."""
    total, balance = (bureau.get(k) for k in ('KC1000001', 'L00000002'))
    if total is None or balance is None:
        return None
    # TODO: 원천에 보증금액이 생기면 총신용공여에서 함께 빼야 한다.
    amount = (Decimal(str(total)) - Decimal(str(balance))) * 1000
    return amount if amount >= 0 else None


def bill_status(row):
    """v0.3.1 (U3) 기관 응답의 "late + 납부일 없음"을 UNPAID로 바꾼다. 상태와 납부일이 맞는지는 DDL CHECK로 검사한다."""
    status = row['payment_status'].upper()
    return 'UNPAID' if status == 'LATE' and not row['paid_date'] else status


def map_bill_rows(responses, ids, consent_ids, item_code, as_of):
    """N-05-6 통신비·공과금 공통 청구·납부 모양을 변환한다. 동의 회원만 IMPORTED 행으로 만든다."""
    result = []
    for js in responses:
        code=js['member_id']
        if (code,item_code) not in consent_ids: continue
        if js['status']!='OK': raise ValueError('동의 회원 기관 응답이 OK가 아님')
        for row in js['bills']:
            result.append(dict(USER_ID=ids[code], BILL_MONTH=row['bill_month'], BILLED_AMT=int(row['billed_amount_krw']),
                DUE_DATE=dt.date.fromisoformat(row['due_date']), PAID_DATE=dt.date.fromisoformat(row['paid_date']) if row['paid_date'] else None,
                PAYMENT_STATUS_CODE=bill_status(row), SOURCE_CODE='IMPORTED', CONSENT_ID=consent_ids[code,item_code], BASE_DATE=as_of))
    return result


def build_seed_rows(source, tables, base_rows, keys, demo_password=None):
    """N-05·N-37 기존 서비스 원천을 서비스 DB 행으로 매핑한다. 개인정보는 메모리에서 바로 암호화하고, 시연 계정 3명만 BCrypt 해시를 넣는다."""
    source = Path(source); aes_key, hmac_key = keys
    members = read_csv(source/'members/members.csv')
    inputs = read_csv(source/'members/member_monthly_inputs.csv')
    assets = read_csv(source/'members/member_asset_snapshots_v02.csv')
    products = read_csv(source/'loan_products.csv')
    if not products: raise ValueError('더미 상품 원천이 비어 있음')
    as_of = dt.date.fromisoformat(products[0]['as_of_date'])
    rows = {name: [dict(r) for r in base_rows[name]] for name in tables}
    generated = {name: [] for name in tables}
    ids = {m['member_id']: int(m['member_id'][3:]) for m in members}
    if len(ids)!=len(members) or len(set(ids.values()))!=len(ids): raise ValueError('회원 ID 원천 중복')
    if any(m['external_data_consent'] not in ('0','1') for m in members): raise ValueError('회원 시작 동의 상태는 0 또는 1이어야 함')
    consenting = {m['member_id'] for m in members if m['external_data_consent']=='1'}
    demo = demo_members(members) if demo_password is not None else {}
    if set(demo.values()) & {m['member_id'].lower() for m in members}: raise ValueError('시연 아이디가 다른 회원과 겹침')
    loans_by = {}
    for loan in read_csv(source/'members/ledgers/loans.csv'):
        if loan['member_id'] not in ids: raise ValueError('대출 원장의 회원 범위 불일치')
        loans_by.setdefault(loan['member_id'],[]).append(loan)
    monthly = {}
    for r in inputs: monthly.setdefault(r['member_id'], []).append(r)
    asset_by = {r['member_id']: r for r in assets}
    if len(asset_by)!=len(assets) or set(asset_by)!=set(ids): raise ValueError('자산 원천 회원 범위 불일치')
    consent_ids, counters = {}, {}

    def add(table, row, id_col=None):
        """생성 행을 모으고 필요한 경우 명시적 정수 식별자를 부여한다."""
        if id_col:
            counters[table] = counters.get(table,0)+1; row[id_col] = counters[table]
        generated[table].append(row)
        return row.get(id_col)

    items = [('financial','LOANS'),('telecom','TELECOM_BILL'),('utility','UTILITY_BILL'),('payment','EASYPAY'),
             ('public-insurance','NATIONAL_PENSION'),('public-insurance','HEALTH_INSURANCE'),('credit-bureau','CREDIT_PROFILE')]
    for member in members:
        code = member['member_id']; uid = ids[code]; signup = dt.datetime.fromisoformat(member['signup_date'])
        if code not in monthly or len(monthly[code])!=12 or len({r['month'] for r in monthly[code]})!=12:
            raise ValueError('회원 입력 원천은 중복 없이 12개월이어야 함')
        ordered = sorted(monthly[code], key=lambda r:r['month'])
        if ordered[-1]['month']!=BASE_MONTH: raise ValueError('회원 입력 기준월 불일치')
        year,month=map(int,BASE_MONTH.split('-'));end=year*12+month-1
        expected_months=[f'{n//12:04d}-{n%12+1:02d}' for n in range(end-11,end+1)]
        if [r['month'] for r in ordered]!=expected_months: raise ValueError('회원 입력은 기준월까지 연속 12개월이어야 함')
        for r in ordered:
            for col in ['income_krw','expense_total_krw','debt_service_krw']:
                value=Decimal(r[col]) if r[col] is not None else None
                if value is None or not value.is_finite() or value<0 or value!=value.to_integral_value():
                    raise ValueError('회원 월 입력 원천은 관측된 음이 아닌 원 단위 정수여야 함')
        current = ordered[-1]
        # 이름·휴대폰은 회원 ID에서 만든 합성값이다. 원문을 SQL·오류·로그에 남기지 않는다.
        name = f'합성회원{uid:06d}'; phone = f'010{uid:08d}'
        add('APP_USER', dict(USER_ID=uid, LOGIN_ID=demo.get(code, code.lower()),
            PASSWORD_HASH=bcrypt_hash(demo_password) if code in demo else None, NICKNAME=member['nickname'],
            NAME_ENC=encrypt_text(name,aes_key), PHONE_ENC=encrypt_text(phone,aes_key), PHONE_HMAC=search_hmac(phone,'phone',hmac_key),
            EMAIL_ENC=encrypt_text(member['email'],aes_key), EMAIL_HMAC=search_hmac(member['email'],'email',hmac_key),
            BIRTH_YEAR=int(member['birth_year']), WORKER_TYPE_CODE=JOB_MAP[member['segment']], WORK_PERIOD_MONTHS=None,
            ROLE_CODE='ROLE_USER', ACCOUNT_STATUS_CODE='ACTIVE', DUMMY_YN='Y', CREATED_AT=signup))
        for kind, required, agreed in [('TERMS_OF_SERVICE','Y','Y'),('PRIVACY_COLLECTION','Y','Y'),('NOTIFICATION_MARKETING','N','N')]:
            add('USER_CONSENT', dict(USER_ID=uid, CONSENT_TYPE_CODE=kind, REQUIRED_YN=required, AGREED_YN=agreed,
                TERMS_VERSION='DEV-0.2', AGREED_AT=signup if agreed=='Y' else None, CREATED_AT=signup), 'CONSENT_ID')
        for provider, item in items:
            agreed = member['external_data_consent']=='1'
            consent_at = dt.datetime.combine(as_of, dt.time())
            cid = add('USER_CONSENT', dict(USER_ID=uid, CONSENT_TYPE_CODE='ALT_DATA_PROVISION', PROVIDER_CODE=provider,
                ITEM_CODE=item, REQUIRED_YN='N', AGREED_YN='Y' if agreed else 'N', TERMS_VERSION='DEV-0.2',
                EXTERNAL_CONSENT_ID=f'DUMMY-{code}-{item}' if agreed else None, AGREED_AT=consent_at if agreed else None,
                EXPIRES_AT=consent_at+dt.timedelta(days=365) if agreed else None, CREATED_AT=consent_at), 'CONSENT_ID')
            if agreed: consent_ids[code,item] = cid
        chosen = [current] if member['segment']=='wage' else ordered
        for r in chosen:
            add('USER_INCOME_MONTH', dict(USER_ID=uid, BASE_MONTH=r['month'],
                INCOME_KIND_CODE='SALARY' if member['segment']=='wage' else 'MONTHLY_INCOME', INCOME_AMT=int(r['income_krw']),
                INPUT_DATE=dt.date.fromisoformat(r['input_date'])), 'INCOME_ID')
        average = rounded(sum(Decimal(r['expense_total_krw']) for r in ordered)/12)
        add('USER_EXPENSE_ITEM', dict(USER_ID=uid, BASE_MONTH=BASE_MONTH, EXPENSE_GROUP_CODE='FIXED',
            EXPENSE_CATEGORY=None, DESCRIPTION='12개월 평균 월 지출(합성)', MONTHLY_AMT=average), 'EXPENSE_ID')
        asset = asset_by[code]
        if asset['base_month']!=BASE_MONTH: raise ValueError('자산 기준월 불일치')
        add('USER_ASSET_SNAPSHOT', map_asset_snapshot(uid, asset), 'ASSET_ID')

    # N-05-3 기관 응답 상태와 무관하게 전 회원 원장을 사용한다. 시작 미동의 회원분은 직접 입력으로 보존한다.
    # 대출 종류·금리 방식은 원장 members/ledgers/loans.csv의 loan_type_code·rate_type에서 읽는다(기관 응답 loanTypeCode와 같은 원천 값).
    # TODO(D-27): 대출 입력 항목 미확정. kind→종류 매핑은 가정(reference/loan_type_mapping.json), 열이 없는 옛 원천은 OTHER·UNKNOWN.
    for member in members:
        code = member['member_id']
        loans = [dict(balance_krw=int(r['balance_thousand'])*1000, annual_rate=r['annual_rate'],
                      remaining_months=r['remaining_months'], annual_service_krw=int(r['annual_service_thousand'])*1000,
                      loan_type_code=r.get('loan_type_code') or 'OTHER', rate_type=r.get('rate_type') or 'UNKNOWN')
                 for r in loans_by.get(code,[])]
        current = next(r for r in monthly[code] if r['month']==BASE_MONTH)
        payments = allocate_current_payment(int(current['debt_service_krw']),loans)
        for loan, payment in zip(loans,payments):
            rate = (Decimal(str(loan['annual_rate']))*100).quantize(Decimal('.001'), rounding=ROUND_HALF_UP)
            row = dict(USER_ID=ids[code], BASE_MONTH=BASE_MONTH, LOAN_TYPE_CODE=loan['loan_type_code'], BALANCE_AMT=int(loan['balance_krw']),
                ANNUAL_RATE_PCT=rate, RATE_TYPE_CODE=loan['rate_type'], REMAINING_MONTHS=int(loan['remaining_months']),
                MONTHLY_PAYMENT_AMT=payment, SOURCE_CODE='IMPORTED' if code in consenting else 'MANUAL')
            # 받은 DDL에는 이 열이 없다. 개정본에 생기면 직접 입력은 NULL, 불러온 행은 동의 ID를 연결한다.
            if 'CONSENT_ID' in tables['USER_LOAN']['columns']: row['CONSENT_ID']=consent_ids.get((code,'LOANS'))
            add('USER_LOAN',row,'LOAN_ID')
    set_asset_loan_flags(generated['USER_ASSET_SNAPSHOT'], generated['USER_LOAN'])
    for row in map_bill_rows(read_responses(source,'telecom_responses.jsonl'),ids,consent_ids,'TELECOM_BILL',as_of):
        add('USER_TELECOM_PAYMENT',row,'TELECOM_PAYMENT_ID')
    for row in map_bill_rows(read_responses(source,'utility_responses.jsonl'),ids,consent_ids,'UTILITY_BILL',as_of):
        add('USER_UTILITY_PAYMENT',row,'UTILITY_PAYMENT_ID')
    for js in read_responses(source,'payment_responses.jsonl'):
        code=js['member_id']
        if code not in consenting: continue
        if js['status']!='OK': raise ValueError('동의 회원 간편결제 응답이 OK가 아님')
        for r in js['months']:
            status=r['observation_status'].upper()
            add('USER_EASYPAY_USAGE',dict(USER_ID=ids[code], BASE_MONTH=r['month'], OBSERVATION_STATUS_CODE=status,
                PAYMENT_COUNT=None if status=='MISSING' else int(r['payment_count']),
                PAYMENT_AMT=None if status=='MISSING' else int(r['payment_amount_krw']),
                ACTIVE_DAYS=None if status=='MISSING' else int(r['active_days']),
                SOURCE_CODE='IMPORTED', CONSENT_ID=consent_ids[code,'EASYPAY'], BASE_DATE=as_of), 'EASYPAY_USAGE_ID')
    for js in read_responses(source,'public_insurance_responses.jsonl'):
        code=js['member_id']
        if code not in consenting: continue
        if js['status']!='OK': raise ValueError('동의 회원 사회보험 응답이 OK가 아님')
        for r in js['records']:
            optional = lambda k: int(r[k]) if r[k] is not None else None
            kind=r['insurance_type'].upper()
            add('USER_SOCIAL_INSURANCE_PAYMENT',dict(USER_ID=ids[code], INSURANCE_TYPE_CODE=kind, BASE_MONTH=r['month'],
                COVERAGE_STATUS_CODE=r['coverage_status'].upper(), PAYER_TYPE_CODE=r['payer_type'].upper(),
                BILLED_AMT=optional('billed_amount_krw'), INDIVIDUAL_AMT=optional('individual_responsibility_krw'), PAID_AMT=optional('paid_amount_krw'),
                DUE_DATE=dt.date.fromisoformat(r['due_date']) if r['due_date'] else None,
                PAID_DATE=dt.date.fromisoformat(r['paid_date']) if r['paid_date'] else None, PAYMENT_STATUS_CODE=r['payment_status'].upper(),
                SOURCE_CODE='IMPORTED', CONSENT_ID=consent_ids[code,kind], BASE_DATE=as_of),'SI_PAYMENT_ID')
    cards_by = {}
    for r in read_csv(source/'members/ledgers/card_monthly.csv'): cards_by.setdefault(r['member_id'],[]).append(r)
    for js in read_responses(source,'credit_bureau_responses.jsonl'):
        code=js['member_id']
        if code not in consenting: continue
        if js['status']!='OK': raise ValueError('동의 회원 신용평가사 응답이 OK가 아님')
        b=js['credit_info']; loans=loans_by.get(code,[]); cards=cards_by.get(code,[])
        optional=lambda k: int(b[k]) if b.get(k) is not None else None
        observed=bool(b.get('credit_usage_available',0))
        recent=[r for r in cards if r['month_offset']=='0' and r['available']=='1']
        spend=sum(rounded(Decimal(r['spend_thousand'])*1000) for r in recent) if observed and recent else None
        add('USER_CREDIT_PROFILE',dict(USER_ID=ids[code], BASE_DATE=as_of, CB_AVAILABLE_YN='Y' if b['cb_available'] else 'N',
            CB_GRADE=optional('CB'), CREDIT_HISTORY_DAYS=optional('credit_history_days'),
            RECENT_DELINQ_YN=None if b['SP'] is None else 'Y' if b['SP'] else 'N', DELINQ_COUNT_12M=optional('DQ1200001'),
            MAX_DELINQ_DAYS_3M=optional('KC5000016'), LOAN_COUNT=optional('L00000001'), LOAN_BALANCE_AMT=int(b['L00000002'])*1000,
            NEW_LOAN_COUNT_3M=sum(int(r['age_days'])<=90 for r in loans), CARD_LIMIT_AMT=estimate_card_limit(b),
            CARD_MONTHLY_SPEND_AMT=spend,
            CARD_UTIL_PCT=Decimal(str(b['CL0631905'])).quantize(Decimal('.01'),rounding=ROUND_HALF_UP) if b['CL0631905'] is not None else None,
            CASH_ADVANCE_MONTHS=sum(r['available']=='1' and Decimal(r['cash_thousand'] or '0')>0 for r in cards) if observed else None,
            PRIVATE_LENDER_LOAN_BALANCE_AMT=sum(int(r['balance_thousand'])*1000 for r in loans if r['sector']=='4'),
            SOURCE_CODE='IMPORTED',CONSENT_ID=consent_ids[code,'CREDIT_PROFILE']),'CREDIT_PROFILE_ID')

    missing = []
    for index, product in enumerate(products,1):
        row=dict(PRODUCT_ID=index, PRODUCT_CODE=product['product_id'], PROVIDER_NAME=product['provider_name'],
            PRODUCT_NAME=product['product_type']+' '+product['product_id'], PRODUCT_TYPE_NAME=product['product_type'],
            SUMMARY=product['product_type']+' 합성 참고 상품(실제 상품 아님)', DESCRIPTION='교육용 합성 데이터로 만든 참고 상품입니다.',
            RATE_MIN_PCT=Decimal(product['rate_min_pct']), RATE_MAX_PCT=Decimal(product['rate_max_pct']),
            LIMIT_MAX_AMT=int(product['limit_max_krw']), TERM_MIN_MONTHS=int(product['term_min_months']), TERM_MAX_MONTHS=int(product['term_max_months']),
            REPAYMENT_METHOD=None, MIN_ALT_SCORE=PRODUCT_MIN_SCORES[product['sector']], ELIGIBILITY_TEXT='·'.join(JOB_MAP[s] for s in product['eligible_segments'].split('|')),
            REQUIRED_DOCUMENTS='시연용: 소득 증빙', CAUTION_TEXT='더미 상품 · 실제 상품 아님', DUMMY_YN='Y', BASE_DATE=as_of)
        if 'TERM_TEXT' in tables['LOAN_PRODUCT']['columns']: row['TERM_TEXT']=f"{product['term_min_months']}~{product['term_max_months']}개월(시연)"
        else: missing.append('LOAN_PRODUCT.TERM_TEXT')
        add('LOAN_PRODUCT',row)
        for segment in product['eligible_segments'].split('|'):
            add('LOAN_PRODUCT_WORKER_TYPE',dict(PRODUCT_ID=index,WORKER_TYPE_CODE=JOB_MAP[segment]))
        if 'LOAN_PRODUCT_FEATURE' in tables:
            add('LOAN_PRODUCT_FEATURE',dict(PRODUCT_ID=index,DISPLAY_ORDER=1,FEATURE_TEXT='교육용 합성 참고 상품, 실제 상품 아님'))
        else: missing.append('LOAN_PRODUCT_FEATURE')
    for index,band in enumerate(rows['SCORE_GRADE_BAND'],1):
        # N-12·N-37 구간 최저점에서도 신청 조건을 만족하는 더미 상품만 모아 참고 범위를 계산한다.
        eligible=[r for r in generated['LOAN_PRODUCT'] if r['MIN_ALT_SCORE']<=band['MIN_SCORE']]
        if not eligible: raise ValueError('점수대에 해당하는 더미 상품이 없음')
        minimum=min(r['RATE_MIN_PCT'] for r in eligible);maximum=max(r['RATE_MAX_PCT'] for r in eligible)
        offer=dict(OFFER_ID=index,MIN_SCORE=band['MIN_SCORE'],MAX_SCORE=band['MAX_SCORE'],RATE_MIN_PCT=minimum,RATE_MAX_PCT=maximum,
                   LIMIT_AMT=max(r['LIMIT_MAX_AMT'] for r in eligible),BASE_DATE=as_of)
        if 'RATE_AVG_PCT' in tables['SCORE_BAND_OFFER']['columns']:
            offer['RATE_AVG_PCT']=((minimum+maximum)/2).quantize(Decimal('.001'),rounding=ROUND_HALF_UP)
        else: missing.append('SCORE_BAND_OFFER.RATE_AVG_PCT')
        add('SCORE_BAND_OFFER',offer)
    if demo_password is not None:
        # N-01-5 관리자 시연 계정: 더미 회원을 바꾸지 않고 새 행으로 추가한다. 회원 데이터 행(동의·소득 등)은 만들지 않는다.
        admin_name, admin_email = '시연 관리자', 'demo-admin@avenue.example'
        add('APP_USER', dict(USER_ID=max(ids.values())+1, LOGIN_ID=DEMO_ADMIN_LOGIN_ID, PASSWORD_HASH=bcrypt_hash(demo_password),
            NICKNAME='시연관리자', NAME_ENC=encrypt_text(admin_name,aes_key), PHONE_ENC=None, PHONE_HMAC=None,
            EMAIL_ENC=encrypt_text(admin_email,aes_key), EMAIL_HMAC=search_hmac(admin_email,'email',hmac_key),
            BIRTH_YEAR=None, WORKER_TYPE_CODE=None, WORK_PERIOD_MONTHS=None, ROLE_CODE='ROLE_ADMIN',
            ACCOUNT_STATUS_CODE='ACTIVE', DUMMY_YN='Y', CREATED_AT=dt.datetime.combine(as_of, dt.time())))
    for name in rows: rows[name].extend(generated[name])
    source_checks(source,members,inputs,generated,ids)
    return rows, generated, sorted(set(missing))


def map_asset_snapshot(uid, asset):
    """N-05-4 원천 총자산의 미입력(NULL)과 입력한 0원을 구분하여 보존한다."""
    amount=asset['total_asset_amt']
    return dict(USER_ID=uid, BASE_MONTH=asset['base_month'], TOTAL_ASSET_AMT=None if amount is None else int(amount))


def set_asset_loan_flags(assets, loans):
    """N-05-3·N-05-8 생성된 대출 행의 회원·기준월로 대출 없음 표시를 채운다."""
    loan_keys={(r['USER_ID'],r['BASE_MONTH']) for r in loans}
    for row in assets:
        row['NO_LOAN_YN']='N' if (row['USER_ID'],row['BASE_MONTH']) in loan_keys else 'Y'


def check_asset_loans(assets, loans):
    """N-05-3·N-05-8 완성된 시드의 대출 없음 표시를 회원·기준월의 실제 대출 행과 대조한다.
    NULL은 미입력이므로 완성된 시드에서는 Y로 간주하지 않고 거부한다."""
    loan_keys={(r['USER_ID'],r['BASE_MONTH']) for r in loans}
    asset_keys={(r['USER_ID'],r['BASE_MONTH']) for r in assets}
    if len(asset_keys)!=len(assets) or not loan_keys <= asset_keys:
        raise ValueError('자산·대출 회원·기준월 범위 불일치')
    for row in assets:
        expected='N' if (row['USER_ID'],row['BASE_MONTH']) in loan_keys else 'Y'
        if row.get('NO_LOAN_YN')!=expected:
            raise ValueError('NO_LOAN_YN·대출 생성 유무 불일치')


def source_checks(source, members, inputs, generated, ids):
    """N-05-3·4·8 회원·소득·지출·대출·대안 원장과 자산의 대출 없음 표시를 대조한다."""
    check_asset_loans(generated['USER_ASSET_SNAPSHOT'], generated['USER_LOAN'])
    if {r['USER_ID'] for r in generated['USER_ASSET_SNAPSHOT']}!=set(ids.values()):
        raise ValueError('자산 회원 범위 불일치')
    by_uid={v:k for k,v in ids.items()}; consenting={m['member_id'] for m in members if m['external_data_consent']=='1'}
    users=[r for r in generated['APP_USER'] if r['ROLE_CODE']=='ROLE_USER'];admins=[r for r in generated['APP_USER'] if r['ROLE_CODE']!='ROLE_USER']
    if {r['USER_ID'] for r in users}!=set(ids.values()) or len(users)!=len(ids): raise ValueError('회원 ID 원천 대조 실패')
    if len(admins)>1 or any(r['USER_ID'] in ids.values() or r['LOGIN_ID']!=DEMO_ADMIN_LOGIN_ID or r['ROLE_CODE']!='ROLE_ADMIN' for r in admins): raise ValueError('관리자 시연 계정 대조 실패')
    admin_ids={r['USER_ID'] for r in admins}
    for table,table_rows in generated.items():
        if table!='APP_USER' and any(r.get('USER_ID') in admin_ids for r in table_rows): raise ValueError('관리자 시연 계정에 회원 데이터 행이 있음')
    for m in members:
        code=m['member_id']; uid=ids[code]; original=[r for r in inputs if r['member_id']==code]
        expected=[r for r in original if m['segment']!='wage' or r['month']==BASE_MONTH]
        actual=[r for r in generated['USER_INCOME_MONTH'] if r['USER_ID']==uid]
        if len(actual)!=len(expected) or {(r['BASE_MONTH'],r['INCOME_AMT']) for r in actual}!={(r['month'],int(r['income_krw'])) for r in expected}:
            raise ValueError('직군별 소득 원천 대조 실패')
        expense=[r for r in generated['USER_EXPENSE_ITEM'] if r['USER_ID']==uid]
        mean=rounded(sum(Decimal(r['expense_total_krw']) for r in original)/12)
        if len(expense)!=1 or expense[0]['EXPENSE_GROUP_CODE']!='FIXED' or expense[0]['MONTHLY_AMT']!=mean: raise ValueError('평균 월 지출 원천 대조 실패')
        loans=[r for r in generated['USER_LOAN'] if r['USER_ID']==uid]
        current=next(r for r in original if r['month']==BASE_MONTH)
        if sum(r['MONTHLY_PAYMENT_AMT'] for r in loans)!=int(current['debt_service_krw']): raise ValueError('전 회원 기준월 상환 합계 원천 대조 실패')
        if any(r['SOURCE_CODE']!=('IMPORTED' if code in consenting else 'MANUAL') for r in loans): raise ValueError('대출 시작 동의 상태·출처 불일치')
    expected={}
    for r in read_csv(source/'members/ledgers/loans.csv'):
        expected[r['member_id']]=expected.get(r['member_id'],0)+int(r['balance_thousand'])*1000
    actual={}
    for r in generated['USER_LOAN']:
        code=by_uid[r['USER_ID']];actual[code]=actual.get(code,0)+r['BALANCE_AMT']
    if expected!=actual: raise ValueError('대출 잔액 원장 대조 실패')
    # v0.3.1 (U2) 미납 = LATE + UNPAID. 달마다, 그리고 합계로 원장과 맞춘다.
    for filename,col,table in [('telecom_monthly.csv','telecom_late','USER_TELECOM_PAYMENT'),('utility_monthly.csv','utility_late','USER_UTILITY_PAYMENT')]:
        ledger={(r['member_id'],r['month']):r[col]=='1' for r in read_csv(source/'members/ledgers'/filename) if r['member_id'] in consenting}
        got={(by_uid[r['USER_ID']],r['BILL_MONTH']):r['PAYMENT_STATUS_CODE'] in ('LATE','UNPAID') for r in generated[table]}
        if len(got)!=len(generated[table]) or got!=ledger or sum(got.values())!=sum(ledger.values()):
            raise ValueError(table+': 미납 원장 대조 실패')
    for filename,table,src_col,dst_col,extra in [
        ('digital_payment_monthly.csv','USER_EASYPAY_USAGE','payment_amount_krw','PAYMENT_AMT',None),
        ('social_insurance_monthly.csv','USER_SOCIAL_INSURANCE_PAYMENT','paid_amount_krw','PAID_AMT','insurance_type')]:
        expected={}
        for r in read_csv(source/'members/ledgers'/filename):
            if r['member_id'] not in consenting: continue
            key=(r['member_id'],r['month'],r[extra].upper() if extra else '')
            expected[key]=int(r[src_col]) if r[src_col] is not None else None
        actual={(by_uid[r['USER_ID']],r['BASE_MONTH'],r['INSURANCE_TYPE_CODE'] if extra else ''):r[dst_col] for r in generated[table]}
        if expected!=actual: raise ValueError(table + ': 원장 금액·행 수 대조 실패')
    bureau={r['member_id']:r for r in read_csv(source/'members/ledgers/credit_bureau.csv')}
    if {by_uid[r['USER_ID']] for r in generated['USER_CREDIT_PROFILE']}!=consenting: raise ValueError('신용평가사 동의 회원 범위 불일치')
    for r in generated['USER_CREDIT_PROFILE']:
        b=bureau[by_uid[r['USER_ID']]]
        for field,col in [('CB_GRADE','CB'),('DELINQ_COUNT_12M','DQ1200001'),('MAX_DELINQ_DAYS_3M','KC5000016')]:
            if r[field]!=(int(Decimal(b[col])) if b[col] is not None else None): raise ValueError('신용평가사 항목 원장 대조 실패')
        if r['LOAN_BALANCE_AMT']!=int(Decimal(b['L00000002']))*1000: raise ValueError('신용평가사 잔액 원장 대조 실패')


def sql_value(value):
    """Oracle 시드 리터럴을 만들고 문자열의 따옴표를 이스케이프한다."""
    if value is None: return 'NULL'
    if isinstance(value,dt.datetime): return "TIMESTAMP '"+value.strftime('%Y-%m-%d %H:%M:%S')+"'"
    if isinstance(value,dt.date): return "DATE '"+value.isoformat()+"'"
    if isinstance(value,(int,Decimal)): return format(value,'f') if isinstance(value,Decimal) else str(value)
    return "'"+value.replace("'","''")+"'"


def bundle_files(ddl_bytes, tables, all_rows, generated, missing):
    """검사 완료된 행에서 실행·정리·시드·행 수 점검 SQL을 준비한다. 이 함수는 파일을 쓰지 않는다."""
    header='-- N-05·N-37 서비스 DB 합성 시드 (DDL: docs/spec/sql/avenue_ddl.sql). 별도 개발 스키마 권장.\nSET DEFINE OFF\n'
    files={'01_create_tables.sql':ddl_bytes}
    # N-05 옛 DB와 이름이 겹치는 테이블을 지우기 전에 중단한다. 단독 실행에도 SQL 오류 즉시 종료를 적용한다.
    markers=', '.join("'"+name+"'" for name in LEGACY_TABLE_MARKERS)
    drop=header+'WHENEVER SQLERROR EXIT FAILURE ROLLBACK\n'
    drop+=f"DECLARE legacy_count PLS_INTEGER;\nBEGIN\n  SELECT COUNT(*) INTO legacy_count FROM USER_TABLES WHERE TABLE_NAME IN ({markers});\n"
    drop+="  IF legacy_count > 0 THEN RAISE_APPLICATION_ERROR(-20001, '옛 더미 DB가 있습니다. 별도 개발 스키마에서 실행하세요.'); END IF;\nEND;\n/\n"
    for name in reversed(tables):
        drop+=f"BEGIN EXECUTE IMMEDIATE 'DROP TABLE {name} CASCADE CONSTRAINTS PURGE';\nEXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;\n/\n"
    files['00_drop_all.sql']=drop.encode('utf-8')
    seed_files=[]
    seed_tables=[]
    for index,(name,table) in enumerate((x for x in tables.items() if generated[x[0]]),10):
        cols=[c for c in table['columns'] if any(c in row for row in generated[name])]
        body=header+f'-- {name}: {len(generated[name])}행\n'
        for n,row in enumerate(generated[name],1):
            body+=f"INSERT INTO {name} ({', '.join(cols)}) VALUES ({', '.join(sql_value(row.get(c)) for c in cols)});\n"
            if n%500==0: body+='COMMIT;\n'
        body+='COMMIT;\n'
        for col,spec in table['columns'].items():
            if spec['identity'] and col in cols:
                body+=f'ALTER TABLE {name} MODIFY ({col} GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH LIMIT VALUE));\n'
        filename=f'{index:02d}_seed_{name.lower()}.sql';files[filename]=body.encode('utf-8');seed_files.append(filename);seed_tables.append(name)
    names=', '.join("'"+t+"'" for t in tables)
    check=header+f"SELECT {len(tables)} AS EXPECTED_TABLES, COUNT(*) AS ACTUAL_TABLES FROM USER_TABLES WHERE TABLE_NAME IN ({names});\n\n"
    check+='\nUNION ALL\n'.join(f"SELECT '{name}' AS TABLE_NAME, {len(all_rows[name])} AS EXPECTED, (SELECT COUNT(*) FROM {name}) AS ACTUAL FROM DUAL" for name in tables)+';\n'
    check+=f"SELECT TABLE_NAME, COLUMN_NAME FROM USER_COL_COMMENTS WHERE COMMENTS IS NULL AND TABLE_NAME IN ({names}) ORDER BY TABLE_NAME, COLUMN_NAME;\n"
    files['99_check.sql']=check.encode('utf-8')
    run=header+'WHENEVER SQLERROR EXIT FAILURE ROLLBACK\nWHENEVER OSERROR EXIT FAILURE ROLLBACK\n'
    run+=''.join('@@'+name+'\n' for name in ['00_drop_all.sql','01_create_tables.sql']+seed_files+['99_check.sql'])
    files['run_all.sql']=run.encode('utf-8')
    # N-05 최초 적재 전에 시드 대상 표가 모두 존재하고 비었는지 검사한다.
    seed_names=', '.join("'"+name+"'" for name in seed_tables)
    seed_only=header+'WHENEVER SQLERROR EXIT FAILURE ROLLBACK\nWHENEVER OSERROR EXIT FAILURE ROLLBACK\n'
    seed_only+='-- N-05 확정 DDL 실행 후 빈 시드 대상 표에만 최초 적재한다.\n'
    seed_only+='DECLARE\n  table_count PLS_INTEGER;\n  row_count PLS_INTEGER;\nBEGIN\n'
    seed_only+=f'  FOR t IN (SELECT COLUMN_VALUE AS table_name FROM TABLE(SYS.ODCIVARCHAR2LIST({seed_names}))) LOOP\n'
    seed_only+="    SELECT COUNT(*) INTO table_count FROM USER_TABLES WHERE TABLE_NAME = t.table_name;\n"
    seed_only+="    IF table_count != 1 THEN RAISE_APPLICATION_ERROR(-20002, '시드 대상 테이블이 없습니다: ' || t.table_name); END IF;\n"
    seed_only+="    EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM ' || t.table_name || ' WHERE ROWNUM = 1' INTO row_count;\n"
    seed_only+="    IF row_count != 0 THEN RAISE_APPLICATION_ERROR(-20003, '시드 대상 테이블이 비어 있지 않습니다: ' || t.table_name); END IF;\n"
    seed_only+='  END LOOP;\nEND;\n/\n'
    seed_only+=''.join('@@'+name+'\n' for name in seed_files+['99_check.sql'])
    files['run_seed_only.sql']=seed_only.encode('utf-8')
    report=dict(ddl_sha256=hashlib.sha256(ddl_bytes).hexdigest(),table_count=len(tables),
                rows={name:len(all_rows[name]) for name in tables},omitted_missing_ddl=missing,base_month=BASE_MONTH,
                privacy='AES-256-GCM random IV per value, "v1:" + Base64(IV+ciphertext+16-byte tag), HMAC-SHA256 without prefix; no keys in output',
                unpaid={t:sum(r['PAYMENT_STATUS_CODE']=='UNPAID' for r in all_rows[t]) for t in ('USER_TELECOM_PAYMENT','USER_UTILITY_PAYMENT') if t in all_rows},
                card_spend_over_limit=sum(r['CARD_MONTHLY_SPEND_AMT'] > r['CARD_LIMIT_AMT'] for r in all_rows['USER_CREDIT_PROFILE'] if r['CARD_MONTHLY_SPEND_AMT'] is not None and r['CARD_LIMIT_AMT'] is not None),
                demo_login_ids=sorted(r['LOGIN_ID'] for r in all_rows['APP_USER'] if r.get('PASSWORD_HASH')),
                note='ASSESSMENT empty. Demo accounts use BCrypt $2a$ cost 10; password not stored in output.')
    files['seed_report.json']=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    files['README.md']=(Path(__file__).resolve().parents[1]/'README.md').read_bytes()
    for name,body in files.items():
        if name.endswith('.sql') and name!='01_create_tables.sql' and any(len(line)>2499 for line in body.decode('utf-8').splitlines()):
            raise ValueError(name+': SQL*Plus 줄 길이 초과')
    return files, report


def generate(source, output, ddl_path, environ=None):
    """N-05·N-37 키·시연 비밀번호·DDL·원천·행 제약을 모두 통과한 뒤에만 새 SQL 파일을 저장한다.
    출력은 저장소의 dummy_db 폴더 또는 저장소 밖의 별도 폴더만 허용한다."""
    keys=load_keys(environ);demo_password=load_demo_password(environ)
    ddl_bytes=Path(ddl_path).read_bytes();tables,base_rows=parse_ddl(ddl_bytes.decode('utf-8-sig'))
    if not tables: raise ValueError('DDL에 CREATE TABLE이 없습니다')
    rows,generated,missing=build_seed_rows(Path(source),tables,base_rows,keys,demo_password)
    complete=validate_rows(tables,rows)
    if complete['ASSESSMENT'] or complete['ASSESSMENT_FACTOR']: raise ValueError('평가 시드는 비워야 함')
    files,report=bundle_files(ddl_bytes,tables,complete,generated,missing)
    out=Path(output).resolve();src=Path(source).resolve()
    if out==src or out in src.parents or src in out.parents: raise ValueError('출력 폴더는 원천 폴더와 분리해야 합니다')
    db_root=Path(__file__).resolve().parents[1]
    repo_root=db_root.parents[3]
    temp_root=Path(tempfile.gettempdir()).resolve()
    if out != db_root and (temp_root not in out.parents or repo_root == out or repo_root in out.parents):
        raise ValueError('출력은 dummy_db 폴더 또는 저장소 밖 임시 폴더여야 합니다')
    if Path(output).is_symlink(): raise ValueError('출력 심볼릭 링크는 허용하지 않습니다')
    out.mkdir(parents=True,exist_ok=True)
    for name,body in files.items():
        target=out/name
        if target.is_symlink(): raise ValueError('출력 파일 심볼릭 링크는 허용하지 않습니다')
    write_all_or_nothing(out,files)
    return report


def write_all_or_nothing(out, files):
    """모든 파일을 임시 파일로 먼저 쓰고, 전부 성공했을 때만 한꺼번에 교체한다. 실패하면 임시 파일을 지우고 기존 파일을 되돌린다."""
    temps={}
    try:
        for name,body in files.items():
            with tempfile.NamedTemporaryFile(dir=out,prefix=name+'.',suffix='.tmp',delete=False) as handle:
                temps[name]=Path(handle.name);handle.write(body)
    except BaseException:
        for temp in temps.values(): temp.unlink(missing_ok=True)
        raise
    backups,replaced={},[]
    try:
        for name in files:
            target=out/name
            if target.exists():
                backup=target.with_name(target.name+'.bak.tmp');target.replace(backup);backups[name]=backup
            temps[name].replace(target);replaced.append(name)
    except BaseException:
        for name in replaced: (out/name).unlink(missing_ok=True)
        for name,backup in backups.items(): backup.replace(out/name)
        for temp in temps.values(): temp.unlink(missing_ok=True)
        raise
    for backup in backups.values(): backup.unlink(missing_ok=True)


def main():
    """N-05 서비스 DB 시드 CLI다. 키는 인자로 받지 않고 실패 시 값 없는 오류만 출력한다."""
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',help='service_dummy 폴더')
    parser.add_argument('output',help='dummy_db 또는 저장소 밖 임시 출력 폴더')
    parser.add_argument('--ddl',default=str(Path(__file__).resolve().parents[2]/'avenue_ddl.sql'))
    parser.add_argument('--env-file',help='키·시연 비밀번호를 읽을 저장소 밖 env 파일 (없으면 환경변수)')
    args=parser.parse_args()
    try:
        environ=read_env_file(args.env_file) if args.env_file else None
        report=generate(args.source,args.output,args.ddl,environ)
    except (ValueError,KeyError,OSError,ArithmeticError) as error:
        print('시드 생성 중단: '+str(error),file=sys.stderr);return 1
    except ModuleNotFoundError:
        print('데이터 생성 requirements.txt의 cryptography·bcrypt 설치가 필요합니다',file=sys.stderr);return 1
    print(json.dumps({'table_count':report['table_count'],'rows':report['rows'],'omitted_missing_ddl':report['omitted_missing_ddl'],
                      'card_spend_over_limit':report['card_spend_over_limit']},ensure_ascii=False,indent=2))
    return 0


if __name__=='__main__':
    sys.exit(main())
