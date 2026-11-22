# Avenue API 명세서 — B팀 (점수 산출·리포트·예측 서버)

- **버전:** v0.3 · 관리: 범영(B팀) · 처음 작성 2026-11-12
- **범위:** B팀이 맡는 API의 요청·응답 상세. 전체 목록은 [API 정의서](api_definition.md), 문서 관계는 [README](README.md)에 있다.
  - **Spring 공개 API (3장):** RPT-01 점수 산출, RPT-02 내 리포트, RPT-03 지난 평가 상세, MEM-06 진단 내역(응답 매핑만)
  - **Spring → FastAPI 내부 API (4장):** ML-01 ~ ML-04. 화면은 직접 부르지 않는다
- **기준:** DDL `docs/spec/sql/avenue_ddl.sql`(v0.3.2, 표 48개 — 11/19 N-25 평가 표본 `MODEL_EVAL_SAMPLE` 추가 🆕 11/20), 피처 정의서 v1.0 `docs/spec/feature_definition.md`. `features.md`·`decisions.md`와 다르면 DDL을 따른다.
- **장 번호는 바꾸지 않는다.** 코드 주석이 "B팀 명세서 4-3"처럼 이 번호를 가리킨다.
- 상태 표시: ✅ 확정 · 🟡 임시값·제안(설정 한 곳에 둔다) · ⛔ 미정(9장)

