# N-24-2 상권 원본 정제 스크립트 — 서울 열린데이터광장 원본(점포·추정매출·생활인구)을 읽어
# 상권 분석 화면(N-24-3·4·5)이 바로 그릴 수 있는 정적 JSON을 만든다. (FP-176)
#
# 실행 (저장소 루트에서):
#   python -I -X utf8 frontend/scripts/market/build_market_data.py --raw C:\workspace\data_raw\market --out frontend/public/data/market
# 원본 받는 방법은 같은 폴더의 README.md 참고.

import argparse
import glob
import json
import os
import zipfile

import pandas as pd

# 화면 기준 분기와 추이에 쓰는 분기. 상권 원본에 2026년 자료가 없어 2025-Q4가 최신이다.
BASE_QUARTER = '2025-Q4'
TREND_QUARTERS = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4']

# 지도 업종 칩 8개 → 원본 서비스 업종 코드. 점포·매출 자료가 둘 다 있는 업종만 묶었다(11/13 결정).
CATEGORIES = [
    ('CAFE', '커피·음료', ['CS100010']),
    ('FOOD', '치킨·음식점', ['CS100001', 'CS100002', 'CS100003', 'CS100004', 'CS100006', 'CS100007', 'CS100008']),
    ('FASHION', '의류·패션', ['CS300011', 'CS300014', 'CS300015']),
    ('CONV', '편의점', ['CS300002', 'CS300001']),
    ('BEAUTY', '미용·뷰티', ['CS200028', 'CS200029', 'CS200030', 'CS300022']),
    ('BAKERY', '베이커리·디저트', ['CS100005']),
    ('PUB', '호프·주점', ['CS100009']),
    ('EDU', '학원·교육', ['CS200001', 'CS200002', 'CS200003']),
]

# 지표 정의. higher_is_better가 False면 낮을수록 좋은 지표(순위·색 방향이 반대).
METRICS = [
    ('storeCount', '점포 수', '곳', True),
    ('openRate', '개업률', '%', True),
    ('closeRate', '분기 폐업률', '%', False),
    ('salesPerStore', '점포당 분기 매출', '원', True),
    ('salesYoY', '매출 전년비', '%', True),
    ('storeYoY', '점포 수 증감', '%', True),
    ('livingPopYoY', '유동인구 증감', '%', True),
]

# 행정동 코드 앞 5자리(행정안전부 시군구 코드) → 구 이름.
GU_BY_CODE = {
    '11110': '종로구', '11140': '중구', '11170': '용산구', '11200': '성동구', '11215': '광진구',
    '11230': '동대문구', '11260': '중랑구', '11290': '성북구', '11305': '강북구', '11320': '도봉구',
    '11350': '노원구', '11380': '은평구', '11410': '서대문구', '11440': '마포구', '11470': '양천구',
    '11500': '강서구', '11530': '구로구', '11545': '금천구', '11560': '영등포구', '11590': '동작구',
    '11620': '관악구', '11650': '서초구', '11680': '강남구', '11710': '송파구', '11740': '강동구',
}

# 생활인구 원본의 강북구 코드 → 상권 원본 코드. 두 원본의 강북구 6개 동 코드가 달라
# 코드 순서대로 짝지었다(추정, 11/13 결정). 구로구 항동(11530800)은 생활인구 원본에 없어 '자료 없음'.
LIVING_POP_CODE_FIX = {
    '11305590': '11305595',  # 번1동
    '11305600': '11305603',  # 번2동
    '11305606': '11305608',  # 번3동
    '11305610': '11305615',  # 수유1동
    '11305620': '11305625',  # 수유2동
    '11305630': '11305635',  # 수유3동
}

EXPECTED_DONG_COUNT = 425


def to_quarter(code):
    """원본 분기 코드 20254 → '2025-Q4'."""
    text = str(code)
    return f'{text[:4]}-Q{text[4]}'


def year_ago(quarter):
    """'2025-Q4' → '2024-Q4' (전년 같은 분기)."""
    return f'{int(quarter[:4]) - 1}{quarter[4:]}'


def ratio(numerator, denominator, scale=100.0):
    """분모가 없거나 0이면 None, 아니면 소수 1자리로 반올림한 비율."""
    if numerator is None or denominator is None or denominator == 0:
        return None
    return round(numerator / denominator * scale, 1)


def change_rate(now, before):
    """전년 대비 증감률(%). 전년 값이 없거나 0이면 None."""
    if now is None or before is None or before == 0:
        return None
    return round((now - before) / before * 100, 1)


