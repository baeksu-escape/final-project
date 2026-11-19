# 두 모델 AUC를 같은 라벨로 맞춘 값을 MODEL_ARTIFACT.METRICS_JSON에 추가하는 SQL

- **날짜:** 2026-11-19
- **작성자:** 최재욱(B팀 모델·정의서 담당) / Claude Code
- **브랜치:** `feature-B/FP-235-same-label-eval` (Jira FP-235, FP-183 하위 작업. 같은 PR에 평가 점수 내보내기 스크립트가 함께 있음)
- **관련 N-ID:** N-25 모형 성능 비교
- **관련 결정:** 정의서 10장 C20(AUC는 같은 라벨끼리 비교), 11/19 범영·재욱 합의(같은 라벨 값으로 비교, `AUC_VALID`는 각 모델 자기 라벨 값 유지, 최종 발표 값은 FP-144 TEST), 11/19 DDL·공용 md는 재욱 작업과 연계되면 직접 수정 가능

## 무엇을, 왜 바꿨나
- FP-216의 기록 SQL은 `MODEL_ARTIFACT.AUC_VALID`에 기존 0.6064(연체 라벨), 대안 0.6565(비금융 효과 라벨)를 넣는다. 라벨이 다른 값이라 N-25 화면이 두 값을 나란히 놓으면 C20에서 정정한 잘못된 비교가 된다.
- 같은 라벨 값(연체 라벨: 기존 0.6049 / 대안 0.5991, 비금융 효과 라벨: 기존 0.6102 / 대안 0.6533, VALID 시드 5개 평균)을 `METRICS_JSON`의 `same_label_comparison`에 더하는 SQL을 만들었다. `AUC_VALID`·`AUC_TEST`·파일 해시는 바꾸지 않는다.
- 값은 `training/compare_labels.py`와 같은 계산을 다시 돌려 얻었다(C20 숫자와 소수 넷째 자리까지 같고, 학습 표 SHA 앞 8자리 `79511b5d`가 모델 설명 파일과 같다). 라벨마다 두 모델을 새로 학습한 실험값이라 서버에 올린 모델 자체의 AUC가 아니라는 설명과, 비금융 효과 라벨 차이(+0.043)는 설계가 반영된 값이라는 설명을 JSON `note`와 SQL 머리말에 넣었다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `docs/spec/sql/update_model_metrics_same_label_lgbm_base_0_1.sql` | 새 파일. 기록 SQL의 `METRICS_JSON` 2개에 `same_label_comparison`을 더해 통째로 갱신, 행이 없으면 멈춤, 다시 실행해도 됨 |
| `docs/spec/sql/README.md` | 상황별 실행 표에 1행 추가 |

## DB·API 변경
- DB: 구조 변경 없음. `MODEL_ARTIFACT` 2행의 `METRICS_JSON` 내용만 바뀐다(DDL·시드·`99_check.sql` 변경 없음).
- API: 없음
- 영향을 받는 기능·팀원: 동주(FP-183·184 N-25 화면 — 같은 라벨끼리 비교하고 라벨 이름·VALID 기준을 표시), 범영(공용 DB 실행)

## 확인
- 확인함: 같은 라벨 AUC를 다시 계산해 정의서 C20 값과 일치 확인. 새 SQL 안의 JSON 2개를 파싱해서 기존 `register_model_lgbm_base_0_1.sql`의 항목이 그대로 들어 있고(`label`, `valid_auc_*`, 해시 등), 추가한 `by_label` 값이 계산 결과와 같음을 코드로 확인. 가장 긴 줄 1,404자(SQL*Plus 한 줄 제한 2,499자 안).
- 확인 못 함: Oracle에서의 실행(로컬 DB 실행은 SQL Developer로 사용자가 확인해야 함), 공용 DB 적용, N-25 화면에서 읽는 모습.

## 다음 사람이 알아야 할 것
- 실행 순서: `register_model_lgbm_base_0_1.sql` → 이 SQL. 공용 DB 실행은 DB 담당(범영)이 한다.
- 새 모델 버전을 만들면 이 SQL도 복사해 새 값으로 바꿔 쓴다(같은 버전에 파일만 바꾸지 않는다).
- `AUC_TEST`는 FP-144 최종 평가 전까지 NULL이다. 최종 발표 값은 TEST로 확정한다.
- 로그 파일명의 작성자 약어 `cjw`는 제안이다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
