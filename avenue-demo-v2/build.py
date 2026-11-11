#!/usr/bin/env python3
"""src/ 를 합쳐 한 파일짜리 데모(avenue-demo-v2.html)를 만든다.

사용법:  python3 build.py            # 이 폴더에서 실행
결과물:  avenue-demo-v2.html (브라우저로 바로 열 수 있는 한 파일)

합치는 순서
  1. src/00_head.html        <head> 메타·글꼴·CSS 전부, #app·#toast 자리
  2. src/10_core.js ~ 40_admin.js   한 <script> 안에 이 순서로 이어 붙임
  3. src/heatmap/seoul-heatmap.html + geo.json
       → 'const HEAT_HTML = "...";' 문자열로 만들어 'use strict' 바로 뒤에 넣음
         (상권 분석 화면의 iframe srcdoc으로 쓰인다)
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
JS = ['10_core.js', '20_auth.js', '30_user.js', '40_admin.js']


def read(*p):
    with open(os.path.join(SRC, *p), encoding='utf-8') as f:
        return f.read()


def heat_doc():
    geo = json.load(open(os.path.join(SRC, 'heatmap', 'geo.json'), encoding='utf-8'))
    geo_s = json.dumps(geo, ensure_ascii=False, separators=(',', ':'))
    lines = read('heatmap', 'seoul-heatmap.html').split('\n')
    i = next(k for k, l in enumerate(lines) if l.startswith('const GEO = /*@GEO@*/'))
    lines[i] = 'const GEO = ' + geo_s + ';'
    heat = '\n'.join(lines)
    return ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'
            + heat + '</body></html>')


def build():
    js = ''.join(read(f) for f in JS)
    assert js.count("'use strict';\n") == 1, "'use strict' must appear once (top of 10_core.js)"
    hs = json.dumps(heat_doc(), ensure_ascii=False).replace('</', '<\\/')
    js = js.replace("'use strict';\n", "'use strict';\nconst HEAT_HTML = " + hs + ";\n")
    out = read('00_head.html') + js
    path = os.path.join(ROOT, 'avenue-demo-v2.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(out)
    print(f'wrote {path} ({len(out.encode("utf-8")):,} bytes)')


if __name__ == '__main__':
    build()