def read_market_csv(folder, columns):
    """상권 원본(cp949 CSV)을 연도별로 읽어 합친다."""
    paths = sorted(glob.glob(os.path.join(folder, '*.csv')))
    if not paths:
        raise SystemExit(f'원본 CSV가 없습니다: {folder}')
    frames = [pd.read_csv(p, encoding='cp949', usecols=columns,
                          dtype={'행정동_코드': str, '서비스_업종_코드': str}) for p in paths]
    df = pd.concat(frames, ignore_index=True)
    df['quarter'] = df['기준_년분기_코드'].map(to_quarter)
    return df


def add_category(df):
    """원본 업종 코드에 칩 코드를 붙이고, 칩에 없는 업종은 버린다."""
    source_to_chip = {src: chip for chip, _, sources in CATEGORIES for src in sources}
    df = df[df['서비스_업종_코드'].isin(source_to_chip)].copy()
    df['category'] = df['서비스_업종_코드'].map(source_to_chip)
    return df


def read_living_pop_month(path):
    """생활인구 월 파일 하나를 읽는다. 대부분 utf-8이지만 2025-09 파일처럼 cp949인 달이 있다."""
    for encoding in ('utf-8-sig', 'cp949'):
        try:
            with zipfile.ZipFile(path) as zf:
                with zf.open(zf.namelist()[0]) as fp:
                    # 원본 머리글보다 값이 하나 많은 줄이 있어 index_col=False로 앞에서부터 맞춘다.
                    return pd.read_csv(fp, encoding=encoding, usecols=['행정동코드', '총생활인구수'],
                                       dtype={'행정동코드': str}, index_col=False)
        except UnicodeDecodeError:
            continue
    raise SystemExit(f'생활인구 원본 글자 인코딩을 알 수 없습니다: {path}')


def read_living_pop(folder, quarters):
    """생활인구 월별 zip을 압축 해제 없이 읽어 동·분기별 일평균 생활인구를 구한다."""
    months = {f'{q[:4]}{m:02d}': q for q in quarters for m in range(int(q[-1]) * 3 - 2, int(q[-1]) * 3 + 1)}
    sums = {}  # (분기, 상권 동 코드) → [합계, 행 수]
    for month, quarter in sorted(months.items()):
        path = os.path.join(folder, f'LOCAL_PEOPLE_DONG_{month}.zip')
        if not os.path.exists(path):
            raise SystemExit(f'생활인구 원본이 없습니다: {path}')
        df = read_living_pop_month(path)
        df['행정동코드'] = df['행정동코드'].replace(LIVING_POP_CODE_FIX)
        grouped = df.groupby('행정동코드')['총생활인구수'].agg(['sum', 'count'])
        for dong, row in grouped.iterrows():
            total = sums.setdefault((quarter, dong), [0.0, 0])
            total[0] += row['sum']
            total[1] += row['count']
    return {key: value[0] / value[1] for key, value in sums.items()}


def build_dong_metrics(stores, sales, living, quarter, dong, chip):
    """동 하나·칩 하나·분기 하나의 지표 7개를 계산한다."""
    store = stores.get((quarter, dong, chip))
    store_before = stores.get((year_ago(quarter), dong, chip))
    store_count = store['점포_수'] if store else 0
    sale = sales.get((quarter, dong, chip))
    sale_before = sales.get((year_ago(quarter), dong, chip))
    return {
        'storeCount': int(store_count),
        'openRate': ratio(store['개업_점포_수'], store_count) if store else None,
        'closeRate': ratio(store['폐업_점포_수'], store_count) if store else None,
        'salesPerStore': round(sale / store_count) if sale is not None and store_count else None,
        'salesYoY': change_rate(sale, sale_before),
        'storeYoY': change_rate(store_count, store_before['점포_수'] if store_before else None),
        'livingPopYoY': change_rate(living.get((quarter, dong)), living.get((year_ago(quarter), dong))),
    }


