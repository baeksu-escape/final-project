# FP-181 (1부) 용어 도우미 질문 버튼 조회 API(HELP-02)와 기준 데이터 SQL 추가

- **날짜:** 2026-11-19
- **작성자:** 광희 (C조) / Claude Code
- **브랜치:** `feature-C/FP-181-chatbot-presets` (최신 develop a3be014에서 새로 만듦)
- **관련 N-ID:** N-32-1
- **관련 결정:** D-21(자유 질문에 넘길 정보, 미정)은 이번 범위 밖. 구조는 FP-180과 같다(`help` 패키지, 별도 시드 SQL, 화면은 api·mock)

## 무엇을, 왜 바꿨나
- 팀원 확인대로 `CHATBOT_PRESET_QUESTION` 표는 DDL에 이미 있어 DDL은 바꾸지 않았다. 비어 있던 질문 버튼 4개의 문구(데이터)와 API를 채웠다.
- `GET /api/chatbot/presets`(HELP-02)는 질문 버튼 4개와 답을 표시 순서대로 돌려준다. AI를 부르지 않고 질문 횟수도 줄이지 않는다(N-32-1).
- 자유 질문(HELP-03, N-32-2)과 AI 요약(N-31)은 Gemini 키·D-18·D-21이 정해진 뒤 FP-181 2부에서 한다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../help/controller/ChatbotController.java` | 새 파일. `GET /api/chatbot/presets` |
| `backend/.../help/service/ChatbotService.java` | 새 파일. 행 → 응답 변환, 빈 목록은 `[]`, 기록·횟수 없음 |
| `backend/.../help/mapper/ChatbotMapper.java`, `resources/mapper/help/ChatbotMapper.xml` | 새 파일. `ORDER BY DISPLAY_ORDER, PRESET_ID` |
| `backend/.../help/dto/ChatbotPresetRow.java`, `ChatbotPresetResponse.java` | 새 파일. 조회 행, 응답(`presets[]`: presetId·question·answer) |
| `backend/src/test/.../help/service/ChatbotServiceTest.java` | 새 파일. 변환·순서·빈 목록, 조회 말고는 매퍼를 부르지 않음 |
| `backend/src/test/.../help/controller/ChatbotControllerTest.java` | 새 파일. 200 필드 이름(DB 열 이름 없음), 토큰 없음 401 |
| `backend/src/test/.../help/mapper/ChatbotMapperIT.java` | 새 파일. `-Ddb.it=true`일 때만, 시험 행 2개를 넣고 롤백 |
| `frontend/src/features/ai/api/chatbotApi.js` | 새 파일. `getChatbotPresets()` |
| `frontend/src/features/ai/mocks/chatbotMockHandlers.js` | 새 파일. 시드와 같은 4개, 로그인 안 했으면 401 |
| `docs/spec/sql/add_chatbot_preset_question.sql` | 새 파일. 질문 버튼 4개 `MERGE`(표시 순서 기준, 다시 실행 가능). 처음 이름 `seed_chatbot_preset_question.sql`을 SQL 폴더 규칙(기존 DB용은 `add_*`)에 맞춰 바꿈. 4번 답의 "더미(예시)"를 "서비스 시연용으로 만든 예시 데이터"로 쉽게 바꿈 |
| `docs/spec/sql/README.md` | 「먼저 내 상황에 맞는 경로를 고른다」 표에 한 행 추가(체크리스트 6) |
| `docs/spec/api/api_spec_c.md` | 「N-32-1 용어 도우미 질문 버튼」 절, 최근 변경 |

## DB·API 변경
- DB
  - 표 구조 변경은 없다.
  - 기준 데이터 SQL `add_chatbot_preset_question.sql`을 새로 만들었다(4행). 아직 어느 DB에도 적용하지 않았다.
  - 적용하면 `dummy_db/99_check.sql`의 `CHATBOT_PRESET_QUESTION` 기대값(0)과 실제 값이 달라지는 것이 정상이다.
- API: `GET /api/chatbot/presets` 추가(HELP-02, 로그인 필요, 응답 `{ presets: [{ presetId, question, answer }] }`)
- 영향을 받는 기능·팀원
  - 범영 님(DB 담당): 병합 후 공용 DB에 `add_chatbot_preset_question.sql` 실행(체크리스트 9). 로컬 DB는 각자 실행
  - 경환 님(더미 DB 생성기): 나중에 생성기·`99_check.sql`에 넣을지는 선택(지금은 별도 파일로 충분)
  - 용어 도우미 화면(FP-207): `getChatbotPresets()`를 쓸 수 있다
  - 범영 님: 이 PR은 `api_definition.md`를 고치지 않는다. 병합 후 정의서 HELP-02 상태를 🟡 → ✅로 바꾸는 것은 후속 작업이다(PR 본문으로 요청)

## 확인
- 확인함
  - `./mvnw clean test`: 394개 통과(실패 0). `ChatbotServiceTest` 2개, `ChatbotControllerTest` 2개 포함.
  - `npm run lint` 오류 0, `npm run build` 성공
  - 시드 SQL: 4행, 길이가 DDL 제한 안(질문 최대 35자/200, 답 최대 267자/2000)임을 스크립트로 확인
  - 🆕 11/20 최신 develop(FP-180 #108 병합 포함) 반영 후 다시 확인: `./mvnw clean test` 398개 통과, `npm run lint` 오류 0, DB 통합 테스트(`-Ddb.it=true`, 로컬 DB, 키는 일회용 값으로 덮어씀) `ChatbotMapperIT`·`GlossaryMapperIT` 포함 6종 통과
- 확인 못 함
  - 시드 SQL의 Oracle 실행 확인은 병합 후 DB 담당이 실행하면서 `COUNT = 4`로 확인한다.

## 다음 사람이 알아야 할 것
- FP-180(용어 사전, `feature-C/FP-180-glossary`)과 같은 `help` 패키지에 다른 파일을 추가했다. 코드 충돌은 없지만 `api_spec_c.md`의 「최근 변경」 줄과 문서 끝 절이 같은 자리라, 나중에 병합하는 쪽에서 두 쪽 내용을 모두 남긴다.
  - 🆕 11/20 FP-180(#108)이 먼저 병합되어 이 브랜치에서 develop을 반영하며 정리했다. 「최근 변경」 두 줄을 모두 두고, 문서 끝은 N-30-1 절(FP-180) 다음에 N-32-1 절(FP-181)을 두었다. 어느 쪽 내용도 지우지 않았다.
- 🆕 11/20 FP-180 리뷰와 같은 형식으로 SQL의 `WHENEVER SQLERROR`·`OSERROR`에 `ROLLBACK`을 붙였다(FP-139 e33120d와 같음).
- HELP-03(자유 질문)은 `ChatbotMapper`·`ChatbotService`·`ChatbotController`에 이어서 추가한다. 하루 횟수는 `APP_SETTING.CHATBOT_DAILY_LIMIT`(10)을 쓰고, `CHATBOT_QUESTION_LOG`에는 질문 글을 저장하지 않으며 `SUCCESS_YN = 'Y'`만 센다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
