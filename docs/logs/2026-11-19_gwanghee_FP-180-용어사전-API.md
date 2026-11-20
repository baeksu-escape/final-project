# FP-180 금융 용어 사전 조회 API(HELP-01)와 기준 데이터 SQL 추가

- **날짜:** 2026-11-19
- **작성자:** 광희 (C조) / Claude Code
- **브랜치:** `feature-C/FP-180-glossary` (최신 develop a3be014에서 새로 만듦)
- **관련 N-ID:** N-30-1 (N-30-2 툴팁·N-32 챗봇이 이 API를 쓴다)
- **관련 결정:** 사용자 선택 11/19 — 새 `help` 패키지(N-31·32도 이곳), 시드는 dummy_db 생성기 밖의 별도 SQL, 화면은 api 함수·mock까지

## 무엇을, 왜 바꿨나
- AI 묶음(FP-179)의 첫 카드다. 툴팁(FP-157)과 챗봇(FP-207)이 쓸 용어 사전 API가 없었고, `GLOSSARY_TERM` 표는 비어 있었다(시드 0행).
- `GET /api/glossary`(HELP-01)를 만들었다. 사전 전체를 용어 이름 순서로 돌려주고, 비어 있으면 `[]`다(오류 아님).
- 화면에 나오는 용어 20개의 쉬운 말·뜻 풀이를 합성 교육용 문구로 써서 별도 SQL로 두었다. SHAP은 원인처럼 설명하지 않았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../help/controller/GlossaryController.java` | 새 파일. `GET /api/glossary` |
| `backend/.../help/service/GlossaryService.java` | 새 파일. 행 → 응답 변환, 빈 사전은 `[]` |
| `backend/.../help/mapper/GlossaryMapper.java`, `resources/mapper/help/GlossaryMapper.xml` | 새 파일. `GLOSSARY_TERM` 전체를 `ORDER BY TERM` |
| `backend/.../help/dto/GlossaryTermRow.java`, `GlossaryResponse.java` | 새 파일. 조회 행, 응답(`terms[]`: term·easyText·explanation) |
| `backend/src/test/.../help/service/GlossaryServiceTest.java` | 새 파일. 변환·순서·빈 목록 |
| `backend/src/test/.../help/controller/GlossaryControllerTest.java` | 새 파일. 200 필드 이름(`termId` 없음), 토큰 없음 401 |
| `backend/src/test/.../help/mapper/GlossaryMapperIT.java` | 새 파일. `-Ddb.it=true`일 때만, 시험 행 2개를 넣고 롤백 |
| `frontend/src/features/ai/api/glossaryApi.js` | 새 파일. `getGlossary()` |
| `frontend/src/features/ai/mocks/glossaryMockHandlers.js` | 새 파일. 시드 문구 5개, 로그인 안 했으면 401 |
| `docs/spec/sql/add_glossary_term.sql` | 새 파일. 용어 20개 `MERGE`(다시 실행 가능). 처음 이름 `seed_glossary_term.sql`을 SQL 폴더 규칙(기존 DB용은 `add_*`)에 맞춰 바꿈 |
| `docs/spec/sql/README.md` | 「먼저 내 상황에 맞는 경로를 고른다」 표에 한 행 추가(체크리스트 6) |
| `docs/spec/api/api_spec_c.md` | 「N-30-1 금융 용어 사전」 절, 최근 변경 |

## DB·API 변경
- DB
  - 표 구조 변경은 없다.
  - 기준 데이터 SQL `add_glossary_term.sql`을 새로 만들었다(`GLOSSARY_TERM` 20행). 아직 어느 DB에도 적용하지 않았다.
  - 적용하면 `dummy_db/99_check.sql`의 `GLOSSARY_TERM` 기대값(0)과 실제 값이 달라지는 것이 정상이다.
- API: `GET /api/glossary` 추가(HELP-01, 로그인 필요, 응답 `{ terms: [{ term, easyText, explanation }] }`)
- 영향을 받는 기능·팀원
  - 범영 님(DB 담당): 병합 후 공용 DB에 `add_glossary_term.sql` 실행(체크리스트 9). 로컬 DB는 각자 실행
  - 경환 님(더미 DB 생성기): 나중에 생성기·`99_check.sql`에 넣을지는 선택(지금은 별도 파일로 충분)
  - 화면 담당: 툴팁·챗봇에서 `features/ai/api/glossaryApi.js`의 `getGlossary()`를 쓸 수 있다
  - 범영·우찬 님: API 정의서 HELP-01 상태 🟡 → ✅ 반영

## 확인
- 확인함
  - `./mvnw clean test`: 394개 통과(실패 0). `GlossaryServiceTest` 2개, `GlossaryControllerTest` 2개 포함.
  - `npm run lint` 오류 0, `npm run build` 성공
  - 시드 SQL: 20행, 문자열 길이가 DDL 제한 안에 있음(쉬운 말 최대 37자/200, 뜻 풀이 최대 133자/1000)을 스크립트로 확인
  - 🆕 11/20 최신 develop(#106까지) 반영 후 다시 확인: `./mvnw clean test` 394개 통과, `npm run lint` 오류 0, DB 통합 테스트(`-Ddb.it=true`, 로컬 DB, 키는 일회용 값으로 덮어씀) `GlossaryMapperIT` 포함 5종 통과
- 확인 못 함
  - 시드 SQL을 실제 Oracle에 실행해 보지 않았다.

## 다음 사람이 알아야 할 것
- N-31(AI 요약)·N-32(챗봇)도 `com.baeksuescape.help`에 둔다.
- 툴팁(N-30-2)은 N-30에 적힌 6개 탭에서만 보인다. 상권 분석·대출 상품·신용 라운지·관리자·마이 페이지에는 두지 않는다.
- 용어·문구를 바꾸려면 `add_glossary_term.sql`을 고치고 다시 실행하면 된다(같은 용어는 덮어씀).

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
