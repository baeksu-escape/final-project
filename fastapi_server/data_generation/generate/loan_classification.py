"""대출 종류와 금리 방식의 재현 가능한 시연 규칙이다."""
import hashlib
import json
from pathlib import Path

MAPPING = json.loads((Path(__file__).resolve().parents[1] / 'reference/loan_type_mapping.json').read_text(encoding='utf-8'))

def loan_type_code(kind, sector):
    """N-05-3 원천 종류와 업권을 DB 대출 종류로 변환한다."""
    code = MAPPING['kind'][str(int(kind))]
    return MAPPING['card_unsecured_code'] if int(kind) == 0 and int(sector) == MAPPING['card_sector'] else code

def rate_type(account_id):
    """계좌 ID의 SHA-256 앞 8자리 홀짝으로 금리 방식을 정한다."""
    return 'variable' if int(hashlib.sha256(account_id.encode()).hexdigest()[:8], 16) % 2 else 'fixed'

def check_loan_classification(loans):
    """원장의 두 코드가 원천과 결정적 규칙에 일치하는지 검사한다."""
    for row in loans.itertuples(index=False):
        if row.loan_type_code != loan_type_code(row.kind, row.sector) or row.rate_type != rate_type(row.account_id).upper():
            return [f'loan classification mismatch {row.account_id}']
    return []
