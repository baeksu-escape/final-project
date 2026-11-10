# 마이페이지 진단 내역 조회 추가 (FP-92)

- **날짜:** 2026-11-10
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-92-diagnosisHistory` (`feature-A/FP-93-myPage`에서 분기)
- **관련 N-ID:** N-04-6
- **관련 결정:** D-01(등급 경계 665·780 임시), D-20(응답 형식 임시안), decisions.md 1-4 "신용 등급"·"모델 결과"(모델 버전 저장, 투표 D8)

## 무엇을, 왜 바꿨나
- FP-93 마이페이지의 빈 "진단 내역" 카드에 지난 평가 표를 넣었다. CSS는 넣지 않았다.
  - 열: 산출 일시, 직군, 기존, 대안, 등급, 변화
  - 최신순으로 보여 준다. 0건이면 "아직 산출한 점수가 없습니다."를 보여 준다.
- 순서·변화·등급은 응답 값을 그대로 쓰고 화면에서 계산하지 않는다. 나중에 목록이 나뉘어도 값이 맞도록 하기 위해서다.
- 모델 버전은 응답에 담지만 화면에는 보여 주지 않는다.
- 기간 필터·페이지 나누기·리포트 링크·삭제는 명세에 없어 만들지 않았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/components/DiagnosisHistoryTable.jsx` | 새 파일. 진단 내역 표, 불러오는 중·오류·0건 안내 |
| `frontend/src/features/auth/api/diagnosisHistoryApi.js` | 새 파일. 진단 내역 API 경로와 호출 함수 |
| `frontend/src/features/auth/diagnosisHistoryConfig.js` | 새 파일. 등급 코드 → 이름, 0건 안내 문구 |
| `frontend/src/features/auth/mocks/diagnosisHistoryMockData.js` | 새 파일. 설정값 `scenario`, 합성 진단 5건 |
| `frontend/src/features/auth/mocks/diagnosisHistoryMockHandlers.js` | 새 파일. 조회 mock(최신순·변화·등급) |
| `frontend/src/features/auth/pages/MyPage.jsx` | 진단 내역 카드 안에 표 넣기(import 1줄, 카드 3줄, 주석) |

## DB·API 변경
- DB: 없음. 다만 진단마다 산출 일시·직군·두 점수·등급·모델 버전을 저장해야 한다(`assessment` 등, DB 담당 확인).
- API(mock 임시안, TODO(D-20))

`GET /api/members/me/diagnoses` → 최신순 목록
```json
{
  "items": [
    {
      "diagnosisId": "d-5",
      "calculatedAt": "2026-11-09T14:30:00",
      "jobType": "EMPLOYEE",
      "existingScore": 630,
      "alternativeScore": 785,
      "grade": "GOOD",
      "alternativeScoreChange": 118,
      "modelVersion": "alt-v1.0"
    }
  ]
}
```
| 필드 | 뜻 |
|------|-----|
| `diagnosisId` | 진단 식별값 |
| `calculatedAt` | 산출 일시(초까지, 화면은 분까지 표시) |
| `jobType` | 진단 당시 직군 코드(화면은 급여소득자·자영업자·프리랜서) |
| `existingScore`·`alternativeScore` | 기존·대안 모델 점수(300~900) |
| `grade` | 대안 점수 등급 `GOOD`·`STANDARD`·`CAUTION`(화면은 Good·Standard·Caution) |
| `alternativeScoreChange` | 바로 이전 진단 대비 대안 점수 차이(정수). 가장 오래된 진단은 `null`(화면은 "—") |
| `modelVersion` | 모델 버전(화면에 보이지 않음) |

- 비로그인이면 401.
- mock 동작
  - 등급은 대안 점수 기준으로 경계 780·665(TODO(D-01))를 써서 mock 안에서 정한다.
  - 직군은 로그인 계정의 직군으로 채운다.
- 0건 확인: `diagnosisHistoryMockData.js`의 `mockDiagnosisHistorySettings.scenario`를 `'EMPTY'`로 바꾼다. 기본값은 `'MANY'`다.
- 영향을 받는 기능·팀원: 백엔드 진단 결과 API 담당, DB 담당

## 확인
- 확인함
  - `npm run lint` 오류 0건, `npm run build` 성공
  - mock 로직 node 검사 7건 통과(저장소 밖 스크립트): 최신순, 변화 값과 가장 오래된 `null`, 3등급, 필드·점수 범위·모델 버전, 계정별 직군, EMPTY 0건, 401
  - 헤드리스 Chrome 점검 16건 통과(mock 모드)
    - 6개 열 머리글, 5행 최신순, 변화 `+118,0,-5,+32,—`, 등급, 직군 이름
    - 모델 버전 미표시, 카드 안 위치
    - 프리랜서 직군 표시
    - EMPTY일 때 안내 문구와 표 없음, MANY로 되돌리면 다시 5행
  - FP-93 마이페이지 회귀 점검 15건 통과(진입·7개 항목·가림 해제)
  - 콘솔: 브라우저가 자동으로 요청하는 `favicon.ico` 404만 있다.
- 확인 못 함: 실제 백엔드 연동(서버·API 명세 없음)

## 다음 사람이 알아야 할 것
- 점수 산출 mock(FP-151 `POST /api/members/me/score-calculation`)은 진단 내역에 기록을 더하지 않는다. 두 mock은 따로 동작한다.
- mock 모드에서는 점수가 아직 없는 데모 계정(`self`·`freelancer`)도 MANY 설정이면 내역 5건이 보인다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
