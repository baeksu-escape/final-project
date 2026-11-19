# N-37 대출 상품 화면 메모

UI 출처는 Claude Artifact `5unyCwrGcxS3WrWFUk9qid`, 버전 `1794641606-4f83`이며 원본 HTML은 저장소에 복제하지 않았다. 상품·수치는 실제 금융 상품이나 평가 결과가 아니다.

## 연결과 API

- `/loans`: `loans/pages/LoanProductsPage.jsx`, `/loans/:productId`: `LoanProductDetailPage.jsx`. 라우트 파라미터 이름은 `productId`지만 값은 productCode다.
- 공용 카드: `loans/components/LoanProductCard.jsx`, props `product`, `score`, `workerTypeCode`. 시뮬레이터 추천도 이 카드를 쓴다.
- `loans/api/loanCatalog.js`: `getLoanProducts()`, `getLoanProduct(productCode)`, `matchesLoanScore(product, score)`, `useLoanFavorites(userId)`(반환 `{ favorites, toggleFavorite, available }`).

| ID | 요청 | 응답 |
|---|---|---|
| LOAN-01 | GET `/api/loan-products` | `{items}` |
| LOAN-02 | GET `/api/loan-products/{productCode}` | 상품 1개, 없으면 404 `PRODUCT_NOT_FOUND` |
| LOAN-03 | GET `/api/members/me/favorite-loan-products` | `{items:[productCode]}` |
| LOAN-04 | PUT `/api/members/me/favorite-loan-products/{productCode}` | 멱등 200 `{}` |
| LOAN-05 | DELETE 같은 경로 | 멱등 200 `{}` |

- 즐겨찾기는 서버에 저장한다(sessionStorage 아님). 목록·상세·추천 카드가 회원별 같은 저장소를 구독하고, 토글은 PUT·DELETE 성공 후에만 표시를 바꾼다.
- mock 핸들러(`loans/mocks/loanMockHandlers.js`)는 실제 응답과 같은 모양으로 응답한다. 상품 데이터는 `loanMockData.js`.

## 카탈로그

시드 17종(LP001~LP017, `docs/spec/sql/dummy_db/22_seed_loan_product.sql`)이며 키는 `productCode`다. 화면이 쓰는 필드만 적는다.

| 필드 | 출처 | 비고 |
|---|---|---|
| productCode | 서버 | 목록 key·상세 주소·즐겨찾기 키 |
| name / providerName / description | 서버 | |
| rateMinPct / rateMaxPct | 서버 | 금리 범위 표시 |
| limitAmount | 서버 | 원 단위 최대 한도 |
| minScore | 서버 | 0 또는 NULL이면 점수 조건 없음 |
| termText / repaymentMethod / eligibility | 서버 | 원문 그대로 표시 |
| workerTypeCodes / features / requiredDocuments | 서버 | 배열 |
| providerTheme | 화면 전용 | 사업자명으로 bank·savings 배너 테마 결정 |
| maxScore | 화면 전용 | UI 상한 1000, 승인 조건 아님 |

## 동작

- 필터 4종(전체·점수 조건 충족·직군·즐겨찾기)은 화면에서 거르고 주소 쿼리 `?filter=`로 유지한다. 모르는 값이면 전체다. 상세의 "목록으로"는 들어온 목록 주소(필터 포함)로 돌아가며, 직접 진입·시뮬레이터에서 온 경우는 `/loans`다.
- 정렬은 즐겨찾기 우선, 같은 그룹에서는 점수 조건 충족 우선이다. 동률은 서버 순서를 유지한다.
- 점수는 신용 리포트(`fetchCreditReport`)에서 읽는다. `404 / ASSESSMENT_NOT_FOUND`는 정상적인 미산출 안내이고, 다른 오류는 `reload`로 재시도하는 조회 오류다. 점수가 없으면 충족으로 분류하지 않는다.
- 상세 등급 칩은 리포트의 cutoffVersion·gradeBands에 저장된 등급과 점수가 일치할 때만 보여 준다.
- 점수 필터는 점수 조건만 본다. 직군 필터와 별개이며 대출 승인·신청 가능성을 판단하지 않는다.
- 신청 버튼은 안내 모달만 연다. 개인정보·서류 수집이나 외부 신청은 없다.
- 모든 화면에 더미 상품·"같은 점수대의 참고 정보" 문구를 표시한다.

## 확인

11/19 실제 서버 모드에서 목록·상세·즐겨찾기·필터 유지를 확인했다. 로컬 Oracle 쿼리와 즐겨찾기 멱등 동작을 확인했고, 백엔드 Loan 테스트와 `npm run lint`가 통과했다. 프론트 테스트 파일은 추가하지 않는다.
