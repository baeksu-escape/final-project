# 데이터 입력 4단계 이어받기 — 임시저장 회원별 분리·단계 표시·다시 들어온 회원은 ④부터·동의 전 버튼 막기

- **날짜:** 2026-11-18
- **작성자:** JWC1226 / Claude Code
- **브랜치:** `feature-A/FP-227-data-input-steps`
- **관련 N-ID:** N-05, N-05-8, N-05-9
- **관련 결정:** 사람 결정 B(다시 들어온 회원의 시작 단계, 11/18)

## 무엇을, 왜 바꿨나
- `feature/data-input-steps`의 커밋 `b407365`(작성자 altrongg-code, 11/18 20:08)을 그대로 cherry-pick했다(`4eaf3ae`). 내용은 4단계 나누기, 단계별 검사, sessionStorage 임시저장, 기준월을 소득 카드 안으로, 카드·신용 이용 카드 형식 통일이다.
- 이어서 더한 것
  - 임시저장 키를 회원별로 나눴다. 시연 PC처럼 여러 사람이 같은 탭을 쓰면 앞사람 입력이 보이던 문제 때문이다. (키 이름과 지우는 시점은 아래 「11/18 보완」에서 바뀌었다.)
  - 임시저장할 때 서버 저장 시각(`savedAt`)을 함께 넣는다. 다시 들어왔을 때 서버 값과 다르면(다른 탭에서 저장 등) 오래된 임시저장본으로 보고 버린다.
  - 임시저장본으로 채우면 안내 「저장하지 않은 입력을 이어서 보여 줍니다.」와 [처음 값으로]를 보인다. 서버 값과 같은 임시저장본은 이어서 보여 줄 것이 없으므로 지우고 없는 것으로 본다. 들어오기만 해도 자동 임시저장되기 때문이다.
  - 단계 표시에 클래스를 붙였다. 칩 목록은 `ol`이고, 지금 단계에 `aria-current="step"`을 단다. 단계가 바뀌면 새 단계의 첫 카드 제목으로 포커스를 옮긴다.
  - **사람 결정 B:** 입력 완료 현황이 모두 차 있고 이어서 볼 임시저장본이 없으면 ④부터 시작한다. 단계 칩이 버튼이 된다. 앞 단계로는 늘 갈 수 있고, 건너뛰기는 서버에 저장된 입력이 있을 때만 된다(①~③ 검사는 ③ [저장하고 다음]에서 한 번에 한다).
  - 대안 데이터 동의 창의 [동의하고 불러오기]는 필수 체크 전에는 꺼 두고 안내 hint를 보인다(계획표 '1차 시연 기준' 9행).
  - 처음 쓰는 사람 안내를 넣었다(저장 입력·임시저장본이 없을 때 ①에서만, `Notice`).

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/auth/sessionDrafts.js` | (보완, 새 파일) 로그아웃 때 지울 임시저장 키 접두어 `avenue:draft:`와 `clearSessionDrafts()` |
| `frontend/src/features/dataInput/utils/inputDraft.js` | 키에 userId(공통 접두어 사용), `savedAt` 저장·비교 |
| `frontend/src/common/auth/AuthProvider.jsx` | `logout`에서만 `clearSessionDrafts()` 호출 |
| `frontend/src/features/dataInput/pages/DataInputPage.jsx` | 임시저장 안내·[처음 값으로], 처음 쓰는 사람 안내, 단계 표시 `ol`·포커스, B 시작 단계·칩 이동 |
| `frontend/src/features/dataInput/components/AltDataImport.jsx` | 동의 전 [동의하고 불러오기] 끄기 + 안내 |
| `frontend/src/features/dataInput/dataInput.css` | `data-input-steps`, `__list`, `__item`, `__button` 추가 |

## DB·API 변경
- DB: 없음
- API: 없음
- 영향을 받는 기능·팀원
  - 직접 로그아웃·탈퇴할 때 sessionStorage의 `avenue:draft:`로 시작하는 키만 지운다. 다른 화면도 로그아웃 때 지울 임시저장이 필요하면 이 접두어를 쓰면 된다.

## 확인
- 확인함
  - cherry-pick 직후와 수정 후 모두 `npm run lint` 오류 0, `npm run build` 성공
  - 헤드리스 Chrome(mock 모드) 화면 점검 49건 모두 통과(저장소 밖 스크립트)
    - 새 계정 가입 → 직군 선택 → ①부터 시작, 처음 쓰는 사람 안내
    - ① 빈 칸 [다음]은 ① 오류만 보이고 머무름, 채우면 ②
    - 포커스가 새 단계 제목으로 이동
    - "신용 이력이 없어요" 체크 시 상자가 숨고 대부업 칸이 비활성
    - ③ 저장 → ④로 가고 임시저장본이 지워짐
    - 동의 창 버튼: 체크 전 꺼짐·안내, 체크 후 켜짐
    - 대안 데이터 5종 → 점수 산출 → 신용 리포트와 주 메뉴
    - 다시 들어오면 ④부터, 칩으로 ①~③ 이동
    - ③에서 ① 빈 칸으로 저장하면 ①로 돌아감
    - ②에서 새로고침하면 같은 단계·값과 안내가 보이고, [처음 값으로]로 되돌아감
    - 서버 시각과 다른 임시저장본은 버림
    - 로그아웃하면 임시저장본이 지워지고, 같은 직군 다른 계정에서 앞사람 값이 안 보임
    - 390px에서 칩 줄바꿈·가로 스크롤 없음
- 확인 못 함
  - 로컬 DB(`Avenue-local`)·실제 서버로는 확인하지 않았다.
  - mock에서 새로 가입한 계정은 신용 리포트 mock(`requireMockUser`, 고정 데모 계정만 앎)에서 401이 난다. 그래서 점수·다시 들어오기는 데모 계정 `employee`로 확인했다. 실제 서버에서 새 계정으로 끝까지 보려면 `AVENUE_ALTDATA_MISSINGMEMBERMODE=BORROW`가 필요하다(사람이 STS 환경 변수에 넣는다).

## 다음 사람이 알아야 할 것
- 문서 반영 필요(문서 담당이 문서 PR로): 기능 정의서 N-05에 "4단계 입력·임시저장(sessionStorage, 회원별·로그아웃 때 삭제)·기준월을 소득 카드 안으로·입력을 마친 회원은 ④부터 + 단계 칩 이동" 반영
- 새 CSS 클래스 4개는 프론트 담당 확인 대상이다.

## 11/18 보완 (보고서 검토 후)
- 세션 만료(401)로 로그인이 풀릴 때는 임시저장본을 지우지 않고, 직접 로그아웃·탈퇴(`AuthProvider.logout`) 때만 지운다.
  - 오래 입력하다 유효 시간이 지나도, 같은 사람이 다시 로그인하면 이어 쓸 수 있게 하려는 것이다. 키에 회원 번호가 있어 다른 계정에는 보이지 않는다.
- 공통 `AuthProvider`가 기능 폴더를 import하지 않도록 바꿨다.
  - 공통 규칙 파일 `common/auth/sessionDrafts.js`(접두어 `avenue:draft:`, `clearSessionDrafts()`)를 두었다.
  - 데이터 입력 키는 `avenue:draft:dataInput:{userId}:{직군}`이 됐고, `clearAllDrafts`는 지웠다. 옛 키는 병합 전 기능이라 옮기지 않는다.
- 확인 결과
  - lint 오류 0, build 성공
  - mock 화면 점검 56건 통과
    - ②에서 새로고침하면 단계·값·안내가 유지된다.
    - 로그아웃 뒤 다른 계정에서는 앞사람 값이 안 보이고, `avenue:draft:` 키가 0개다.
    - 토큰을 지워 401이 난 뒤 같은 계정으로 다시 로그인하면 단계·값이 남아 있다.
  - `common/auth`에서 기능 폴더를 import하는 곳은 0건이다. `common/routes/AppRoutes.jsx`의 화면 import 3건은 develop에 원래 있던 것이다.

## 11/19 수정 v1.0·v1.1 — 7단계, 입력 완료 현황 = 단계 리모컨, 저장 전 직군 다시 고르기
- **v1.0**
  - 단계를 7개로 나눴다. 1 소득·기간, 2 기존 부채(대출), 3 카드·신용 이용, 4 자산, 5 월 고정 지출·할부·정기결제([저장하기]), 6 대안 데이터, 7 점수 산출.
  - 단계 이름과 입력 완료 현황 이름은 카드 제목(섹션 `title`, `ALT_DATA_TITLE`)에서 가져온다.
  - 입력 완료 현황은 모든 단계에서 오른쪽 열에 둔다.
- **v1.1**
  - 위쪽 단계 칩과 진행 막대를 없앴다. 입력 완료 현황이 7단계 목록·진행 막대·`7단계 중 N단계 완료`를 보여 주는 단계 리모컨이 됐다.
  - 동그라미: 완료는 초록 채움(화면 낭독기 '완료'), 지금 단계는 강조(`aria-current="step"`), 미완료는 빈 동그라미.
  - 단계 완료 기준
    - 1~4단계: [다음] 검사를 통과했거나 서버 저장본이 있고, 지금 값에 그 단계 오류가 없을 때.
    - 5단계: 서버 저장본이 있고 오류가 없을 때.
    - 6단계: 대안 데이터 5종을 모두 불러왔을 때.
    - 7단계: 완료 표시 없음.
  - 줄을 누르면 그 단계로 간다. 앞 단계는 늘 갈 수 있고, 뒤 단계는 그 앞이 모두 완료일 때만 간다. 6·7단계는 저장 후에만 간다. 못 가는 줄은 `aria-disabled`이고 title로 「앞 단계를 먼저 끝내 주세요.」를 보여 준다.
  - 통과한 단계(`passedSteps`)를 임시저장본에 함께 남긴다. 저장 전에는 `임시 저장됨: N단계까지 (5단계 [저장하기] 전)`을 보인다.
  - 1단계 [이전](저장한 입력이 없을 때만)을 누르면 직군 선택(`state.from='data-input'`)으로 간다.
    - 직군 선택은 이때만 직군이 있는 사용자를 머물게 하고, 지금 직군을 미리 골라 둔다.
    - 같은 직군이면 저장 없이 돌아가고, [취소]도 있다.
    - 다른 직군으로 바꾸면 이전 직군의 임시저장본을 지운다.
- **서버 MEM-05(사람 결정 11/19)**
  - 비어 있으면 저장하고, 같은 직군이면 그대로 200이다.
  - 다른 직군은 저장한 입력도 평가도 없을 때만 바꾸고, 하나라도 있으면 409 `JOB_TYPE_LOCKED`다.
  - 회원 행을 먼저 잠그고(`lockUser`), 바꾸는 쿼리는 `WHERE WORKER_TYPE_CODE = 바뀌기 전 직군`이다(0행이면 409 `JOB_TYPE_ALREADY_SELECTED`).
- **'저장한 입력' 판단:** `FinancialInputMapper.selectSavedBaseMonths`(표 `USER_ASSET_SNAPSHOT`, 입력 저장 때마다 기준월 행이 생긴다, 기준월 무관)를 쓴다.
- **'평가' 판단:** 새 쿼리 `UserAccountMapper.countAssessments`(`ASSESSMENT`, 점수 산출 결과와 관계없이)를 쓴다.

바뀐 파일(v1.0·v1.1)
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../user/service/MyPageService.java` | `selectJobType` 새 규칙, `FinancialInputMapper` 주입 |
| `backend/.../user/mapper/UserAccountMapper.java`·`resources/mapper/user/UserAccountMapper.xml` | `updateWorkerTypeFrom`·`countAssessments` 추가(기존 `updateWorkerTypeIfEmpty`는 그대로) |
| `backend/.../user/controller/MyPageController.java` | 주석만 |
| `backend/src/test/.../user/service/SocialAndMyPageServiceTest.java` | 옛 직군 시험 1개를 새 규칙 4가지 시험으로 바꿈 |
| `docs/spec/api/api_spec_a.md` | MEM-05 줄·오류 표(`JOB_TYPE_LOCKED`)·머리말 최근 변경 |
| `frontend/src/features/dataInput/config/inputSteps.js` | 7단계, `getStepTitle`, `getStepDoneList`, `canJumpToStep` |
| `frontend/src/features/dataInput/config/completionItems.js`·`altDataSources.js` | 이름을 카드 제목에서, `getAltDataItem`·`areInputSectionsComplete` |
| `frontend/src/features/dataInput/components/InputStatus.jsx` | 단계 리모컨 |
| `frontend/src/features/dataInput/pages/DataInputPage.jsx`·`JobSelectPage.jsx` | 7단계 이동·리모컨 연결·1단계 [이전] / 다시 고르기 |
| `frontend/src/features/dataInput/utils/inputDraft.js`·`dataInputPaths.js` | `passedSteps` 저장, `FROM_DATA_INPUT` |
| `frontend/src/features/dataInput/mocks/dataInputMockHandlers.js` | mock 직군 저장도 새 규칙 |
| `frontend/src/features/dataInput/dataInput.css` | `data-input-steps*` 지움, `input-status__item--current`·`input-status__step` 추가 |

