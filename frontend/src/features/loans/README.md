# FP-90·91 대출 상품·시뮬레이터 통합 메모

이번 화면 작업의 임시 자료다. UI 출처는 Claude Artifact `5unyCwrGcxS3WrWFUk9qid`, 버전 `1794641606-4f83`이며 원본 HTML은 저장소에 복제하지 않았다. 상품·수치는 실제 금융 상품이나 평가 결과가 아니다.

역할: Codex1은 loans·통합, Claude는 simulation 실제 구현 인수, Codex2는 초안·읽기 교차 검수, root는 계획·설계·통합 검토를 맡았다.

## 연결과 담당 경계

- `/loans`: `loans/pages/LoanProductsPage.jsx`, `/loans/:productId`: `LoanProductDetailPage.jsx`.
- 기존 `/simulator`: `simulation/pages/SimulationPage.jsx`의 default export. 다른 메뉴는 재구성하지 않는다.
- 공용 카드: `loans/components/LoanProductCard.jsx`, props `product`, `score`, `workerTypeCode`.
- `loans/api/loanCatalog.js`: `getLoanProducts()` 비동기 카탈로그, `matchesLoanScore(product, score)`, `useLoanFavorites(userId)`.
- 즐겨찾기 훅은 `{ favorites, toggleFavorite, available }`을 반환한다. 목록·상세·추천이 같은 저장소를 구독한다.
- mock 즐겨찾기 키는 회원 ID와 `ui-v2-1794641606-4f83` 버전으로 격리한다. sessionStorage 사용 불가 시 현재 탭 메모리에서 유지한다. DB 이전 데이터로 취급하지 않는다.
- `VITE_USE_MOCK=false`에서 상품 API 미연결을 오류로 표시한다. 실제 서버 경로를 새로 확정하거나 실패 후 mock으로 전환하지 않는다.

## UI와 서비스 카탈로그 차이

DDL에는 상품 INSERT가 없다. 현재 `docs/spec/sql/dummy_db/22_seed_loan_product.sql`은 **17종**(LP001~LP017), 23번 직군 연결은 43행, 24번 특징은 17행이다. UI의 **9종**(L01~L09)과 상품명·사업자·금리·한도·기간·상환·직군·최소점수가 다르다. root에 보고하고 승인받은 UI9종만 사용하며 서비스 시드 수치를 혼합하지 않는다.

UI `L01`(든든 사업자 우대 대출, 에비뉴은행 예시, 4.9~6.1%, 5천만원, 자영업자)과 서비스 `LP001`은 같은 상품이 아니다. 순서나 숫자 접미사로 자동 매핑하지 않는다. 모든 UI 상품은 `idSource='ui-mock'`, `catalogVersion='ui-v2-1794641606-4f83'`, `dbProductId=null`이다. `productId=L01~L09`는 화면 전용 문자열이며 DB PRODUCT_ID로 전송하지 않는다.

| 화면 전용 필드 | 기존 DB 필드 대조 기록 | 제약 |
|---|---|---|
| productId / dbProductId | PRODUCT_ID / PRODUCT_CODE | 현재 매핑 없음 |
| name / providerName / description | PRODUCT_NAME / PROVIDER_NAME / DESCRIPTION | UI와 서비스 값 다름 |
| rateMinPct / rateMaxPct | RATE_MIN_PCT / RATE_MAX_PCT | interestRate는 같은 값의 배열 별칭 |
| limitAmount | LIMIT_MAX_AMT | 원 단위, UI 원본 만원 값만 환산 |
| minScore / maxScore | MIN_ALT_SCORE / 점수 상한 | UI 상한 1000, 승인 조건 아님 |
| termText / termMonths | TERM_TEXT / TERM_MIN_MONTHS·TERM_MAX_MONTHS | termMonths는 현재 NULL, 텍스트 임의 수치화 금지 |
| repaymentMethod / eligibility | REPAYMENT_METHOD / ELIGIBILITY_TEXT | 원문 차이 유지 |
| workerTypeCodes | LOAN_PRODUCT_WORKER_TYPE.WORKER_TYPE_CODE | 직군 코드 배열, 단수 별칭 없음 |
| providerTheme | UI 전용 사업자 배너 테마 | mock adapter에서 정규화, DB 필드 아님 |
| features / requiredDocuments | LOAN_PRODUCT_FEATURE / REQUIRED_DOCUMENTS | 서비스 응답 배열 형식 미정 |

## mock 동작과 제약

- 목록·상세·즐겨찾기 서버 경로와 요청·응답 계약은 미정이다. 화면용 adapter 계약은 서버 API 명세가 아니다.
- 현재 점수는 기존 `fetchCreditReport`의 저장된 대안 결과에서 읽는다. 미산출·조회 실패는 NULL을 유지하고 확인 불가로 표시한다.
- 상품 조회 실패와 점수 조회 실패는 `reload` 버튼으로 재조회한다. 정상 응답의 미산출 안내는 오류와 구분한다. 재시도·회원 전환 시 요청별 취소 플래그와 조회 회차로 이전 응답·이전 점수 표시를 막는다.
- 기존 리포트 계약의 `404 / ASSESSMENT_NOT_FOUND`는 정상적인 평가 없음 안내로 처리한다. 다른 404·네트워크 오류는 재시도 가능한 조회 오류다.
- 상세 등급 칩은 리포트의 cutoffVersion·gradeBands에 저장된 등급과 점수가 일치할 때만 보여 준다. 현재 경계 상수로 재분류하지 않는다.
- 기존 리포트 mock은 회원별 점수가 아니라 공용 시연 점수 701을 반환한다. 이번에 공통 mock을 수정하지 않았다.
- 점수 필터는 점수 조건만 검사한다. 직군 필터와 별개이며 대출 승인·신청 가능성을 판단하지 않는다.
- 모든 필터 결과는 즐겨찾기 우선, 같은 그룹에서는 점수 조건 충족 우선으로 표시한다. 동률은 원 카탈로그 순서를 유지하고 배열 원본은 바꾸지 않는다. NULL·미산출 점수는 충족으로 분류하지 않는다.
- 신청 버튼은 안내 모달만 표시하며 개인정보·서류 수집·외부 신청을 하지 않는다.
- 시뮬레이터의 10개 입력·자동 계산·초기화·예시값·추천은 UI 시연 계약이다. 원격 FP176의 옛 9입력·상품6종·300~900 점수 범위를 가져와 덮어쓰지 않는다.
- 실제 모델·금리/한도 조회·서버 연결은 이번 작업 범위 밖이며 미검증이다. UI 시연식은 운영 모델이 아니다.

