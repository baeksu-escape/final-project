# finance DTO를 기능별 하위 패키지로 나누기

- **날짜:** 2026-11-19
- **작성자:** 임광희(C팀) / Claude Code
- **브랜치:** `feature-C/FP-217-DTO-Split` (Jira FP-217)
- **관련 N-ID:** 없음(구조 정리). 옮긴 DTO는 N-16·N-17·N-18·N-20·N-21·N-22 기능에서 쓴다
- **관련 결정:** FP-170 리뷰 피드백 — `finance/dto` 한 폴더에 파일이 23개라 찾기 어렵다

## 무엇을, 왜 바꿨나
- `finance/dto`의 DTO 21개를 기능별 하위 패키지 4개로 옮겼다. 클래스 이름·필드·동작·API 응답은 바뀌지 않는다.
  | 패키지 | 파일 |
  |---|---|
  | `finance.dto.health` | DsrCalculateRequest·Response, FinancialHealthRequest·Response |
  | `finance.dto.cashflow` | CashFlowConditionRequest, CashFlowForecastRequest·Response, IncomeVolatilityRequest·Response, MonthlyIncomeItem, DeficitMonthsResult, IncomeMonthRow, ExpectedScoreResponse |
  | `finance.dto.simulation` | CreditCareBaseResponse, CreditCareSimulationRequest·Response, ScoreBandOfferResponse, ScoreBandOfferRow, GradeBandRow, LoanRecommendResponse |
  | `finance.dto.scenario` | ScenarioRecalculateRequest(아직 쓰는 곳 없음, FP-167에서 고치거나 지운다는 주석 추가) |
- 옛 시뮬레이터 DTO 2개(`CreditCareRecalculateRequest`·`CreditCareRecalculateResponse`)를 지웠다. 11/09에 만든 옛 형식으로, FP-170의 새 DTO(`CreditCareSimulationRequest`·`Response`)로 대체되어 쓰는 곳이 없었다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `finance/dto/**` 21개 | `git mv`로 하위 패키지로 옮기고 `package` 줄만 수정 |
| `finance/dto/CreditCareRecalculateRequest.java`·`Response.java` | 삭제 |
| 컨트롤러 3·서비스 5·매퍼 인터페이스 2·`IncomeVolatilityCalculator` | import 줄만 새 경로로 수정(`IncomeVolatilityService`는 `dto.*` → `dto.cashflow.*`) |
| `mapper/finance/IncomeVolatilityMapper.xml`·`ScoreBandOfferMapper.xml` | `resultMap type`의 클래스 경로 수정 |
| 테스트 9개 | import·전체 경로만 수정 |

## DB·API 변경
- DB: 없음
- API: 없음(경로·요청·응답 필드 그대로)
- 영향을 받는 기능·팀원: 동주 님 FP-152 브랜치(미병합)의 `PeerBenchmarkResponse`는 `finance/dto`에 그대로 두어도 빌드는 되지만, 병합 전에 `finance/dto/peer/`로 옮기는 것을 제안할 예정

## 확인
- 확인함:
  - `finance.dto.<클래스>` 형태의 옛 경로가 코드·XML에 0건이다.
  - git이 21개를 rename으로 인식한다.
  - `./mvnw clean test` 전체 371개를 통과했다.
  - DB 통합 테스트(`-Ddb.it=true`, 로컬 DB) 3종 7개를 통과했다. XML 경로가 바뀐 `IncomeVolatilityMapperIT`·`ScoreBandOfferMapperIT`도 포함된다.
- 확인 못 함: 프론트 화면(변경 없음이라 실행하지 않음)

## 다음 사람이 알아야 할 것
- finance에 DTO를 새로 만들 때는 기능에 맞는 하위 패키지에 둔다. MyBatis XML의 `resultType`·`resultMap type`도 하위 패키지 경로로 적는다(컴파일로 잡히지 않는다).
- DB 통합 테스트를 로컬에서 돌릴 때, 로컬 `application.properties`의 AES·HMAC 키가 새 형식 검사(Base64, 32바이트)를 통과하지 못하면 스프링이 뜨지 않는다. 이번에는 실행할 때 `-Davenue.pii.aes-key`·`-Davenue.pii.hmac-key`에 일회용 무작위 값을 넣어 돌렸다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
