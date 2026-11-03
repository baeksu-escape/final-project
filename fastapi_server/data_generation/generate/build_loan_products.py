"""Dummy loan product catalogue for the service. Fictional providers only."""
from pathlib import Path
import argparse, json
import numpy as np
from generate.service_dummy_logic import expand_loan_products, check_loan_products

ROOT = Path(__file__).resolve().parents[1]


def run(out, seed=20261102):
    anchors = json.loads((ROOT/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))
    products = expand_loan_products(anchors, np.random.default_rng(seed))
    errors = check_loan_products(products, anchors)
    if errors:
        raise ValueError('; '.join(errors))
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    products.to_csv(out/'loan_products.csv', index=False, encoding='utf-8-sig')
    print(f'loan_products.csv: {len(products)} products')
    return products


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(ROOT/'service_dummy'))
    ap.add_argument('--seed', type=int, default=20261102)
    a = ap.parse_args(); run(a.out, a.seed)
