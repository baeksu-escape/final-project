# N-24-4 행정동 보로노이 지도 다각형 만들기 — 서울 열린데이터광장 '서울시 상권분석서비스(영역-행정동)' shapefile에서
# 동 중심 좌표로 보로노이 칸을 만들고, 동 경계를 합친 실제 서울 외곽선으로 잘라 SVG path JSON으로 저장한다. (FP-205)
#
# 실행 (저장소 루트에서, build_market_data.py를 먼저 돌려 dongs.json이 있어야 한다):
#   python -I -X utf8 frontend/scripts/market/build_market_geo.py --raw C:\workspace\data_raw\market --out frontend/public/data/market
# 필요한 라이브러리: shapely (pip install shapely). shapefile은 표준 struct로 직접 읽는다.

import argparse
import glob
import json
import os
import struct

import shapely
from shapely.geometry import MultiPoint, Point, Polygon
from shapely.ops import unary_union

# 지도 가로 크기(SVG 좌표). 세로는 서울 모양 비율로 정해진다.
MAP_WIDTH = 1000
# 외곽선 틈 메우기 폭과 단순화 정도(미터). 화면 1칸이 약 37m라 이보다 작은 차이는 보이지 않는다.
GAP_FILL = 5
SIMPLIFY_OUTLINE = 30
SIMPLIFY_CELL = 15
EXPECTED_DONGS = 425
EXPECTED_GU = 25


# .dbf 속성 표를 읽는다. 문자 인코딩은 .cpg 파일을 따른다(없으면 cp949).
def read_dbf(path, encoding):
    with open(path, 'rb') as f:
        head = f.read(32)
        count = struct.unpack('<I', head[4:8])[0]
        header_len, record_len = struct.unpack('<HH', head[8:12])
        fields = []
        while True:
            desc = f.read(32)
            if desc[0] == 0x0D:
                break
            fields.append((desc[:11].split(b'\0')[0].decode('ascii'), desc[16]))
        f.seek(header_len)
        rows = []
        for _ in range(count):
            record = f.read(record_len)
            pos, row = 1, {}
            for name, length in fields:
                row[name] = record[pos:pos + length].decode(encoding, 'replace').strip()
                pos += length
            rows.append(row)
    return rows


# .shp 다각형(type 5)을 순서대로 읽는다. 시계 방향 고리는 바깥, 반시계 방향은 구멍이다.
def read_shp_polygons(path):
    shapes = []
    with open(path, 'rb') as f:
        f.seek(100)
        while True:
            head = f.read(8)
            if len(head) < 8:
                break
            length = struct.unpack('>i', head[4:8])[0] * 2
            content = f.read(length)
            shape_type = struct.unpack('<i', content[:4])[0]
            if shape_type != 5:
                raise SystemExit(f'다각형이 아닌 도형이 있습니다 (type {shape_type})')
            num_parts, num_points = struct.unpack('<ii', content[36:44])
            parts = list(struct.unpack(f'<{num_parts}i', content[44:44 + 4 * num_parts]))
            start = 44 + 4 * num_parts
            points = [struct.unpack('<2d', content[start + 16 * i:start + 16 * (i + 1)]) for i in range(num_points)]
            outers, holes = [], []
            for k, begin in enumerate(parts):
                end = parts[k + 1] if k + 1 < num_parts else num_points
                ring = Polygon(points[begin:end])
                (holes if ring.exterior.is_ccw else outers).append(ring.buffer(0))
            shape = unary_union(outers)
            if holes:
                shape = shape.difference(unary_union(holes))
            shapes.append(shape)
    return shapes


# 동 경계를 모두 합쳐 서울 외곽선 하나를 만든다. 동 사이 작은 틈은 메우고, 안쪽 구멍은 없앤다.
def seoul_outline(shapes):
    merged = unary_union(shapes).buffer(GAP_FILL).buffer(-GAP_FILL)
    parts = list(merged.geoms) if merged.geom_type == 'MultiPolygon' else [merged]
    largest = max(parts, key=lambda p: p.area)
    return Polygon(largest.exterior).simplify(SIMPLIFY_OUTLINE)


