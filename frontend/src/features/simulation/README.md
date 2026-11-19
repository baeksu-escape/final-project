# N-18 신용케어 시뮬레이터 화면 메모

상품·수치는 실제 금융 상품이나 평가 결과가 아니다. 점수·금리·한도는 같은 점수대의 참고 정보다.

## 구성

- `pages/SimulationPage.jsx`, `api/useSimulation.js`, `api/simulationApi.js`, `adapters/simulationAdapter.js`, 전용 `components/`·`mocks/`·`styles/simulation.css`로 나눈다. 6개 슬라이더와 원 단위 금액 4개(입력 10개)를 쓰며 NULL을 0으로 채우지 않는다.
- 라우트는 기존 `/simulator` 하나다.

## 서버 연결

- SIM-01 `GET /api/simulation/credit-care/base`: 현재 점수·입력 기준값. 응답에 `topReductionFactors`가 있으면 첫 화면 감점 카드에 쓴다(없으면 재계산 전까지 안내 문구).
- SIM-02 `POST /api/simulation/credit-care/recalculate`: 변경한 입력으로 재계산한다. 응답의 `topReductionFactors`로 감점 카드를 갱신한다.
- SIM-04 점수대별 금리·한도: 재계산 점수에 대한 예상 금리·한도를 가져온다.
- 실패는 `describeSimulationError`로 안내 문구를 만들어 보여 준다. 실패 후 mock으로 바꾸지 않는다. mock 모드(`VITE_USE_MOCK`)에서는 `mocks/`가 같은 모양으로 응답한다.
- SIM-03은 만들지 않았다. 추천은 아래처럼 LOAN-01과 화면 선택으로 한다.

## 입력과 계산

- 슬라이더·직접 숫자/금액 입력·예시값 넣기는 같은 change 경로를 쓴다. 입력이 500ms 멈추면 최신 유효값으로 한 번 재계산하며 계산 버튼은 없다. 실패했을 때만 다시 계산 버튼을 보인다.
- 이전 타이머와 늦은 응답은 순번으로 무효화한다(회원 전환·reload·되돌리기·unmount 포함). 기준값과 같은 입력·되돌리기는 요청하지 않는다. 계산 결과를 저장하거나 기존 평가를 덮어쓰지 않는다.
- 값이 없는(NULL) 항목은 입력을 비활성화하고 슬라이더는 위치만 유지한다. 서버에 저장된 값이 화면 범위 밖이어도 그 실제 값을 그대로 표시하고, 사용자가 바꾼 값만 범위(0 이상 정수, 화면 범위 안)를 검사한다.
- 입력 오류는 해당 칸 옆(`.field-error`)에 표시하고 오류 자리를 미리 비워 레이아웃이 흔들리지 않게 한다. 하단 상태 줄은 입력 확인·계산 실패일 때 붉게 보인다.
- 응답 변환(adapter)은 React 상태 updater 밖의 try에서 실행하고, 변환 오류는 계산 오류 안내로 전달한다. 점수 0~1000 정수, 금리 비음수 유한수, 한도 비음수 안전정수, 확률 0~1 등을 검증하며 금리·한도·확률의 NULL은 보존한다.

## 감점 요인과 추천

- 감점 카드는 서버의 `topReductionFactors`를 상위 3개까지 보여 준다. SHAP 결과는 점수에 영향을 준 요인일 뿐 인과관계가 아니라는 표현을 쓴다.
- 추천은 대출 상품 카탈로그(LOAN-01, `getLoanProducts`)에서 직군·점수 조건을 적용하고 최소 점수 내림차순, 최저 금리 오름차순으로 최대 3개를 고른다. 카드는 `loans/components/LoanProductCard.jsx`를 공유하며 즐겨찾기는 서버(LOAN-03~05)에 저장된다.

## 확인

실제 서버 모드에서의 화면 확인은 아직 하지 않았다. 사용자 최종 검수도 아직이다.
