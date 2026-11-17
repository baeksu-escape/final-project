# .gitignore에 학습 설명 파일(artifacts/*.meta.json) 제외 추가

- **날짜:** 2026-11-16
- **작성자:** 최재욱(B팀 모델·정의서 담당) / Claude Code
- **브랜치:** `feature-B/chore-gitignore-model-meta`
- **관련 N-ID:** 없음 (N-12-2 학습 스크립트의 부속 변경)
- **관련 결정:** 없음

## 무엇을, 왜 바꿨나
- 학습 스크립트(`fastapi_server/training/`, 별도 PR)가 `fastapi_server/artifacts/`에 모델 파일(`*.joblib`, 이미 제외됨)과 설명 파일(`*.meta.json`)을 만든다. 설명 파일은 학습할 때마다 바뀌는 생성 파일인데 제외 규칙이 없어 `git add .`로 실수로 올라갈 수 있었다.
- 공통 설정 파일이라 사용자 확인을 받고(11/16), 학습 스크립트 PR과 섞이지 않게 작은 브랜치로 분리했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `.gitignore` | `fastapi_server/artifacts/*.meta.json` 제외 규칙과 설명 주석 2줄 추가 |

## DB·API 변경
- DB: 없음
- API: 없음
- 영향을 받는 기능·팀원: 없음. `artifacts/.gitkeep`과 다른 파일은 그대로 추적된다.

## 확인
- 확인함: `git check-ignore -v`로 `artifacts/legacy.meta.json`, `artifacts/alternative.meta.json`이 새 규칙에 걸리는 것과 `artifacts/.gitkeep`은 걸리지 않는 것을 확인. `git diff --stat`으로 `.gitignore` 2줄 추가만 확인.
- 확인 못 함: 다른 PC에서의 동작(규칙이 단순해 문제 없을 것으로 봄).

## 다음 사람이 알아야 할 것
- 설명 파일을 커밋 대상으로 삼으려면 이 규칙을 지운다. 설명 파일에는 학습 조건·성능·라이브러리 버전·학습 표 해시가 들어 있다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
