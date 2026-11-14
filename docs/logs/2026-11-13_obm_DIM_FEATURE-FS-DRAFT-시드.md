# 피처 사전(DIM_FEATURE) FS-DRAFT 시드 39개 추가 (피처 정의서 v1.0 기준)

- **날짜:** 2026-11-13
- **작성자:** 오범영 / Claude Code
- **브랜치:** `feature-B/FP-123-DIM-FEATURE-FS-DRAFT`
- **관련 N-ID:** N-12-2 기존·대안 점수 계산·저장, N-14 항목별 SHAP 설명, N-18-8 시뮬레이터 조정 항목
- **관련 결정:** O-17(B팀 API 명세서 v0.3) — 첫 점수 저장 전 `FS-DRAFT` → `FS-V1` 순서로 채운다 / D-29 기존 모델 피처 범위 / 피처 정의서 `docs/spec/feature_definition.md` v1.0(FP-132)

## 무엇을, 왜 바꿨나
- `ASSESSMENT_FACTOR.FEATURE_CODE`가 `DIM_FEATURE`를 FK로 가리키는데 표가 비어 있어, Mock 점수를 저장할 수 없었다.
- FastAPI Mock(FP-140)·Spring 점수 저장(FP-142) 개발용으로, 피처 정의서 11장 "DIM_FEATURE 입력용 표"의 39개(기존 모델 19 + 대안 데이터 20)를 `FS-DRAFT` 버전으로 넣는 시드 파일을 추가했다.
- 처음에는 연습용 코드 14개로 만들었으나, 같은 날 피처 정의서 v1.0이 develop에 들어와 커밋 전에 39개로 바꿨다(범영 결정 A안). Mock·화면 mock이 처음부터 학습 데이터와 같은 이름을 쓰게 하려는 것이다.
- 정의서가 "임시 결정·수정 가능" 상태라 버전 이름은 `FS-DRAFT`로 둔다. 정의서가 확정되면 `FS-V1`로 따로 넣는다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `docs/spec/sql/seed/avenue_seed_dim_feature_fs_draft.sql` | 새 파일(새 폴더 `seed/`). `DIM_FEATURE`에 `FS-DRAFT` 39행 INSERT + 확인 SELECT |

## DB·API 변경
- DB: 테이블·컬럼 변경 없음. `DIM_FEATURE` 기준 데이터 39행 추가(`avenue_ddl.sql` 다음에 실행).
- API: 없음. Mock·Spring은 `featureCode`를 이 39개 안에서 쓴다.
- 영향을 받는 기능·팀원:
  - 재욱: 정의서 11장이 바뀌면 이 시드도 같이 고친다. 표시 이름·`SIMULATABLE_YN`·표시 순서는 정의서의 제안값
  - C팀: `SIMULATABLE_YN = Y` 9개가 N-18-8 조정 항목과 맞는지 확인 필요
  - UI 담당: 표시 이름(`FEATURE_NAME`)이 SHAP 요인 목록에 그대로 나온다
  - 경환: 11/13 방법 A 합의 — 시드 원본은 `docs/spec/sql/seed/`에 두고, 경환 님 생성기가 이 폴더를 읽어 `run_all.sql` 순서와 `99_check.sql` 기대값(`DIM_FEATURE` 0 → 39)에 자동 반영한다(이번 PR에서는 `dummy_db/`를 건드리지 않음)

## 확인
- 확인함: 정적 점검 — 정의서 11장 표에서 그대로 옮긴 39행, 코드 중복 없음, 코드 최대 32자(≤50), 이름 최대 18자(≤100), 단위 최대 3자(≤20), Y/N 값만 사용(대안 20·시뮬 9, 정의서 11장 합계와 같음)
- 확인함: 오범영 SQL Developer 실행(`avenue_ddl.sql` 적재 스키마, 14개 판 실행 후 39개 판 재실행) — 확인 SELECT 결과 TOTAL 39 / ALT 20 / SIM 9, 오류 없음
- 확인 못 함: FastAPI Mock·Spring 저장과 연결한 실행(1·2단계에서 확인)

## 다음 사람이 알아야 할 것
- 맨 앞 `DELETE`는 재실행용이다. `FS-DRAFT` 코드를 쓰는 `ASSESSMENT_FACTOR` 행이 생긴 뒤에는 FK 오류가 나므로 다시 실행하지 않는다.
- 단위 표기 "비율"·"소수"와 코드형 피처(`segment`, `*_coverage_status`, `*_payer_type`)의 모델 입력 변환은 정의서 9장 미정 사항이다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
