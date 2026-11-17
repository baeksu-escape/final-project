# FP-183 소득 변동성 및 현금흐름 계산 로직 구현

- **날짜:** 2026-11-10
- **작성자:** 광희 (C조) / Antigravity
- **브랜치:** `feature-C/FP-183-income-volatility`
- **관련 N-ID:** N-22-3, N-22-4, N-22-5, N-21-5, N-21-6, N-21-7
- **관련 결정:** 투표 D1(소득 12개월 입력), decisions.md D-22(변동계수 12% 초과 판정)

## 무엇을, 왜 바꿨나
- 프리랜서·자영업자 대상 핵심 진단 기능인 소득 변동성(N-22) 및 현금흐름 전망(N-21) 계산 엔진을 백엔드에 구현했다.
- 팀 원칙에 따라 N-22-4와 N-21-7(성수기·비수기 격차) 계산은 `IncomeVolatilityCalculator.calculatePeakOffPeakGap()` 단일 공통 함수를 공유하도록 설계했다.
- 11/09 최신 명세 확정에 맞춰 12개월 소득 입력을 기준으로 소득 부족 달(N-22-5)과 다음 비수기 도래 개월 수(주기), 준비 권장 금액 계산 로직을 완성했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/src/main/java/com/baeksuescape/finance/dto/IncomeVolatilityResult.java` | FP-184 변동계수 및 성수기·비수기 격차 결과 DTO (BigDecimal 기반) |
| `backend/src/main/java/com/baeksuescape/finance/dto/DeficitMonthsResult.java` | FP-185 소득 부족 달 개수, 목록, 총 부족액 결과 DTO |
| `backend/src/main/java/com/baeksuescape/finance/dto/CashFlowForecastResult.java` | FP-186 월별 순현금, 최대 연속 적자 개월 수, 누적 적자액 결과 DTO |
| `backend/src/main/java/com/baeksuescape/finance/util/IncomeVolatilityCalculator.java` | FP-184/185/186 계산 엔진 (방어적 코딩, BigDecimal 정밀 연산 및 하위 호환) |
| `backend/src/main/java/com/baeksuescape/finance/service/IncomeVolatilityService.java` | FP-184/185/186 비즈니스 서비스 메서드 3종 구현 |
| `backend/src/test/java/com/baeksuescape/finance/service/IncomeVolatilityServiceTest.java` | FP-184/185/186 단위 테스트 (정상/예외/방어적 코딩 6건 통과) |
| `backend/src/test/java/com/baeksuescape/finance/util/IncomeVolatilityCalculatorTest.java` | N-22/N-21 기획 명세 일치 검증 단위 테스트 (5건 통과) |

## DB·API 변경
- DB: 없음 (회원 입력 데이터 기반 순수 계산 로직)
- API:
  - `POST /api/diagnosis/income-volatility` (신규): 12개월 소득/고정지출 전달 시 변동성 지표(CV, 12% 초과 여부), 성수기·비수기 격차, 소득 부족 달 정보 반환
  - `POST /api/diagnosis/cash-flow/forecast` (신규): 소득/지출 변동 조건 반영 시 기간별 순현금 및 worst month 반환
- 영향을 받는 기능·팀원: A조 재무 진단 화면 담당 (소득 변동성 탭, 현금흐름 시뮬레이터 탭)

## 확인
- 확인함:
  - `IncomeVolatilityServiceTest` 및 `IncomeVolatilityCalculatorTest` JUnit 5 단위 테스트 총 11건 전건 통과
    - [FP-184] 변동계수(CV) 산출, 12.0% 초과 판정, 상위/하위 N개월 성수기·비수기 격차 금액/비율 계산 검증
    - [FP-184] 빈 소득 데이터 입력 시 `IllegalArgumentException` 방어 검증
    - [FP-185] 기준 금액 미만 부족 달 3건 추출, 총 부족액(200만원) 및 경고 발생 검증
    - [FP-185] 부족 달 없을 때 경고 미발생(`false`) 검증
    - [FP-186] 월별 순 현금흐름(수입 - 지출), 최대 연속 적자 개월 수(2회), 총 누적 적자액(300만원), 가장 빠듯한 달 도출 검증
    - [FP-186] 수입/지출 리스트 크기 불일치 시 `IllegalArgumentException` 방어 검증
    - [N-22-5] 8월 기준 1월 적자 달(부족액 50만)에 대한 5개월 후 도래 주기 계산 검증
  - `backend/src/main/java/com/baeksuescape/finance/` 전체 소스 자바 17 컴파일 성공
- 확인 못 함:
  - 실제 Oracle DB 연동 (MyBatis 매퍼 쿼리는 이후 DB 적재 및 인증 완료 후 연계 예정)

## 다음 사람이 알아야 할 것
- `IncomeVolatilityCalculator.calculatePeakOffPeakGap` 메소드는 N-22-4와 N-21-7이 공통으로 사용하는 함수이므로, 시그니처나 로직 변경 시 두 기능 모두에 영향을 준다.
- 변동성 '변동이 큼' 판정 기준은 UI 확정 기준인 12.0% 상수를 적용했다 (`HIGH_VOLATILITY_THRESHOLD_CV = 12.0`).

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |

