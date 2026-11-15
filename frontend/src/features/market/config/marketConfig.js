// N-24 상권 분석 화면 설정 — 지도·차트에 쓰는 지표 5개, 색 구간, 동 안 업종 순위 기준.
// 지표 이름·단위·좋은 방향은 meta.json의 metrics를 쓰고, 여기에는 화면 전용 값만 둔다.

// 지표 칩 순서(데모 기준). signed: 증감 지표라 양수에 +를 붙인다.
export const MAP_METRICS = Object.freeze([
  { key: 'closeRate', signed: false, desc: '이번 분기에 문을 닫은 점포 비율' },
  { key: 'salesYoY', signed: true, desc: '작년 같은 분기와 비교한 매출 변화' },
  { key: 'openRate', signed: false, desc: '이번 분기에 새로 문을 연 점포 비율' },
  { key: 'storeYoY', signed: true, desc: '작년 같은 분기와 비교한 점포 수 변화' },
  { key: 'livingPopYoY', signed: true, desc: '작년 같은 분기와 비교한 생활인구 변화' },
])

// 서울 평균에서 떨어진 정도(표준편차 단위, 좋은 쪽이 +)에 따른 색 구간. 색 값은 market.css의 --market-* 변수.
export const HEAT_BINS = Object.freeze([
  { key: 'neg3', min: -Infinity, max: -1.5 },
  { key: 'neg2', min: -1.5, max: -0.75 },
  { key: 'neg1', min: -0.75, max: -0.25 },
  { key: 'neu', min: -0.25, max: 0.25 },
  { key: 'pos1', min: 0.25, max: 0.75 },
  { key: 'pos2', min: 0.75, max: 1.5 },
  { key: 'pos3', min: 1.5, max: Infinity },
])

// 행정동 상세 창의 업종 순위 기준. dir 1이면 클수록 위, -1이면 작을수록 위(폐업률).
export const CATEGORY_RANK_OPTIONS = Object.freeze([
  { value: 'storeCount', label: '점포 수', dir: 1 },
  { value: 'salesPerStore', label: '점포당 매출', dir: 1 },
  { value: 'salesYoY', label: '매출 전년비', dir: 1 },
  { value: 'closeRate', label: '폐업률', dir: -1 },
])

export const DEFAULT_METRIC = 'closeRate'
export const DEFAULT_CATEGORY = 'CAFE'
export const ALL_GU = '전체'
// 분포 막대 개수, 주의할 동·좋은 동 개수
export const DIST_BIN_COUNT = 14
// 분포 막대 범위(하위·상위 백분위). 밖의 값은 양 끝 막대에 모은다
export const DIST_RANGE = Object.freeze([0.05, 0.95])
export const RANK_LIST_SIZE = 5
