import { useEffect, useSyncExternalStore } from 'react'
import { apiDelete, apiGet, apiPut } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다 (VITE_USE_MOCK=false면 등록돼도 무시됨)
import '../mocks/loanMockHandlers.js'

const listeners = new Set()
// 회원별 즐겨찾기 상태: { items: productCode[], loaded, promise }
const cache = new Map()
const EMPTY = Object.freeze([])

// 가상은행·가상신협은 bank, 그 밖(저축은행·카드·캐피탈)은 savings 배너 테마를 쓴다. 서버 응답에는 없는 화면 값이다.
const providerTheme = (name) => (name.startsWith('가상은행') || name.startsWith('가상신협') ? 'bank' : 'savings')
// 서버 상품에 화면 전용 값(배너 테마·점수 상한)을 붙인다.
const toProduct = (item) => ({ ...item, providerTheme: providerTheme(item.providerName ?? ''), maxScore: 1000 })

// N-37-1 LOAN-01 대출 상품 전체 목록(PRODUCT_ID 순)을 조회한다. 필터·정렬은 화면에서 한다.
export async function getLoanProducts() {
  const data = await apiGet('/api/loan-products')
  const items = Array.isArray(data) ? data : data?.items
  if (!Array.isArray(items)) throw new Error('대출 상품 응답 형식이 올바르지 않습니다.')
  return items.map(toProduct)
}

// N-37-2 LOAN-02 productCode로 상품 하나를 조회한다.
export async function getLoanProduct(productCode) {
  return toProduct(await apiGet(`/api/loan-products/${encodeURIComponent(productCode)}`))
}

// N-37-1 점수만 비교한다. 최소 점수가 없으면(null) 점수 조건 없음으로 충족이다. 직군·기타 조건 충족이나 대출 승인을 의미하지 않는다.
export function matchesLoanScore(product, score) {
  return typeof score === 'number' && Number.isFinite(score) && score >= (product.minScore ?? 0) && score <= product.maxScore
}

// N-37-3 LOAN-03 회원의 즐겨찾기 productCode 목록을 한 번만 불러온다(여러 카드가 동시에 요청해도 1회).
function loadFavorites(userId) {
  const entry = cache.get(userId) ?? { items: EMPTY, loaded: false, promise: null }
  cache.set(userId, entry)
  if (entry.loaded || entry.promise) return
  entry.promise = apiGet('/api/members/me/favorite-loan-products').then((data) => {
    cache.set(userId, { items: Array.isArray(data?.items) ? data.items : EMPTY, loaded: true, promise: null })
  }, () => {
    cache.set(userId, { items: EMPTY, loaded: false, promise: null })
  }).then(() => listeners.forEach((listener) => listener()))
}

// N-37-3 목록·상세·시뮬레이터 카드가 같은 회원별 상태를 구독한다. 토글은 PUT·DELETE 성공 후에만 반영한다.
export function useLoanFavorites(userId) {
  const entry = useSyncExternalStore(subscribe, () => (userId == null ? null : cache.get(userId) ?? null), () => null)
  useEffect(() => { if (userId != null) loadFavorites(userId) }, [userId])
  const favorites = entry?.items ?? EMPTY
  const toggleFavorite = async (productCode) => {
    if (userId == null || !entry?.loaded) return
    const path = `/api/members/me/favorite-loan-products/${encodeURIComponent(productCode)}`
    const has = favorites.includes(productCode)
    try {
      await (has ? apiDelete(path) : apiPut(path, {}))
    } catch {
      return // 실패하면 표시를 바꾸지 않는다.
    }
    const current = cache.get(userId)
    const items = has ? current.items.filter((code) => code !== productCode) : [...current.items.filter((code) => code !== productCode), productCode]
    cache.set(userId, { ...current, items })
    listeners.forEach((listener) => listener())
  }
  return { favorites, toggleFavorite, available: Boolean(entry?.loaded) }
}

// N-37-3 공용 저장소 변경을 모든 카드에 전달하고 해제 시 구독을 제거한다.
function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
