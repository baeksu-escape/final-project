import { useSyncExternalStore } from 'react'
import { USE_MOCK } from '../../../common/config/env.js'
import { CATALOG_VERSION, MOCK_LOAN_PRODUCTS } from '../mocks/loanMockData.js'

const listeners = new Set()
const cache = new Map()
const EMPTY = Object.freeze([])

// N-37-1 UI 전용 mock 카탈로그다. 실제 API 계약이 없으므로 실제 모드에서는 명시적으로 실패한다.
export async function getLoanProducts() {
  if (!USE_MOCK) throw new Error('대출 상품 API 연결이 준비되지 않았습니다. 현재 화면은 mock 모드에서 확인할 수 있습니다.')
  return structuredClone(MOCK_LOAN_PRODUCTS)
}

// N-37-1 점수만 비교한다. 직군·기타 조건 충족이나 대출 승인을 의미하지 않는다.
export function matchesLoanScore(product, score) {
  return typeof score === 'number' && Number.isFinite(score) && score >= product.minScore && score <= product.maxScore
}

// N-37-3 회원과 UI 카탈로그 버전별로 저장한 즐겨찾기만 읽는다. DB 상품 ID로 재사용하지 않는다.
function readFavorites(key) {
  if (!key) return EMPTY
  if (!cache.has(key)) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? '[]')
      cache.set(key, Array.isArray(saved) ? saved.filter((id) => MOCK_LOAN_PRODUCTS.some((product) => product.productId === id)) : [])
    } catch {
      cache.set(key, [])
    }
  }
  return cache.get(key)
}

// N-37-3 목록·상세·시뮬레이터 카드가 같은 회원별 상태를 구독한다. 실제 모드에서는 mock을 사용하지 않는다.
export function useLoanFavorites(userId) {
  const key = USE_MOCK && userId != null ? `avenue:loan-favorites:${CATALOG_VERSION}:${encodeURIComponent(userId)}` : null
  const favorites = useSyncExternalStore(subscribe, () => readFavorites(key), () => EMPTY)
  const toggleFavorite = (productId) => {
    if (!key) return
    if (!MOCK_LOAN_PRODUCTS.some((product) => product.productId === productId)) return
    const current = readFavorites(key)
    const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]
    cache.set(key, next)
    try { sessionStorage.setItem(key, JSON.stringify(next)) } catch { /* 저장 불가 시 현재 탭 메모리에서만 유지한다. */ }
    listeners.forEach((listener) => listener())
  }
  return { favorites, toggleFavorite, available: Boolean(key) }
}

// N-37-3 공용 저장소 변경을 모든 카드에 전달하고 해제 시 구독을 제거한다.
function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
