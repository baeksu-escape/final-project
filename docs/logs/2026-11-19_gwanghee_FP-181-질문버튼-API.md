# FP-181 용어 도우미 질문 버튼(HELP-02)·자유 질문(HELP-03)·AI 요약(RPT-04) API와 기준 데이터 SQL 추가

- **날짜:** 2026-11-19
- **작성자:** 광희 (C조) / Claude Code
- **브랜치:** `feature-C/FP-181-chatbot-presets` (최신 develop a3be014에서 새로 만듦)
- **관련 N-ID:** N-32-1, 🆕 11/26 N-32-2, N-31-2
- **관련 결정:** 구조는 FP-180과 같다(`help` 패키지, 별도 시드 SQL, 화면은 api·mock). 🆕 11/26 decisions.md 1-1 AI 서비스(OpenAI)·D-18(연결 2초/응답 15초) 확정, D-21(질문 글만 넘김)은 그대로 따른다
- **범위:** 처음에는 1부(HELP-02)만 PR하려 했으나, 11/26 팀 규칙(Jira 카드 1개 = PR 1개)에 따라 2부(HELP-03·RPT-04)까지 이 PR 하나로 낸다(아래 11/26 2부 절)

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
  - 광희(PR 작성자): 병합 후 공용 DB에 `add_chatbot_preset_question.sql`을 실행하고 DB 변경 채널에 남긴다(🆕 11/23 sql README 「공용 DB 적용 규칙」, 범영 님은 검수). 로컬 DB는 각자 실행
  - 경환 님(더미 DB 생성기): 나중에 생성기·`99_check.sql`에 넣을지는 선택(지금은 별도 파일로 충분)
  - 용어 도우미 화면(FP-207): `getChatbotPresets()`를 쓸 수 있다
  - 범영 님: 🆕 11/23 새 규칙(정의서 2장 행은 만든 사람이 PR에서 고침)에 따라 이 PR에서 정의서 HELP-02 상태를 🟡 → ✅로 직접 바꿨다. 범영 님은 리뷰에서 검수한다

