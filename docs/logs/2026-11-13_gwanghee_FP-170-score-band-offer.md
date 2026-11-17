# FP-170 같은 점수대 참고 금리·한도 조회 API 추가

- **날짜:** 2026-11-13
- **작성자:** 광희 (C조) / Claude Code
- **브랜치:** `feature-C/FP-183-ImplementIncomeVolatilityANDCashFlowCalculationLogic` (FP-203·166에 이어 작업, 커밋 전)
- **관련 N-ID:** N-18-7 (금리·한도 부분)
- **관련 결정:** D-12(더미 대출 상품·참고 정보로만 표시), D-01(등급 경계 665·780), D-20(공통 응답 형식 미정)

## 무엇을, 왜 바꿨나
- FP-170 가운데 B조 예측 서버 없이 만들 수 있는 부분부터 구현했다. 점수를 받아 `SCORE_BAND_OFFER`에서 그 점수대의 참고 금리 범위·평균·한도를 찾는다.
- 등급은 고정값이 아니라 DB의 ACTIVE 등급 구간(`SCORE_GRADE_BAND` + `SCORE_CUTOFF_VERSION`)에서 찾는다. 등급 경계가 바뀌어도 코드를 고칠 필요가 없다.
- 상품 추천은 A조 담당이라 만들지 않았다. A조가 재사용할 수 있도록 `ScoreBandOfferService.findOffer()`를 공개했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../finance/mapper/ScoreBandOfferMapper.java` (신규) | 점수대 금리·한도, ACTIVE 등급 조회 |
| `backend/src/main/resources/mapper/finance/ScoreBandOfferMapper.xml` (신규) | 위 SQL 2개(resultMap 명시) |
| `backend/.../finance/dto/ScoreBandOfferRow.java` (신규) | `SCORE_BAND_OFFER` 1행 |
| `backend/.../finance/dto/GradeBandRow.java` (신규) | 등급 코드와 컷오프 버전 |
| `backend/.../finance/dto/ScoreBandOfferResponse.java` (신규) | 응답(필드 이름은 A조 `LoanRecommendResponse`와 맞춤) |
| `backend/.../finance/service/ScoreBandOfferService.java` (신규) | 점수 검사(0~1000) → 조회 → 응답. 없으면 404 |
| `backend/.../finance/controller/SimulationController.java` (신규) | `GET /api/simulation/score-band-offer` |
| `backend/src/test/.../service/ScoreBandOfferServiceTest.java` (신규) | 경계·응답 필드·평균 null·400·404 5건 |
| `backend/src/test/.../controller/SimulationControllerTest.java` (신규) | JSON 필드 이름·400·404 3건 |
| `backend/src/test/.../mapper/ScoreBandOfferMapperIT.java` (신규) | 실제 Oracle 조회 2건(`-Ddb.it=true`일 때만) |
| `frontend/src/features/simulation/api/simulationApi.js` | `getScoreBandOfferInfo(score)` 추가 |
| `frontend/src/features/simulation/mocks/simulationMockData.js` | 시드와 같은 점수대 자료 `SCORE_BAND_OFFER_ROWS` 추가 |
| `frontend/src/features/simulation/mocks/simulationMockHandlers.js` | 새 경로 mock 등록(기존 mock은 그대로) |
| `docs/spec/api_spec.md` | FP-170 금리·한도 절 추가 |

## DB·API 변경
- DB: 없음 (`SCORE_BAND_OFFER`, `SCORE_GRADE_BAND`, `SCORE_CUTOFF_VERSION` 읽기만)
- API: `GET /api/simulation/score-band-offer?score=` (신규, 경로 제안)
- 영향을 받는 기능·팀원:
  - A조: 대출 추천에서 재사용 가능. 기존 `loans/recommend` mock은 바꾸지 않았다
  - 경환: 시뮬레이터 화면(FP-91)

## 확인
- 확인함:
  - `./mvnw clean test` 전체 44건 통과. 새로 추가한 건은 8건이다.
    - ScoreBandOfferService 5건
    - SimulationController 3건
  - `npm run lint` 오류 0
  - 실제 Oracle(`-Ddb.it=true`): **등급 구간 조회 `selectActiveGradeBand` 통과**(DDL 기준 데이터 CUT-0.1, 664/665/780 경계)
- 확인 못 함:
  - 금리·한도 조회 `selectOfferByScore`. 로컬 DB에 `SCORE_BAND_OFFER` 시드가 없어 실패했다("SCORE_BAND_OFFER가 비어 있다"). `dummy_db/run_all.sql` 적재 후 다시 실행해야 한다.
  - 화면 동작(시뮬레이터 화면이 아직 없다).

## 다음 사람이 알아야 할 것
- 경로·필드 이름은 제안이다. A조와 맞춰야 한다.
- 더미 시드의 금리 상한이 세 점수대 모두 19.64%로 같다. 데이터 담당 확인이 필요하다.
- 점수 재계산(N-18-5)·예상 점수(N-21-8)는 B조 예측 서버가 준비되면 같은 컨트롤러(`SimulationController`)에 추가한다. 재계산 입력은 공통 재계산 틀(`RecalculationFrame`)을 쓴다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
