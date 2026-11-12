"""N-05-3 서비스 대출 원장과 기관 응답의 분류 일치를 검증한다."""
import argparse
import json
from pathlib import Path
import pandas as pd
from generate.loan_classification import check_loan_classification


def verify(base):
    """생성된 모든 대출 계좌의 종류·금리 규칙과 기관 응답을 대조한다."""
    base = Path(base)
    loans = pd.read_csv(base / 'members/ledgers/loans.csv', encoding='utf-8-sig')
    errors = check_loan_classification(loans)
    expected = {(r.member_id, r.account_id): (r.loan_type_code, r.rate_type) for r in loans.itertuples(index=False)}
    found = []
    for line in (base / 'external_api/financial_responses.jsonl').read_text(encoding='utf-8').splitlines():
        response = json.loads(line)
        for loan in response['loans']:
            key = (response['member_id'], loan['account_id'])
            found.append(key)
            if expected.get(key) != (loan.get('loan_type_code'), loan.get('rate_type')):
                errors.append(f'response mismatch {key}')
    if len(found) != len(expected) or len(set(found)) != len(found) or set(found) != set(expected):
        errors.append('loan account set mismatch')
    if errors:
        raise ValueError('; '.join(errors))
    print(f'OK: {len(found)} loan accounts')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True)
    verify(parser.parse_args().base)