def build_area_metrics(stores, sales, living, quarter, dongs, chip):
    """서울 전체 또는 구 하나의 지표를 합계 기준으로 계산한다(11/13 결정: 합계 ÷ 합계)."""
    def total(table, q, column=None):
        values = [table.get((q, d, chip)) for d in dongs]
        values = [v[column] if column else v for v in values if v is not None]
        return sum(values) if values else None

    store_count = total(stores, quarter, '점포_수') or 0
    sales_now = total(sales, quarter)
    # 점포당 매출은 매출 자료가 있는 동의 점포만 분모로 쓴다.
    stores_with_sales = sum(stores[(quarter, d, chip)]['점포_수'] for d in dongs
                            if (quarter, d, chip) in stores and (quarter, d, chip) in sales)
    pop_now = [living.get((quarter, d)) for d in dongs]
    pop_before = [living.get((year_ago(quarter), d)) for d in dongs]
    pop_pairs = [(n, b) for n, b in zip(pop_now, pop_before) if n is not None and b is not None]
    return {
        'storeCount': int(store_count),
        'dongAvgStoreCount': round(store_count / len(dongs), 1),
        'openRate': ratio(total(stores, quarter, '개업_점포_수'), store_count),
        'closeRate': ratio(total(stores, quarter, '폐업_점포_수'), store_count),
        'salesPerStore': round(sales_now / stores_with_sales) if sales_now and stores_with_sales else None,
        'salesYoY': change_rate(sales_now, total(sales, year_ago(quarter))),
        'storeYoY': change_rate(store_count, total(stores, year_ago(quarter), '점포_수')),
        'livingPopYoY': change_rate(sum(n for n, _ in pop_pairs), sum(b for _, b in pop_pairs)) if pop_pairs else None,
    }


def rank_values(values, higher_is_better):
    """{동: 값} → {동: 순위}. 값이 없는 동은 빼고, 같은 값은 같은 순위."""
    valid = {k: v for k, v in values.items() if v is not None}
    ordered = sorted(valid.values(), reverse=higher_is_better)
    first_rank = {}
    for index, value in enumerate(ordered, start=1):
        first_rank.setdefault(value, index)
    return {k: first_rank[v] for k, v in valid.items()}


def check(result, dongs):
    """파일을 쓰기 전에 결과가 예상한 모양인지 확인한다. 하나라도 어긋나면 멈춘다."""
    errors = []
    if len(dongs) != EXPECTED_DONG_COUNT:
        errors.append(f'행정동 수 {len(dongs)}개 (예상 {EXPECTED_DONG_COUNT})')
    if sorted(result) != sorted(chip for chip, _, _ in CATEGORIES):
        errors.append('업종 칩 8개가 모두 만들어지지 않았습니다')
    for chip, data in result.items():
        if sorted(data['seoul']) != TREND_QUARTERS:
            errors.append(f'{chip}: 분기 목록이 다릅니다')
        for dong, item in data['dongs'].items():
            for quarter, metrics in item['quarters'].items():
                if metrics['storeCount'] < 0:
                    errors.append(f'{chip} {dong} {quarter}: 점포 수가 음수')
                for key in ('openRate', 'closeRate'):
                    if metrics[key] is not None and metrics[key] < 0:
                        errors.append(f'{chip} {dong} {quarter}: {key}가 음수')
    if errors:
        raise SystemExit('점검 실패:\n- ' + '\n- '.join(errors[:20]))


