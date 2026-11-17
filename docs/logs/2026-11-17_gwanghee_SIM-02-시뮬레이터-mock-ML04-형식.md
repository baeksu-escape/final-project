# SIM-02 시뮬레이터 점수 재계산 mock을 ML-04 형식으로 다시 쓰기

- **날짜:** 2026-11-17
- **작성자:** 광희 (C조) / Claude Code
- **브랜치:** `feature-C/FP-170-scoreBandOffer` (개인 브랜치, 커밋 전. develop에는 병합하지 않음)
- **관련 N-ID:** N-18-5, N-18-6(값만), N-18-8
- **관련 결정:** decisions.md 점수 범위 0–1000(11/12 확정), D2(부도 확률 표시 미정), A-22(10번째 키 제안)

## 무엇을, 왜 바꿨나
- 프론트 mock `POST /api/simulation/credit-care/recalculate`는 FP-176·177(11/09) 때의 옛 형식이었다.
  - 점수 범위가 300~900이었다.
  - camelCase 키 9개와 `altDataBonusDiff`를 썼다.
  - 카드 한도가 0이면 사용률을 50%로 가정했다.
- B조 ML-04 규칙(11/16, B팀 명세서 4-4)에 맞춰 mock 전체를 다시 썼다.
  - 키는 10개만 받는다. 모르는 키와 카드 한도·사용액 중 한쪽만 보낸 경우는 오류다.
  - 카드 한도가 0이면 사용률을 결측으로 계산한다.
- SIM-02(Spring) 계약은 아직 정해진 문서가 없어 **제안안**을 `api_spec.md`에 적었다.
  - 경로는 기존 이름을 그대로 쓴다.
  - 응답은 ML-04 응답에서 `requestId`·`shap`을 빼고, 감점 요인에 `featureName`을 더한 모양이다.
- Spring SIM-02 구현(ML-04 호출)은 하지 않았다. B조 확인 4건을 받은 뒤 진행한다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/simulation/mocks/simulationMockHandlers.js` | `handleCreditCareRecalculate`를 ML-04 형식으로 다시 씀(검사·금융/대안 영향·감점 요인 3개), 도우미 함수 추가 |
| `frontend/src/features/simulation/mocks/simulationMockData.js` | 출발 평가 예시(588점), 키 10개 → 피처 표, 등급별 부도 확률 예시 추가 |
| `frontend/src/features/simulation/api/simulationApi.js` | `recalculateCreditCare` 주석을 새 요청 모양(`{ changes }`)으로 수정 |
| `docs/spec/api_spec.md` | N-18-5·8 SIM-02 제안 계약 추가 |

## DB·API 변경
- DB: 없음
- API: `POST /api/simulation/credit-care/recalculate`의 요청·응답 모양이 바뀌었다(mock만 있고 Spring은 아직 없음).
  - 요청: `{ changes: { ML-04 키 10개 중 바꾼 것 } }`
  - 응답: `before`·`after`(score, gradeBandCode, defaultProb), `delta`(total, financialEffect, alternativeEffect), `topReductionFactors`
  - 오류: 400 `INVALID_INPUT`, `fieldErrors`의 field는 `changes.<키>`
- 영향을 받는 기능·팀원:
  - 지금 이 API를 부르는 화면은 없다.
  - 시뮬레이터 화면을 연결하는 프론트 담당은 새 모양을 기준으로 붙이면 된다.

## 확인
- 확인함:
  - `npm run lint` 오류 0
  - node로 mock을 직접 불러 확인했다.
    - 변경 없음 → 588 → 588
    - 정상 변경 → 588 → 623, `total = financialEffect + alternativeEffect`
    - 모르는 키 → 400 `changes.DELINQ_COUNT12M`
    - 카드 한쪽만 → 400 `changes.CARD_LIMIT_AMT`
    - 한도 0 → 오류 없음, 카드 영향 0
    - 점수가 0 아래로 내려가는 입력 → 0으로 자르고 영향 합이 맞음
  - 옛 이름(`300~900`, `altDataBonusDiff`, `telecomPaymentMonths`, `modelRecalculatedDiff`)이 frontend에 남지 않음(grep)
- 확인 못 함:
  - 화면 동작(이 API를 부르는 화면이 아직 없음)
  - 실제 ML-04 연동(Spring 미구현)

## 다음 사람이 알아야 할 것
- mock 점수는 "가장 좋은 값에서 떨어진 정도 × 고정 가중치"의 간단한 규칙이다. 진짜 모델 값이 아니다.
- B조 범영 님께 확인할 것:
  - `UTILITY_LATE_MONTHS` 확정 여부
  - `null`이 "바꾸지 않음"과 같은지
  - 범위를 벗어난 값이 422인지
  - 간편결제 "월 × 12" 변환이 바뀔지
- 쓰지 않는 Java DTO `CreditCareRecalculateRequest/Response`는 옛 형식이다. SIM-02 백엔드를 만들 때 함께 정리한다.
- `loans/recommend` mock과 `getScoreBandOffer`는 A조 대출 추천 쪽이라 손대지 않았다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
