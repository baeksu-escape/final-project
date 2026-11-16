# FastAPI 실행 방식 정리: 1차·시연 = 한 PC + 가상환경, Docker = 2차 개발 후보

- **날짜:** 2026-11-16
- **작성자:** 오범영 / Claude Code
- **브랜치:** `feature-B/FP-142-venv-run`
- **관련 N-ID:** N-12-2 기존·대안 점수·3등급 계산·저장 (FastAPI 예측 서버 실행 환경)
- **관련 결정:** 11/16 범영 — Docker는 2차 개발 고도화 후보(미확정). 1차 개발·시연은 Docker 없이 한 PC에서 켠다. 강사님 의견("가상환경으로 갈지 Docker로 갈지 명확히")

## 무엇을, 왜 바꿨나
- PR #55(FP-140)·#56(FP-142)의 문서·주석은 Docker를 기본 실행 방법처럼 적었다(「Docker로 켜기」, `http://fastapi:8000`). 수행계획서 기술 목록에는 Docker가 없고, 1차는 쓰지 않기로 해서 문서를 결정에 맞췄다.
- 기존 README의 `pip install`은 가상환경 없이 PC 전체 파이썬에 설치하는 방식이었다. 파이썬 내장 가상환경(venv, Python 3.11)으로 켜도록 바꿨다. 새 도구는 없다.
- 코드 동작은 바꾸지 않았다. Spring은 원래 기본 주소 `http://localhost:8000`으로 FastAPI를 부른다.
- 이전 로그 두 개(`2026-11-16_obm_FastAPI-예측-Mock-ML-01-04.md`의 "Docker 내부망용", `2026-11-16_obm_Spring-점수-산출-저장-RPT-01-03-MEM-06.md`의 Dockerfile 작성)는 당시 기록이라 고치지 않고, 이 로그로 바뀐 점을 남긴다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `fastapi_server/README.md` | 「실행」을 한 PC + venv 순서로 바꿈(만들기·켜기·설치·PowerShell 막힘 해결), 테스트도 venv에서, Docker 절 제목을 "2차 개발 후보, 1차·시연 미사용"으로 바꾸고 빌드 확인 안 됨 표시 |
| `fastapi_server/Dockerfile` | 맨 위 주석 1줄만 "2차 개발 후보·1차 미사용·빌드 확인 안 됨"으로. 내용은 그대로 |
| `fastapi_server/.dockerignore` | 맨 위 주석에 "2차 개발 후보, 1차·시연 미사용" 표시 |
| `backend/src/main/resources/application.properties.example` | **공용 견본 주석 1줄**: "1차·시연: 한 PC(localhost:8000), Docker(`fastapi:8000`)는 2차 후보". 설정 키·값은 그대로(범영 승인 11/16) |

## 영향
- 팀원: FastAPI를 켤 때 README 「실행」대로 `.venv`를 만들고 그 안에 설치한다. `.venv/`는 `.gitignore`에 이미 있어 올라가지 않는다.
- Spring·React 설정은 바뀌지 않는다(같은 PC면 기본값 그대로).
- B팀 API 명세서·정의서(공유 링크)의 "Docker 내부망" 문구도 같은 뜻으로 고친다(저장소 밖).

## 확인
- README 순서대로 새 가상환경을 만들어 확인했다(범영 PC, Python 3.11.9, 전체 파이썬 설치는 건드리지 않음).
  - `python -m venv .venv` → activate → `pip install -r requirements.txt` 성공
  - 같은 가상환경에서 `python -m unittest discover tests` **33개 통과**
  - `uvicorn main:app`로 켜서 `GET /v1/health` → `{"status":"UP"}`
- 확인 못 함: Docker 빌드·실행(2차 후보, PC에 Docker 없음), PowerShell 실행 정책 안내 문구의 실제 효과(Git Bash로 확인함)

## 남은 일
- Jira FP-142 설명의 "Dockerfile 작성 및 컨테이너 이미지 빌드/배포"를 2차 후보로 고칠지(범영).
- 2차 개발에서 Docker를 쓰기로 하면 Dockerfile 빌드·실행 확인부터 한다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
