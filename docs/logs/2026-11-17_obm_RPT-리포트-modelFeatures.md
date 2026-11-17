# RPT-02·03 리포트 응답에 모델별 피처 목록(modelFeatures) 추가

- **날짜:** 2026-11-17
- **작성자:** 오범영 / Claude Code
- **브랜치:** `feature-B/FP-142-model-features`
- **관련 N-ID:** N-12-6 점수·등급 비교 표시 (모델별 피처 칩)
- **관련 결정:** 11/17 범영 A안 — 응답에 피처별 목록을 넣는다. 경환 합의: 기존 모델 = `ALTERNATIVE_YN = N`, 대안 모델 = 전체, 묶음은 화면이 `featureCode`로 만든다(응답에 그룹 필드 없음)

## 무엇을, 왜 바꿨나
- N-12-6(P0)은 "모델마다 쓰는 피처를 칩으로 보여 주고 대안 모델이 새로 더한 비금융 피처는 보라색으로 구분"한다. 화면 `ScoreComparisonCard.jsx`는 `report.modelFeatures`를 읽는데 응답에 없어서 칩 영역이 숨겨져 있었다.
- RPT-02·03 응답 맨 끝에 `modelFeatures: { traditional: [...], alternative: [...] }`를 **추가**했다. 각 항목은 `{ featureCode, name, alternativeYn }`. 기존 필드는 바꾸지 않았다.
- 기준은 피처 사전 `DIM_FEATURE` 한 곳이다. 그 평가의 `FEATURE_SET_VERSION`으로 읽고, 산출 불가 평가처럼 피처 세트가 저장되지 않은 경우에는 `MODEL_REGISTRY`에서 그 평가 모델 버전의 피처 세트를 찾는다. 피처를 찾지 못하면 `null`(화면이 칩을 숨긴다).
- 지금(FS-DRAFT)은 기존 19개·대안 39개다. 확정 피처 세트(FS-V1)로 바뀌면 코드 수정 없이 18·38개가 된다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../assessment/dto/ReportDtos.java` | `Report`에 `modelFeatures` 추가, `ModelFeatures`·`ModelFeature` record 추가 |
| `backend/.../assessment/dto/AssessmentRows.java` | `FeatureRow`(코드·이름·대안 여부) 추가 |
| `backend/.../assessment/mapper/AssessmentMapper.java`, `resources/mapper/assessment/AssessmentMapper.xml` | `selectModelFeatures(featureSetVersion, modelVersion)` 추가(`DIM_FEATURE`, 피처 세트가 없으면 `MODEL_REGISTRY`로 찾음) |
| `backend/.../assessment/service/ReportService.java` | 리포트 조립 때 기존(대안 데이터 아닌 것)·대안(전체)으로 나눔 |
| `backend/src/test/.../ReportServiceTest.java` | 새 테스트 3개(나누기·산출 불가 평가·사전 없음) |
| `backend/src/test/.../AssessmentApiContractTest.java` | 응답 JSON에 `modelFeatures` 필드 이름 확인 추가 |

## 영향
- API 응답 필드 추가: RPT-02 `GET /api/report/me`, RPT-03 `GET /api/report/{requestId}`. 필드를 더하기만 해서 지금 화면·다른 API는 그대로 동작한다.
- DB 변경 없음(조회만). 화면은 경환 님 브랜치(`ScoreComparisonCard.jsx`)가 이미 이 필드를 읽는다.
- B팀 API 명세서(공유 링크) 3-2·3-3 갱신.

## 확인
- `./mvnw test` **230개 통과**(새 3개 포함)
- SQL 직접 실행: `DIM_FEATURE`(FS-DRAFT, 모델 버전으로 찾는 경로) 39행, `ALTERNATIVE_YN = N` 19행
- 실제 연결(로컬 연습 DB, 공용 DB에는 쓰지 않음): 시연 계정 로그인 → 점수 산출 `SCORED` → `GET /api/report/me`의 `modelFeatures` **기존 19개 / 대안 39개**, 대안의 `alternativeYn = Y` 항목(통신비·공과금 등) 확인
- 확인 못 함: 화면(경환 님 브랜치 `ScoreComparisonCard.jsx`)에서 칩 표시

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