## 시뮬레이터 인계 내용

- `simulation/pages/SimulationPage.jsx`, `api/useSimulation.js`, `api/simulationApi.js`, `adapters/simulationAdapter.js`, 전용 components·mocks·CSS로 나눈다. 6개 슬라이더와 원 단위 금액 4개를 전달하며 NULL을 0으로 채우지 않는다.
- 슬라이더·직접 숫자/금액 입력·예시값 넣기는 같은 change 경로를 사용한다. 이전 타이머와 응답 순번을 무효화하고 입력이 500ms 멈추면 최신 유효값으로 한 번 계산한다. 현재점수와 10개 입력이 유효할 때만 요청한다.
- 첫 로드·마지막 계산값(계산 전에는 실제 값)과 같은 입력·되돌리기는 요청하지 않는다. 회원 전환·reload·되돌리기·unmount 시 타이머와 늦은 응답을 무효화한다. 계산 버튼은 없고 실패 시에만 다시 계산한다. 계산 결과를 저장하거나 기존 평가를 덮어쓰지 않는다.
- 추천은 공용 UI9 카탈로그에서 직군·점수 조건을 적용하고 최소 점수 내림차순, 최저 금리 오름차순으로 최대 3개를 고른다. 카드 표시 점수도 추천 기준과 일치시킨다.
- 현재값/재계산 함수의 입력 필드는 화면용 임시 계약이다. 실제 모드에서는 미연결 오류를 표시하며 mock으로 전환하지 않는다. 옛 원격 9입력 payload로 자동 변환하거나 서버 경로를 새로 확정하지 않는다.
- 시연 점수식은 원본 UI 식에서 10개 입력의 기준값 대비 차이를 현재점수에 더한다. 무변경은 변화·영향 0이다. 카드 한도 0 처리 등은 시연 규칙이며 실제 모델 규칙이 아니다.
- 점수·금리·한도·부도 확률·등급 경계(780/665)는 UI 시연식이며 실제 모델·score_band_offer 조회가 아니다. 시뮬레이터 확률(701점 약 0.85%)과 리포트 mock 확률(약 9.2%)은 다르며 서로 실제 값처럼 합치지 않는다.
- 감점 3개는 고정 mock이며 실제 N-14 SHAP와 연결되지 않았다. 예시 값 넣기는 입력·포커스를 바꾼 뒤 일반 입력과 같은 500ms 자동 계산을 거친다.
- 감점 카드 자체의 예시 gain 미리보기는 API를 호출하지 않는다. +20/+5는 mock에 미리 둔 고정값이며 "시연 예시 기준"으로만 표시한다. 사용자가 실제 예시값을 넣는 동작과 구분한다.
- 응답은 current/changed 필수, 점수 0~1000 정수, 기존 3등급 코드, 금리 비음수 유한수, 한도 비음수 안전정수, 확률 0~1, 영향도 안전정수로 검증한다. 금리·한도·확률·영향도의 NULL은 보존한다. 입력 현재점수 범위 오류와 필수값 누락은 계산하지 않는다.
- unmount 시 계산 순번을 무효화한다. 미입력 슬라이더는 0 위치의 슬라이더 대신 빈 NumberInput으로 구분하고 미입력 기준값은 mock 계산을 거부한다.
- 응답 adapter 변환은 React 상태 updater 밖의 try에서 실행한다. 변환 오류는 계산 오류 안내로 전달하며 state updater 안에서 예외를 발생시키지 않는다.
- mock 재계산 함수 입구에서도 현재점수와 입력·기준값의 정확한 10개 키 및 기존 범위 검사를 확인한다. 브라우저 내 mock 요청 검사이며 서버 검증이 아니다. 마지막 보완 후 lint/build가 통과했다.

## 확인

추가 승인된 목록 정렬·자동 계산 변경 완료 코드의 `npm.cmd run lint`·`npm.cmd run build`가 통과했다(Vite 140 modules). Claude는 목록 정렬을, Codex1은 자동 계산 흐름을 읽기 교차 검토했다. Claude의 node 단독 계산 확인은 무변경·예시 변화·한도 0·미입력 및 잘못된 응답 시나리오이며 Codex1의 브라우저 검증은 아니다. 브라우저 화면·클릭·반응형·테마 시각 확인과 실제 서버 연동은 미검증이다. 사용자 최종검수도 아직 실시하지 않았으며 읽기 로직 검수와 구분한다. 프론트 테스트 파일은 추가하지 않는다.
