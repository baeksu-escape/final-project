# N-26 관리자 직군·연령별 통계 API (ADM-03)

- **날짜:** 2026-11-20
- **작성자:** 임광희(C팀) / Claude Code
- **브랜치:** `feature-C/FP-161-admin-stats` (Jira FP-161, P0)
- **관련 N-ID:** N-26-1 구분 선택, N-26-2 요약 수치, N-26-3 분포, N-26-4 통계 표
- **관련 결정:** D-26·D-28 담당자 결정(11/20, 광희). 이 PR에서 `decisions.md`에 기록했다.

## 무엇을, 왜 바꿨나
- FP-161(P0)은 D-26(관리자 통계 항목)·D-28(탈퇴 회원 포함 여부)이 미정이라 막혀 있었다. N-26 담당인 광희가 11/20에 직접 정했다.
  - **D-26: 11/06 확정 UI대로 한다**(decisions.md 정리 원칙).
    - 만드는 것: 요약(평가 고객 수, 평균 기존·대안 점수와 상승폭, Standard 이상 비율, 가입 회원 수, 오늘 산출), 대안 등급 분포, 직군별·연령대별 통계 표
    - 만들지 않는 것: 기능 명세 v3의 상자 그림·직군×연령 히트맵·통신비 연체 경험(UI 관리자 화면에 없음)
  - **데이터: 서비스 회원의 최근 SCORED 평가 1건**(`ASSESSMENT` SERVICE 행)
    - 명세의 "전체 고객 12,000명(합성 집단)"은 `ASSESSMENT`에 적재되지 않았다(시드 0행).
    - 평가 표본(`MODEL_EVAL_SAMPLE`, 3,085행)에는 연령대가 없어 연령별 통계를 낼 수 없다.
  - **D-28: 탈퇴 회원(`WITHDRAWN`)의 평가는 뺀다.** 잠긴 회원은 넣는다. 동주 님 DIAG-01 회원 평균·관리자 계정 목록과 같은 기준이다.
- `GET /api/admin/stats?groupBy=WORKER_TYPE|AGE_BAND`(ADM-03)를 만들었다.
  - 5명 미만 그룹(또는 전체)은 평균·비율·등급 분포를 `null`로 숨긴다. 몇 명뿐이면 개인 점수가 드러나기 때문이다(DIAG-01과 같은 기준).
  - 직군·연령대는 평가 시점 값이다.
- 화면(FP-162)이 쓸 api 함수와 mock까지 만들었다. 화면은 FP-162에서 만든다.
- 동주 님 FP-184(모형 성능)와 같은 방식으로, 기존 `admin` 패키지에 **새 파일만** 더했다. 기존 관리자 파일(경환·우찬)은 고치지 않았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `admin/controller/AdminStatsController.java` | 새 파일. `GET /api/admin/stats` |
| `admin/service/AdminStatsService.java` | 새 파일. 구분 검사, 집계, 5명 미만 숨김, 오늘 0시(Asia/Seoul) 기준 |
| `admin/mapper/AdminStatsMapper.java`, `resources/mapper/admin/AdminStatsMapper.xml` | 새 파일. 회원별 최근 SCORED(탈퇴 제외), 가입 회원 수, 오늘 산출 수 |
| `admin/dto/AdminStatsDtos.java`·`AdminStatsRows.java` | 새 파일 |
| 테스트 | `AdminStatsServiceTest`, `AdminStatsApiTest`(관리자 200·일반 회원 403·토큰 없음 401·잘못된 구분 400), `AdminStatsMapperIT`(DB) |
| `frontend/.../admin/api/adminStatsApi.js`, `mocks/adminStatsMockHandlers.js` | 새 파일. `getAdminStats({ groupBy })`, 같은 규칙으로 계산하는 mock |
| `docs/spec/api/api_spec_c.md` | ADM-03 절, 「최근 변경」 |
| `docs/spec/api/api_definition.md` | 2-10 ADM-03 행(담당·상태), Q-10 해결, 「최근 변경」 8번 |
| `docs/ai/decisions.md` | 1-4에 D-26·D-28 담당자 결정, 미정 표에 결정 위치 표시, 색인 |
| `docs/ai/features.md` | N-26-2·3 출력·테이블·비고를 결정에 맞춤 |

## DB·API 변경
- DB: 없음(`ASSESSMENT`·`APP_USER` 읽기만)
- API: `GET /api/admin/stats` 추가(ADM-03). 정의서 행은 새 규칙대로 이 PR에서 고쳤다.
- 영향을 받는 기능·팀원
  - 화면 FP-162(광희)
  - 문서 담당자(decisions.md 결정 기록 검수)
  - 범영 님(정의서 검수)

