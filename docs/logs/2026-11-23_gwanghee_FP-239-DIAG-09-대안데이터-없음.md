# DIAG-09 예상 점수: 통신비·공과금 기록이 없으면 409 ALT_DATA_EMPTY

- **날짜:** 2026-11-23
- **작성자:** 임광희(C팀) / Claude Code
- **브랜치:** `feature-C/FP-239-diag09-alt-data-empty` (Jira FP-239 리뷰 후속)
- **관련 N-ID:** N-21-8 예상 점수
- **관련 결정:**
  - FP-239 리뷰에서 범영 님이 제안했다("1차·2차 판단은 광희에게"). 11/23 광희가 1차에 넣기로 정했다.
  - 기준은 점수 산출(RPT-01)과 같다(피처 정의서 8-5·D-30 (다)).

## 무엇을, 왜 바꿨나
- **문제:** 통신비·공과금 기관 기록이 비어 있는 회원은 FastAPI ML-03이 422로 거절한다. 시연 계정 `demo_self`로 재현했다(범영 님).
  - DIAG-09는 그 거절을 400 "입력값을 확인해 주세요"로만 바꿔서, 회원은 이유를 알 수 없었다.
  - 점수 산출(RPT-01)은 같은 경우를 ML-03 호출 전에 검사해 `NOT_SCORABLE` `ALT_DATA_EMPTY`로 알린다.
- **고친 것:** DIAG-09도 ML-03을 부르기 전에 같은 기준으로 검사한다. 통신비 또는 공과금 기록이 0건이면 아래를 돌려준다.
  - 409 `ALT_DATA_EMPTY`
  - "통신비·공과금 기록이 없어 예상 점수를 계산할 수 없어요."
- 검사 위치는 소득 개월 검사(`checkIncomeMonths`, 409 `INPUT_INCOMPLETE`) 바로 다음이다.
- 판정 조건은 RPT-01의 `ScoreCalculationService.isBillDataEmpty`와 같다.
  - 그 메서드는 다른 패키지(`assessment`)라 부를 수 없어서, 같은 조건을 `ExpectedScoreService.checkBillData`에 두었다.
  - 간편결제·보험은 0건도 학습에 있어 막지 않는다.
- 범영 님 코드(`PredictionClient`, `ScoreCalculationService`)는 고치지 않았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../finance/service/ExpectedScoreService.java` | `checkBillData` 추가, ML-03 호출 전에 부름 |
| `backend/src/test/.../finance/service/ExpectedScoreServiceTest.java` | 공통 예시 요청에 통신비·공과금 1건씩 추가, 빈 기록 시험 1개 추가 |
| `docs/spec/api/api_definition.md` | 1장 C팀 오류 표에 409 `ALT_DATA_EMPTY` 행, 2장 DIAG-09 행에 한 구절(「최근 변경」은 고치지 않음) |
| `docs/spec/api/api_spec_c.md` | DIAG-09 오류 표에 409 `ALT_DATA_EMPTY` 행 |

## DB·API 변경
- DB: 없음
- API: DIAG-09에 새 오류 코드 409 `ALT_DATA_EMPTY`를 추가했다. 경로와 정상 응답은 그대로다.
- 영향을 받는 기능·팀원: 경환 님 현금흐름 화면
  - 고칠 필요는 없다. `financeAdapter.describeExpectedScoreError`는 모르는 코드면 서버 문구(`error.message`)를 그대로 보여 준다.
  - 그래서 점수 영역 경고에 새 문구가 나오고, 전망은 그대로 보인다.
  - 전용 문구를 원하면 경환 님이 409 `ALT_DATA_EMPTY` 분기를 넣으면 된다.

## 확인
- `ExpectedScoreServiceTest` 11개 통과. 아래 두 경우를 확인했다.
  - 통신비 빈 목록이면 ML-03을 부르지 않고 409와 정한 문구가 나온다.
  - 공과금 없음, 대안 데이터 없음이면 막히고, 둘 다 있으면 통과한다.
- `./mvnw clean test` 전체 469개 통과
- 확인 못 함: 실제 DB에서 `demo_self`로 화면 확인(광희 님 확인 필요)

## 다음 사람이 알아야 할 것
- mock(`diagnosisMockHandlers.js`)은 대안 데이터가 없어 이 오류를 내지 않는다.
- RPT-01의 판정 기준이 바뀌면 `ExpectedScoreService.checkBillData`도 같이 바꾼다(두 곳에 같은 조건).

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
