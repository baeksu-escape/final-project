# Windows Maven Wrapper의 빈 링크 대상 처리

- **날짜:** 2026-11-17
- **작성자:** 경환 / Codex
- **브랜치:** `feature-A/FP-88-credit-report`
- **관련 N-ID:** 없음
- **관련 결정:** 없음

## 무엇을, 왜 바꿨나
- `mvnw.cmd`는 일반 폴더인 `.m2`에서도 `Target[0]`을 바로 읽어 PowerShell 예외를 냈다.
- 링크 대상이 배열이면 첫 경로를 사용하고, 비어 있으면 기본 `.m2/wrapper/dists` 경로를 쓰도록 수정했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/mvnw.cmd` | `.m2`가 일반 폴더여도 Wrapper가 실행되도록 링크 대상 검사 보완 |
| `docs/logs/2026-11-17_kgh_Windows-Maven-Wrapper.md` | 원인과 확인 결과 기록 |

## DB·API 변경
- DB: 없음
- API: 없음
- 영향을 받는 기능·팀원: Windows에서 Maven Wrapper를 사용하는 backend 작업자

## 확인
- 확인함: `mvnw.cmd`가 `Target[0]` 예외를 지나 Maven 실행 단계까지 진행하는 것을 확인했다.
- 확인함: `mvnw.cmd -Dmaven.repo.local=<사용자 .m2 경로> test` — 테스트 230개 통과.
- 확인 못 함: 이 환경의 Java `user.home` 속성은 `C:\`라 기본 저장소 `C:\.m2\repository`를 만들 수 없다. 해당 환경에서는 `-Dmaven.repo.local`로 사용자 `.m2\repository` 경로를 지정해야 한다.

## 다음 사람이 알아야 할 것
- Wrapper의 PowerShell 예외와 Java가 보고하는 기본 사용자 홈 경로 문제는 별개다. `user.home=C:\` 설정 자체는 저장소에서 바꾸지 않았다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