- **API 변경:** MEM-05 규칙과 오류 코드 `JOB_TYPE_LOCKED`. 경로·요청·응답 모양은 같다. 팀 공지가 필요하다.
- **DB:** 없음(DDL 그대로, 쿼리 2개 추가).
- **확인:** `npm run lint` 오류 0, `npm run build` 성공, `mvnw test` 374건 통과. 화면은 사람이 mock 모드로 확인한다(이 작업에서는 브라우저를 조작하지 않았다).
- **문서 반영 필요(문서 담당):** 기능 정의서 N-05(7단계, 입력 완료 현황 = 단계 리모컨), N-04-8·N-05-1(저장 전 직군 변경 허용). API 정의서 `api_definition.md` 84·144행의 MEM-05 설명도 바꿔야 한다(이 작업에서는 고치지 않음).

## 11/19 v1.2·v1.3 (화면만)
- 대출은 "보유한 대출이 없습니다."를 체크하지 않았으면 줄이 늘 1개 이상 보인다(`minRows`, `withMinimumRows`).
- "없음"·"신용 이력이 없어요"를 체크하면 칸을 숨기지 않고 잠근다(값은 보관하고, `해당 없음` 표시). 요청 본문 모양은 같다.

## 11/19 v1.4 — 자산 4종 저장(DDL C12), 버튼 배치, 카드·신용 빈 칸 통과 오류
- **DB(DDL v0.3.2 C12, 조장 결정 11/19):** `USER_ASSET_SNAPSHOT`의 `TOTAL_ASSET_AMT` 앞에 열 4개를 추가했다.
  - 열: `DEPOSIT_AMT`·`INVESTMENT_AMT`·`REAL_ESTATE_AMT`·`OTHER_ASSET_AMT` (NUMBER(15), NULL 허용).
  - 제약: CHECK `CK_UAS_DEPOSIT_AMT`·`CK_UAS_INVESTMENT_AMT`·`CK_UAS_REAL_ESTATE_AMT`·`CK_UAS_OTHER_ASSET_AMT` (>= 0).
  - 총자산 열은 그대로 두고 4종 합계를 계속 저장한다. 재무 건전성 진단(C팀)과 입력 완료 판단이 이 열을 쓴다.
  - 표 수는 48 그대로다.
  - 기존 DB는 새 파일 `docs/spec/sql/alter_user_asset_snapshot_breakdown.sql`을 한 번 실행한다. 기존 행의 4종은 NULL로 남는다.