> **🆕 최근 변경 (11/20, FP-143)** — 바뀐 곳에 🆕 11/20 표시
> 1. 기준 DDL 표 48개(N-25 평가 표본 `MODEL_EVAL_SAMPLE`, PR #99)
> 2. 4-4 SIM-02 경로를 `/api/members/me/credit-care-recalculate`로(PR #103)
>
> 이전 변경 (11/19): 4장 머리말 ML-03(ACTIVE)·ML-04(저장된 버전) 구분, 공용 DB 실제 모델 전환 완료 반영
> 이전 변경 (11/18): 저장소 `docs/spec/api/api_spec_b.md`로 이관(장 번호 그대로), 4-4 간편결제 × 12 🟡 정정
> 이전 변경 (11/17): ML-04 10번째 키 `UTILITY_LATE_MONTHS`, ML-04 범위 검사는 Spring SIM-02가 먼저, RPT-02·03 `modelFeatures`, 실제 모델 연결(FP-141, PR #74)·`supportedModelVersions`, 모델 파일 해시 대조(PR #77), SIM-02 오류 전달 규칙(광희 PR #78)
> 이전 변경 (11/16): O-13(입력 부족 409)·O-15(`NO_LOAN_YN`)·O-3·O-6·O-9·O-14 확정, `creditProfile` null·`payerTypeCode`, 4xx 재시도 안 함, 입력 최신성 6개월, 빈 목록 `ALT_DATA_EMPTY`
> 이전 변경 (11/13): 피처 정의서 v1.0 반영(피처 코드 39개, `creditProfile` 짝, ML-04 키 10개), rank 동점 이름순

**v0.2 → v0.3에서 바뀐 것 (2026-11-12 범영 결정)**

| 결정 | 내용 | 반영한 곳 |
|---|---|---|
| ✅ 구현 담당 | RPT-01·02·03과 MEM-06의 **Spring 서버 구현은 범영**이 맡는다 | 정의서 Q-1 해결 |
| ✅ 1차 개발 범위 | **신용평가사 조회(207열)는 1차에 하지 않는다.** 2차에 필요하면 추가한다 | 2장, 4-3 (`creditBureau`는 2차용 선택 필드) |
| ✅ 필수 동의 | **대안 데이터 5개 모두 동의해야 산출한다.** 통신 `TELECOM_BILL`, 공과금 `UTILITY_BILL`, 간편결제 `EASYPAY`, 국민연금 `NATIONAL_PENSION`, 건강보험 `HEALTH_INSURANCE`. 하나라도 없으면 **409 `INPUT_INCOMPLETE`**(11/16 O-13 확정, 평가 행 저장 안 함) | 2장, 3-1, 4-3 |
| ✅ 대출 | 대출 동의(`financial/LOANS`)는 필수가 아니다. 화면에 "해당 없음" 키를 두고, 누르면 `NO_LOAN_YN = 'Y'`로 저장한다(O-15 A안) | 4-3 `loans`, 9장 O-15 |
| ✅ 기존 모델의 뜻 | 실제 신용평가사 점수를 그대로 재현하는 모델이 아니다. 기존 평가가 보는 **금융 정보를 최대한 반영한 비교 기준 모델**이다. 대안 모델과 차이는 **대안 데이터 5개 유무 하나뿐**이다(같은 알고리즘·데이터 분리·튜닝·점수 변환식) | 4-3 |
| ✅ SHAP 저장 | 피처 **전부** 저장한다 (DDL `ASSESSMENT_FACTOR` 주석 "모든 피처") | 4-3, O-5 해결 |
| ✅ `shapValue` | 저장하고 화면에는 보내지 않는다 | O-4 해결 |
| ✅ 피처 목록 (11/13) | 피처 정의서 v1.0(`docs/spec/feature_definition.md`, FP-132)을 따른다. **기존 모델 19개, 대안 모델 39개**. `DIM_FEATURE`에는 정의서 11장 39개를 `FS-DRAFT`로 넣는다(`docs/spec/sql/seed/avenue_seed_dim_feature_fs_draft.sql`) | 4-3, 5장, O-1·O-16 해결 |

**v0.1 → v0.2에서 바뀐 것**
- Spring 공개 API(3장)를 새로 넣었다. 프론트에 이미 있는 경로(`score-calculation`, `report/me`, `diagnoses`)는 그대로 두고 필드만 더했다.
- DDL v0.3.2 반영: 탈퇴 회원 평가 이력 보존(W1), 불러온 대출의 `CONSENT_ID`(W2·W3)
- ML-04 응답에 `topReductionFactors`(감점 요인 상위 3개, 회복 점수)를 넣었다. C팀 mock이 이미 이 값을 기대하고 있어서다(v0.1 O-7).
- SIM-02의 출발점을 화면이 보낸 점수가 아니라 저장된 `FEATURE_SNAPSHOT`으로 정했다(4-4).

---

## 1. 공통 규칙

정의서 1장 공통 규칙을 따른다. B팀 API에 더하는 규칙은 아래와 같다.

| | 규칙 | 근거 |
|---|---|---|
| ✅ | FastAPI는 **상태가 없다.** DB를 읽거나 쓰지 않고, 필요한 값은 모두 요청 본문으로 받는다 | 인수인계 결정 #4·#7 |
| ✅ | 피처 계산(집계)은 **FastAPI 한 곳**에서만 한다. Spring은 응답의 `featureSnapshot`을 그대로 저장한다. 학습 때와 서비스 때 계산이 갈라지는 것(training-serving skew)을 막는 방식이다 | 결정 #7 |
| ✅ | 저장은 Spring만 한다. `ASSESSMENT` 1행과 `ASSESSMENT_FACTOR` 여러 행을 **한 트랜잭션**으로 저장한다. 평가는 추가만 하고 고치거나 지우지 않는다(탈퇴해도 보존, W1) | 결정 #5, DDL W1 |
| ✅ | 평가 식별자는 `REQUEST_ID`(소문자 UUID)만 밖으로 보낸다. `ASSESSMENT_ID`는 응답에 넣지 않는다 | DDL B3 |
| ✅ | FastAPI 응답의 `modelVersion`·`featureSetVersion`·`cutoffVersion`은 DB 값과 **글자까지 같아야** 한다. 다르면 FK 오류로 저장이 실패한다 | DDL FK |
| ✅ | 화면에는 `shapScore`(점수 단위 증감)만 보낸다. "작용한 정도"로만 표시하고 원인처럼 설명하지 않는다 | AGENTS.md 5장 |
| ✅ | `FEATURE_SNAPSHOT`(모델 입력 전체)은 개인 금융정보라 **회원 화면 응답에 넣지 않는다.** 관리자가 열람하면 `ACCESS_AUDIT_LOG`에 남긴다 | DDL `FEATURE_SNAPSHOT` 주석 |

### 1-1. 오류 응답 (✅ D-20 확정, 🆕 11/20)

```json
{ "code": "INVALID_INPUT", "message": "입력값을 확인해 주세요.", "fieldErrors": [{ "field": "baseMonth", "message": "기준월을 입력해 주세요." }] }
```
- 프론트가 이미 쓰는 형식이다(`code`, `message`, `fieldErrors`). FastAPI 내부 오류에는 추적용 `requestId`를 하나 더 넣는다.
- `message`와 로그에 입력값·개인정보 원문을 넣지 않는다.

---

## 2. 점수 산출 판정 흐름 (Spring, RPT-01)

```
① 로그인·직군 확인       직군 없음 → 409 JOB_TYPE_REQUIRED          (평가 행 저장 안 함)
② 입력 완료 확인         N-05-8 6개 항목 중 하나라도 덜 참          → 409 INPUT_INCOMPLETE   (저장 안 함)
                          - 소득: DIM_WORKER_TYPE.REQUIRED_INCOME_MONTHS(12/12/1)만큼
                          - 자산: TOTAL_ASSET_AMT IS NOT NULL / 대출: USER_LOAN 행 또는 NO_LOAN_YN = 'Y'
                          - 대안 데이터 5개 모두 유효한 동의 + 불러오기 완료(만료·철회면 덜 찬 것)
                          ※ 1차는 신용평가사 동의를 보지 않는다. 대출 동의는 필수가 아니다
   + 출생연도 없음(연령대 필수)                                → 409 INPUT_INCOMPLETE   (11/16 재욱 검토)
③ 입력 최신성 확인       기준월이 APP_SETTING.INPUT_MAX_AGE_MONTHS(DB 설정값, 11/16 3→6)보다 오래됨  ← 코드에 고정하지 않고 DB 값을 읽는다
                          → 200 NOT_SCORABLE + STALE_INPUT          (호출 안 함, 행 저장)
④ 호출 전 소득 확인       직군별 개월 수(12/12/1)·서로 다른 달이 아니면 → 409 INPUT_INCOMPLETE (FastAPI 422 방지)
④-2 통신비·공과금 기록    둘 중 하나라도 불러온 기록이 0건            → 200 NOT_SCORABLE + ALT_DATA_EMPTY (호출 안 함, 행 저장, 11/16 정의서 8-5 (다))
⑤ ML-03 호출 → 200        → 200 SCORED (ASSESSMENT + ASSESSMENT_FACTOR 한 트랜잭션)
            → 연결 실패·시간 초과·5xx → 1번 재시도 → 그래도 실패면 200 NOT_SCORABLE + MODEL_ERROR
            → 4xx(422·409) → 재시도 없이 200 NOT_SCORABLE + MODEL_ERROR + 경고 로그
```
- **11/16 O-13 확정:** 입력·동의가 덜 찬 경우는 평가가 아니라 요청 거절(409)이다. 화면(FP-86)이 버튼을 먼저 막고, 서버도 같은 조건으로 다시 확인한다.
- 산출 불가 사유 코드는 `DIM_NOT_SCORABLE_REASON` 4가지에 `ALT_DATA_EMPTY`(대안 데이터 기관 기록 없음, 통신비·공과금)를 더해 5가지다(재욱 DDL PR). 1차에서 실제로 저장되는 사유는 `STALE_INPUT`, `ALT_DATA_EMPTY`, `MODEL_ERROR` 3가지다. `CONSENT_REQUIRED`, `INPUT_INCOMPLETE` 코드는 표에 남겨 두고 쓰지 않는다(코드 표는 지우지 않는다).
- `NOT_SCORABLE` 행 규칙(DDL CHECK)
  - `MODEL_VERSION`은 꼭 채운다. 지금 ACTIVE인 `MODEL_REGISTRY` 값을 쓴다.
  - 두 점수는 `SCORABLE_YN = 'N'`, 점수·등급·확률은 NULL
  - `FEATURE_SNAPSHOT`, `FEATURE_SET_VERSION`, `CUTOFF_VERSION`은 NULL이어도 된다.
- 판정 순서는 권장안이다. 바꾸려면 범영과 먼저 정한다.

---

## 3. Spring 공개 API

### 3-1. RPT-01 `POST /api/members/me/score-calculation` — N-12-2 기존·대안 점수·3등급 계산·저장 — ✅ 구현됨(FP-142)

**요청** (✅ 경로 고정. 본문은 🟡 추가)
```json
{ "requestId": "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c" }
```
| 필드 | 필수 | 설명 |
|---|---|---|
| `requestId` | ✅ | 소문자 UUID. 화면이 버튼을 누를 때 만들고, **재시도할 때 같은 값**을 보낸다(FP-86 화면이 이미 보낸다). 없거나 형식이 틀리면 400 |

**응답 200** — 평가 행이 저장된 경우다: `SCORED`, 또는 `NOT_SCORABLE`(`STALE_INPUT`·`ALT_DATA_EMPTY`·`MODEL_ERROR`).
```json
{
  "calculatedAt": "2026-11-12T14:30:00+09:00",
  "requestId": "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c",
  "gradeStatusCode": "SCORED",
  "notScorableReasonCode": null,
  "alternative": { "score": 701, "gradeBandCode": "STANDARD" },
  "traditional": { "scorableYn": "Y", "score": 612, "gradeBandCode": "CAUTION" }
}
```
| 필드 | DB | 설명 |
|---|---|---|
| `calculatedAt` | `ASSESSED_AT` | ✅ 지금 mock에 있는 필드라 이름을 유지한다 |
| `requestId` | `REQUEST_ID` | 리포트 상세(RPT-03)에 쓴다 |
| `gradeStatusCode` | `GRADE_STATUS_CODE` | `SCORED` / `NOT_SCORABLE` |
| `notScorableReasonCode` | `NOT_SCORABLE_REASON_CODE` | 1차에서 오는 값은 `STALE_INPUT` / `ALT_DATA_EMPTY`(통신비·공과금 기관 기록 없음) / `MODEL_ERROR`(`CONSENT_REQUIRED`·`INPUT_INCOMPLETE`는 409로 바뀜). `SCORED`면 null |
| `alternative` | `ALT_SCORE`, `ALT_GRADE_BAND_CODE` | `NOT_SCORABLE`이면 null |
| `traditional` | `TRAD_SCORABLE_YN`, `TRAD_SCORE`, `TRAD_GRADE_BAND_CODE` | 금융 이력이 부족하면 `scorableYn: "N"`, 점수·등급 null |

**오류**
| HTTP | `code` | 언제 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 로그인 안 함·탈퇴 회원 |
| 403 | `FORBIDDEN` | 관리자 계정 |
| 400 | `INVALID_INPUT` | `requestId`가 없거나 소문자 UUID가 아님 |
| 409 | `JOB_TYPE_REQUIRED` | 직군 선택 전 |
| 409 | `INPUT_INCOMPLETE` | 입력 완료 6개 항목 미달, 또는 대안 데이터 5종 유효 동의·불러오기 빠짐. 평가 행을 저장하지 않는다. `message`는 화면에 그대로 보인다 |
| 409 | `REQUEST_ID_CONFLICT` | 같은 `requestId`가 **다른 회원**의 평가에 이미 있음 |

- **같은 `requestId`를 다시 보내면**(같은 회원) 새로 저장하지 않고 기존 결과를 그대로 돌려준다. DB `UK_ASM_REQUEST_ID` 위반(ORA-00001)을 잡아 처리하고, 이때 `USER_ID`가 같은지 꼭 확인한다(DDL B3).
- ✅ **O-13 확정(11/16 범영):** 화면 mock(FP-86)과 같이 입력·동의가 덜 차면 409로 막는다. 409에는 평가 행이 없으므로 진단 내역(MEM-06)에도 나오지 않는다.

### 3-2. RPT-02 `GET /api/report/me` — N-12 나의 신용 리포트, N-14 영역별 영향도(SHAP) — ✅ 구현됨(FP-142)

내 **가장 최근 평가 1건**을 돌려준다(`ASSESSED_AT` 최신). 최신 평가가 `NOT_SCORABLE`이면 상태와 사유만 채운다.

**응답 200**
```json
{
  "requestId": "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c",
  "assessedAt": "2026-11-12T14:30:00+09:00",
  "inputBaseMonth": "2026-10",
  "workerTypeCode": "SELF_EMPLOYED",
  "gradeStatusCode": "SCORED",
  "notScorableReasonCode": null,
  "traditional": { "scorableYn": "Y", "score": 612, "gradeBandCode": "CAUTION", "defaultProb": 0.183421 },
  "alternative": { "scorableYn": "Y", "score": 701, "gradeBandCode": "STANDARD", "defaultProb": 0.092115 },
  "comparison": { "scoreDiff": 89, "gradeChanged": true },
  "gradeBands": {
    "cutoffVersion": "CUT-0.1",
    "bands": [
      { "gradeBandCode": "CAUTION", "minScore": 0, "maxScore": 664 },
      { "gradeBandCode": "STANDARD", "minScore": 665, "maxScore": 779 },
      { "gradeBandCode": "GOOD", "minScore": 780, "maxScore": 1000 }
    ]
  },
  "shap": {
    "baseScore": 639,
    "factors": [
      { "rank": 1, "featureCode": "telecom_on_time_streak", "featureName": "통신비 정시 납부 기간", "unitName": "개월",
        "featureValue": "12", "shapScore": 31, "alternativeYn": "Y", "simulatableYn": "Y" },
      { "rank": 2, "featureCode": "income_cv_svc_12m", "featureName": "월 소득 변동 정도", "unitName": "비율",
        "featureValue": "0.27", "shapScore": -17, "alternativeYn": "N", "simulatableYn": "N" }
    ]
  },
  "aiSummary": null,
  "modelVersion": "DEV-DUMMY",
  "modelFeatures": {
    "traditional": [
      { "featureCode": "income_svc_12m_krw", "name": "최근 12개월 소득 합계", "alternativeYn": "N" },
      { "featureCode": "DQ1200001", "name": "최근 1년 연체 횟수", "alternativeYn": "N" }
    ],
    "alternative": [
      { "featureCode": "income_svc_12m_krw", "name": "최근 12개월 소득 합계", "alternativeYn": "N" },
      { "featureCode": "telecom_on_time_streak", "name": "통신비 정시 납부 기간", "alternativeYn": "Y" },
      { "featureCode": "DQ1200001", "name": "최근 1년 연체 횟수", "alternativeYn": "N" }
    ]
  }
}
```
(`modelFeatures` 예시는 일부만 적었다. 실제로는 FS-DRAFT 기준 기존 19개·대안 39개)

| 필드 | DB | 관련 기능 |
|---|---|---|
| `traditional.*`, `alternative.*` | `TRAD_*`, `ALT_*` | N-12-6 점수·등급 비교 표시, N-12-7 부도 확률 표시 |
| `comparison.scoreDiff` | `ALT_SCORE − TRAD_SCORE` (기존 점수가 없으면 null) | N-12-3 점수 차이·등급 변화 계산 |
| `comparison.gradeChanged` | 두 등급이 다른지 | N-12-3 |
| `gradeBands` | `SCORE_GRADE_BAND` (이 평가의 `CUTOFF_VERSION`) | N-12-6 반원 게이지 눈금. **과거 평가도 그때의 구간으로** 보여 준다 |
| `shap.baseScore` | `SHAP_BASE_SCORE` | N-14 |
| `shap.factors[]` | `ASSESSMENT_FACTOR` ⋈ `DIM_FEATURE` | N-14-2 증감이 큰 항목 정렬(`rank`), N-14-3 대안 데이터 항목 구분(`alternativeYn`), N-14-4 항목명·증감 점수 표시, N-12-8 한눈에 보는 요약, N-14-5 개선 미션 바로가기(`simulatableYn`) |
| `aiSummary` | `AI_SUMMARY` | N-31-2. 없으면 null, 생성은 RPT-04 |
| `modelFeatures.traditional[]` / `.alternative[]` | `DIM_FEATURE` (이 평가의 `FEATURE_SET_VERSION`, 산출 불가 평가는 `MODEL_REGISTRY`에서 모델 버전의 피처 세트) `DISPLAY_ORDER` 순 | N-12-6 모델별 피처 칩. 기존 = `ALTERNATIVE_YN = N`만, 대안 = 전체. 필드는 `featureCode`, `name`, `alternativeYn`. 묶음(소득·대출·통신비 등)은 화면이 `featureCode`로 만든다. 피처 사전이 없으면 `null` |

- 응답에 넣지 않는 것: `ASSESSMENT_ID`, `FEATURE_SNAPSHOT`, `SHAP_VALUE`(원래 SHAP 값), 학습용 열(`DATA_SPLIT_CODE` 등)
- 평가가 하나도 없으면 **404 `ASSESSMENT_NOT_FOUND`**. 화면은 "점수 산출하기" 안내를 보여 준다.
- 점수 합 규칙: `shap.baseScore + Σ shapScore = alternative.score` (✅ ML-03이 보장한다)

### 3-3. RPT-03 `GET /api/report/{requestId}` — N-04-6 진단 내역 조회 (상세) — ✅ 구현됨(FP-142)

- 응답 모양은 RPT-02와 같고(`modelFeatures` 포함), 지정한 평가 1건을 돌려준다.
- **본인 평가가 아니면 404 `ASSESSMENT_NOT_FOUND`**로 응답한다. 403을 쓰면 남의 평가가 있다는 사실이 드러나서 404로 통일한다.
- `requestId`가 UUID 형식이 아니면 400 `INVALID_INPUT`

### 3-4. MEM-06 `GET /api/members/me/diagnoses` — N-04-6 진단 내역 조회 (목록, 응답 매핑만) — ✅ 구현됨(FP-142)

경로와 필드는 ✅ 우찬 님 mock을 그대로 쓴다. B팀은 DB 값과 짝만 정한다.

| mock 필드 | DB | 비고 |
|---|---|---|
| `diagnosisId` | **`REQUEST_ID`** | ⚠️ `ASSESSMENT_ID`를 넣지 않는다 (RPT-03에 그대로 넘긴다) |
| `calculatedAt` | `ASSESSED_AT` | |
| `existingScore` | `TRAD_SCORE` | 산출 불가면 null |
| `alternativeScore` | `ALT_SCORE` | 산출 불가면 null |
| `grade` | `ALT_GRADE_BAND_CODE` | mock은 점수로 계산한다. 서버는 저장된 등급을 준다(그 평가의 구간 기준) |
| `modelVersion` | `MODEL_VERSION` | |
| `jobType` | `WORKER_TYPE_CODE` | 평가 시점 직군 |
| `alternativeScoreChange` | 직전 `SCORED` 평가 대비 차이 | 첫 평가는 null |
| (추가 🟡) `gradeStatusCode`, `notScorableReasonCode` | 같은 이름 열 | 산출 불가 행 표시용 |

- 정렬: 최신순. 서비스 회원 행만(`DATASET_CODE = 'SERVICE'`) 보여 준다.

---

## 4. Spring → FastAPI 내부 API

- 주소: 1차 개발·시연은 **한 PC**에서 `http://localhost:8000` (Spring 설정 `avenue.prediction.base-url`, 비우면 이 값). 외부에는 열지 않는다. Docker 내부망 `http://fastapi:8000`은 2차 개발 후보(미확정).
- ⛔ 내부 인증 헤더 여부(O-8)
- **모델 선택 (FP-141, PR #74)**
  - ML-03: Spring은 DB `MODEL_REGISTRY`의 **ACTIVE** 모델 버전을 `expectedModelVersion`으로 보낸다. **DB의 ACTIVE가 스위치**다.
  - ML-04: Spring SIM-02는 ACTIVE가 아니라 **출발 평가(최근 SCORED)에 저장된** `MODEL_VERSION`을 `baseAssessment.modelVersion`으로 보낸다. 저장된 피처값과 같은 모델로 다시 계산해야 하기 때문이다(4-4, FP-170 PR #93). 정정
  - `DEV-DUMMY`(또는 버전 없음) → Mock(`FS-DRAFT` 39개), `LGBM-BASE-0.1` → 실제 모델(`FS-V1` 38개), 그 밖 → 409 `VERSION_MISMATCH`
  - 실제 모델 파일이 없으면 Mock으로 바꾸지 않고 503 `MODEL_NOT_READY`(11/17 범영·재욱 합의)
  - 공용 DB는 11/18 `LGBM-BASE-0.1`(FP-216)에 이어 **11/20 `LGBM-BASE-0.2`로 전환 완료**(FP-237, 🆕 11/20). 학습 데이터·모델 파일 기록은 `docs/spec/sql/register_model_lgbm_base_0_1.sql`(PR #88). 전환은 `docs/spec/sql/activate_model_lgbm_base_0_1.sql`, 되돌리기는 `rollback_model_to_dev_dummy.sql`(PR #77, 절차: `fastapi_server/README.md`). 0.2는 `register_model_lgbm_base_0_2.sql` → `activate_model_lgbm_base_0_2.sql`, 되돌리기 `rollback_model_lgbm_base_0_2_to_0_1.sql`(PR #110·#113)

### 4-1. ML-01 `GET /v1/health`
```json
{ "status": "UP", "modelLoaded": true, "modelVersion": "LGBM-BASE-0.1", "supportedModelVersions": ["DEV-DUMMY", "LGBM-BASE-0.1"] }
```
- `modelLoaded`: **실제 모델 파일**을 불러왔는지. Mock은 파일이 없어도 늘 쓸 수 있다. `false`면 `modelVersion`은 `DEV-DUMMY`다.
- 서버가 켜져 있으면 늘 200 `"status": "UP"`이다. 공용 DB를 실제 모델로 바꾸기 전에 `modelLoaded: true`를 꼭 확인한다.

### 4-2. ML-02 `GET /v1/model-info`
Spring이 시작할 때 한 번 부른다. 세 버전이 DB에 있는지 확인하고, 없으면 평가를 막는다. FK 오류로 저장이 실패하는 것을 미리 막기 위해서다.
```json
{
  "modelVersion": "DEV-DUMMY",
  "featureSetVersion": "FS-DRAFT",
  "cutoffVersion": "CUT-0.1",
  "gradeBands": [ { "gradeBandCode": "CAUTION", "minScore": 0, "maxScore": 664 } ],
  "supportedModelVersions": ["DEV-DUMMY", "LGBM-BASE-0.1"],
  "features": [ { "featureCode": "telecom_on_time_streak", "alternativeYn": "Y", "simulatableYn": "Y" } ]
}
```
- `gradeBands`와 `features`가 DB(`SCORE_GRADE_BAND`, `DIM_FEATURE`)와 다르면 Spring이 경고 로그를 남긴다.
- 실제 모델을 불러왔으면 그 묶음의 버전(예: `LGBM-BASE-0.1`) / `FS-V1` / 피처 38개, 아니면 Mock `DEV-DUMMY` / `FS-DRAFT` / 39개를 돌려준다. `supportedModelVersions`는 이 서버가 지금 계산할 수 있는 버전 목록이다: `DEV-DUMMY` + 불러온 묶음의 버전(못 불러왔으면 `DEV-DUMMY`만). 🆕 11/20
- 🆕 11/20 실제 모델 버전은 코드 상수가 아니라 불러온 묶음의 `meta.json`(`model_version`)에서 정한다(FP-237). 모델을 바꿀 때 코드는 그대로 두고 파일 교체 + DB 등록·전환 SQL만 한다.

### 4-3. ML-03 `POST /v1/assessments/score` — N-12-2 점수 계산

**요청**
```json
{
  "requestId": "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c",
  "expectedModelVersion": "DEV-DUMMY",
  "applicant": { "workerTypeCode": "SELF_EMPLOYED", "age": 34, "requiredIncomeMonths": 12 },
  "inputBaseMonth": "2026-10",
  "incomeMonths": [ { "baseMonth": "2025-11", "incomeKindCode": "MONTHLY_INCOME", "incomeAmt": 2850000 } ],
  "expenses": [ { "expenseGroupCode": "FIXED", "expenseCategory": "주거", "monthlyAmt": 650000 } ],
  "loans": [ { "loanTypeCode": "CREDIT", "sourceCode": "IMPORTED", "balanceAmt": 12000000, "annualRatePct": 8.9, "remainingMonths": 24, "monthlyPaymentAmt": 550000 } ],
  "creditProfile": { "sourceCode": "MANUAL", "delinqCount12m": 0, "newLoanCount3m": 0, "cardLimitAmt": 5000000, "cardMonthlySpendAmt": 800000, "cashAdvanceMonths": 0, "privateLenderLoanBalanceAmt": 0 },
  "alternativeData": {
    "telecom": [ { "billMonth": "2025-11", "billedAmt": 55000, "dueDate": "2025-11-25", "paidDate": "2025-11-20", "paymentStatusCode": "ON_TIME" } ],
    "utility": [ { "billMonth": "2025-11", "billedAmt": 60000, "dueDate": "2025-11-25", "paidDate": null, "paymentStatusCode": "UNPAID" } ],
    "easypay": [ { "baseMonth": "2025-11", "observationStatusCode": "OBSERVED", "paymentCount": 23, "paymentAmt": 410000, "activeDays": 15 } ],
    "socialInsurance": [ { "insuranceTypeCode": "NATIONAL_PENSION", "baseMonth": "2025-11", "coverageStatusCode": "COVERED", "payerTypeCode": "WORKPLACE", "paymentStatusCode": "ON_TIME", "individualAmt": 120000, "paidAmt": 120000 } ]
  }
}
```
| 필드 | 필수 | 원천 (DDL v0.3.2) | 규칙 |
|---|---|---|---|
| `requestId` | ✅ | `ASSESSMENT.REQUEST_ID` | FastAPI는 저장하지 않고 응답에 그대로 돌려준다(로그 추적용) |
| `expectedModelVersion` | 선택 | `MODEL_REGISTRY` ACTIVE | 다르면 409 `VERSION_MISMATCH` |
| `applicant.workerTypeCode` | ✅ | `APP_USER.WORKER_TYPE_CODE` | |
| `applicant.age` | ✅ | `APP_USER.BIRTH_YEAR`로 Spring이 계산 | 만 나이만 보낸다. 다른 개인정보는 보내지 않는다 |
| `applicant.requiredIncomeMonths` | ✅ | `DIM_WORKER_TYPE.REQUIRED_INCOME_MONTHS` | FastAPI가 한 번 더 검사한다: 값이 없거나 직군(12/12/1)과 다르거나, 소득이 서로 다른 그 개월 수가 아니면 422 |
| `inputBaseMonth` | ✅ | 가장 늦은 `USER_INCOME_MONTH.BASE_MONTH` | |
| `incomeMonths[]` | ✅ | `USER_INCOME_MONTH` (기준월 −11 ~ 기준월) | 자영업자·프리랜서 12개, 급여소득자 `SALARY` 1개 |
| `expenses[]` | ✅ | `USER_EXPENSE_ITEM` (기준월 행) | 평소 월 금액 (R1) |
| `loans[]` | ✅ (빈 배열 가능) | `USER_LOAN` (기준월 행) | `rateTypeCode`는 모델 입력이 아니라 보내지 않는다. 대출 "해당 없음"(`NO_LOAN_YN = 'Y'`)이면 `[]` (O-15 A안 해결) |
| `creditProfile` | ✅ | `USER_CREDIT_PROFILE` 최신 행. **1차는 회원 직접 입력**(`SOURCE_CODE = MANUAL`, `CB_AVAILABLE_YN = 'N'`) | 1차 모델의 금융 정보 원천. 피처 정의서 3-6과 짝: `delinqCount12m` → `DQ1200001`(30일 이상), `cashAdvanceMonths` → `CF1231605`, `newLoanCount3m` → `L22000900`, `privateLenderLoanBalanceAmt` → `LA0099212`, `cardLimitAmt`·`cardMonthlySpendAmt` → `CL0631905`(사용액 ÷ 한도 × 100). `maxDelinqDays3m`은 정의서에 없어 뺐다(O-16 해결). 회원이 "신용 이력이 없어요"를 고르면 연체·현금서비스·신규 대출·카드 값이 **null**로 온다(INP-02). FastAPI는 null을 0으로 바꾸지 않는다(정의서 7장) |
| `creditBureau` | **2차용 선택 필드** | 가상 신용평가사 응답 (DB에 원문 없음, R2) | **1차에는 보내지 않는다.** 2차에 추가할 때도 이 필드에 값만 채우면 되고 기존 호출은 깨지지 않는다 |
| `alternativeData.*` | ✅ 5종 모두 | `USER_TELECOM_PAYMENT`, `USER_UTILITY_PAYMENT`, `USER_EASYPAY_USAGE`, `USER_SOCIAL_INSURANCE_PAYMENT` (기준월 −11 ~ 기준월) | 5개 동의가 필수라 `null`로 오지 않는다. `[]`은 "불러왔지만 기록 없음". `socialInsurance` 행에는 가입 유형 `payerTypeCode`(`PAYER_TYPE_CODE`: `WORKPLACE`·`REGIONAL`·`VOLUNTARY`·`HOUSEHOLD`·`UNKNOWN`)를 함께 보낸다. 피처 `np_payer_type`·`hi_payer_type`의 원천이다 |

- 자산(`USER_ASSET_SNAPSHOT`)은 모델 입력이 아니라 보내지 않는다(결정 #2).
- **이상치 고정 상한 (피처 정의서 C8, 임시):** 12개월 소득 합계 20억 원 초과, 평균 월 지출 2억 원 초과, 월 상환액 0 미만이면 FastAPI가 그 값과 **그 값으로 계산하는 피처를 함께 결측**으로 둔다(11/16 (가)안). 상한은 FastAPI 설정 상수다. 소득 합계 0 이하면 비율 피처도 결측이다.
- **피처 수:** Mock(`DEV-DUMMY`)은 `FS-DRAFT` 39개, 실제 모델(`LGBM-BASE-0.1`)은 `FS-V1` 38개(피처 정의서 C9로 `LRZ021201` 제외)다. `FS-V1` 시드는 PR #72(재욱)로 추가했고 공용 DB에도 들어 있다(O-17).
- **1차 모델 구성 (피처 정의서 v1.0, 11/13 임시 결정 · D-29)**
  - **기존 모델 19개:** 소득·지출·상환 9개(`incomeMonths`·`expenses`·`loans`에서 계산) + 프로필 3개(`segment` ← `workerTypeCode`, `age`, `debt_balance_krw` ← 대출 잔액 합) + 신용 이력 7개(`creditProfile` 5개 칸 + 대출 목록에서 `L00000001` 대출 건수, `LRZ021201` 월 상환액 합 × 12)
  - **대안 모델 39개:** 기존 19개 + 대안 데이터 20개(통신·공과금 3, 간편결제 4, 국민연금 6, 건강보험 6, `si_arrears_any` 1). 두 모델의 차이는 **대안 데이터 유무 하나뿐**이다.
  - 피처 계산은 FastAPI가 정의서 3장 계산식대로 한다. 피처 코드는 학습 데이터 열 이름 그대로다(예: `income_cv_svc_12m`, `DQ1200001`).
  - 총자산·업력·대출 상세(종류·금리·남은 기간)는 모델에 쓰지 않는다(정의서 8-4).
- 공과금 미납 개월 수(`utility_late_months`)는 12개월 중 `LATE` 또는 `UNPAID`인 달의 수다(DDL U2). 계산은 FastAPI가 한다.

**응답 200**
```json
{
  "requestId": "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c",
  "modelVersion": "DEV-DUMMY", "featureSetVersion": "FS-DRAFT", "cutoffVersion": "CUT-0.1",
  "traditional": { "scorableYn": "Y", "score": 612, "gradeBandCode": "CAUTION", "defaultProb": 0.183421 },
  "alternative": { "scorableYn": "Y", "score": 701, "gradeBandCode": "STANDARD", "defaultProb": 0.092115 },
  "shap": {
    "baseScore": 639,
    "factors": [
      { "rank": 1, "featureCode": "telecom_on_time_streak", "featureValue": "12", "shapValue": -0.214503, "shapScore": 31 },
      { "rank": 2, "featureCode": "income_cv_svc_12m", "featureValue": "0.27", "shapValue": 0.118220, "shapScore": -17 }
    ]
  },
  "featureSnapshot": { "telecom_on_time_streak": 12, "income_cv_svc_12m": 0.27, "…": "39개 전부" }
}
```
| 응답 필드 | 저장 위치 (`ASSESSMENT` / `ASSESSMENT_FACTOR`) | 규칙 |
|---|---|---|
| 버전 3개 | `MODEL_VERSION`, `FEATURE_SET_VERSION`, `CUTOFF_VERSION` | DB 값과 같아야 한다 |
| `traditional.*` | `TRAD_SCORABLE_YN`, `TRAD_SCORE`, `TRAD_GRADE_BAND_CODE`, `TRAD_DEFAULT_PROB` | 못 내면 `"N"` + 나머지 null (`CK_ASM_TRAD_VALUES`) |
| `alternative.*` | `ALT_*` | 200이면 항상 `"Y"`. Spring은 `GRADE_STATUS_CODE = SCORED`로 저장한다 |
| `shap.baseScore` | `SHAP_BASE_SCORE` | |
| `shap.factors[]` | `ASSESSMENT_FACTOR` 1행씩 (`FEATURE_RANK`, `FEATURE_CODE`, `FEATURE_VALUE`, `SHAP_VALUE`, `SHAP_SCORE`) | `featureCode`는 `DIM_FEATURE`(같은 `FEATURE_SET_VERSION`)에 있어야 한다 |
| `featureSnapshot` | `FEATURE_SNAPSHOT` (CLOB IS JSON) | 모델에 넣은 피처값 전체. 빈 객체는 안 된다 |

- **점수 합 규칙:** `baseScore + Σ shapScore = alternative.score`
  - 반올림으로 생기는 1~2점 차이는 FastAPI가 `|shapScore|`가 큰 항목부터 1점씩 나눠 맞춘다(최대 잉여 방식).
  - ✅ **`rank` 규칙 (DDL `FEATURE_RANK` 주석, 11/13 범영 확정):** 올림·내림 상관없이 `|shapScore|`가 큰 순서로 1부터 매긴다. `|shapScore|`가 같으면 **항목 이름(`DIM_FEATURE.FEATURE_NAME`) 가나다순**으로 앞에 둔다. 화면(N-12-8)은 부호(+/−)로 나눈 뒤 각 쪽에서 `rank`가 작은 3개를 고른다.
  - ✅ `factors`에는 피처 **전부**를 담고 Spring은 전부 저장한다(DDL 주석 "모든 피처"). 화면(RPT-02)에 몇 개를 보낼지는 따로 정한다(🟡 상위 10개).

**오류**
| HTTP | `code` | Spring 처리 |
|---|---|---|
| 422 | `INVALID_INPUT` | 버그로 보고 로그를 남긴다. **재시도 없이** `MODEL_ERROR` 행 저장. Spring이 호출 전에 소득 개월 수와 통신비·공과금 빈 목록을 확인해 막으므로 정상 흐름에서는 나오지 않는다(FastAPI는 통신비 또는 공과금이 빈 목록이면 `fieldErrors` `alternativeData.telecom`/`utility`로 422) |
| 409 | `VERSION_MISMATCH` (이 서버가 계산할 수 없는 모델 버전) | `MODEL_ERROR` 행 저장, 운영자 알림 |
| 503 | `MODEL_NOT_READY` (실제 모델 파일이 없거나 해시 불일치) | 같은 `requestId`로 1번만 재시도한 뒤 `MODEL_ERROR` |
| 500 / 타임아웃 | `INTERNAL_ERROR` | 위와 같음. 🟡 타임아웃: 연결 1초, 응답 3초 (D-18 전) |

### 4-4. ML-04 `POST /v1/assessments/simulate` — N-18 신용케어 시뮬레이터 (저장 안 함)

C팀 SIM-02 `POST /api/members/me/credit-care-recalculate`가 부른다(11/19 경로 이동, 광희 PR #103 🆕 11/20).
- **흐름:** C팀 Spring이 로그인 회원의 최신 `SCORED` 평가에서 `FEATURE_SNAPSHOT`과 버전을 읽어 출발점으로 보낸다.
  - 화면이 보낸 `currentScore`는 쓰지 않는다. 화면 값이 조작돼도 결과가 바뀌지 않고, 리포트의 SHAP과 같은 기준이 된다.

**요청**
```json
{
  "requestId": "9b2e4c1a-…(새 UUID)",
  "baseAssessment": { "requestId": "3f1c2a9e-…", "modelVersion": "DEV-DUMMY", "featureSetVersion": "FS-DRAFT", "featureSnapshot": { "telecom_on_time_streak": 12, "…": "39개 전부" } },
  "applicant": { "workerTypeCode": "SELF_EMPLOYED" },
  "changes": {
    "TELECOM_ON_TIME_MONTHS": 12, "DELINQ_COUNT_12M": 0, "CASH_ADVANCE_MONTHS": 0, "NEW_LOAN_COUNT_3M": 0, "EASYPAY_MONTHLY_COUNT": 30,
    "CARD_LIMIT_AMT": 5000000, "CARD_MONTHLY_SPEND_AMT": 800000, "LOAN_BALANCE_AMT": 10000000, "PRIVATE_LENDER_LOAN_BALANCE_AMT": 0,
    "UTILITY_LATE_MONTHS": 0
  }
}
```
- `changes`의 키 10개 (✅ `UTILITY_LATE_MONTHS` 10번째 키 확정, 11/17 범영)
  - N-18-2 값 바꾸기 (슬라이더 5개): `TELECOM_ON_TIME_MONTHS`, `DELINQ_COUNT_12M`, `CASH_ADVANCE_MONTHS`, `NEW_LOAN_COUNT_3M`, `EASYPAY_MONTHLY_COUNT`
  - N-18-3 값 바꾸기 (금액 입력 4개): `CARD_LIMIT_AMT`, `CARD_MONTHLY_SPEND_AMT`, `LOAN_BALANCE_AMT`, `PRIVATE_LENDER_LOAN_BALANCE_AMT`
  - 공과금 미납 개월 수 `UTILITY_LATE_MONTHS`(0~12) — 10번째 입력
  - 화면 항목을 피처로 바꾸는 규칙은 FastAPI가 가진다. 바꾸지 않은 항목은 빼거나 null로 보낸다(**null = 키를 뺀 것과 같음**, 단 카드는 둘 다 null이거나 둘 다 값).
  - **범위 검사:** FastAPI는 범위를 검사하지 않고 그대로 계산한다(소수는 정수로 자름). 음수·상한 초과는 **Spring SIM-02가 화면 범위로 먼저 막는다**(11/17 범영 결정, 광희 확인).
  - 키 ↔ 피처 (정의서 8-2): `TELECOM_ON_TIME_MONTHS` → `telecom_on_time_streak`(0~12개월), `DELINQ_COUNT_12M` → `DQ1200001`, `CASH_ADVANCE_MONTHS` → `CF1231605`, `NEW_LOAN_COUNT_3M` → `L22000900`, `EASYPAY_MONTHLY_COUNT` → `dp_payment_count_12m`(Spring은 월 횟수 그대로 보낸다. 🟡 FastAPI가 지금은 × 12로 바꾸지만 변환 방식은 피처 정의서 9장 미정 — 정정, 이전 판의 "확정"은 잘못), `CARD_LIMIT_AMT`·`CARD_MONTHLY_SPEND_AMT` → `CL0631905`, `LOAN_BALANCE_AMT` → `debt_balance_krw`, `PRIVATE_LENDER_LOAN_BALANCE_AMT` → `LA0099212`, `UTILITY_LATE_MONTHS` → `utility_late_months`(0~12)
  - 통신비 정시 납부를 바꿀 때 `telecom_late_months`도 함께 바꿀지는 정의서 9장 미정이다.
- `baseAssessment.modelVersion`으로 계산기를 고른다(4장 머리말 "모델 선택"). 이 서버가 계산할 수 없는 버전이면 409 `VERSION_MISMATCH`, 실제 모델 파일이 없으면 503 `MODEL_NOT_READY`
- SIM-02가 ML-04 오류를 화면에 전달하는 규칙(422 → 400, 503·연결 실패 → 503, 409 → 409)은 [API 정의서](api_definition.md) 2-6(C조 광희, PR #78)에 있다.
- **잘못된 `changes`는 422 `INVALID_INPUT`** (조용히 무시하지 않는다, 11/16 재욱 검토)
  - 위 10개 키 밖의 키(오타 등) → `fieldErrors`에 `changes.<그 키>`
  - `CARD_LIMIT_AMT`·`CARD_MONTHLY_SPEND_AMT` 중 하나만 옴 → `changes.CARD_LIMIT_AMT` (저장된 피처값에는 사용률만 있어서 하나로는 다시 계산할 수 없다)
  - 카드 한도가 0이면 오류가 아니라 사용률(`CL0631905`)을 **결측**으로 둔다(점수 계산과 같은 규칙)

**응답 200**
```json
{
  "requestId": "9b2e4c1a-…",
  "modelVersion": "DEV-DUMMY", "cutoffVersion": "CUT-0.1",
  "before": { "score": 701, "gradeBandCode": "STANDARD", "defaultProb": 0.092115 },
  "after":  { "score": 742, "gradeBandCode": "STANDARD", "defaultProb": 0.071530 },
  "delta":  { "total": 41, "financialEffect": 12, "alternativeEffect": 29 },
  "topReductionFactors": [
    { "rank": 1, "featureCode": "CL0631905", "featureValue": "62", "shapScore": -15, "recoverScore": 10 }
  ],
  "shap": { "baseScore": 639, "factors": [ "…4-3과 같은 모양…" ] }
}
```
| 필드 | 관련 기능 | C팀 mock 필드와 짝 |
|---|---|---|
| `before` / `after` | N-18-5 모델 점수 재계산, N-18-9 결과 표시 | `currentScore`·`currentGradeBand` / `expectedScore`·`expectedGradeBand` |
| `after.defaultProb` | N-18-6 부도 확률 변화 계산 | `expectedDefaultRate` |
| `delta.total` | N-18-9 | `scoreDiff` |
| `delta.financialEffect` / `alternativeEffect` | N-18-5 (금융 이력 영향 / 대안 데이터 영향, `DIM_FEATURE.ALTERNATIVE_YN`으로 나눔. 합 = total) | ✅ C조 mock도 `delta.financialEffect` / `alternativeEffect`로 바꿈(PR #78, `altDataBonusDiff` 삭제) |
| `topReductionFactors[]` | N-18-8 감점 요인 상위 3개 안내 (`shapScore`가 가장 낮은 3개, `simulatableYn = Y`만) | `topReductionFactors` — 항목명은 `DIM_FEATURE.FEATURE_NAME`, 행동 문구(`actionCondition`)는 화면 문구로 둔다 🟡 |

- `recoverScore`: 그 항목을 시뮬레이터 범위 안에서 가장 좋은 값으로 바꿨을 때 오르는 점수(O-14 확정)
- 결과는 저장하지 않는다(O-9 확정).

---

## 5. Mock 서버 (FP-140)

| 항목 | Mock 동작 |
|---|---|
| 버전 | `DEV-DUMMY` / `FS-DRAFT` / `CUT-0.1` (DDL 기준 데이터와 같음) |
| 점수 | 입력에서 정해지는 값이다. 같은 입력이면 같은 점수가 나와서 화면 테스트가 흔들리지 않는다. 범위 0~1000 |
| SHAP | 점수 합 규칙을 실제와 똑같이 지킨다 |
| 피처 코드 | ✅ 피처 정의서 v1.0 11장의 39개를 `FS-DRAFT`로 쓴다(정의서가 확정되면 `FS-V1`). 시드 파일 `docs/spec/sql/seed/avenue_seed_dim_feature_fs_draft.sql`(11/13, `avenue_ddl.sql` 다음 실행). 금융 8: `income_cv`, `zero_income_months_12m`, `expense_to_income_pct`, `debt_service_ratio_pct`, `delinq_count_12m`, `max_delinq_days_3m`, `card_util_pct`, `cash_advance_months` / 대안 6: `telecom_on_time_streak`, `telecom_late_months`, `utility_late_months`, `dp_payment_amount_12m_krw`, `np_arrears_months`, `hi_arrears_months`. 시뮬 가능 여부는 임시값 |
| 오류 시험 | 🟡 요청 헤더 `X-Mock-Scenario: MODEL_ERROR \| NOT_READY \| TIMEOUT` (개발용, 실제 서버에는 없음) |
| 실행·검사 | ✅ 구현됨(FP-140 브랜치 `feature-B/FP-140-prediction-mock-api`). `fastapi_server`에서 `uvicorn main:app --port 8000` → http://localhost:8000/docs . 자동 검사는 Python 내장 `python -m unittest discover tests -v`(실제 모델 포함 116개, 11/17). 자세한 방법은 `fastapi_server/README.md` |

## 6. 운영

| | 규칙 |
|---|---|
| ✅ | 모델 파일은 DB 밖(`fastapi_server/artifacts/`, Git 제외)에 둔다. 서버가 시작될 때 모델 묶음의 `SHA256SUMS.txt`와 파일 해시가 **같을 때만** 불러온다. 다르면 열지 않고 실제 모델 요청은 503 (joblib은 불러올 때 코드가 실행될 수 있다, PR #77). FastAPI는 DB를 읽지 않으므로 DB `MODEL_ARTIFACT.FILE_SHA256`은 기록용이며 공용 DB 전환 때 넣는다(FP-216) |
| ✅ | 같은 이름으로 파일만 바꾸지 않는다. 바꾸면 새 `MODEL_VERSION`으로 등록한다 |
| 🟡 | Spring은 타임아웃·503에서 같은 `requestId`로 1번만 다시 시도한다. 저장 중복은 `UK_ASM_REQUEST_ID`가 막는다 |
| ✅ | FastAPI 로그에는 `requestId`, 처리 시간, 오류 코드만 남긴다. 요청 본문은 남기지 않는다 |

## 7. 다른 팀에 미치는 영향

| 팀 | 영향 |
|---|---|
| 우찬 (입력·마이페이지) | RPT-01 응답 필드 추가, 산출 불가 처리 방식(O-13), MEM-06 `diagnosisId` = `REQUEST_ID`, INP-03 `utility` 추가, **필수 동의 5개 화면 처리, 대출 "해당 없음" 숨은 값(O-15), 최장 연체일수 입력 칸(O-16)** |
| 경환 (결과 화면) | RPT-02 응답으로 게이지·SHAP 화면 구성. 등급 구간을 응답에서 받는다 |
| 광희 (시뮬레이터·AI) | SIM-02가 ML-04를 부른다. 출발점은 서버의 `FEATURE_SNAPSHOT`, 점수 범위 0~1000, 필드 이름 짝(4-4) |
| 재욱 (모델) | 피처 목록 → `featureSnapshot` 키와 `DIM_FEATURE`, 점수 변환식, `recoverScore` 계산 |

## 8. DDL ↔ API 필드 대응 (B팀 표)

| `ASSESSMENT` 열 | ML-03 응답 | RPT-02 응답 | 화면 노출 |
|---|---|---|---|
| `REQUEST_ID` | `requestId` | `requestId` | ✅ |
| `ASSESSMENT_ID` | — | — | ❌ |
| `GRADE_STATUS_CODE` / `NOT_SCORABLE_REASON_CODE` | (Spring 판정) | 같은 이름 | ✅ |
| `TRAD_*` / `ALT_*` | `traditional` / `alternative` | 같음 | ✅ |
| `SHAP_BASE_SCORE` | `shap.baseScore` | `shap.baseScore` | ✅ |
| `FEATURE_SNAPSHOT` | `featureSnapshot` | — | ❌ (관리자 열람 시 감사 로그) |
| `AI_SUMMARY` | — | `aiSummary` | ✅ |
| `DATA_SPLIT_CODE`, `LABEL_TYPE_CODE`, `ACTUAL_DEFAULT_YN`, `EVAL_ELIGIBLE_YN` | — | — | ❌ (합성 고객 전용, N-25) |

| `ASSESSMENT_FACTOR` 열 | ML-03 `shap.factors[]` | RPT-02 `shap.factors[]` |
|---|---|---|
| `FEATURE_RANK` | `rank` | `rank` |
| `FEATURE_CODE` | `featureCode` | `featureCode` + `DIM_FEATURE`의 `featureName`, `unitName`, `alternativeYn`, `simulatableYn` |
| `FEATURE_VALUE` | `featureValue` | `featureValue` |
| `SHAP_VALUE` | `shapValue` | — (보내지 않음) |
| `SHAP_SCORE` | `shapScore` | `shapScore` |

## 9. ⛔ 정해야 할 것

| ID | 질문 | 추천안 | 누구와 |
|---|---|---|---|
| ~~O-1~~ | ~~1차 피처 목록 (기존·대안 모델)~~ | ✅ **해결 (11/13, 임시 결정):** 피처 정의서 v1.0 — 기존 19개, 대안 39개 (D-29). 학습 결과를 보고 조정 | — |
| ~~O-2~~ | ~~신용평가사 값 전달~~ | ✅ **해결:** 1차에는 신용평가사 조회 안 함. 2차에 `creditBureau` 필드로 추가 | — |
| ~~O-3~~ | ~~확률 → 점수 변환식, 기준점~~ | ✅ **해결 (11/16 범영, 추천안):** PDO 방식 — 기준 700점 = 우량:불량 20:1, 40점마다 오즈 2배, 범위 0~1000. SHAP 점수도 같은 배율로 환산. 진짜 모델(FP-141)도 같은 식 | — |
| ~~O-4~~ | ~~`shapValue` 전달~~ | ✅ **해결:** 저장하고 화면에는 보내지 않음 | — |
| ~~O-5~~ | ~~`factors` 전부 vs 상위 N~~ | ✅ **해결:** 전부 저장 (DDL 주석) | — |
| ~~O-6~~ | ~~N-21-8 예상 대안 점수 (DIAG-09)~~ | ✅ **해결 (11/16 범영, 추천안):** Spring이 바꾼 입력으로 ML-03을 부르고 저장하지 않음. FastAPI 추가 작업 없음 | — |
| O-8 | 내부 호출 인증 헤더 | 시연 범위에서는 한 PC 안(localhost)에서만 부르고 헤더 없음 | 우찬 |
| ~~O-9~~ | ~~시뮬레이터 결과 저장~~ | ✅ **해결 (11/16 범영, 추천안):** 저장하지 않음 (진단 내역에는 진짜 평가만) | — |
| O-10 | 오류 응답 형식 (D-20) | ✅ 확정(11/20): 프론트가 쓰던 형식을 전 API 공통으로(FP-87) | 전체 |
| O-11 | 타임아웃 (D-18) | 연결 1초 / 응답 3초 | 전체 |
| ~~O-12~~ | ~~꼭 필요한 동의 항목~~ | ✅ **해결:** 대안 데이터 5개 모두 필수. 대출 동의는 선택. 신용평가사는 1차 없음 | — |
| ~~O-13~~ | ~~입력이 덜 찼을 때 409 차단 vs `NOT_SCORABLE` 저장~~ | ✅ **해결 (11/16 범영):** 입력·동의가 덜 차면 409 `INPUT_INCOMPLETE`로 막고 평가 행을 저장하지 않는다(화면 FP-86과 같음) | — |
| ~~O-14~~ | ~~`recoverScore` 계산 방식~~ | ✅ **해결 (11/16 범영, 추천안):** 그 항목을 시뮬레이터 범위 안 가장 좋은 값으로 바꿨을 때의 점수 차이(음수면 0). 간편결제 월 건수 상한은 화면 범위가 정해지면 맞춘다 | — |
| ~~O-15~~ | ~~대출 "해당 없음"의 숨은 값~~ | ✅ **해결 (A안, 11/13 경환·우찬 합의):** `USER_ASSET_SNAPSHOT.NO_LOAN_YN = 'Y'`로 저장한다(대출 행 없음). ML-03에는 `loans: []` | — |
| ~~O-16~~ | ~~최근 3개월 최장 연체일수 입력 칸~~ | ✅ **해결 (11/13):** 피처 정의서에서 `KC5000016`을 뺐다(화면에 없음). 모델 입력이 아니라 ML-03에서도 뺐다. DB 칸(`MAX_DELINQ_DAYS_3M`)은 그대로 둔다 | — |
| ~~O-17~~ | ~~`DIM_FEATURE` 시드 순서~~ | ✅ **해결 (11/13 범영):** 점수를 처음 저장하기 전에 넣는다. ① `FS-DRAFT`(피처 정의서 v1.0 39개, 11/13) → ② `FS-V1`(정의서 확정 후) | — |

### 9-1. 쉽게 풀어 쓴 설명

위 표를 처음 보는 사람도 이해할 수 있게 학교 생활에 빗대어 풀었다. 이 프로젝트의 비유는 아래와 같다.
- **선생님** = 점수를 내는 모델(FastAPI)
- **교무실** = Spring 서버
- **학생** = 회원

**O-1. 1차 피처 목록 (기존·대안 모델)** — ✅ 11/13 피처 정의서 v1.0으로 정해짐 (기존 19개, 대안 39개)
- **질문:** 선생님이 점수를 낼 때 **어떤 기록들을 볼지** 목록을 정해야 해요.
- **추천:** 1차에는 신용평가사 성적표를 안 받기로 했어요. 그래서 학생이 직접 적어 낸 기록(소득, 지출, 대출, 카드·연체)과 생활 기록 5가지(통신비, 공과금, 간편결제, 국민연금, 건강보험)만 봐요.
  - **기존 모델:** 금융 기록만 보는 선생님
  - **대안 모델:** 금융 기록 + 생활 기록을 보는 선생님
  - 두 선생님이 보는 것의 차이는 **생활 기록 5가지 하나뿐**이에요. 그래야 "생활 기록을 보면 점수가 이만큼 달라진다"고 정확히 말할 수 있어요.

**O-3. 확률 → 점수 변환식, 기준점** — ✅ 11/16 아래 추천안으로 확정
- **질문:** 선생님은 처음에 "이 학생이 1년 안에 약속(대출 상환)을 못 지킬 확률 5%" 같은 **확률**로 답해요. 이걸 사람들이 보기 쉬운 **0~1000점**으로 바꾸는 규칙이 필요해요.
- **추천:** 신용점수에서 흔히 쓰는 규칙(PDO 방식)을 써요.
  - 기준: "약속을 지킬 사람 20명 : 못 지킬 사람 1명"인 학생을 **700점**으로 정해요.
  - 확률이 반으로 줄어들 때마다 점수를 **40점씩** 올려요.
  - 이렇게 하면 지금 등급 경계 665점은 못 지킬 확률 약 8.4%, 780점은 약 1.2%예요.

**O-6. 예상 대안 점수 (N-21-8)** — ✅ 11/16 아래 추천안으로 확정
- **질문:** "소득이 이렇게 바뀌면 내 점수는?" 하고 **미리 보기**를 할 때, 그 결과를 성적 기록부에 남길지 정해요.
- **추천:** 바뀐 값으로 선생님께 물어보기만 하고 **기록부에는 남기지 않아요.** 연습 문제처럼요.

**O-8. 내부 호출 인증 헤더**
- **질문:** 교무실(Spring)이 선생님(FastAPI)에게 물어볼 때 **출입증**을 보여 줘야 할지 정해요.
- **추천:** 시연 때는 교무실과 선생님 방이 같은 건물(한 PC) 안에 있고 바깥 문은 열지 않아서 출입증 없이 가요. 나중에 필요하면 그때 출입증을 만들어요.

**O-9. 시뮬레이터 결과 저장** — ✅ 11/16 아래 추천안으로 확정
- **질문:** "카드를 덜 쓰면 점수가 몇 점 오를까?" 같은 **연습 계산** 결과를 기록부에 남길지 정해요.
- **추천:** 남기지 않아요. 진단 내역에는 진짜 점수만 남아야 헷갈리지 않아요.

**O-10. 오류 응답 형식 (D-20)**
- **질문:** 뭔가 잘못됐을 때 서버가 **어떤 모양의 안내문**을 돌려줄지 정해요.
- **추천:** 지금 화면 팀이 이미 쓰는 모양을 그대로 써요: "무슨 문제인지(`code`) + 안내 문장(`message`) + 어느 칸이 틀렸는지(`fieldErrors`)"
- **결과(🆕 11/20):** 추천대로 확정. FP-87 `GlobalExceptionHandler`가 전 API에 같은 모양을 쓴다(decisions.md D-20).

**O-11. 타임아웃 (D-18)**
- **질문:** 선생님께 물어보고 **얼마나 기다렸다가 포기할지** 정해요.
- **추천:**
  - 문을 두드리고 1초 안에 대답이 없으면 포기해요(연결 1초).
  - 문이 열렸는데 3초 안에 답이 없어도 포기해요(응답 3초).
  - 포기했을 때는 **같은 질문으로 한 번만** 다시 물어봐요.
  - 계산은 보통 1초도 안 걸려서 충분해요.

**O-13. 입력이 덜 찼을 때 처리** — ✅ 11/16 확정: 서버도 409로 막아요(점수 기록을 남기지 않아요)
- **질문:** 학생이 숙제를 다 안 내고 "점수 주세요"를 누르면 어떻게 할지 정해요.
- **확정:**
  - 화면에서 먼저 **버튼을 막아** 누르지 못하게 해요.
  - 그래도 요청이 들어오면, 서버도 "숙제가 덜 찼어요(409 `INPUT_INCOMPLETE`)"라고 **돌려보내고 기록부에는 남기지 않아요.**

**O-14. 회복 점수 계산 방식** — ✅ 11/16 아래 추천안으로 확정
- **질문:** 시뮬레이터가 "카드 사용을 줄이면 **최대 몇 점** 오를 수 있어요"라고 알려 줄 때 그 숫자를 어떻게 셀지 정해요.
- **추천:** 그 항목을 시뮬레이터에서 고를 수 있는 **가장 좋은 값**으로 바꾸고 선생님께 다시 물어봐요. 새 점수 − 지금 점수 = 회복 점수예요.

**O-15. 대출 "해당 없음"의 숨은 값** — ✅ 11/13 해결: "대출 없음" 표시 칸(`NO_LOAN_YN`)에 Y를 적어요
- **질문:** 대출이 없는 학생이 "해당 없음"을 누르면 **서랍(DB)에 무엇을 넣을지** 정해요.
- **추천:** 대출 칸은 **비워 둬요**(아무 줄도 저장하지 않음). 선생님께는 "대출 목록: 없음(`[]`)"으로 전해요.
  - 다만 다시 들어왔을 때 "아직 안 적었음"인지 "대출 없음을 골랐음"인지 화면이 구분할 방법은 우찬 님과 정해요.
  - 다른 방법: 0원짜리 대출 한 줄을 넣는 거예요. 이 경우 선생님이 "대출 1건"으로 잘못 세지 않게 0원 줄은 무시하는 규칙이 필요해요.

**O-16. 최근 3개월 최장 연체일수 입력 칸** — ✅ 11/13 해결: 정의서에서 빠져서 칸이 필요 없어졌어요
- **질문:** 입력 화면에 "최근 3개월 동안 가장 길게 늦게 낸 날수" 칸을 넣을지 정해요.
- **추천:** 넣어요. 선생님이 공부한 정답지를 만들 때 쓴 중요한 기록 8개 중 하나예요. DB에는 이미 칸(`MAX_DELINQ_DAYS_3M`)이 있어요.

**O-17. 피처 사전(DIM_FEATURE) 넣는 순서** — ✅ 11/13 아래 추천안으로 확정
- **질문:** 점수표에는 "통신비 연속 납부 +31점"처럼 **항목 이름**이 나와요. 이 항목 이름 사전을 언제 DB에 넣을지 정해요.
- **추천:** 점수를 처음 저장하기 **전에** 넣어요. 사전에 없는 항목은 DB가 저장을 거절하거든요.
  - 순서: ① 피처 정의서 v1.0의 39개(`FS-DRAFT`, 아직 임시라 DRAFT) → ② 정의서 확정본(`FS-V1`)

### 9-2. 어려운 용어 풀이

| 용어 | 쉬운 뜻 |
|---|---|
| 피처(feature) | 모델이 점수를 낼 때 보는 기록 하나하나. 예: "통신비 미납 개월 수" |
| 기존 모델 | 금융 기록만 보고 점수를 내는 비교용 모델. 실제 신용평가사 점수를 그대로 따라 한 것은 아니다 |
| 대안 모델 | 금융 기록 + 생활 기록(대안 데이터 5종)을 보고 점수를 내는 모델 |
| 대안 데이터 | 은행 기록 말고 생활 속 납부 기록. 통신비, 공과금, 간편결제, 국민연금, 건강보험 |
| 신용평가사(CB) | 사람들의 대출·연체 기록을 모아 신용 성적표를 만드는 회사. 이 프로젝트에서는 가짜(가상) 회사다 |
| SHAP | "이 항목 때문에 점수가 몇 점 올라가고 내려갔는지"를 나눠 보여 주는 계산 방법. 원인이 아니라 "작용한 정도"로만 말한다 |
| `shapValue` / `shapScore` | 모델 안쪽 단위의 원래 값 / 사람이 보기 쉬운 점수 단위로 바꾼 값 |
| PDO | Points to Double the Odds. "약속을 지킬 가능성이 두 배가 될 때 올라가는 점수"(여기서는 40점) |
| 부도 확률 | 1년 안에 대출을 제때 못 갚을 확률 |
| Mock | 진짜 모델 대신 정해진 답을 돌려주는 연습용 서버. 다른 팀이 미리 개발할 수 있게 해 준다 |
| Spring / FastAPI | Spring은 화면 요청을 받고 DB에 저장하는 서버(교무실), FastAPI는 점수만 계산하는 서버(선생님) |
| localhost (한 PC) | 같은 컴퓨터 안에서만 통하는 주소. 1차·시연은 서버 셋을 한 PC에서 켜고 Spring이 `localhost:8000`으로 FastAPI를 부른다 |
| 가상환경(venv) | 파이썬 라이브러리를 프로젝트 폴더 안에 따로 담는 상자. 다른 파이썬 프로그램과 버전이 섞이지 않는다 |
| Docker 내부망 | 서버들을 각각 상자(컨테이너)에 넣었을 때 상자끼리만 통하는 길. **2차 개발 후보, 1차·시연에서는 쓰지 않는다** |
| 타임아웃 | 답을 기다리는 최대 시간. 넘으면 포기한다 |
| `NOT_SCORABLE` | "점수를 낼 수 없음" 상태. 이유(동의 없음, 입력 부족 등)를 같이 기록한다 |
| `CONSENT_REQUIRED` | 동의가 없어서 점수를 낼 수 없다는 이유 코드 |
| HTTP 200 / 409 | 200 = 정상 처리됨, 409 = 지금 상태로는 처리할 수 없음 |
| `[]` (빈 배열) | "목록인데 들어 있는 게 없음". 예: 대출 목록 없음 |
| DIM_FEATURE | 피처 이름·단위·대안 여부를 적어 둔 사전 표 |
| `FS-DRAFT` / `FS-V1` | 피처 사전의 버전 이름. 정의서 v1.0 임시본(39개) / 확정본 |