def write_json(path, data):
    """키를 정렬하고 공백 없이 저장해, 다시 돌려도 같은 파일이 나오게 한다."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as fp:
        json.dump(data, fp, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def main():
    parser = argparse.ArgumentParser(description='N-24 상권 원본 → 화면용 정적 JSON')
    parser.add_argument('--raw', required=True, help='원본 폴더 (store/, sales/, living_pop/ 포함)')
    parser.add_argument('--out', required=True, help='결과 폴더 (frontend/public/data/market)')
    args = parser.parse_args()

    store_df = add_category(read_market_csv(os.path.join(args.raw, 'store'), [
        '기준_년분기_코드', '행정동_코드', '행정동_코드_명', '서비스_업종_코드', '점포_수', '개업_점포_수', '폐업_점포_수']))
    sales_df = add_category(read_market_csv(os.path.join(args.raw, 'sales'), [
        '기준_년분기_코드', '행정동_코드', '서비스_업종_코드', '당월_매출_금액']))

    # 행정동 목록: 상권 원본 전체(업종 무관) 기준, 이름은 가장 최근 분기 것을 쓴다.
    all_store = read_market_csv(os.path.join(args.raw, 'store'), ['기준_년분기_코드', '행정동_코드', '행정동_코드_명'])
    latest = all_store.sort_values('quarter').drop_duplicates('행정동_코드', keep='last')
    unknown_gu = sorted({c[:5] for c in latest['행정동_코드']} - set(GU_BY_CODE))
    if unknown_gu:
        raise SystemExit(f'구 이름을 모르는 코드: {unknown_gu}')
    dongs = sorted(({'code': r['행정동_코드'], 'name': r['행정동_코드_명'], 'gu': GU_BY_CODE[r['행정동_코드'][:5]]}
                    for _, r in latest.iterrows()), key=lambda d: d['code'])
    dong_codes = [d['code'] for d in dongs]
    gu_of = {d['code']: d['gu'] for d in dongs}
    gu_names = sorted(set(gu_of.values()))

    # (분기, 동, 칩) 단위로 합산해 사전으로 둔다.
    stores = store_df.groupby(['quarter', '행정동_코드', 'category'])[['점포_수', '개업_점포_수', '폐업_점포_수']].sum()
    stores = {key: row.to_dict() for key, row in stores.iterrows()}
    sales = sales_df.groupby(['quarter', '행정동_코드', 'category'])['당월_매출_금액'].sum()
    sales = {key: float(value) for key, value in sales.items()}
    living_quarters = sorted(set(TREND_QUARTERS) | {year_ago(q) for q in TREND_QUARTERS})
    living = read_living_pop(os.path.join(args.raw, 'living_pop'), living_quarters)

    result = {}
    for chip, _, _ in CATEGORIES:
        dong_items = {}
        for dong in dong_codes:
            dong_items[dong] = {'quarters': {q: build_dong_metrics(stores, sales, living, q, dong, chip)
                                             for q in TREND_QUARTERS}, 'rank': {}}
        rank_total = {}
        for key, _, _, higher_is_better in METRICS:
            values = {d: dong_items[d]['quarters'][BASE_QUARTER][key] for d in dong_codes}
            seoul_rank = rank_values(values, higher_is_better)
            rank_total[key] = {'seoul': len(seoul_rank), 'gu': {}}
            for gu in gu_names:
                gu_rank = rank_values({d: v for d, v in values.items() if gu_of[d] == gu}, higher_is_better)
                rank_total[key]['gu'][gu] = len(gu_rank)
                for d in gu_rank:
                    dong_items[d]['rank'][key] = {'seoul': seoul_rank[d], 'gu': gu_rank[d]}
        result[chip] = {
            'category': chip,
            'seoul': {q: build_area_metrics(stores, sales, living, q, dong_codes, chip) for q in TREND_QUARTERS},
            'gu': {gu: {q: build_area_metrics(stores, sales, living, q, [d for d in dong_codes if gu_of[d] == gu], chip)
                        for q in TREND_QUARTERS} for gu in gu_names},
            'dongs': dong_items,
            'rankTotal': rank_total,
        }

    check(result, dongs)

    # 상세 창 업종 순위표용: 동마다 기준 분기 칩 8개 요약.
    dong_categories = {}
    for dong in dong_codes:
        dong_categories[dong] = {}
        for chip, _, _ in CATEGORIES:
            item = result[chip]['dongs'][dong]
            metrics = item['quarters'][BASE_QUARTER]
            dong_categories[dong][chip] = {
                'storeCount': metrics['storeCount'],
                'salesPerStore': metrics['salesPerStore'],
                'salesYoY': metrics['salesYoY'],
                'closeRate': metrics['closeRate'],
                'salesYoYRankSeoul': item['rank'].get('salesYoY', {}).get('seoul'),
            }

    meta = {
        'baseQuarter': BASE_QUARTER,
        'quarters': TREND_QUARTERS,
        'categories': [{'code': c, 'name': n, 'sourceCodes': s} for c, n, s in CATEGORIES],
        'metrics': [{'key': k, 'name': n, 'unit': u, 'higherIsBetter': h} for k, n, u, h in METRICS],
        'source': '서울 열린데이터광장: 서울시 상권분석서비스(점포-행정동, 추정매출-행정동), 행정동 단위 서울 생활인구(내국인)',
        'notes': [
            '서울·구 평균은 합계 기준(예: 폐업 수 합 ÷ 점포 수 합)이다.',
            '강북구 6개 동의 생활인구는 원본 코드가 달라 코드 순서대로 짝지었다(추정).',
            '구로구 항동은 생활인구 원본에 없어 유동인구 증감이 없다.',
        ],
    }

    write_json(os.path.join(args.out, 'meta.json'), meta)
    write_json(os.path.join(args.out, 'dongs.json'), dongs)
    for chip, data in result.items():
        write_json(os.path.join(args.out, 'category', f'{chip}.json'), data)
    write_json(os.path.join(args.out, 'dong-categories.json'), dong_categories)
    print(f'완료: 행정동 {len(dongs)}개, 업종 칩 {len(result)}개, 분기 {TREND_QUARTERS} → {args.out}')


if __name__ == '__main__':
    main()
