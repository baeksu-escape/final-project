# 직군 선택·직군별 데이터 입력 화면 (FP-85)

- **날짜:** 2026-11-03
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-85-jobInput`
- **관련 N-ID:** N-05(데이터 입력), N-08(직군 분기)
- **관련 결정:** D-20(응답 형식 임시안), D-09(추가 필요 테이블)

## 무엇을, 왜 바꿨나
- 로그인 후 직군이 없는 사용자가 직군을 고르는 화면(`/select-job`)과 직군별 데이터 입력 화면(`/data-input`)을 만들었다.
- 직군별·공통 입력 항목은 `features/dataInput/config/inputSections.js` 설정으로 분리했다. 화면은 설정을 읽어 그린다.
- 검증은 필수 항목만 본다. FP-86 상세 검증은 `validation/inputValidation.js`의 `FORM_VALIDATORS`와 칸 설정의 `validate`에 꽂는다.
- 대안 데이터(간편결제·통신비·국민연금/건강보험)는 [불러오기]로 더미 데이터를 가져오는 모의 연동이다. 외부 API는 호출하지 않는다.
- 스타일 코드는 없다. className만 붙였다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/dataInput/**` | 새 파일 16개(화면 2, 컴포넌트 5, 설정 3, 검증, 값 변환, API, mock 2, 경로) |
| `frontend/src/common/routes/AppRoutes.jsx` | `/select-job` placeholder를 JobSelectPage로 교체, `/data-input` 라우트 추가, import 3줄 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | `patchMockAccountUser()` 함수 1개 추가(직군 저장을 로그인 mock에 반영). 기존 코드는 그대로 |

## DB·API 변경
- DB: 없음
- API: 프론트 mock 경로를 임시로 정함. TODO(D-20)
  - `PATCH /api/members/me/job-type` `{ jobType }` → `{ user }` / 400 / 403(관리자) / 409(이미 직군 있음)
  - `GET /api/members/me/financial-input` → `{ input | null, status, altData }`
  - `PUT /api/members/me/financial-input` → `{ savedAt, status }`. 본문은 `utils/inputValues.js`의 `buildPayload` 참고(모든 섹션에 `baseMonth`)
  - `POST /api/members/me/alt-data/{easypay|telecom|social-insurance}/import` `{ baseMonth }` → `{ source, importedAt, rows }`
  - `status` = `{ sections: { income, loans, assets, fixedExpense, otherExpenses: boolean }, altData: { easypay, telecom, socialInsurance: boolean } }`
- 필드 이름은 더미 DB(`MEMBER_MONTHLY_INPUT`, `MEMBER_LOAN`, `MEMBER_TELECOM_BILL`, `MEMBER_PAYMENT_MONTHLY`, `MEMBER_SOCIAL_INSURANCE`)를 참고했다. 대출 업권은 `SECTOR_CODE` 0~6과 같다.
- 영향을 받는 기능·팀원: 백엔드 입력 API 담당, FP-86(상세 검증), 재무 진단·시뮬레이터 담당(입력값 사용)

## 확인
- 확인함
  - `npm run lint` 오류 0건
  - `npm run build` 성공
  - 로직·mock node 검사 51건 통과
    - 세 직군 요청 본문의 baseMonth, 연소득 없음, 필수 검사, FP-86 검증 함수 꽂을 자리, 직군 저장·변경 차단
  - 헤드리스 Chrome 점검 97건 통과
    - 세 직군: 직군 선택 → 입력 → 필수 오류 → 저장 → 완료 현황 → 대안 데이터 3종 불러오기
    - 다시 들어올 때 저장값 채움, 재로그인 시 직군 유지, 관리자 접근 차단
    - 콘솔 출력 없음, localStorage에는 토큰만
  - 기존 점검(라우팅 32건, 인증 49건) 회귀 통과
- 확인 못 함: 실제 백엔드 연동(서버 없음)

## 다음 사람이 알아야 할 것
- mock 저장값은 메모리에만 있어서 새로고침하면 사라진다(데모 계정 `newbie`도 다시 직군 미선택이 된다).
- 데이터 입력 화면은 헤더 탭에 없다(N-08 탭 구성 유지). 직군 선택 직후 이동하고, 주소 `/data-input`으로 들어간다.
- 팀 결정 필요
  - 데이터 입력 화면을 다시 여는 위치(탭·마이페이지·리포트 링크)
  - 대출 상품 종류 코드(DB `LOAN_KIND_CODE` 의미 미확정, 이번에는 업권만 받음)
  - 자산·기타 지출 저장 테이블 없음(D-09)
  - 대안 데이터 기간(임시 6개월)
  - 기타 지출 종류 코드값

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
