-- ====================================================================
-- N-32-1 용어 도우미 질문 버튼 기준 데이터 — 질문 버튼 4개와 등록된 답 (FP-181)
-- CHATBOT_PRESET_QUESTION 4행. 용어 도우미(FP-207)가 HELP-02 GET /api/chatbot/presets로 읽는다. 누를 때 질문 횟수는 줄지 않는다.
--
-- 주의
--  - 교육용 프로토타입의 합성 문구다. 실제 금융기관·법령의 공식 정의를 옮긴 것이 아니다.
--  - SHAP은 "점수에 어떻게 반영됐는지"만 설명하고 원인·결과(인과관계)처럼 쓰지 않는다(AGENTS.md 5장).
--  - 금리·한도는 더미 데이터이며 "같은 점수대의 참고 정보"로만 설명한다(AGENTS.md 5장). 사용자에게 보이는 답에는 "더미" 대신 "서비스 시연용 예시 데이터"라고 쓴다.
--  - 문구는 PR에서 팀이 검토한다.
--
-- 실행 순서: avenue_ddl.sql → (시드가 필요하면) dummy_db/run_seed_only.sql → 이 파일. 새 DB·기존 DB 모두 이 파일로 넣는다.
-- 공용 DB 실행은 PR 병합 후 DB 담당(범영)이 한다. 로컬 DB는 각자 실행한다(docs/spec/sql/README.md 체크리스트 9).
--
-- 다시 실행해도 된다: 표에 중복 불가 열이 없어 표시 순서(DISPLAY_ORDER 1~4)를 기준으로, 같은 순서가 있으면 질문·답을 이 파일 값으로 덮어쓴다.
-- 적용한 DB에서는 dummy_db/99_check.sql의 CHATBOT_PRESET_QUESTION 기대값(0)과 실제(4)가 다르게 나오는 것이 정상이다.
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK

MERGE INTO CHATBOT_PRESET_QUESTION t
USING (
    SELECT 1 AS DISPLAY_ORDER,
           '대안 신용 점수는 기존 신용 점수와 무엇이 다른가요?' AS QUESTION_TEXT,
           '기존 신용 점수는 대출·카드 같은 금융 거래 기록만 봅니다. 대안 신용 점수는 여기에 통신비·공과금을 제때 냈는지, 간편결제를 어떻게 쓰는지 같은 생활 기록을 더해서 계산합니다. 그래서 금융 거래 기록이 적은 사회초년생이나 프리랜서도 성실한 생활 기록이 점수에 반영될 수 있습니다. 두 점수는 신용 리포트에서 나란히 비교할 수 있고, 대안 점수가 더 낮게 나오는 경우도 그대로 보여 줍니다. 이 서비스의 점수는 합성 데이터로 만든 교육용 예시이며 실제 신용평가 결과가 아닙니다.' AS ANSWER_TEXT FROM DUAL
    UNION ALL SELECT 2,
           '점수 영향도(SHAP)는 어떻게 읽나요?',
           '점수 영향도는 모델이 내 점수를 계산할 때 항목마다 점수가 기준점보다 얼마나 올라가거나 내려갔는지를 나눠 보여 주는 값입니다. 플러스(+)는 점수를 올린 쪽, 마이너스(-)는 내린 쪽으로 반영됐다는 뜻이고, 모든 항목의 값을 기준점에 더하면 내 점수가 됩니다. 다만 이 값은 점수에 어떻게 반영됐는지를 보여 줄 뿐, 그 항목 때문에 점수가 정해졌다는 원인·결과를 뜻하지는 않습니다. 값을 바꿨을 때 점수가 어떻게 달라지는지는 신용케어 시뮬레이터에서 따로 확인해 보세요.' FROM DUAL
    UNION ALL SELECT 3,
           'DSR(상환 부담률)이 높으면 어떤 뜻인가요?',
           'DSR은 1년 동안 갚는 모든 대출의 원금과 이자를 1년 소득으로 나눈 비율입니다. 예를 들어 1년 소득이 4,000만 원이고 1년에 갚는 원리금이 1,200만 원이면 DSR은 30%입니다. 이 비율이 높을수록 버는 돈에 비해 빚 갚는 데 쓰는 돈이 많아, 갑자기 소득이 줄거나 지출이 늘었을 때 버티기 어려워집니다. 자산·부채 건전성 화면과 DSR 계산기에서 내 비율과 위험 단계(서비스가 정한 예시 기준)를 볼 수 있습니다.' FROM DUAL
    UNION ALL SELECT 4,
           '시뮬레이터 결과와 참고 금리·한도는 실제 대출 심사 결과인가요?',
           '아니요. 신용케어 시뮬레이터는 입력값을 바꿨을 때 모델이 계산한 예상 점수를 보여 줄 뿐 저장되지 않고, 실제 점수가 바뀌지도 않습니다. 함께 보이는 금리·한도도 실제 금융회사의 심사 결과가 아니라, 서비스 시연용으로 만든 예시 데이터에서 같은 점수대에 해당하는 값을 보여 주는 참고 정보입니다. 실제 대출 가능 여부와 조건은 금융회사의 심사를 따릅니다.' FROM DUAL
) s
ON (t.DISPLAY_ORDER = s.DISPLAY_ORDER)
WHEN MATCHED THEN UPDATE SET t.QUESTION_TEXT = s.QUESTION_TEXT, t.ANSWER_TEXT = s.ANSWER_TEXT
WHEN NOT MATCHED THEN INSERT (QUESTION_TEXT, ANSWER_TEXT, DISPLAY_ORDER) VALUES (s.QUESTION_TEXT, s.ANSWER_TEXT, s.DISPLAY_ORDER);

COMMIT;

-- 확인: 표시 순서 1~4가 하나씩 있어야 한다
SELECT DISPLAY_ORDER, QUESTION_TEXT FROM CHATBOT_PRESET_QUESTION ORDER BY DISPLAY_ORDER;
