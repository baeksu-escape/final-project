// N-24-2 상권 데이터 조회 — DB·API 없이 public/data/market의 정적 JSON을 읽는다(11/13 결정).
// 한 번 읽은 파일은 메모리에 보관해 업종을 다시 고를 때 다시 받지 않는다.
const BASE = `${import.meta.env.BASE_URL}data/market/`
const cache = new Map()

// 파일 하나를 읽어 JSON으로 돌려준다. 실패하면 캐시에서 지워 다음에 다시 시도할 수 있게 한다.
function loadJson(path) {
  if (!cache.has(path)) {
    const request = fetch(BASE + path).then((response) => {
      if (!response.ok) throw new Error(`상권 데이터를 불러오지 못했습니다 (${path})`)
      return response.json()
    })
    request.catch(() => cache.delete(path))
    cache.set(path, request)
  }
  return cache.get(path)
}

// 화면 처음에 필요한 공통 파일: 기준 분기·업종·지표 정의, 행정동 목록, 동별 업종 요약.
export async function loadMarketBase() {
  const [meta, dongs, dongCategories] = await Promise.all([
    loadJson('meta.json'),
    loadJson('dongs.json'),
    loadJson('dong-categories.json'),
  ])
  return { meta, dongs, dongCategories }
}

// 업종 하나의 서울·구·행정동 지표와 순위.
export function loadMarketCategory(categoryCode) {
  return loadJson(`category/${categoryCode}.json`)
}
