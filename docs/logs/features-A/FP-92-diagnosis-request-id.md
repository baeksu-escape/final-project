# 진단 내역 diagnosisId를 REQUEST_ID로, 서버 등급 사용과 산출 불가 행 표시 (FP-92)

- **날짜:** 2026-11-12
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-92-diagnosis-request-id` (`feature-A/FP-199-V3-UPDATE`에서 분기)
- **관련 N-ID:** N-04-6
- **관련 결정:** Avenue API 명세서 B팀 v0.2 3-4(MEM-06 `GET /api/members/me/diagnoses`), 팀 결정(서버는 다른 팀원이 구현하고 화면은 받은 값을 표시만 한다)

## 무엇을, 왜 바꿨나
- 진단 내역의 `diagnosisId`를 점수 산출 요청의 `requestId`와 같은 소문자 UUID로 바꿨다(mock 데이터). 순번(ASSESSMENT_ID 등)을 쓰지 않는다.
- 상세 경로 `GET /api/report/{requestId}`(RPT-03, 🟡)를 경로 상수로 두었다. N-04-6 출력에 상세 링크가 없어서 화면 링크는 만들지 않았다.
- 새 필드 `gradeStatusCode`·`notScorableReasonCode`를 받는다.
  - 산출 불가(NOT_SCORABLE) 행은 등급 칸에 '산출 불가 (사유)'를 보여 준다. 사유는 FP-86과 같은 문구다.
  - 점수 칸에는 '—'를 보여 주고, 변화 칸은 비운다.
- 화면은 점수로 등급을 계산하지 않고 응답의 `grade`를 그대로 보여 준다. 이전부터 그랬다. mock 안의 등급 계산은 서버 역할이다.
- `alternativeScoreChange`는 바로 앞의 SCORED 평가와 비교한 값이다. mock 계산도 맞췄다. 첫 평가는 null이다.
- mock에 산출 불가 행이 1건 섞인 시나리오 `MIXED`를 추가했다. 기본값은 지금처럼 `MANY`다.
- 산출 상태·사유 문구 공통 파일 `common/config/scoreStatus.js`를 FP-86 브랜치와 **같은 내용으로** 추가했다. 두 브랜치를 모두 병합해도 충돌하지 않는다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/config/scoreStatus.js` | 새 공통 파일(FP-86과 같은 내용). 산출 상태·사유 문구 |
| `frontend/src/features/auth/mocks/diagnosisHistoryMockData.js` | diagnosisId를 소문자 UUID로, gradeStatusCode·notScorableReasonCode, `MIXED` 시나리오용 산출 불가 1건 |
| `frontend/src/features/auth/mocks/diagnosisHistoryMockHandlers.js` | 산출 일시 정렬, 산출 불가 행 처리, 변화는 바로 앞 SCORED 대비 |
| `frontend/src/features/auth/components/DiagnosisHistoryTable.jsx` | 산출 불가 행의 등급·점수·변화 칸 표시(표 구조는 그대로) |
| `frontend/src/features/auth/diagnosisHistoryConfig.js` | `NOT_SCORABLE_LABEL` '산출 불가' |
| `frontend/src/features/auth/api/diagnosisHistoryApi.js` | 상세 경로 `reportDetail(requestId)`(🟡), 응답 필드 주석 |

## DB·API 변경
- DB: 없음
- API: `GET /api/members/me/diagnoses`(경로·기존 필드 그대로)
  - 행마다 `gradeStatusCode`(SCORED·NOT_SCORABLE)와 `notScorableReasonCode`를 추가했다.
  - `diagnosisId`는 소문자 UUID(= requestId)다.
  - NOT_SCORABLE 행은 `existingScore`·`alternativeScore`·`grade`·`alternativeScoreChange`가 null이다.
- 상세 경로 상수: `/api/report/{requestId}`(RPT-03, 🟡 제안)
- 영향을 받는 기능·팀원
  - 진단 내역 서버 담당: diagnosisId = REQUEST_ID, 변화 계산 기준
  - 리포트 담당: 상세 경로

## 확인
- 확인함: `npm run lint` 통과, `npm run build` 통과
- 확인함: Node 스크립트로 mock 처리 함수를 직접 불러 17개 항목 통과
  - MANY: 5건 최신순, 소문자 UUID, 변화 값 118·0·-5·32·null
  - MIXED: 6건, 산출 불가 행의 null 처리와 위치, 그 다음 SCORED의 변화가 앞 SCORED 대비인지, 사유 문구
  - EMPTY와 점수 없는 계정은 0건
- 확인 못 함
  - 브라우저에서 마이페이지 진단 내역 표를 직접 보는 확인. `npm run dev`(VITE_USE_MOCK=true)에서 `diagnosisHistoryMockData.js`의 `scenario`를 `MIXED`로 바꿔 확인해야 한다.
  - 상세 경로 상수는 Node에서 불러오지 못해(`import.meta.env`) 코드로만 확인했다.

## 다음 사람이 알아야 할 것
- 점수 산출(FP-86) mock 결과는 진단 내역 mock과 연결되지 않았다. 진단 내역은 고정 합성 데이터를 쓴다.
- 산출 불가 행의 등급 칸 문구가 길다. 칸이 넓어지면 줄바꿈 스타일이 필요할 수 있다(스타일 제안만).

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