- **DDL 짝꿍 파일:**
  - `dummy_db/01_create_tables.sql`을 원본과 바이트까지 같게 맞췄다(`cmp` 출력 없음).
  - `seed_report.json`의 `ddl_sha256`을 `ff1f759b…0dac`로 바꿨다.
  - `docs/spec/sql/README.md` 상황별 표에 한 행을 추가했다.
  - 기준 데이터 INSERT·시드 행 수는 바뀌지 않았다.
- **서버(`FinancialInputService`·`FinancialInputMapper.xml`·`DataInputRows.AssetRow`):**
  - 저장: 4종을 그대로 저장한다(빈 칸 NULL, 0은 0). 총자산은 `totalAsset()` 그대로다.
  - 조회: 4종 중 하나라도 있으면 4종을 그대로 돌려준다. 모두 NULL인 옛 행은 `otherAmount`에 총자산을 넣는다.
  - 입력 완료 판단과 점수 산출 입력은 그대로다.
  - 시험 4개를 추가했다(4종 그대로, 일부만 입력, 옛 행, 모두 비움).
- **명세:** `api_spec_a.md` INP-02 `assets`·INP-01 응답 설명, 머리말 최근 변경, 6장 "2차로 넘긴 것"에서 자산 항목을 반영함으로 바꿨다.
- **화면:**
  - 요청 본문 이름이 서버 `Assets`와 같아 바꾸지 않았다. mock은 저장한 본문을 그대로 돌려주므로 4종이 이미 돌아온다.
  - 버튼 줄은 `data-input-form__actions`(-start/-end)다. [이전]은 왼쪽 끝이고, [다음]·[저장하기]·[점수 산출하기]는 왼쪽 입력 열의 오른쪽 끝이다.
  - 카드·신용 6칸은 체크하지 않으면 필수다(설명 끝에 "해당 없는 항목은 0을 입력해 주세요."). 서버 검사는 그대로 두었다.
- **확인:**
  - `npm run lint` 오류 0, `npm run build` 성공.
  - `mvnw test` 397건 통과.
  - DB 도구 시험 52건: `bcrypt` 없음 1건만 실패했다(PC 환경 문제, README 안내대로).
  - 공용 DB·로컬 DB에는 아무것도 실행하지 않았다.
- **공용 DB 적용:** 병합한 뒤 DB 담당(범영)이 `alter_user_asset_snapshot_breakdown.sql`을 한 번 실행한다. 로컬 DB는 각자 실행한다.
- 11/19 develop 병합 때 B팀 FP-139가 C11을 먼저 써서 자산 4종 변경을 C12로 바꿈.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
