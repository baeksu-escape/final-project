# 데이터 입력 검증 (FP-86)

- **날짜:** 2026-11-05
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-86-inputValidation`
- **관련 N-ID:** N-05(데이터 입력), N-22(정보 부족 기준 6개월)
- **관련 결정:** D-20(응답 형식 임시안), D-16(월별 이력)

## 무엇을, 왜 바꿨나
- FP-85 데이터 입력 화면에 상세 검증을 붙였다. 규칙은 화면과 분리한 순수 함수(`validation/inputRules.js`)로 만들었다. FP-85가 마련한 두 자리에 꽂았다.
  - 칸 설정의 `validate`
  - `FORM_VALIDATORS`
- 검증 규칙
  - 금액·숫자: 숫자만 받고, 음수와 상한 초과를 막는다. 금액과 남은 기간은 정수만 받는다.
  - 기준월: YYYY-MM 형식이어야 하고, 미래 월을 막는다.
  - 월별 소득
    - 미래 월, 기준월보다 늦은 달을 막는다. 기준월부터 거꾸로 12개월 안의 달만 받는다.
    - 같은 달 중복을 막고, 최대 12줄까지 받는다.
    - 입력한 달이 6개월 미만이면 오류가 아닌 '정보 부족' 안내만 보여 준다(감점하지 않음).
  - 대출·기타 지출: FP-85 필수 칸에 0 이상 검사를 더했다.
- 금액 상한처럼 팀에서 정하지 않은 값은 `config/validationLimits.js` 한 곳에 임시값으로 모았다.
- 화면 동작
  - 잘못된 값은 입력 즉시 칸 옆에 오류를 보여 준다. 빈 필수 칸 오류는 첫 저장 시도 뒤부터 보여 준다.
  - 오류가 하나라도 있으면 저장 버튼을 막는다.
  - 서버(mock)가 400으로 돌려준 칸별 오류도 해당 칸 옆에 보여 준다. 그 칸을 고치면 사라진다.
  - 이미 저장한 기준월로 다시 저장하려 하면 덮어쓴다고 안내한다(확인 창 없음).
- 스타일 코드는 없다. className만 붙였다(`input-section__notice`, `data-input-form__overwrite-notice`).

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/dataInput/config/validationLimits.js` | 새 파일. 검증 기준값(임시 상한 4개, 확정 12·6개월) |
| `frontend/src/features/dataInput/validation/inputRules.js` | 새 파일. 금액·숫자·달 규칙, 중복 찾기, 정보 부족 안내 |
| `frontend/src/features/dataInput/validation/serverErrors.js` | 새 파일. 서버 칸별 오류 ↔ 화면 오류 key 변환 |
| `frontend/src/features/dataInput/config/inputSections.js` | 칸에 `validate`, 월별 소득에 최대 줄 수·중복·안내 설정 추가(항목 구성은 그대로) |
| `frontend/src/features/dataInput/validation/inputValidation.js` | `checkRequired`·`nowMonth` 옵션, `FORM_VALIDATORS`에 줄 목록 규칙, `getInputNotices` 추가 |
| `frontend/src/features/dataInput/components/SectionList.jsx` | 최대 줄 수 전달, 안내 문구 표시 |
| `frontend/src/features/dataInput/pages/DataInputPage.jsx` | 오류 표시 시점, 저장 버튼 막기, 서버 오류 표시, 덮어쓰기 안내 |
| `frontend/src/features/dataInput/mocks/dataInputMockHandlers.js` | PUT이 같은 규칙으로 다시 검사해 400과 `fieldErrors`를 돌려줌 |

## DB·API 변경
- DB: 없음
- API: `PUT /api/members/me/financial-input`의 입력값 오류 응답을 임시로 정했다. TODO(D-20)
  - 400 `{ code: 'INVALID_INPUT', message: '입력값을 확인해 주세요.', fieldErrors: [{ field, message }] }`
  - `field` 모양(Spring 검증 오류 필드 경로와 같은 꼴)
    - `baseMonth`
    - `income.monthlySalary`
    - `loans.items[0].balanceAmount`
    - `income.items`(섹션 전체)
  - 화면에 맞는 칸이 없는 오류는 폼 아래 문구로 보여 준다.
- 영향을 받는 기능·팀원: 백엔드 입력 API 담당(서버 검증과 오류 형식), 재무 진단·시뮬레이터 담당(입력값 범위)

## 확인
- 확인함
  - `npm run lint` 오류 0건
  - `npm run build` 성공
  - 로직·mock node 검사 87건 통과(저장소 밖 스크래치 스크립트)
    - 규칙별 경계값: 상한, 음수, 소수, 미래 월, 12개월 범위, 중복, 13줄, 정보 부족 개수
    - 세 직군 검사 결과, 서버 오류 경로 왕복 변환, mock PUT 400 응답
  - 헤드리스 Chrome 점검 148건 통과. 세 직군 모두 직군 선택부터 시작했다.
    - 잘못된 값 즉시 오류와 버튼 막힘, 빈 칸 저장 시 필수 오류
    - 중복 달, 범위 밖 달, 정보 부족 안내, 12줄 제한
    - 올바른 값 저장, 완료 현황, 덮어쓰기 안내, 대안 데이터 불러오기
    - 서버 칸 오류 표시와 해제, localStorage에는 토큰만
  - 콘솔: 앱 출력·예외 없음. 브라우저가 자동으로 요청하는 `favicon.ico` 404만 있다(저장소에 favicon이 없음, 이번 범위 밖).
- 확인 못 함
  - 실제 백엔드 연동(서버 없음)
  - 단위 테스트: 저장소에 테스트 도구가 없어 테스트 파일을 만들지 않았다.

## 다음 사람이 알아야 할 것
- 규칙을 더할 때
  - 칸 하나만 보는 규칙은 `inputSections.js` 칸 설정의 `validate`에 단다(규칙 함수는 `inputRules.js`).
  - 화면 전체를 보는 규칙은 `inputValidation.js`의 `FORM_VALIDATORS`에 넣는다.
- mock은 사용자당 최근 저장 1건만 둔다. 덮어쓰기 안내도 '마지막으로 저장한 기준월'을 기준으로 한다.
- 팀 결정 필요
  - 임시 상한값: 월 금액 10억원, 잔액·자산 1,000억원, 금리 100%, 남은 기간 600개월. decisions.md에 맞는 D 번호가 없다.
  - 서버 오류 응답 형식(D-20)
  - 기준월별 이력 저장 방식(D-16)
  - 프론트 테스트 도구 도입 여부(Node 내장 `node:test`는 설치 없이 쓸 수 있음)

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
|  |  |  |  |
