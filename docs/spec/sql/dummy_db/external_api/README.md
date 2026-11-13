# 가상 기관 응답 더미 (데이터 v3.6.1)

2차 mock 서버 전까지 INP-03(대안 데이터 불러오기)이 읽을 기관 응답 파일이다. 모두 합성 데이터다.

## 파일

| 파일 | 기관 | 주요 내용 | DB 표 |
|---|---|---|---|
| `telecom_responses.jsonl` | 통신 | `bills[]`: `bill_month`, `billed_amount_krw`, `due_date`, `paid_date`, `payment_status` | `USER_TELECOM_PAYMENT` |
| `utility_responses.jsonl` | 공과금 | `bills[]`: 통신과 같은 모양 (전기·가스·수도 합계 월 1건) | `USER_UTILITY_PAYMENT` |
| `payment_responses.jsonl` | 간편결제 | `months[]`: `month`, `observation_status`, `payment_count`, `payment_amount_krw`, `active_days` | `USER_EASYPAY_USAGE` |
| `public_insurance_responses.jsonl` | 국민연금·건강보험 | `records[]`: `insurance_type`, `month`, `coverage_status`, `payer_type`, `billed_amount_krw`, `individual_responsibility_krw`, `paid_amount_krw`, `due_date`, `paid_date`, `payment_status` | `USER_SOCIAL_INSURANCE_PAYMENT` |
| `financial_responses.jsonl` | 금융 | `loans[]`(대출: `balance_krw`, `annual_rate`, `remaining_months`, `opened_date`, `loan_type_code`, `rate_type` 등), `cards[]`, `card_usage[]` | `USER_LOAN`(IMPORTED) |
| `credit_bureau_responses.jsonl` | 신용평가사 | `credit_info`(207열) | 1차 미사용 |

## 공통 규칙

- 한 줄 = 회원 한 명의 응답(JSON). 회원 400명 전원 몫이 있고 `status`는 모두 `OK`다.
- 공통 필드: `member_id`, `provider`, `is_dummy`(항상 true), `status`. 일부 파일은 `as_of_date`(기준일)도 있다.
- `member_id` → DB `USER_ID`: `MEM000102` → `102` (숫자 부분, 앞의 0 제거).
- 납부 상태(`payment_status`): `on_time` → `ON_TIME`, `late` + `paid_date` 있음 → `LATE`, `late` + `paid_date` 없음 → `UNPAID`.
- 금액은 원 단위. 대출 `annual_rate`는 비율(0.0724)이라 DB `ANNUAL_RATE_PCT`에는 ×100(7.24).
- 동의 여부는 이 파일과 무관하다. 회원이 해당 항목에 동의한 경우에만 불러와 `SOURCE_CODE = IMPORTED`, `CONSENT_ID`를 채워 저장한다(DDL v0.3.2 W3).
- DB 시드에는 시작 때 동의한 회원 몫이 이미 들어 있다. 이 파일은 시연 중 새로 동의한 회원의 불러오기에 쓴다.
- 새로 가입한 계정은 이 파일에 데이터가 없다(처리 방식은 입력 담당이 정한다).

## 출처

`fastapi_server/data_generation`의 `generate.build_external_api` 출력(v3.6.1). 시드 매핑 규칙은 `docs/spec/sql/dummy_db/README.md`와 `tools/build_db.py`를 따른다.
