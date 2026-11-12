# 공과금 대안 데이터 추가와 데이터 입력 화면의 항목별 정보 제공 동의 (FP-85)

- **날짜:** 2026-11-12
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-85-utility-consent` (`feature-A/FP-199-V3-UPDATE`에서 분기)
- **관련 N-ID:** N-05-6, N-05-9
- **관련 결정:** 11/12 대안 데이터 5종(공과금 추가, DDL v0.3.1 U1), DDL v0.3.2 W1·W3, 팀 합의 "동의는 데이터 입력 화면에서 받는다"

## 무엇을, 왜 바꿨나
- 공과금(utility)을 5번째 대안 데이터로 추가했다. 열 이름은 DDL `USER_UTILITY_PAYMENT` 열을 camelCase로 썼고, 12개월 중 LATE·UNPAID가 1~2건 섞이게 했다.
- 기존 4종 mock 응답에 DDL의 NOT NULL 열 중 없던 값을 **추가**했다. 기존 필드 이름은 바꾸지 않았다(아래 대조표).
- 불러올 기간 `ALT_DATA_MONTHS`를 6에서 12로 바꿨다. B팀 명세서 v0.2 기준 대안 데이터 기간은 기준월 −11 ~ 기준월이다.
- [불러오기] 전에 항목별 정보 제공 동의 창(공통 `Modal`)을 띄운다.
  - 창 내용: 제공 기관, 불러오는 항목, 이용 목적, 보관 기간, [필수] 체크
  - 동의한 종류는 동의일과 [연결 해제]를 보여 준다.
  - [연결 해제]하면 동의를 거두고, 그 동의로 불러온 데이터를 지운다.
- 동의와 불러온 데이터의 mock 저장소를 `altDataMockStore.js`로 분리했다. FP-93 탈퇴가 쓸 회원별 삭제 함수 `withdrawAllAltDataOfUser`를 내보낸다.
- 완료 현황 조건(`completionItems.js`)은 바꾸지 않았다. FP-86에서 다룬다. CSS는 넣지 않았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/dataInput/config/altDataSources.js` | 공과금 항목, 종류별 동의 정보(`consent`), `ALT_DATA_MONTHS` 12, 동의 종류·이용 목적·보관 기간·납부 상태 이름 상수 |
| `frontend/src/features/dataInput/mocks/altDataMock.js` | 공과금 줄, 기존 4종에 DDL 열 추가, 납부 기한·납부일 규칙(DDL CHECK와 같음), jobType 인자 |
| `frontend/src/features/dataInput/mocks/altDataMockStore.js` | 새 파일. 동의·불러온 데이터 저장소와 회원별 삭제 함수 |
| `frontend/src/features/dataInput/mocks/dataInputMockHandlers.js` | 동의 API mock 3개, 유효 동의가 없으면 불러오기 409 `CONSENT_REQUIRED`, 저장소 분리 |
| `frontend/src/features/dataInput/api/dataInputApi.js` | 동의 경로 상수(🟡 제안 경로)와 함수 3개, `importAltData`에 consentId |
| `frontend/src/features/dataInput/components/AltDataImport.jsx` | 동의 창, 동의일·[연결 해제], 납부 상태 코드 표시 |
| `frontend/src/features/dataInput/pages/DataInputPage.jsx` | [연결 해제] 뒤 표 데이터·완료 현황 비우기(`onDisconnected`) |

## DB·API 변경
- DB: 없음. DDL v0.3.2의 `USER_CONSENT`, `USER_UTILITY_PAYMENT` 등 기존 표를 따른다.
- API(mock, 🟡 API 정의서 v0.1 제안 경로)

| 요청 | 본문 | 응답 | 오류 |
|------|------|------|------|
| `GET /api/members/me/consents` | 없음 | `{ items: [{ consentId, consentTypeCode, providerCode, itemCode, requiredYn, agreedYn, agreedAt, expiresAt, withdrawnAt }] }`(철회한 동의 포함) | 401·403·409 |
| `POST /api/members/me/consents` | `{ consentTypeCode: 'ALT_DATA_PROVISION', providerCode, itemCode }` | `{ consentId, agreedAt }`. 같은 항목에 유효한 동의가 있으면 그 동의를 돌려준다 | 400 종류·기관·항목 틀림 |
| `DELETE /api/members/me/consents/{consentId}` | 없음 | `{ consentId, withdrawnAt }` | 404 내 동의가 아님 |
| `POST /api/members/me/alt-data/{source}/import` | `{ baseMonth, consentId }`(consentId 추가) | `{ source, importedAt, rows, consentId }` | 409 `{ code: 'CONSENT_REQUIRED' }` |