## 확인
- 확인함
  - `./mvnw clean test` 443개 통과
  - DB 통합 테스트(`-Ddb.it=true`, 로컬 Oracle, 키는 일회용 값): `AdminStatsMapperIT` 3개 중 2개 통과, 1개 건너뜀(로컬 DB에 탈퇴 회원이 없음)
    - 처음에는 평가 행을 넣다가 `CK_ASM_FEATURE_REQUIRED`(SCORED는 피처값 필수)에 걸렸다. 테스트 행에 피처값을 넣어 고쳤다. 운영 코드는 그대로다.
  - `npm run lint` 오류 0
  - node로 mock 직접 호출: 직군별·연령대별 모양, 5명 미만 숨김, 일반 회원 403, 잘못된 구분 400, 비로그인 401. 명세서 예시 숫자와 같다.
- 확인 못 함
  - 탈퇴 회원 제외를 실제 DB에서 확인하지 못했다(로컬에 탈퇴 회원 없음, 쿼리 조건으로만 확인).
  - 화면(FP-162 전)

## 11/23 보완: 기존 모델 등급 항목 추가
- **왜:** 11/06 확정 UI 관리자 화면은 등급 값을 **기존 → 대안**으로 나란히 보여 준다. 예시는 Standard 이상 비율 39.6% → 67.1%, 직군별 표 "Standard 이상(기존 → 대안)", 직군마다 기존·대안 두 줄짜리 등급 분포 막대다. 처음 구현은 평균 점수만 기존·대안 둘 다였고, 등급 값은 대안만 있어서 FP-162 화면이 이 칸들을 그릴 수 없었다.
- **무엇을:** 응답에 필드를 **추가**했다. 기존 필드(`standardOrAboveRatePct`·`gradeDistribution` = 대안)의 이름과 뜻은 그대로다.
  - `summary.tradStandardOrAboveRatePct`
  - 최상위 `tradGradeDistribution`
  - `groups[].tradStandardOrAboveRatePct`·`tradGradeDistribution`
- **규칙**
  - 값은 DB에 저장된 기존 등급(`ASSESSMENT.TRAD_GRADE_BAND_CODE`)으로 계산한다. 계산 위치는 대안과 같은 Java 함수이고, "어느 등급을 볼지"만 바꿔 쓴다.
  - 분모는 **기존 등급이 있는 회원**(기존 모델로 산출된 회원)이다. 산출 못 한 회원은 기존 쪽 분모에서만 빠진다(평균 기존 점수와 같은 처리).
  - 5명 미만 숨김은 같다.