# 도형에서 바깥 고리만 모아 돌려준다(Polygon·MultiPolygon·GeometryCollection 모두).
def exterior_rings(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == 'Polygon':
        return [list(geom.exterior.coords)]
    if hasattr(geom, 'geoms'):
        return [ring for part in geom.geoms for ring in exterior_rings(part)]
    return []


def main():
    parser = argparse.ArgumentParser(description='행정동 보로노이 지도 다각형 만들기 (N-24-4)')
    parser.add_argument('--raw', required=True, help='원본 폴더 (area/ 아래에 영역-행정동 shapefile)')
    parser.add_argument('--out', required=True, help='결과 폴더 (frontend/public/data/market)')
    args = parser.parse_args()

    shp_files = glob.glob(os.path.join(args.raw, 'area', '*.shp'))
    if len(shp_files) != 1:
        raise SystemExit(f'area 폴더에 .shp 파일이 하나 있어야 합니다 (찾은 수 {len(shp_files)})')
    base = shp_files[0][:-4]
    encoding = 'cp949'
    if os.path.exists(base + '.cpg'):
        encoding = open(base + '.cpg', encoding='ascii').read().strip() or encoding
    rows = read_dbf(base + '.dbf', encoding)
    shapes = read_shp_polygons(base + '.shp')
    if len(rows) != len(shapes):
        raise SystemExit(f'.dbf({len(rows)})와 .shp({len(shapes)})의 개수가 다릅니다')

    with open(os.path.join(args.out, 'dongs.json'), encoding='utf-8') as f:
        gu_of = {d['code']: d['gu'] for d in json.load(f)}

    codes = [row['ADSTRD_CD'] for row in rows]
    centers = [(float(row['XCNTS_VALU']), float(row['YDNTS_VALU'])) for row in rows]
    if len(codes) != EXPECTED_DONGS or set(codes) != set(gu_of):
        raise SystemExit(f'행정동 코드가 dongs.json과 다릅니다 (shapefile {len(codes)}개, dongs.json {len(gu_of)}개)')

    outline = seoul_outline(shapes)

    # 보로노이: 칸은 입력 점 순서대로 나온다(ordered=True). 짝이 맞는지 아래에서 한 번 더 확인한다.
    envelope = outline.envelope.buffer(5000)
    cells = list(shapely.voronoi_polygons(MultiPoint(centers), extend_to=envelope, ordered=True).geoms)
    clipped = {}
    for code, center, cell in zip(codes, centers, cells):
        if not cell.contains(Point(center)):
            raise SystemExit(f'{code} 보로노이 칸이 중심점을 담고 있지 않습니다')
        piece = cell.intersection(outline).simplify(SIMPLIFY_CELL)
        if piece.is_empty:
            raise SystemExit(f'{code} 칸이 서울 외곽선 밖에 있습니다')
        clipped[code] = piece

    # 미터 좌표 → SVG 좌표 (왼쪽 위 0,0, y 뒤집기)
    min_x, min_y, max_x, max_y = outline.bounds
    scale = MAP_WIDTH / (max_x - min_x)
    height = round((max_y - min_y) * scale, 1)

    def to_svg(x, y):
        return round((x - min_x) * scale, 1), round((max_y - y) * scale, 1)

    def path_of(geom):
        out = []
        for ring in exterior_rings(geom):
            pts = [to_svg(x, y) for x, y in ring[:-1]]
            out.append('M' + 'L'.join(f'{x:g},{y:g}' for x, y in pts) + 'Z')
        return ''.join(out)

    dongs = {}
    for code, (cx, cy) in zip(codes, centers):
        x, y = to_svg(cx, cy)
        dongs[code] = {'path': path_of(clipped[code]), 'x': x, 'y': y}

    gu_list = []
    for gu in sorted(set(gu_of.values())):
        shape = unary_union([clipped[c] for c in codes if gu_of[c] == gu]).buffer(1).buffer(-1)
        label = shape.representative_point()
        lx, ly = to_svg(label.x, label.y)
        bx0, by0, bx1, by1 = shape.bounds
        left, top = to_svg(bx0, by1)
        right, bottom = to_svg(bx1, by0)
        gu_list.append({
            'name': gu,
            'path': path_of(shape.simplify(SIMPLIFY_CELL)),
            'x': lx,
            'y': ly,
            'box': [left, top, round(right - left, 1), round(bottom - top, 1)],
        })
    if len(gu_list) != EXPECTED_GU:
        raise SystemExit(f'구가 {EXPECTED_GU}개가 아닙니다 ({len(gu_list)}개)')

    result = {'w': MAP_WIDTH, 'h': height, 'outline': path_of(outline), 'gu': gu_list, 'dongs': dongs}
    out_path = os.path.join(args.out, 'geo.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    size = os.path.getsize(out_path) // 1024
    print(f'완료: 행정동 {len(dongs)}개, 구 {len(gu_list)}개, 지도 {MAP_WIDTH}x{height}, {size}KB → {out_path}')


if __name__ == '__main__':
    main()
