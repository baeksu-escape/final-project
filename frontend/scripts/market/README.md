# 상권 분석 정적 데이터 만들기 (N-24, FP-176)

상권 분석 화면(N-24-3·4·5)은 DB·API 없이 `frontend/public/data/market/`의 JSON을 읽어 그린다(11/13 결정).
이 JSON은 `build_market_data.py`가 서울 열린데이터광장 원본으로 만든다. 원본은 크기가 커서 저장소에 넣지 않는다.

## 1. 원본 받기

| 데이터 | 주소 | 받을 파일 |
|---|---|---|
| 서울시 상권분석서비스(점포-행정동) | https://data.seoul.go.kr/dataList/OA-22172/S/1/datasetView.do | 2024년, 2025년 ZIP |
| 서울시 상권분석서비스(추정매출-행정동) | https://data.seoul.go.kr/dataList/OA-22175/S/1/datasetView.do | 2024년, 2025년 ZIP |
| 행정동 단위 서울 생활인구(내국인) | https://data.seoul.go.kr/dataList/OA-14991/S/1/datasetView.do | `LOCAL_PEOPLE_DONG_202401.zip` ~ `202512.zip` (24개) |

저장소 밖 폴더에 이렇게 둔다. 점포·매출은 압축을 풀고, 생활인구는 압축 그대로 둔다(풀면 4GB가 넘는다).

```
C:\workspace\data_raw\market\
  store\       서울시 상권분석서비스(점포-행정동)_2024년.csv, _2025년.csv
  sales\       서울시 상권분석서비스(추정매출-행정동)_2024년.csv, _2025년.csv
  living_pop\  LOCAL_PEOPLE_DONG_YYYYMM.zip
```

## 2. 실행 (저장소 루트에서)

```
python -I -X utf8 frontend/scripts/market/build_market_data.py --raw C:\workspace\data_raw\market --out frontend/public/data/market
```

필요한 라이브러리는 pandas 하나다. 30초쯤 걸린다. 결과가 예상한 모양(행정동 425개, 업종 칩 8개, 분기 4개)이 아니면 파일을 쓰지 않고 멈춘다. 같은 원본으로 다시 돌리면 같은 파일이 나온다.

## 3. 결과 파일

| 파일 | 내용 |
|---|---|
| `meta.json` | 기준 분기(2025-Q4), 분기 목록, 업종 칩 8개와 원본 업종 코드, 지표 정의(단위, 높을수록 좋은지), 출처 |
| `dongs.json` | 행정동 425개 `{ code, name, gu }` |
| `category/<칩>.json` | 칩 하나의 `seoul[분기]`, `gu[구][분기]`, `dongs[동 코드].quarters[분기]`, `dongs[동 코드].rank[지표] = { seoul, gu }`, `rankTotal[지표] = { seoul, gu[구] }` |
| `dong-categories.json` | 동마다 기준 분기 칩 8개 요약(점포 수, 점포당 매출, 매출 전년비, 폐업률, 서울 내 매출 전년비 순위). 상세 창 업종 순위표용 |

지표: `storeCount` 점포 수, `openRate` 개업률(%), `closeRate` 분기 폐업률(%, 낮을수록 좋음), `salesPerStore` 점포당 분기 매출(원), `salesYoY` 매출 전년비(%), `storeYoY` 점포 수 증감(%), `livingPopYoY` 유동인구 증감(%, 업종과 무관). 계산할 수 없는 값은 `null`이며 화면에서 "자료 없음"으로 보여 준다.

## 4. 정한 기준

- 업종 칩 8개와 원본 업종 코드는 스크립트의 `CATEGORIES`에 있다. 점포·매출 자료가 둘 다 있는 업종만 묶었다. 치킨·음식점은 음식점 전체(한식·중식·일식·양식·패스트푸드·치킨·분식)다.
- 서울·구 평균은 합계 기준이다(예: 폐업 수 합 ÷ 점포 수 합).
- 순위는 좋은 순이고, 값이 없는 동은 빼며 같은 값은 같은 순위다.
- 강북구 6개 동(번1·2·3동, 수유1·2·3동)은 생활인구 원본 코드가 상권 원본과 달라 코드 순서대로 짝지었다(추정). 구로구 항동은 생활인구 원본에 없다.
- 점포가 몇 곳뿐인 동은 비율이 크게 튈 수 있다(예: 커피·음료 폐업률 최대 60%).
- 화면에는 출처 "서울 열린데이터광장"을 표시한다.

## 5. 지도 다각형 만들기 (N-24-4, FP-205)

지도는 지도 API 없이 행정동 중심점으로 나눈 보로노이 칸을 SVG로 그린다. `build_market_geo.py`가 `geo.json`을 만든다.

| 데이터 | 받을 파일 | 둘 곳 |
|---|---|---|
| 서울시 상권분석서비스(영역-행정동) | shapefile ZIP(`.shp` `.shx` `.dbf` `.prj` `.cpg`) | `C:\workspace\data_raw\market\area\` (압축 해제) |

```
python -m pip install shapely
python -I -X utf8 frontend/scripts/market/build_market_geo.py --raw C:\workspace\data_raw\market --out frontend/public/data/market
```

`build_market_data.py`를 먼저 돌려 `dongs.json`이 있어야 한다(구 이름을 여기서 읽는다). 행정동 425개·구 25개가 아니거나 코드가 `dongs.json`과 다르면 파일을 쓰지 않고 멈춘다.

- 원본 좌표는 중부원점 TM(미터)이다. 동 중심점(`XCNTS_VALU`, `YDNTS_VALU`)으로 보로노이 칸을 만들고, 동 경계를 모두 합친 서울 외곽선으로 자른다.
- 구 경계는 같은 구의 칸을 합친 것이라 실제 구 경계와 조금 다르다. 화면에 "단순화한 모식도"라고 표시한다.
- 한강은 원본에 없어 그리지 않는다.

`geo.json`: `{ w, h, outline, gu: [{ name, path, x, y, box }], dongs: { [동 코드]: { path, x, y } } }`. 좌표는 왼쪽 위가 0,0이고 가로 1000 기준이다. `box`는 구를 고를 때 확대할 영역 `[x, y, 너비, 높이]`다.