- **같이 한 일:** 최신 develop(#132 FP-246)을 반영했다.
  - 새 규칙("기능 PR은 맨 위 「최근 변경」을 고치지 않는다")에 따라 정의서·C팀 명세서 「최근 변경」의 FP-161 줄을 지웠다.
  - decisions.md 충돌은 양쪽을 모두 남겼다.
- **바뀐 파일:** `AdminStatsRows`(기존 등급), `AdminStatsMapper.xml`(`TRAD_GRADE_BAND_CODE` 조회), `AdminStatsDtos`(필드 추가), `AdminStatsService`(등급 함수 일반화), 테스트 3개, mock·api 주석, `api_spec_c.md`·`api_definition.md` ADM-03, decisions D-26·features N-26-2·3 문구
- **확인**
  - `./mvnw clean test` 464개 통과(기존 테스트에 기존 등급 검증 추가)
  - DB 통합 테스트 8종 통과: `AdminStatsMapperIT`가 기존 등급을 읽는 것도 확인했다. 탈퇴 확인 1개는 로컬에 탈퇴 회원이 없어 건너뜀
  - `npm run lint` 오류 0
  - node로 mock 직접 호출: 기존 Standard 이상 30.8%(13명 중 4명), 급여소득자 50.0%, 5명 미만 그룹은 null. 명세서 예시와 같다

## 11/23 리뷰 반영: 5명 기준을 값마다 적용
- **지적:** 그룹 전체가 5명 이상이어도 기존 모델 산출자가 5명 미만이면, 기존 평균·기존 등급 분포·상승폭으로 소수 회원의 값이 드러날 수 있다(`AdminStatsService` 85줄 그룹 기준 판단).
  - 실제로 테스트 예시의 급여소득자 그룹(5명 중 기존 산출 4명)이 기존 평균 672.5·상승폭 55.0·기존 Standard 이상 50%를 그대로 내고 있었다.
- **고친 것**
  - 5명 기준을 그룹 인원이 아니라 **값마다 실제로 계산에 들어간 인원**에 적용한다(평균·비율·등급 분포 함수 안에서 판단).
    - 대안 값은 그룹 전원으로, 기존 평균·기존 등급 값·상승폭은 기존 모델 산출자로 계산한다.
  - 응답에 `tradScoredMemberCount`(요약·그룹)를 **추가**했다. 기존 값만 비었을 때 화면이 이유("기존 모델 산출자가 부족함")를 안내할 수 있다. 동주 님 DIAG-01이 금액마다 인원을 주는 방식과 같다.
- **테스트**
  - 잘못된 값을 기대하던 급여소득자 그룹 단정 4개를 `null`로 고쳤다.
  - 새 테스트 `minimumPerValue`: 그룹 6명 중 기존 산출 4명이면 기존 값만 숨고 대안 값은 보이며, 5명이 되면 보이는지 확인한다.
- **확인**
  - `./mvnw clean test` 465개 통과
    - 처음에는 새 테스트의 상승폭 기대값을 64.0으로 잘못 적었다. 바른 값은 (50+20+70+80+60)/5 = 56.0이라 고쳤다.
  - `AdminStatsMapperIT` 통과(2개, 탈퇴 확인 1개는 건너뜀)
  - `npm run lint` 오류 0
  - mock도 같은 규칙으로 바꿨고, 명세서 예시 숫자는 그대로다. 예시 그룹은 기존 산출자도 5명 이상이거나 그룹 자체가 5명 미만이고, 인원 필드만 추가했다.

## 11/23 리뷰 반영: ACTIVE 모델 평가만 센다
- **지적:** 쿼리가 `MODEL_VERSION`을 거르지 않는다. 회원의 최근 평가가 0.2 전환(11/20) 전에 산출된 것이면 0.1이나 Mock(`DEV-DUMMY`) 점수가 통계에 섞인다. 공용 DB에는 11/16 Mock 테스트 평가가 남아 있을 수 있다.
  - 선택지는 (가) ACTIVE 모델 평가만 세기, (나) 그대로 두고 시연 전에 옛 모델 평가 건수 확인하기였다.
- **결정(광희): (가).** 기존 → 대안 비교는 한 모델 기준이어야 숫자의 뜻이 분명하고, Mock 테스트 평가가 저절로 빠진다. 동주 님 모형 성능 비교(ACTIVE 모델 표본)·DIAG-09(ACTIVE 모델로 계산)와 기준이 같다.
- **고친 것**
  - `AdminStatsMapper`에 ACTIVE 모델 조회(`selectActiveModelVersion`, 기존 매퍼와 같은 조건)를 추가했다.
  - 회원별 최근 평가 조회와 오늘 산출 건수에 `MODEL_VERSION = ACTIVE` 조건을 추가했다. 조건은 최근 평가를 고르기 **전에** 건다. 그래서 옛 모델 평가만 있는 회원은 빠진다.
  - ACTIVE 모델이 없으면 평가를 읽지 않고 0명 통계를 낸다.
  - 응답에 `modelVersion`(통계 기준 모델)을 **추가**했다. 화면이 "모델 0.2 기준"처럼 안내할 수 있다.
- **테스트**
  - 서비스: ACTIVE 모델 조회·전달, `modelVersion` 응답, ACTIVE가 없을 때 0명(평가 조회 안 함)
  - API: `modelVersion` 필드
  - DB 통합 `onlyActiveModel`: 더 늦게 저장된 옛 모델 평가(500점)를 무시하고 ACTIVE 모델 평가(720점)를 고르는지, 오늘 산출에도 옛 모델 평가가 빠지는지 확인했다(로컬 DB에서 실제 실행).
- **확인:** `./mvnw clean test` 466개 통과, DB 통합 테스트 8종 통과(탈퇴 확인 1개는 로컬에 탈퇴 회원이 없어 건너뜀), `npm run lint` 오류 0
- **영향:** 모델을 바꾸면 새 모델로 다시 점수를 낸 회원만 통계에 잡힌다. 시연 전에 ACTIVE 모델로 회원 점수를 미리 내 둔다.

## 다음 사람이 알아야 할 것
- 시연 DB는 점수를 낸 회원이 적어 대부분의 그룹이 5명 미만으로 비어 보일 수 있다. 발표 전에 시연 회원 점수를 E2E 스크립트로 미리 내 두는 것을 검토한다.
- 평가마다 모델(0.1·0.2)과 등급 구간 버전이 다를 수 있다. 등급은 평가 때 저장된 값을 그대로 쓴다.
- 5명 기준은 `AdminStatsService.MIN_GROUP_SIZE` 상수다.
- 사용자 비교 분석(ADM-04, N-26-5~7)은 D-27(우선순위 미정)이라 만들지 않았다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
