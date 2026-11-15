# 대안 데이터 5종 모두 필수와 점수 산출 요청 requestId·새 응답 처리 (FP-86)

- **날짜:** 2026-11-12
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-86-score-request` (`feature-A/FP-85-utility-consent`에서 분기)
- **관련 N-ID:** N-05-8, N-05-9
- **관련 결정:** 11/12 팀 합의(대안 데이터 5종 모두 동의해야 산출, 나중에 바뀔 수 있음), 팀 결정(입력이 덜 차면 서버가 409로 막는다), Avenue API 명세서 B팀 v0.2 3-1(RPT-01)

## 무엇을, 왜 바꿨나
- 완료 현황의 대안 데이터 조건을 '1개 이상'에서 '5종 모두'로 바꿨다.
  - 5종 목록은 `altDataSources.js`에서 읽어 오고, 표기도 목록 길이로 만든다.
  - 나머지 5개 항목 조건은 그대로다.
- [점수 산출하기] 요청에 `requestId`(소문자 UUID)를 넣었다.
  - 네트워크 오류·시간 초과로 다시 누르면 같은 값을 보낸다.
  - 처리 결과를 받으면 값을 비운다.
  - 요청 중에는 버튼을 막고, 빠른 두 번 누르기도 막는다.
- 새 응답을 처리한다. 점수·등급은 화면에서 계산하지 않는다.
  - `gradeStatusCode`가 SCORED면 리포트로 이동한다.
  - NOT_SCORABLE이면 입력 화면에 머물며 사유별 안내를 보여 준다.
- 409 오류 코드별로 처리한다.
  - `INPUT_INCOMPLETE`: 서버 문구를 그대로 보여 준다.
  - `JOB_TYPE_REQUIRED`: 직군 선택 화면으로 보낸다.
  - `REQUEST_ID_CONFLICT`: 새 requestId를 만들고 "다시 시도해 주세요."를 보여 준다.
- 산출 상태·사유 문구를 공통 파일 `common/config/scoreStatus.js`에 두었다. FP-92 진단 내역도 같은 문구를 쓴다(FP-92 브랜치에 같은 내용으로 추가함).

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/config/scoreStatus.js` | 새 공통 파일. 산출 상태 SCORED·NOT_SCORABLE, 사유 4개 문구, `getNotScorableMessage` |
| `frontend/src/features/dataInput/config/completionItems.js` | 대안 데이터 조건 5종 모두, 표기 `대안 데이터(5종 모두)` |
| `frontend/src/features/dataInput/api/dataInputApi.js` | `requestScoreCalculation(requestId)` — 본문 `{ requestId }`, 응답·오류 주석 |
| `frontend/src/features/dataInput/pages/DataInputPage.jsx` | requestId 보관·재시도, 응답 상태·409 코드별 처리, 두 번 누르기 방지 |
| `frontend/src/features/dataInput/validation/serverErrors.js` | 점수 산출 409 코드 `SCORE_ERROR_CODES` |
| `frontend/src/features/dataInput/mocks/dataInputMockHandlers.js` | 새 응답 필드, 같은 requestId 재사용, 409 코드, 5종 동의 조건, 직군 미선택 409에 코드 추가 |
| `frontend/src/features/dataInput/mocks/scoreMockData.js` | 새 파일. 점수 산출 mock 시나리오 설정 |

## DB·API 변경
- DB: 없음
- API: `POST /api/members/me/score-calculation`(경로 그대로)
  - 요청: 본문 `{ requestId }`를 추가했다.
  - 응답: `calculatedAt`은 그대로 두고 필드를 추가했다.
    ```json
    {
      "calculatedAt": "2026-11-12T05:30:00.000Z",
      "requestId": "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b",
      "gradeStatusCode": "SCORED",
      "notScorableReasonCode": null,
      "alternative": { "score": 742, "gradeBandCode": "STANDARD" },
      "traditional": { "scorableYn": "Y", "score": 655, "gradeBandCode": "CAUTION" }
    }
    ```
  - 오류
    - 400: requestId 없음·형식 틀림
    - 409 `INPUT_INCOMPLETE`: 완료 현황 미달 또는 5종 유효 동의 빠짐
    - 409 `JOB_TYPE_REQUIRED`: 직군 미선택
    - 409 `REQUEST_ID_CONFLICT`: 다른 회원이 이미 쓴 requestId
- 같은 회원이 같은 requestId를 다시 보내면 처음 결과를 그대로 돌려준다.
- 데이터 입력 API 전체: 직군 미선택 409 응답에 `code: 'JOB_TYPE_REQUIRED'`가 추가됐다(문구는 그대로).
- 영향을 받는 기능·팀원
  - 점수 산출 서버 담당: requestId 중복 처리, 409 코드
  - FP-92: 같은 사유 문구 사용

## 확인
- 확인함: `npm run lint` 통과, `npm run build` 통과
- 확인함: Node 스크립트로 mock 처리 함수를 직접 불러 30개 항목 통과
  - 4종만 불러오면 버튼 조건이 false이고 409
  - 5종이면 SCORED. 점수는 0~1000 정수이고 등급이 공통 경계와 같다.
  - 같은 requestId면 같은 결과, 다른 회원이면 409 REQUEST_ID_CONFLICT
  - NOT_SCORABLE 3종과 그 문구
  - 연결 실패 뒤 같은 requestId로 다시 보내면 성공
  - 직군 미선택이면 409 JOB_TYPE_REQUIRED
  - 연결 해제 뒤에는 다시 409
- 확인함: FP-85 점검 72개를 다시 돌려 모두 통과
- 확인 못 함: 브라우저에서 버튼을 직접 눌러 보는 확인(두 번 누르기, 리포트 이동, 안내 문구 표시). `npm run dev`(VITE_USE_MOCK=true)로 확인해야 한다.
  - 시나리오는 `mocks/scoreMockData.js`의 `scenario`를 바꿔 확인한다.

## 다음 사람이 알아야 할 것
- 5종 조건은 팀 합의라 바뀔 수 있다. 바꿀 때는 `completionItems.js`의 altData 한 줄만 고치면 된다. 다만 mock의 5종 동의 조건(`hasAllAltDataConsents`)도 함께 봐야 한다.
- `crypto.randomUUID()`는 localhost·https에서만 동작한다.
- 나머지 필수 입력 항목은 담당자가 정할 예정이라 이번에는 바꾸지 않았다.
- SCORED 결과는 진단 내역(FP-92) mock과 아직 연결되지 않았다. 진단 내역 mock은 고정 데이터를 쓴다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