- 제공 기관·항목 코드(DDL 주석 값)

| 종류 | providerCode | itemCode |
|------|--------------|----------|
| 간편결제 | payment | EASYPAY |
| 통신비 | telecom | TELECOM_BILL |
| 국민연금 | public-insurance | NATIONAL_PENSION |
| 건강보험료 | public-insurance | HEALTH_INSURANCE |
| 공과금 | utility | UTILITY_BILL |

- 프론트 필드 ↔ DDL 열(이름이 다른 것만). 공과금은 모두 DDL 이름과 같다.

| 종류 | 프론트 필드 | DDL 열 | 비고 |
|------|-------------|--------|------|
| 간편결제 | `month` | `BASE_MONTH` | 기존 이름 유지 |
| 간편결제 | `paymentAmount` | `PAYMENT_AMT` | 기존 이름 유지 |
| 통신비 | `month` | `BILL_MONTH` | 기존 이름 유지 |
| 통신비 | `billedAmount` | `BILLED_AMT` | 기존 이름 유지 |
| 통신비 | `paymentStatus`(정상 납부·연체) | `PAYMENT_STATUS_CODE` | 표시용 글자. 코드는 `paymentStatusCode`로 추가 |
| 국민연금·건강보험 | `month` | `BASE_MONTH` | 기존 이름 유지 |
| 국민연금·건강보험 | `paidAmount` | `PAID_AMT` | 기존 이름 유지. 미납이면 0 |
| 국민연금·건강보험 | `paymentStatus`(정상 납부·미납) | `PAYMENT_STATUS_CODE` | 표시용 글자. 코드는 `paymentStatusCode`로 추가 |

- 새로 추가한 응답 필드
  - 간편결제: `observationStatusCode`, `activeDays`
  - 통신비: `dueDate`, `paidDate`, `paymentStatusCode`
  - 국민연금·건강보험: `insuranceTypeCode`, `coverageStatusCode`, `payerTypeCode`, `dueDate`, `paidDate`, `paymentStatusCode`
- 빼 둔 값: 서버가 채우는 `SOURCE_CODE`·`CONSENT_ID`·`BASE_DATE`. 국민연금·건강보험의 `BILLED_AMT`·`INDIVIDUAL_AMT`는 NULL 허용이라 넣지 않았다.
- 영향을 받는 기능·팀원
  - FP-86: 5종 모두 필수 조건
  - FP-93: 탈퇴할 때 `withdrawAllAltDataOfUser` 사용
  - Spring 담당: 동의 API 3개, import의 consentId 검사(W3)

## 확인
- 확인함: `npm run lint` 통과, `npm run build` 통과
- 확인함: Node 스크립트로 mock 처리 함수를 직접 불러 72개 항목 통과
  - 5종 각각 동의 → 불러오기 → 연결 해제
  - 동의 없이, 다른 항목의 동의로, 다른 회원의 동의로, 거둔 동의로 불러오면 409
  - 행이 DDL CHECK(상태와 납부일, 이용일 수)를 지킴
  - 12개월이고 마지막 달이 기준월
  - 공과금 LATE·UNPAID 1~2건
  - 동의 이력이 남음
  - 회원별 삭제 함수 동작
- 확인 못 함: 브라우저에서 동의 창을 직접 눌러 보는 확인. 이 환경에서 화면을 띄울 수 없다. `npm run dev`(VITE_USE_MOCK=true)로 확인해야 한다.

## 다음 사람이 알아야 할 것
- mock 라우터(`common/mocks/mockHandlers.js`)는 경로 변수를 지원하지 않는다. 그래서 동의를 만들 때 그 번호의 DELETE 경로를 등록한다(`registerConsentDeleteHandler`). 공통 파일은 고치지 않았다.
- 보관 기간 문구("동의일로부터 1년…")는 DDL 주석(EXPIRES_AT 최대 1년, W1)을 근거로 쓴 안이라 팀 확인이 필요하다(`ALT_DATA_CONSENT_TERMS`).
- 제공 기관 이름은 "가상 ○○(모의)"로 썼다. 실제 기관과 연결하지 않는다.
- 새로 붙인 클래스: `alt-data-source__consent-date`, `alt-data-source__disconnect`, `alt-data-source__result`, `alt-data-consent`, `alt-data-consent__terms`. 스타일은 없다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
