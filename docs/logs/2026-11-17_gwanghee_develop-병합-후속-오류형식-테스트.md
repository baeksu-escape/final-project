# develop 병합 후속: mock query 형식 맞춤, 오류 응답 공통 형식 적용, API 테스트 방식 변경

- **날짜:** 2026-11-17
- **작성자:** 광희 (C조) / Claude Code
- **브랜치:** `feature-C/FP-170-scoreBandOffer` (개인 브랜치. develop에는 병합하지 않음)
- **관련 N-ID:** N-21, N-22 (FP-203), N-16·N-20 (FP-166), N-18-7 (FP-170)
- **관련 결정:** D-20(공통 응답 형식, 문서상 미정이나 코드는 `{code, message, fieldErrors}`로 통일됨)

## 무엇을, 왜 바꿨나
- develop(PR #64까지)을 개인 브랜치로 가져오는 병합이 `frontend/src/common/mocks/mockHandlers.js`에서 충돌했다.
  - develop(A조 FP-80) 쪽을 택했다. 공용 mock은 이제 `query`를 URLSearchParams로, `headers`도 함께 넘긴다.
  - 공용 파일은 develop과 똑같이 두었다.
  - 내 mock 3곳(현금흐름 전망, 점수대 금리·한도, 대출 추천)은 `query.get()`으로 읽도록 고쳤다. 이 수정은 병합 커밋에 포함했다.
- 병합으로 들어온 공통 예외 처리기는 `ResponseStatusException`을 따로 처리하지 않는다. 그래서 FP-203·166·170의 400·404가 500 `INTERNAL_ERROR`로 바뀌는 문제가 생겼다. 세 서비스를 팀 표준 `ApiException`으로 바꿨다.
  - 입력 오류: `400 INVALID_INPUT`, 어느 칸인지 `fieldErrors`에 담는다
  - 자료 없음: `404 NOT_FOUND`
- `@WebMvcTest`가 A조 `AdminWebConfig`(관리자 매퍼 필요)를 함께 불러와 시작에 실패했다. 다른 팀과 같은 방식(`@SpringBootTest` + `@AutoConfigureMockMvc` + `test` 프로필 H2)으로 바꿨다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/mocks/mockHandlers.js` | 충돌 해결: develop과 같게 (병합 커밋) |
| `frontend/src/features/diagnosis/mocks/diagnosisMockHandlers.js` | 현금흐름 전망 mock이 `query.get()` 사용 (병합 커밋) |
| `frontend/src/features/simulation/mocks/simulationMockHandlers.js` | 대출 추천·점수대 mock이 `query.get()` 사용 (병합 커밋) |
| `backend/.../finance/service/IncomeVolatilityService.java` | 404를 `ApiException(NOT_FOUND)`로 |
| `backend/.../finance/service/FinancialHealthService.java` | 400을 `ApiException(INVALID_INPUT)` + `fieldErrors`(필드 이름)로 |
| `backend/.../finance/service/ScoreBandOfferService.java` | 400·404를 `ApiException`으로, 범위 밖은 `fieldErrors`에 `score` |
| `backend/src/test/.../controller/IncomeVolatilityControllerTest.java` | `@SpringBootTest` 방식, 응답 `code` 확인 |
| `backend/src/test/.../controller/FinancialHealthControllerTest.java` | `@SpringBootTest` 방식, `code`·`fieldErrors` 확인 |
| `backend/src/test/.../controller/SimulationControllerTest.java` | `@SpringBootTest` 방식, `code` 확인 |
| `backend/src/test/.../service/IncomeVolatilityServiceTest.java` | `ApiException` 기준으로 확인 |
| `backend/src/test/.../service/ScoreBandOfferServiceTest.java` | `ApiException`·`fieldErrors` 기준으로 확인 |
| `docs/spec/api_spec.md` | 오류 응답 형식·코드 설명 갱신 |

## DB·API 변경
- DB: 없음
- API: 경로·성공 응답은 그대로다. **오류 응답 본문만** Spring 기본 형식에서 공통 형식 `{code, message, fieldErrors}`로 바뀌었다(상태 코드는 같음).
- 영향을 받는 기능·팀원: 이 API를 부르는 프론트(동주 N-21·N-22 화면, A조 N-16·N-20, 경환 시뮬레이터 화면)

## 확인
- 확인함:
  - `./mvnw clean test` 전체 270건 통과(실패 0, 오류 0, 다른 팀 테스트 포함)
  - `npm run lint` 오류 0
  - 공용 `mockHandlers.js`가 develop(`9dcce00`)과 같음(`git diff` 차이 없음)
  - URLSearchParams `get()` 동작은 Node로 확인
- 확인 못 함:
  - 화면에서 mock 동작(해당 화면이 아직 없음)
  - 실제 DB 조회 통합 테스트. 로컬 DB 시드가 아직 비어 있다. 이제 적재는 `avenue_ddl.sql` → `dummy_db/run_seed_only.sql` 순서다.

## 다음 사람이 알아야 할 것
- finance 패키지 API 테스트는 이제 test 프로필로 전체 컨텍스트를 띄운다. 그래서 `@WebMvcTest`보다 느리다.
- `/api/diagnosis/**`, `/api/simulation/**`는 아직 로그인 없이 임시 개방이다(`AvenueProperties`). FP-203 GET의 `userId` 쿼리는 로그인 연동 때 `@AuthenticationPrincipal AuthUser`로 바꿔야 한다.
- decisions.md D-20 문구는 실제 코드와 다르다. 문서 담당 확인이 필요하다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
