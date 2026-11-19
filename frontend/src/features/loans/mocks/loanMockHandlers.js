// N-37 대출 상품 mock 핸들러 — LOAN-01~05 실제 응답과 같은 모양으로 응답한다.
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'
import { MOCK_LOAN_PRODUCTS } from './loanMockData.js'

// 회원별 즐겨찾기(productCode 배열). 새로고침하면 초기화된다.
const favoritesByUser = new Map()
const favoritesOf = (token) => {
  const { userId } = requireMockUser(token)
  if (!favoritesByUser.has(userId)) favoritesByUser.set(userId, [])
  return favoritesByUser.get(userId)
}

// N-37-3 LOAN-04·05 멱등 처리: 이미 있어도 추가는 200, 이미 없어도 해제는 200이다.
const handlers = {
  'GET /api/loan-products': () => structuredClone(MOCK_LOAN_PRODUCTS),
  'GET /api/members/me/favorite-loan-products': ({ token }) => ({ items: [...favoritesOf(token)] }),
}
MOCK_LOAN_PRODUCTS.forEach(({ productCode }) => {
  handlers[`GET /api/loan-products/${productCode}`] = () => structuredClone(MOCK_LOAN_PRODUCTS.find((item) => item.productCode === productCode))
  handlers[`PUT /api/members/me/favorite-loan-products/${productCode}`] = ({ token }) => {
    const list = favoritesOf(token)
    if (!list.includes(productCode)) list.push(productCode)
    return {}
  }
  handlers[`DELETE /api/members/me/favorite-loan-products/${productCode}`] = ({ token }) => {
    const list = favoritesOf(token)
    const index = list.indexOf(productCode)
    if (index >= 0) list.splice(index, 1)
    return {}
  }
})
registerMockHandlers(handlers)
