# 빈 목록 (다): 통신비·공과금 기록이 없으면 점수 안 냄 — Spring 선검사 + FastAPI 422

- **날짜:** 2026-11-16
- **작성자:** 오범영 / Claude Code
- **브랜치:** `feature-B/FP-142-alt-data-empty`
- **관련 N-ID:** N-12-2 기존·대안 점수·3등급 계산·저장
- **관련 결정:** 피처 정의서 8-5 (다) 1차 확정, `decisions.md` 1-4 D-30(PR #57), 사유 코드 이름 `ALT_DATA_EMPTY`(11/16 범영 결정, DDL은 재욱 PR #60으로 병합)

## 무엇을, 왜 바꿨나
- 대안 데이터 동의 후 불러왔는데 기관에 기록이 없으면 빈 목록이 된다(A팀 `missing-member-mode=EMPTY`, 시드에 없는 새 계정). 통신비·공과금 기록이 없는 사람은 학습 데이터에 없어서, 그대로 점수를 내면 학습에 없는 입력으로 계산된다(`telecom_on_time_streak` 0 등).
- Spring 점수 산출(RPT-01)은 소득 개월 확인 다음, FastAPI를 부르기 전에 통신비 **또는** 공과금 목록이 0건인지 본다. 0건이면 FastAPI를 부르지 않고 `NOT_SCORABLE` + `ALT_DATA_EMPTY` 행을 저장하고 200을 준다(STALE_INPUT과 같은 방식). 목록은 `ScoreInputAssembler`가 이미 읽은 것을 그대로 센다.
- FastAPI ML-03도 같은 경우 422 `INVALID_INPUT`으로 거절한다(안전장치, `fieldErrors` `alternativeData.telecom`/`utility`). ML-04 시뮬레이션은 저장된 평가의 피처값에서 시작해 해당 없다.
- 간편결제 0건·보험 기록 없음은 학습에도 있는 경우라 막지 않는다(정의서 8-5).

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../assessment/service/ScoreCalculationService.java` | 상수 `ALT_DATA_EMPTY`, `isBillDataEmpty()` 추가, 판정 흐름에 선검사 한 단계 |
| `backend/src/test/.../assessment/service/ScoreCalculationServiceTest.java` | 도우미에 통신비·공과금 1행씩, 새 테스트 3개(통신비 빈 목록·공과금 빈 목록 → ALT_DATA_EMPTY, 간편결제·보험 빈 목록 → SCORED) |
| `fastapi_server/routers/assessment.py` | `_check_bill_data()` 추가, ML-03에서 호출 |
| `fastapi_server/tests/test_mock_scorer.py` | 새 테스트 2개(빈 목록 422, 간편결제·보험 빈 목록 200) |
| `fastapi_server/pipeline/feature_builder.py` | 3-2 함수 설명의 빈 목록 TODO를 "8-5 (다)로 막음"으로 바꿈(동작 그대로) |
| `fastapi_server/README.md` | 테스트 개수 35, 422 목록에 빈 목록 추가 |

## 영향
- API 응답 값 추가: RPT-01·RPT-02·RPT-03·MEM-06의 `notScorableReasonCode`에 `ALT_DATA_EMPTY`가 올 수 있다. 화면 문구(`frontend/src/common/config/scoreStatus.js`)에 없으면 기본 문구 "점수를 산출할 수 없습니다."가 나온다 — 맞춤 문구는 프론트 담당께 요청.
- DB: `DIM_NOT_SCORABLE_REASON`에 `ALT_DATA_EMPTY` 행이 없으면 저장이 FK(`FK_ASM_REASON`)에 막혀 500이 난다. 사유 코드 DDL은 PR #60으로 develop에 병합됐고, 공용 DB에도 `add_not_scorable_reason_alt_data_empty.sql`을 적용해 5행을 확인했다(11/16 범영). 로컬 DB를 쓰는 팀원은 같은 SQL을 한 번 실행한다. 시연 계정은 기관 기록이 있어 해당하지 않는다.
- B팀 API 명세서(공유 링크) 2장·3-1·4-3 갱신(저장소 밖).

## 확인
- `./mvnw test` **227개 통과**(새 3개)
- FastAPI 가상환경 `python -m unittest discover tests` **35개 통과**(새 2개)
- 확인 못 함: 공용 DB 실제 저장(사유 코드 행은 적용됨, 기관 기록 없는 새 계정으로 점수 산출해 `NOT_SCORABLE`/`ALT_DATA_EMPTY` 1행 저장 확인 예정)

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