## 확인
- 확인함
  - `./mvnw clean test`: 394개 통과(실패 0). `ChatbotServiceTest` 2개, `ChatbotControllerTest` 2개 포함.
  - `npm run lint` 오류 0, `npm run build` 성공
  - 시드 SQL: 4행, 길이가 DDL 제한 안(질문 최대 35자/200, 답 최대 267자/2000)임을 스크립트로 확인
  - 🆕 11/20 최신 develop(FP-180 #108 병합 포함) 반영 후 다시 확인: `./mvnw clean test` 398개 통과, `npm run lint` 오류 0, DB 통합 테스트(`-Ddb.it=true`, 로컬 DB, 키는 일회용 값으로 덮어씀) `ChatbotMapperIT`·`GlossaryMapperIT` 포함 6종 통과
- 확인 못 함
  - 시드 SQL의 공용 DB 실행은 병합 후 PR 작성자(광희)가 하면서, SQL 끝 확인 쿼리에 표시 순서 1~4가 하나씩(4행) 나오는지로 확인한다.

## 11/23 최신 develop 반영·새 규칙 정리 (PR 전)
- 11/20 이후 develop이 크게 앞서가(#109~#132) 다시 반영했다. 충돌은 2곳이다.
  - `api_spec_c.md` 맨 위 「최근 변경」: #132 새 규칙("기능 PR은 맨 위 「최근 변경」을 고치지 않는다")에 따라 FP-181 줄을 빼고 develop 쪽만 남겼다. 문서 끝 N-32-1 절은 그대로다.
  - `sql/README.md` 경로 표: develop의 최신 "모델 전환(0.1)" 행과 FP-181의 "질문 버튼 4개" 행을 모두 남겼다.
  - develop 대비 지운 줄은 0줄이다.
- 새 규칙 반영
  - SQL 머리말: 공용 DB 실행을 "DB 담당(범영)"에서 "PR 작성자가 병합 후 실행하고 DB 변경 채널에 남긴다"로 고쳤다(#124 문구와 같음).
  - 정의서 HELP-02 행: 상태를 `✅ FP-181 🆕 11/23`으로 직접 고쳤다.
- 2부(N-31 요약, N-32-2 자유 질문)는 이번 PR 범위가 아니다. Jira FP-181은 열어 둔다.
- 확인
  - `./mvnw clean test` 460개 통과
  - DB 통합 테스트(로컬 Oracle, 키는 일회용 값) 8종 통과(`ChatbotMapperIT` 포함)
  - `npm run lint` 오류 0, `npm run build` 성공
  - mock 직접 호출: 질문 버튼 4개(`presetId`·`question`·`answer`), 비로그인 401
  - 충돌 표시 검사 0건

## 11/26 2차 개발 시작 — 최신 develop(c1d0380, #150~#155) 반영 후 PR
- 11/23 이후 develop이 138커밋 앞서가 다시 반영했다. 충돌은 없었다(`api_definition.md`·`api_spec_c.md`·`sql/README.md` 자동 병합). 정의서 HELP-02 행은 `✅ FP-181 🆕 11/23`, sql README 경로 표의 질문 버튼 행이 그대로 남은 것을 확인했다.
- 보안 설정 확인: `/api/chatbot/**`는 임시 개방 목록에 없고 「그 밖의 `/api/**` = 로그인 필요」에 걸린다(코드 변경 없음).
- 확인
  - `./mvnw test` 496개 통과(실패 0), `ChatbotServiceTest`·`ChatbotControllerTest` 각 2개 포함
  - DB 통합 테스트(로컬 Oracle, 키는 일회용 값) 9종 중 `ChatbotMapperIT`·`GlossaryMapperIT` 포함 8종 통과. `ScoreBandOfferMapperIT` 2건 실패는 로컬 DB가 아직 CUT-0.1 등급 구간이라서(기대 CUT-0.3·654, 실제 CUT-0.1·665)이며 이 PR과 무관하다. 로컬에 `activate_cutoff_cut_0_3.sql`을 실행하면 맞춰진다.
  - `npm run lint`(`features/ai`) 오류 0, `npm run build` 성공
  - FP-181 파일 공백 오류 0, 충돌 표시 검사 0건
- AI 제공사: 11/26 OpenAI 키를 받았다는 이야기가 있었으나 `decisions.md` 확정 사항은 Gemini 무료 등급이다. 바꾸려면 팀 결정과 decisions.md 수정이 먼저다. → 같은 날 강사 안내로 OpenAI로 정해져 아래 2부에서 decisions.md를 고쳤다.

## 11/26 2부 — 자유 질문(HELP-03)·AI 요약(RPT-04), 한 PR로 합침
### 무엇을, 왜
- 강사 안내: 챗봇·요약 담당은 강사가 주는 OpenAI 키를 쓴다(광희 확인: 요약에도 사용 가능). decisions.md 1-1의 Gemini 무료 등급을 OpenAI로 바꿨다.
- Spring AI 1.0은 Spring Boot 3.4 이상만 공식 지원한다. 우리는 3.2.5라 팀 전체 버전을 올려야 해서 쓰지 않고, FastAPI 호출(`PredictionClient`)과 같은 **RestClient 직접 호출**로 했다(광희 선택, pom 변경 없음).
- 키가 없는 팀원 PC에서도 백엔드가 켜지도록, 키가 비면 두 API만 503 `AI_UNAVAILABLE`로 답한다.
- 범영 님 `ReportController`·`ReportService`·`AssessmentMapper`는 고치지 않았다. RPT-04는 `help` 패키지에 새 컨트롤러로 두고, 본인 확인은 `ReportService.byRequestId`(RPT-03)를 호출해 그대로 쓴다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../help/client/OpenAiProperties.java` | 새 파일. `avenue.ai.openai.*`(키·모델 기본 `gpt-5.6-luna`·주소·연결 2초/응답 15초) |
| `backend/.../help/client/OpenAiClient.java` | 새 파일. `POST /chat/completions`, 키 없음 503, 실패·시간 초과·빈 답 502 `AI_FAILED`, 로그에 글·키 없음 |
| `backend/.../help/controller/ChatbotController.java` | HELP-02에 로그인 사용자 번호, `POST /api/chatbot/questions` 추가 |
| `backend/.../help/service/ChatbotService.java` | 남은 횟수 계산, `ask()`: 한도 429, 성공 Y·실패 N 기록(시각은 서버 Clock) |
| `backend/.../help/dto/ChatbotPresetResponse.java` | `remainingCount`·`dailyLimit` 추가 |
| `backend/.../help/dto/ChatbotQuestionRequest·Response.java` | 새 파일. 1~200자 검사, 응답 `answer`·`remainingCount`·`dailyLimit` |
| `backend/.../help/mapper/ChatbotMapper.java·xml` | `countSuccessSince`(Y만), `insertQuestionLog`(시각·성공 여부만) |
| `backend/.../help/controller/AiSummaryController.java` | 새 파일. `POST /api/report/{requestId}/ai-summary` |
| `backend/.../help/service/AiSummaryService.java` | 새 파일. 저장된 요약 재사용, 산출 안 됨 409, 계산값만 넣은 글, 1000자 자르기, 빈 경우만 저장 |
| `backend/.../help/mapper/AiSummaryMapper.java·xml`, `dto/AiSummaryResponse.java` | 새 파일. `AI_SUMMARY IS NULL`일 때만 UPDATE, 조회 |
| `backend/src/main/resources/application.properties.example` | `avenue.ai.openai.api-key=${OPENAI_API_KEY:}`(키 값은 환경변수에만)와 설명 |
| 테스트 | `OpenAiClientTest`(새, JDK HttpServer로 가짜 응답), `AiSummaryServiceTest`(새), `AiSummaryMapperIT`(새), `ChatbotServiceTest`·`ChatbotControllerTest`·`ChatbotMapperIT` 보강 |
| `frontend/src/features/ai/api/chatbotApi.js`, `mocks/chatbotMockHandlers.js` | `askChatbotQuestion()`, mock 입력 검사·10회 초과 429·남은 횟수 |
| `frontend/src/features/ai/api/aiSummaryApi.js`, `mocks/aiSummaryMockHandlers.js` | 새 파일. `requestAiSummary(requestId)`, mock 리포트 한 건 |
| `docs/ai/decisions.md` | 1-1 AI 서비스 OpenAI, 외부 호출 타임아웃(D-18) 확정, 2장 미정에서 D-18 삭제 |
| `AGENTS.md` | 1장·5장 "Gemini" → "서비스 AI(OpenAI)" (넘길 정보 규칙은 그대로) |
| `docs/spec/api/api_definition.md` | 1-2 오류 code 4개(`NOT_SCORED`·`DAILY_LIMIT_EXCEEDED`·`AI_FAILED`·`AI_UNAVAILABLE`), RPT-04·HELP-03 ✅, HELP-02 설명, Q-7 |
| `docs/spec/api/api_spec_c.md` | HELP-02 응답 필드, 새 절 N-32-2(HELP-03)·N-31-2(RPT-04), 공용 DB 실행 주체 문구 |
| `docs/ai/features.md` | N-31-2·N-32-2에 API·AI 제공사 메모 |

### DB·API 변경
- DB: 표 구조 변경 없음, 새 SQL 없음. `CHATBOT_QUESTION_LOG`·`APP_SETTING.CHATBOT_DAILY_LIMIT`(10)·`ASSESSMENT.AI_SUMMARY`는 DDL에 이미 있다(행이 없어도 기본 10).
- API: HELP-03 추가, RPT-04 추가, HELP-02 응답에 `remainingCount`·`dailyLimit` 추가(기존 필드는 그대로라 FP-207 화면은 그대로 동작)
- 영향을 받는 팀원
  - 전원: 백엔드는 키 없이도 켜진다. 각자 `application.properties`에 `avenue.ai.openai.api-key=${OPENAI_API_KEY:}` 한 줄(키 값 없음)을 복사하고, AI 기능을 시연할 PC에만 환경변수 `OPENAI_API_KEY`를 설정한다(강사 안내: 키 값은 .env 또는 환경변수에만, 메신저·노션·코드·properties에 복사 금지).
  - AGENTS.md·decisions.md는 팀 공통 문서라 PR 본문과 팀 채널에 알린다.
  - 범영 님: RPT 경로에 광희 API가 생긴다(`/api/report/{requestId}/ai-summary`). 저장한 요약은 RPT-02·03 `aiSummary`로 나간다.
  - FP-207(용어 도우미 화면)·FP-182(AI 요약 카드)가 이 API를 쓴다.

### 확인
- 확인함
  - `./mvnw clean compile` 성공, `./mvnw test` **547개 통과**(실패 0). 새 테스트: `OpenAiClientTest` 6, `AiSummaryServiceTest` 7, `ChatbotServiceTest` 6, `ChatbotControllerTest` 7
  - DB 통합 테스트(로컬 Oracle, 키는 일회용 값): `ChatbotMapperIT` 2·`AiSummaryMapperIT` 1·`GlossaryMapperIT` 1 통과
  - `npm run lint` 오류 0, `npm run build` 성공, mock 직접 호출(남은 횟수 10 → 질문 후 9, 빈 질문 400, 요약 generated true → false)
- 확인 못 함 / 남은 것
  - 실제 OpenAI 호출: 광희 님이 자기 `application.properties`에 키를 넣은 뒤 확인한다(아래 「실제 호출 확인」에 결과를 적는다).
  - 기본 모델: 처음 `gpt-4o-mini`로 했으나 강사 키의 프로젝트는 이 모델 권한이 없어 403(`model_not_found`)이었다. 키로 쓸 수 있는 대화 모델은 `gpt-5.6-luna`·`sol`·`terra` 셋이라(11/26 모델 목록 조회), 짧은 질문 한 번씩 비교해 답이 짧고 추론 토큰을 쓰지 않은 `gpt-5.6-luna`를 기본값으로 바꿨다(`avenue.ai.openai.model`로 바꿀 수 있음).
  - 세 모델 모두 답에 `**굵게**` 같은 마크다운을 넣어서, 두 지시 문장에 "마크다운을 쓰지 않는다"를 더했다.
- 🆕 11/26 실제 호출 확인(로컬 DB, 8092 임시 서버, 키는 사용자 환경변수에서 바로 넘기고 출력하지 않음, 회원 2)
  - HELP-03 "신용점수와 DSR은 어떤 관계가 있나요?" → 200, 3.8초, 마크다운 없는 5문장, 남은 횟수 10 → 9
  - HELP-03 금융과 무관한 질문("저녁 메뉴 추천") → 200, "금융 용어만 설명할 수 있어요" 안내. AI를 부른 성공 호출이라 횟수는 줄었다(8). 지금 규칙대로다
  - HELP-02 남은 횟수 8/10 확인
  - RPT-04 첫 요청 → 200, 1.8초, `generated: true`, 3문장(점수·점수 차이·작용 점수 3개·시연용 안내), 원인 표현 없음. 두 번째 → `generated: false`(AI 호출 없음), RPT-02 `aiSummary`에 저장된 것 확인
  - RPT-04 남의 평가(회원 3이 회원 2의 requestId) → 404
  - 로컬 DB에 남은 것: 회원 2의 최신 평가 `AI_SUMMARY` 1건, `CHATBOT_QUESTION_LOG` 성공 2줄(공용 DB는 건드리지 않음)

## 다음 사람이 알아야 할 것
- FP-180(용어 사전, `feature-C/FP-180-glossary`)과 같은 `help` 패키지에 다른 파일을 추가했다. 코드 충돌은 없지만 `api_spec_c.md`의 「최근 변경」 줄과 문서 끝 절이 같은 자리라, 나중에 병합하는 쪽에서 두 쪽 내용을 모두 남긴다.
  - 🆕 11/20 FP-180(#108)이 먼저 병합되어 이 브랜치에서 develop을 반영하며 정리했다. 「최근 변경」 두 줄을 모두 두고, 문서 끝은 N-30-1 절(FP-180) 다음에 N-32-1 절(FP-181)을 두었다. 어느 쪽 내용도 지우지 않았다.
- 🆕 11/20 FP-180 리뷰와 같은 형식으로 SQL의 `WHENEVER SQLERROR`·`OSERROR`에 `ROLLBACK`을 붙였다(FP-139 e33120d와 같음).
- HELP-03(자유 질문)은 `ChatbotMapper`·`ChatbotService`·`ChatbotController`에 이어서 추가한다. 하루 횟수는 `APP_SETTING.CHATBOT_DAILY_LIMIT`(10)을 쓰고, `CHATBOT_QUESTION_LOG`에는 질문 글을 저장하지 않으며 `SUCCESS_YN = 'Y'`만 센다. → 🆕 11/26 그대로 만들었다.
- 🆕 11/26 같은 사용자가 동시에 질문을 여러 번 보내면 하루 횟수를 1회쯤 넘을 수 있다(세고 → 부르고 → 기록 순서라서). 시연 범위라 잠금은 두지 않았다.
- 🆕 11/26 AI 지시 문장은 `ChatbotService.SYSTEM_PROMPT`·`AiSummaryService.SYSTEM_PROMPT`에 있다. 바꾸면 명세서 지시 문장 설명도 함께 고친다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
