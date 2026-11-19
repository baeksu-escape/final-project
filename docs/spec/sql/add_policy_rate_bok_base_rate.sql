-- FP-153 N-17 시나리오 테스트의 출발 금리(정책금리)를 기존 표 FACT_POLICY_RATE에 넣는다. DDL 변경 없음.
-- 원자료: 한국은행 경제통계시스템(ECOS) 1.3.1 한국은행 기준금리 및 여수신금리 > 한국은행 기준금리, 주기 월, 2024.01~2026.10
--   (2026-11-19 내려받음. 원본 CSV는 저장소 밖 C:\workspace\data_raw\public_stats\ 에 둔다)
-- 기준: 월 값을 그 달 마지막 날(BASE_DATE)로 넣는다. RATE_PCT는 연 %(3.25 = 3.25%). 모두 34행.
-- N-17은 가장 최근 값(BASE_DATE가 가장 늦은 행)을 출발 금리로 쓴다(DDL 주석 FACT_POLICY_RATE.BASE_DATE).
-- 새 달 값이 나오면 같은 형식으로 행을 더해 다시 실행하면 된다.
-- 실행 순서: avenue_ddl.sql → (시드가 필요하면) dummy_db/run_seed_only.sql → 이 파일.
-- MERGE라서 다시 실행해도 같은 결과가 된다(있으면 값을 고치고, 없으면 넣는다).
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다. 공용 DB 실행은 DB 담당이 한다.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

-- N-17-2·N-17-4 한국은행 기준금리 월별 값 (연 %)
MERGE INTO FACT_POLICY_RATE t
USING (SELECT DATE '2024-01-31' AS BASE_DATE, '한국은행 기준금리' AS RATE_NAME, 3.500 AS RATE_PCT FROM DUAL
       UNION ALL SELECT DATE '2024-02-29', '한국은행 기준금리', 3.500 FROM DUAL
       UNION ALL SELECT DATE '2024-03-31', '한국은행 기준금리', 3.500 FROM DUAL
       UNION ALL SELECT DATE '2024-04-30', '한국은행 기준금리', 3.500 FROM DUAL
       UNION ALL SELECT DATE '2024-05-31', '한국은행 기준금리', 3.500 FROM DUAL
       UNION ALL SELECT DATE '2024-06-30', '한국은행 기준금리', 3.500 FROM DUAL
       UNION ALL SELECT DATE '2024-07-31', '한국은행 기준금리', 3.500 FROM DUAL
       UNION ALL SELECT DATE '2024-08-31', '한국은행 기준금리', 3.500 FROM DUAL
       UNION ALL SELECT DATE '2024-09-30', '한국은행 기준금리', 3.500 FROM DUAL
       UNION ALL SELECT DATE '2024-10-31', '한국은행 기준금리', 3.250 FROM DUAL
       UNION ALL SELECT DATE '2024-11-30', '한국은행 기준금리', 3.000 FROM DUAL
       UNION ALL SELECT DATE '2024-12-31', '한국은행 기준금리', 3.000 FROM DUAL
       UNION ALL SELECT DATE '2025-01-31', '한국은행 기준금리', 3.000 FROM DUAL
       UNION ALL SELECT DATE '2025-02-28', '한국은행 기준금리', 2.750 FROM DUAL
       UNION ALL SELECT DATE '2025-03-31', '한국은행 기준금리', 2.750 FROM DUAL
       UNION ALL SELECT DATE '2025-04-30', '한국은행 기준금리', 2.750 FROM DUAL
       UNION ALL SELECT DATE '2025-05-31', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2025-06-30', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2025-07-31', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2025-08-31', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2025-09-30', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2025-10-31', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2025-11-30', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2025-12-31', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2026-01-31', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2026-02-28', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2026-03-31', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2026-04-30', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2026-05-31', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2026-06-30', '한국은행 기준금리', 2.500 FROM DUAL
       UNION ALL SELECT DATE '2026-07-31', '한국은행 기준금리', 2.750 FROM DUAL
       UNION ALL SELECT DATE '2026-08-31', '한국은행 기준금리', 3.000 FROM DUAL
       UNION ALL SELECT DATE '2026-09-30', '한국은행 기준금리', 3.000 FROM DUAL
       UNION ALL SELECT DATE '2026-10-31', '한국은행 기준금리', 3.000 FROM DUAL) s
   ON (t.BASE_DATE = s.BASE_DATE AND t.RATE_NAME = s.RATE_NAME)
 WHEN MATCHED THEN
      UPDATE SET t.RATE_PCT = s.RATE_PCT
 WHEN NOT MATCHED THEN
      INSERT (BASE_DATE, RATE_NAME, RATE_PCT)
      VALUES (s.BASE_DATE, s.RATE_NAME, s.RATE_PCT);

COMMIT;

-- 확인: 한국은행 기준금리 34행, 가장 최근 값(2026-10-31, 3.000)이 나오면 된다.
SELECT COUNT(*) AS ROW_COUNT, MAX(BASE_DATE) AS LATEST_DATE FROM FACT_POLICY_RATE WHERE RATE_NAME = '한국은행 기준금리';
SELECT BASE_DATE, RATE_PCT FROM FACT_POLICY_RATE WHERE RATE_NAME = '한국은행 기준금리' AND BASE_DATE = (SELECT MAX(BASE_DATE) FROM FACT_POLICY_RATE WHERE RATE_NAME = '한국은행 기준금리');
