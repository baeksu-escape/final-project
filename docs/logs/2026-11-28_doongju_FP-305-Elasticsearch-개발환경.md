# Elasticsearch 8.10.4 개발 환경 — 혼자 띄우는 법, 백엔드 연결 확인, 라운지 색인(nori) 만들기 (기본 꺼짐)

- **날짜:** 2026-11-28
- **작성자:** 동주(C팀) / Claude Code
- **브랜치:** `feature-C/FP-304-elasticsearch` (Jira FP-304 아래 FP-305. FP-306 색인 동기화도 이 브랜치에서 이어서)
- **관련 N-ID:** N-06-1(신용 라운지 글 검색) — 2차 개발
- **관련 결정:** D-07 변경(11/28 팀 합의: 2차부터 라운지 글 검색에 Elasticsearch 사용. 버전 8.10.4·기본 꺼짐은 담당 동주 결정)

## 무엇을, 왜 바꿨나
- 2차 주제로 라운지 글 검색을 Elasticsearch로 바꾼다(지금은 Oracle `LIKE '%검색어%'`라 띄어쓰기·조사가 다르면 못 찾고 글이 많아지면 느리다). FP-305는 그 첫 단계로 **서버를 띄우고 연결·색인까지**만 한다. 글 넣기·검색 바꾸기는 FP-306.
- Docker(FP-286, 범영)가 배포까지 못 할 수도 있어, 누구 PC에서든 **혼자 띄우는 방법 두 가지**(Windows zip, Docker)를 `elasticsearch/`에 두었다.
- 백엔드는 **새 라이브러리 없이** Spring `RestClient`로 부른다(`OpenAiClient`·`PredictionClient`와 같은 방식, `pom.xml` 변경 없음).
- 설정 `avenue.search.enabled`는 **기본 꺼짐**이다. 꺼져 있으면 Elasticsearch를 전혀 부르지 않아 띄우지 않은 팀원 PC·테스트에 영향이 없다. 켰는데 서버가 없으면 백엔드는 그대로 켜지고 경고만 남긴다.
- 다른 기능도 검색을 쓸 수 있게 연결 부분은 공통(`global/search`)에 두고, 라운지 색인 정의만 라운지 쪽에 두었다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `elasticsearch/README.md`, `run-windows.ps1`, `Dockerfile`, `docker-compose.yml` | 새 폴더. 8.10.4 + nori를 zip 또는 Docker로 띄우는 법, 확인·연결 방법 |
| `backend/.../global/search/SearchProperties.java` | 새 파일. `avenue.search.enabled`(기본 false)·`url`·시간 제한(연결 1초·응답 3초) |
| `backend/.../global/search/SearchClient.java` | 새 파일. 서버 버전·색인 있는지·색인 만들기(RestClient), 실패는 `SearchUnavailableException` |
| `backend/.../global/search/SearchUnavailableException.java`, `SearchIndexDefinition.java` | 새 파일. 실패 예외, 색인 이름 + 설정 JSON 위치 |
| `backend/.../global/search/SearchIndexInitializer.java` | 새 파일. 서버가 켜진 뒤 켜져 있을 때만 연결 확인 → 없는 색인 만들기, 실패하면 경고만 |
| `backend/.../community/service/LoungeSearchIndex.java` | 새 파일. 색인 `lounge_posts` 등록 |
| `backend/src/main/resources/search/lounge-posts.json` | 새 파일. 분석기 `lounge_korean`(nori, 품사 걸러내기), 필드 7개, `dynamic: strict` |
| `backend/src/test/.../global/search/SearchClientTest.java`, `SearchIndexInitializerTest.java`, `community/service/LoungeSearchIndexTest.java` | 새 파일. 시험 17개(가짜 ES 서버, 실제 ES 없이) |
| `backend/src/main/resources/application.properties.example` | `avenue.search.*` 두 줄(기본값만) |
| `README.md`, `backend/README.md` | 실행 순서에 선택 항목, 공통 설정 표 한 줄, 백엔드 실행 준비 한 단락 |
| `docs/ai/decisions.md` | D-07 변경, 저장소 구조에 `elasticsearch/`, 「최근 변경」 한 줄 |

## DB·API 변경
- DB: 없음
- API: 없음(라운지 검색은 아직 Oracle 그대로)
- 영향을 받는 기능·팀원: 없음(기본 꺼짐). 공통 설정 견본에 두 줄이 늘었다. 범영(FP-286 Docker) — 팀 compose가 생기면 `elasticsearch/docker-compose.yml`의 서비스 정의를 옮겨 넣는다.

## 확인
- 확인함: `./mvnw test` 614개 통과(실패 0, 오류 0). 새 시험 17개 포함. 기본값(꺼짐)으로 켜지는 Spring 시험들에서 Elasticsearch 관련 로그·요청이 없음(시험 로그로 확인).
- 확인함(11/28, 동주 PC, Docker Desktop 29.9.3): `elasticsearch/`에서 `docker compose up -d --build` → `GET /` 버전 8.10.4, `_cat/plugins`에 `analysis-nori 8.10.4`, 클러스터 green.
- 확인함(같은 서버): `lounge-posts.json` 그대로 `PUT /lounge_posts` 성공, 모르는 필드 문서는 400(strict). `lounge_korean` 분석 결과 — "대출이 어렵나요" → 대출·어렵, "DSR 40% 넘으면 대출이 어렵나요?" → dsr·40·넘·대출·어렵, "통신비 자동이체 …" → 통신비·통신·비·자동·이체·등록·대안·점수·올랐·오르. 확인 뒤 시험 색인은 지웠다(백엔드가 처음 켜질 때 만들게).
- 확인함(11/28, 동주): `application.properties`에 `avenue.search.enabled=true`를 넣고 백엔드 실행 → `Started BackendApplication` 뒤에 `Elasticsearch 8.10.4 연결 (http://localhost:9200)`, `Elasticsearch 색인 lounge_posts 만듦` 로그.
- 확인 못 함: Windows zip 방식(`run-windows.ps1`) — Docker로 확인해 실행하지 않았다.

## 다음 사람이 알아야 할 것
- 켜는 방법: 각자 `application.properties`에 `avenue.search.enabled=true`. 끄면 즉시 기존 검색이다.
- 색인은 **없을 때만** 만든다. `lounge-posts.json`을 바꾸면 색인을 지우고(`DELETE /lounge_posts`) 백엔드를 다시 켠다. FP-306에서 전체 다시 넣기를 만든다.
- 버전이 8.10.4와 다르면 경고 로그만 남기고 그대로 진행한다.
- 개발·시연용이라 보안을 끄고 `127.0.0.1`에만 연다. 외부에 여는 배포 환경이면 보안을 켜고 비밀번호를 설정해야 한다(이번 범위 밖).
- D-07 변경은 11/28 팀 합의다. `decisions.md` 관리 방식대로 PR에 조장 확인 댓글을 남겨 기록한다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
