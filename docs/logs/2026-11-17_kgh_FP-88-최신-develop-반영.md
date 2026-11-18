# FP-88 최신 develop 반영 및 신용 리포트 정리

- **날짜:** 2026-11-17
- **작성자:** 경환 / Codex
- **브랜치:** `feature-A/FP-88-credit-report`
- **관련 N-ID:** N-12-6, N-14
- **관련 결정:** 모델 피처 칩은 `featureCode` 기준으로 화면에서 묶는다(11/17)

## 무엇을, 왜 바꿨나
- 최신 develop(PR #67·#68·#69)을 반영하고, 랜딩 페이지 라우트와 FP-88 신용 리포트 화면 라우트를 함께 유지했다.
- 이미 `assessment` 패키지에 통합된 리포트 API와 중복되는 구형 `credit` 서비스·매퍼·DTO·테스트를 제거했다.
- 기존 모델·대안 모델의 피처 목록을 영역별 칩으로 묶어 표시하도록 반영했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/routes/AppRoutes.jsx` | 최신 라우트 구조에 FP-88 리포트 화면 연결 유지 |
| `frontend/src/features/credit/components/ScoreComparisonCard.jsx` | 피처 목록을 영역별 칩으로 묶음 |
| `backend/src/main/java/com/baeksuescape/credit/` 및 관련 mapper·test | 통합 `assessment` 리포트 API와 중복되는 구형 구현·테스트 제거 |
| `docs/logs/2026-11-17_kgh_FP-88-최신-develop-반영.md` | 이번 정리와 확인 결과 기록 |

## DB·API 변경
- DB: 없음
- API: 경로·요청 필드 추가 없음. 최신 develop의 RPT-02·03 `modelFeatures` 응답을 사용한다.
- 영향을 받는 기능·팀원: 신용 리포트 화면 및 FP-142 리포트 API 담당

## 확인
- 확인함: `npm.cmd run lint` 통과
- 확인 못 함: `mvnw.cmd test`는 Maven Wrapper의 PowerShell 구동 오류(`Cannot index into a null array`, `Cannot start maven from wrapper`)로 시작하지 못함. 브라우저에서 실제 응답의 칩 표시도 확인하지 못함.

## 다음 사람이 알아야 할 것
- 서버 리포트 API의 기준 구현은 `backend/.../assessment/`이다. 제거한 `credit` 구현은 더 이상 연결하지 않는다.
- PR 전에 mock 및 실제 응답으로 기존·대안 피처 칩이 그룹별로 표시되는지 확인한다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
