-- ====================================================================
-- Avenue 서비스 DB DDL v0.3.2 · Oracle 21c, UTF-8
-- 상태: v0.3.1 확정본 + C조 요청 반영(경환, 2026-11-11·12), 팀 공유 전. 아래 v0.3.1 머리말은 이력으로 그대로 둔다.
--  - 서비스 DB 기준 DDL = 이 파일 (표 51개). 옛 dummy_db/ 14개 표(APP_MEMBER 계열)와 경환 v0.2(46개 표)를 대신한다 (D-05, 점검 결과 결정 5).
--  - A-1 점수 범위 = 0~1000. 점수 CHECK와 등급 구간(CUT-0.1)이 이 범위를 쓴다. decisions.md의 "300~900"은 문서 담당자가 고쳐야 한다.
--  - U2·U3·E2 = 아래 v0.3.1 내용으로 확정. E2(키 버전 접두어)는 우선 이대로 운영하고, 키 운영 방식이 정해지면 다시 확인한다.
-- 실행: 빈 스키마에서 SQL Developer "스크립트 실행"(F5)으로 한 번에 실행한다. 마지막에 COMMIT이 있다.
-- 적용 전에 바꿔야 하는 코드: 경환님 시드 생성기(표 47개, UNPAID 변환, "v1:" 접두어), A팀 Spring(UNPAID 변환, "v1:" 복호화).
--   생성기를 고치기 전의 옛 시드는 CK_UTP_PAID_DATE에서 거절된다.
-- ====================================================================
-- (이력) DDL 초안 (경환) · Oracle 21c, UTF-8 · 2026-11-09
-- 기준: 기능 명세서 v3 시트(사용 테이블 열의 이름을 따름)
-- 참고: docs/spec/sql/dummy_db/01_create_tables.sql, 03_b_team_tables.sql(B팀)
--
-- 정리 원칙
--  - 테이블 이름은 명세서 v3를 따른다. N-35의 user·admin·credit_data·consumption_data는
--    app_user·assessment 등으로 합치고 access_audit_log만 만든다 (D-05 회의 확인).
--  - B팀 PREDICTION_HISTORY → assessment, PREDICTION_SHAP_FACTOR → assessment_factor로 합쳤다.
--  - 삭제된 기능(N-23 가산점, N-36 비회원 간이 예측)과 N-29 다국어 전용 테이블은 만들지 않는다. N-28 로그는 v0.3.2(W6)에서 추가.
--  - 등급 상태에 입력 부족(INSUFFICIENT_INPUT)은 두지 않는다. 입력이 덜 차면 산출하지 않는다.
--  - 금리는 연 % (NUMBER, 8.9 = 8.9%), 확률은 0~1, 금액은 원 단위 정수.
--
-- [v0.2 제안 · 범영 · 2026-11-10] 팀 공유·합의 전 초안. 바꾼 곳에는 "v0.2 (항목번호)" 주석을 붙였다.
--  R3 직군별 필수 소득 개월 수 DIM_WORKER_TYPE.REQUIRED_INCOME_MONTHS, 입력 최신성 한도 APP_SETTING
--  B1 등급 구간 버전 SCORE_CUTOFF_VERSION          B2 피처 사전 FEATURE_SET_VERSION, DIM_FEATURE
--  B3 평가 요청 고유번호 ASSESSMENT.REQUEST_ID      B4 산출 불가 사유 DIM_NOT_SCORABLE_REASON
--  B5 학습·검증·시험 구분 DATA_SPLIT_CODE 등        P1 데이터셋 버전 DATASET_VERSION, DATASET_CLEANING_LOG
--  P2 모델 등록부 MODEL_REGISTRY, MODEL_ARTIFACT
--  R1 (팀원 확인 반영) 소득만 달마다 12개월, 지출·대출·자산은 기준월 시점의 현재 값 한 세트. 지출은 평균 월 지출 금액(회원이 적는 평소 월 금액), 대출은 현재 월 원리금 한 값.
--     모델 피처도 이 입력에 맞춘다 (피처 정의서·학습 데이터 정의에서 반영, DDL의 열 구조는 그대로).
--  R2 (팀원 확인 반영) 신용평가사 응답 207개 항목용 테이블과 원문 저장은 만들지 않는다. 모델에 넘긴 값은 ASSESSMENT.FEATURE_SNAPSHOT(JSON)에만 보관.
--  R4 단위(원·개월)는 컬럼 이름에 이미 반영돼 있어 DDL 변경 없음 (화면 문구만 수정).
--  U1 (A팀 공과금 API 반영) USER_UTILITY_PAYMENT 신설. A팀 v3.5.7 공과금 응답이 통신 응답과 같은 형식(청구월, 청구액, 기한, 납부일, 상태)이라 통신비 표와 같은 구조로 만듦.
--     모델 피처 utility_late_months(공과금 미납 개월 수)의 원천이다.
--
-- [v0.3 제안 · 범영 · 2026-11-11] 팀 공유·합의 전 초안. 경환님 브랜치(KGH_Work)의 더미 DB v0.2 DDL(46개 표)과 대조하고,
--   서비스 입력·학습 데이터 v3.6.0 변경(커밋 설명)을 반영했다. 바꾼 곳에는 "v0.3 (항목번호)" 주석을 붙였다.
--   구조 비교: 범영 v0.2(47개 표) 대비 표·열·인덱스 구조는 같다. 경환 v0.2(46개 표) 대비로는 USER_UTILITY_PAYMENT(U1) 1개가 늘었다.
--   v0.3.1에서 CHECK 제약 2개(CK_UTP_PAID_DATE, CK_UUP_PAID_DATE)를 추가했다 (U3).
--  E1 이름·휴대폰·이메일 암호문과 검색 HMAC의 저장 형식을 열 주석에 기록 (경환님 생성기 build_db_v02.py·README 기준)
--  S1 더미 시드 규칙을 SOURCE_CODE 주석에 기록: 동의 회원 대출 = IMPORTED, 미동의 회원 대출 = MANUAL
--
-- [v0.3.1 확정 · 범영 · 2026-11-11] E2·U2·U3를 아래 내용으로 정했다. 바꾼 곳에는 "v0.3.1 (항목번호)" 주석을 붙였다.
--  E2 (확정, 우선 운영) 암호문 앞에 키 버전 접두어를 붙인다: "v1:" + Base64(IV 12바이트 + 암호문 + 태그 16바이트).
--     복호화할 때는 첫 ':' 앞의 버전으로 키를 고르고, 모르는 버전이면 오류로 멈춘다. 열 길이(500자)는 그대로 둔다.
--     HMAC 열에는 접두어를 붙이지 않는다 (검색 값이라 키를 바꾸면 어차피 모두 다시 계산한다).
--     바꿀 곳: 경환님 생성기 encrypt_text, Spring 암·복호화 코드.
--  U2 (확정) utility_late_months는 LATE와 UNPAID를 모두 센다 (= 기한까지 내지 않은 달). 학습 데이터의 utility_late 정의와 같다.
--  U3 (확정) 상태 뜻을 고정하고 통신비·공과금 두 표에 같은 CHECK를 넣는다.
--     ON_TIME = 기한 안에 납부(납부일 <= 기한), LATE = 기한 뒤에 납부(납부일 > 기한), UNPAID = 기준일 현재 미납(납부일 NULL).
--     바꿀 곳: 기관 응답의 "late + 납부일 없음"을 UNPAID로 바꿔 저장한다 (경환님 생성기 map_bill_rows, A팀 Spring 불러오기 코드).
--
-- [v0.3.2 · 경환 · 2026-11-11] v0.3.1 확정본에 C조(공공통계·활용) 요청 05_c_team_tables.sql을 합쳤다. 표 47 → 49. 바꾼 곳에는 "v0.3.2 (C번호)" 주석.
--  C1 새 표 FACT_DONG_LIVING_POP (행정동 분기 생활인구, N-24-4·5)
--  C2 새 표 FACT_HFS_WORKER_STAT (직군별 평균 연소득·총자산·총부채, N-15-3). 프리랜서 종사상지위 매핑은 TODO(팀 확정)
--  C3 DIM_SERVICE_CATEGORY.MAP_GROUP_CODE 열 + CK_DSC_MAP_GROUP (지도 업종 칩 8개, N-24-2·3·4·5). 칩에 없는 업종은 NULL
--  C4 CONTENT_REPORT CK_CRP_RESULT_STATUS (처리 상태 ↔ 처리 결과, N-34-3)
--  C5 인덱스 IX_FDS_DONG_CAT, IX_FDT_DONG_CAT (동·업종 최근 4분기, N-24-2·5)
--  C6 C조 열 주석 보완 (구조 변경 없음)
--  C7 [2026-11-12 · C조 합의] 새 표 BOARD_POST_LOG (게시글 변경 이력, N-06·N-33-2·N-34-3). 표 49 → 50.
--     작성·수정·삭제·숨김·해제를 모두 기록하고 허용 조합은 CK_BPL_TRANSITION으로 막는다. 회원·신고 FK는 참조 행이 있을 때만 삭제를 막는다.
--     BOARD_POST.STATUS_CODE 주석: DELETED = 작성자 또는 관리자 삭제. 허용 값 3개는 그대로.
--     숨겨진 글 작성자 삭제 = 가능, 숨겨진 글 수정 = 불가 (11/12 확정).
--  W1 [2026-11-12 · 경환] 탈퇴 = 상태 변경 (법적 근거). 회원 행은 지우지 않는다.
--     CK_APU_ACCOUNT_STATUS에 WITHDRAWN 추가, APP_USER.WITHDRAWN_AT 열 추가.
--     APP_USER를 참조하는 FK 20개의 ON DELETE CASCADE / SET NULL을 뺐다. 참조 행이 있으면 회원 삭제가 거절된다.
--     개인정보 칸은 NOT NULL을 그대로 두고 표시값으로 덮어쓴다: LOGIN_ID='wd_'||USER_ID, NICKNAME='탈퇴'||USER_ID,
--     NAME_ENC·EMAIL_ENC='WITHDRAWN', EMAIL_HMAC='WITHDRAWN:'||USER_ID, 휴대폰·비밀번호 NULL. CK_APU_PII_BY_STATUS가 빠뜨림을 막는다.
--     v0.3.2 (W1) 탈퇴·동의 종료 시 동의로 불러온 데이터는 삭제하고, 그 밖의 딸린 데이터는 보관한다 (DDL_v0.3.2_정해야할것들gh.md 2-3).
--  W2 [2026-11-12] USER_LOAN.CONSENT_ID + FK_ULN_CONSENT (불러온 대출을 동의별로 구분, 다른 대안 데이터 표와 같은 구조)
--  W3 [2026-11-12] 대안 데이터 6개 표에 CK_*_CONSENT_SOURCE (IMPORTED ↔ CONSENT_ID 필수)
--  W4 [2026-11-12] 대안 데이터 6개 표 동의 FK의 ON DELETE SET NULL 제거 (W3 CHECK와 충돌, 동의 이력은 지우지 않음)
--  W5 [2026-11-12] APP_USER.ADM_DONG_CODE·SERVICE_CATEGORY_CODE와 FK 2개 삭제 (팀원 검수, 쓰는 곳 없음)
--  W6 [2026-11-12] 새 표 SYSTEM_LOG (N-28 관리자 시스템 로그). 표 50 → 51
--  C8 (보류) DIM_ADM_DONG.GEO_ADM_CODE — 행정동 경계 파일을 정한 뒤 결정
-- ====================================================================


-- ====================================================================
-- 1. 코드 테이블
-- ====================================================================

-- D-03 직군 3분류.
CREATE TABLE DIM_WORKER_TYPE (
    WORKER_TYPE_CODE       VARCHAR2(20 CHAR)    NOT NULL,
    WORKER_TYPE_NAME       VARCHAR2(30 CHAR)    NOT NULL,
    DISPLAY_ORDER          NUMBER(2)            NOT NULL,
    REQUIRED_INCOME_MONTHS NUMBER(2)            NOT NULL,
    CONSTRAINT PK_DIM_WORKER_TYPE PRIMARY KEY (WORKER_TYPE_CODE),
    CONSTRAINT CK_DWT_CODE CHECK (WORKER_TYPE_CODE IN ('EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER')),
    CONSTRAINT CK_DWT_REQ_MONTHS CHECK (REQUIRED_INCOME_MONTHS IN (1, 12))
);
COMMENT ON TABLE  DIM_WORKER_TYPE IS '직군 코드 (EMPLOYEE=급여소득자, SELF_EMPLOYED=자영업자, FREELANCER=프리랜서)';
COMMENT ON COLUMN DIM_WORKER_TYPE.REQUIRED_INCOME_MONTHS IS 'v0.2 (R3) 점수 산출에 필요한 소득 개월 수. 자영업자·프리랜서=12(소득이 불규칙해 12개월을 본다), 급여소득자=1(월급이 고정). Spring이 이 값으로 입력을 검사하고, 같은 값을 FastAPI 검사에도 쓴다(FastAPI는 DB를 읽지 않으므로 요청 또는 설정 파일로 전달)';

-- N-27-2 역할. 관리자 역할은 1개 (D-02).
CREATE TABLE DIM_ROLE (
    ROLE_CODE              VARCHAR2(20 CHAR)    NOT NULL,
    ROLE_NAME              VARCHAR2(30 CHAR)    NOT NULL,
    CONSTRAINT PK_DIM_ROLE PRIMARY KEY (ROLE_CODE),
    CONSTRAINT CK_DRL_CODE CHECK (ROLE_CODE IN ('ROLE_USER', 'ROLE_ADMIN'))
);
COMMENT ON TABLE  DIM_ROLE IS '역할 코드 (ROLE_USER=일반 사용자, ROLE_ADMIN=관리자)';

-- N-05-3·N-16-4 대출 종류.
CREATE TABLE DIM_LOAN_TYPE (
    LOAN_TYPE_CODE         VARCHAR2(30 CHAR)    NOT NULL,
    LOAN_TYPE_NAME         VARCHAR2(50 CHAR)    NOT NULL,
    PRIVATE_LENDER_YN      CHAR(1)              DEFAULT 'N' NOT NULL,
    DISPLAY_ORDER          NUMBER(3)            NOT NULL,
    CONSTRAINT PK_DIM_LOAN_TYPE PRIMARY KEY (LOAN_TYPE_CODE),
    CONSTRAINT CK_DLT_PRIVATE_LENDER_YN CHECK (PRIVATE_LENDER_YN IN ('Y', 'N'))
);
COMMENT ON TABLE  DIM_LOAN_TYPE IS '대출 종류 코드 (신용대출, 주택담보, 카드론, 대부업 등)';
COMMENT ON COLUMN DIM_LOAN_TYPE.PRIVATE_LENDER_YN IS '대부업 여부. UI 대출 종류에는 대부업이 없어 지금은 모두 N이고, 대부업 잔액은 USER_CREDIT_PROFILE.PRIVATE_LENDER_LOAN_BALANCE_AMT에 둔다';

-- N-24 서울 행정동.
CREATE TABLE DIM_ADM_DONG (
    ADM_DONG_CODE          VARCHAR2(10 CHAR)    NOT NULL,
    GU_NAME                VARCHAR2(20 CHAR)    NOT NULL,
    DONG_NAME              VARCHAR2(30 CHAR)    NOT NULL,
    CONSTRAINT PK_DIM_ADM_DONG PRIMARY KEY (ADM_DONG_CODE)
);
COMMENT ON TABLE  DIM_ADM_DONG IS '서울 행정동 (경계 GeoJSON은 파일로 둔다)';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN DIM_ADM_DONG.ADM_DONG_CODE IS '서울시 상권분석서비스 행정동 코드 (상권 FACT 표와 같은 코드)';
COMMENT ON COLUMN DIM_ADM_DONG.GU_NAME IS '구 이름 (구 선택, 구별 평균, 구 안 순위)';
COMMENT ON COLUMN DIM_ADM_DONG.DONG_NAME IS '행정동 이름 (행정동 검색, 지도 라벨, 동 상세 제목)';

-- N-24 상권 업종.
CREATE TABLE DIM_SERVICE_CATEGORY (
    SERVICE_CATEGORY_CODE  VARCHAR2(10 CHAR)    NOT NULL,
    SERVICE_CATEGORY_NAME  VARCHAR2(50 CHAR)    NOT NULL,
    MAP_GROUP_CODE         VARCHAR2(20 CHAR),                   -- v0.3.2 (C3)
    CONSTRAINT PK_DIM_SERVICE_CATEGORY PRIMARY KEY (SERVICE_CATEGORY_CODE),
    CONSTRAINT CK_DSC_MAP_GROUP CHECK (MAP_GROUP_CODE IN ('CAFE', 'FOOD', 'FASHION', 'CONV', 'BEAUTY', 'BAKERY', 'PUB', 'EDU'))  -- v0.3.2 (C3)
);
COMMENT ON TABLE  DIM_SERVICE_CATEGORY IS '상권 업종 코드 (지도 화면 8개 업종 포함)';
-- v0.3.2 (C3)
COMMENT ON COLUMN DIM_SERVICE_CATEGORY.MAP_GROUP_CODE IS '지도 업종 칩 묶음 (CAFE=커피·음료, FOOD=치킨·음식점, FASHION=의류·패션, CONV=편의점, BEAUTY=미용·뷰티, BAKERY=베이커리·디저트, PUB=호프·주점, EDU=학원·교육). 칩에 없는 업종은 NULL';

-- v0.2 (B4) 산출 불가 사유. 등급 상태는 SCORED / NOT_SCORABLE 2종을 그대로 두고, 못 구한 이유만 이 코드로 따로 기록한다.
-- CHECK 목록 없이 FK로만 막는다: 새 사유는 이 표에 행만 추가하면 된다.
CREATE TABLE DIM_NOT_SCORABLE_REASON (
    REASON_CODE            VARCHAR2(30 CHAR)    NOT NULL,
    REASON_NAME            VARCHAR2(100 CHAR)   NOT NULL,
    DISPLAY_ORDER          NUMBER(2)            NOT NULL,
    CONSTRAINT PK_DIM_NOT_SCORABLE_REASON PRIMARY KEY (REASON_CODE)
);
COMMENT ON TABLE  DIM_NOT_SCORABLE_REASON IS '산출 불가 사유 코드 (CONSENT_REQUIRED=동의 없음, INPUT_INCOMPLETE=필수 입력 부족, STALE_INPUT=입력 기준월이 오래됨, MODEL_ERROR=모델 서버 오류)';


-- ====================================================================
-- 2. 회원·인증 (N-01~N-05, N-27)
-- ====================================================================

-- N-02-4 회원 계정. 이름·휴대폰·이메일은 AES 암호화, 검색용 HMAC 별도 저장.
CREATE TABLE APP_USER (
    USER_ID                NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    LOGIN_ID               VARCHAR2(30 CHAR)    NOT NULL,
    PASSWORD_HASH          VARCHAR2(100 CHAR),
    NICKNAME               VARCHAR2(12 CHAR)    NOT NULL,
    NAME_ENC               VARCHAR2(500 CHAR)   NOT NULL,
    PHONE_ENC              VARCHAR2(500 CHAR),
    PHONE_HMAC             VARCHAR2(64 CHAR),
    EMAIL_ENC              VARCHAR2(500 CHAR)   NOT NULL,
    EMAIL_HMAC             VARCHAR2(64 CHAR)    NOT NULL,
    BIRTH_YEAR             NUMBER(4),
    WORKER_TYPE_CODE       VARCHAR2(20 CHAR),
    WORK_PERIOD_MONTHS     NUMBER(4),
    ROLE_CODE              VARCHAR2(20 CHAR)    DEFAULT 'ROLE_USER' NOT NULL,
    ACCOUNT_STATUS_CODE    VARCHAR2(20 CHAR)    DEFAULT 'ACTIVE' NOT NULL,
    LOCK_REASON            VARCHAR2(300 CHAR),
    LOCKED_AT              TIMESTAMP,
    LOGIN_FAIL_COUNT       NUMBER(2)            DEFAULT 0 NOT NULL,
    PASSWORD_CHANGE_REQUIRED_YN CHAR(1)         DEFAULT 'N' NOT NULL,
    LAST_LOGIN_AT          TIMESTAMP,
    WITHDRAWN_AT           TIMESTAMP,
    DUMMY_YN               CHAR(1)              DEFAULT 'N' NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    UPDATED_AT             TIMESTAMP,
    CONSTRAINT PK_APP_USER PRIMARY KEY (USER_ID),
    CONSTRAINT UK_APU_LOGIN_ID UNIQUE (LOGIN_ID),
    CONSTRAINT UK_APU_NICKNAME UNIQUE (NICKNAME),
    CONSTRAINT UK_APU_EMAIL_HMAC UNIQUE (EMAIL_HMAC),
    CONSTRAINT FK_APU_WORKER_TYPE FOREIGN KEY (WORKER_TYPE_CODE) REFERENCES DIM_WORKER_TYPE (WORKER_TYPE_CODE),
    CONSTRAINT FK_APU_ROLE FOREIGN KEY (ROLE_CODE) REFERENCES DIM_ROLE (ROLE_CODE),
    CONSTRAINT CK_APU_NICKNAME_LEN CHECK (LENGTH(NICKNAME) BETWEEN 2 AND 12),
    CONSTRAINT CK_APU_BIRTH_YEAR CHECK (BIRTH_YEAR BETWEEN 1930 AND 2006),
    -- v0.3.2 (W1) WITHDRAWN 추가
    CONSTRAINT CK_APU_ACCOUNT_STATUS CHECK (ACCOUNT_STATUS_CODE IN ('ACTIVE', 'LOCKED', 'WITHDRAWN')),
    CONSTRAINT CK_APU_WITHDRAWN_AT CHECK ((ACCOUNT_STATUS_CODE = 'WITHDRAWN' AND WITHDRAWN_AT IS NOT NULL)
                                      OR (ACCOUNT_STATUS_CODE <> 'WITHDRAWN' AND WITHDRAWN_AT IS NULL)),
    -- v0.3.2 (W1) 탈퇴 회원은 개인정보 칸이 표시값이어야 하고, 탈퇴 회원이 아니면 표시값을 쓸 수 없다.
    -- 표시값은 암호문(v1:...)·HMAC(16진수 64자)과 겹치지 않는다. 회원 번호를 붙여 UNIQUE를 지킨다.
    -- v0.3.2 (W1) 탈퇴 아이디·닉네임 접두어는 탈퇴 회원만 쓰도록 예약한다.
    CONSTRAINT CK_APU_PII_BY_STATUS CHECK (
           (ACCOUNT_STATUS_CODE = 'WITHDRAWN'
            AND LOGIN_ID = 'wd_' || TO_CHAR(USER_ID) AND NICKNAME = '탈퇴' || TO_CHAR(USER_ID)
            AND NAME_ENC = 'WITHDRAWN' AND EMAIL_ENC = 'WITHDRAWN' AND EMAIL_HMAC = 'WITHDRAWN:' || TO_CHAR(USER_ID)
            AND PHONE_ENC IS NULL AND PHONE_HMAC IS NULL AND PASSWORD_HASH IS NULL)
        OR (ACCOUNT_STATUS_CODE <> 'WITHDRAWN'
            AND LOGIN_ID NOT LIKE 'wd\_%' ESCAPE '\' AND NICKNAME NOT LIKE '탈퇴%'
            AND NAME_ENC <> 'WITHDRAWN' AND EMAIL_ENC <> 'WITHDRAWN' AND EMAIL_HMAC NOT LIKE 'WITHDRAWN:%')),
    CONSTRAINT CK_APU_PW_CHANGE_YN CHECK (PASSWORD_CHANGE_REQUIRED_YN IN ('Y', 'N')),
    CONSTRAINT CK_APU_DUMMY_YN CHECK (DUMMY_YN IN ('Y', 'N')),
    CONSTRAINT CK_APU_USER_FIELDS CHECK (ROLE_CODE = 'ROLE_ADMIN' OR BIRTH_YEAR IS NOT NULL)
);
COMMENT ON TABLE  APP_USER IS '회원·관리자 계정 (N-01~N-05, N-27)';
COMMENT ON COLUMN APP_USER.LOGIN_ID IS '로그인 아이디';
COMMENT ON COLUMN APP_USER.PASSWORD_HASH IS 'BCrypt 해시 (소셜 로그인 전용 계정만 NULL. 시연 계정도 해시를 저장하고 일반 로그인)';
COMMENT ON COLUMN APP_USER.NICKNAME IS '닉네임 (2~12자, 중복 불가, 신용 라운지 작성자 표시)';
COMMENT ON COLUMN APP_USER.NAME_ENC IS 'v0.3.1 (E1·E2) 이름 (AES-256-GCM 암호문. "v1:" + 표준 Base64로 저장한다. Base64 = 앞 12바이트 IV + 암호문 + 16바이트 인증 태그. v1은 키 버전이고, 값마다 새 난수 IV를 쓰며, 키는 DB에 두지 않는다)';
COMMENT ON COLUMN APP_USER.PHONE_ENC IS 'v0.3.1 (E1·E2) 휴대폰 (AES-256-GCM 암호문. "v1:" + 표준 Base64로 저장한다. Base64 = 앞 12바이트 IV + 암호문 + 16바이트 인증 태그. v1은 키 버전이고, 값마다 새 난수 IV를 쓰며, 키는 DB에 두지 않는다)';
COMMENT ON COLUMN APP_USER.PHONE_HMAC IS 'v0.3 (E1) 휴대폰 검색용 HMAC (아이디 찾기). HMAC-SHA256, 암호화와 다른 별도 키, 소문자 16진수 64자. 숫자만 남긴 값으로 계산한다';
COMMENT ON COLUMN APP_USER.EMAIL_ENC IS 'v0.3.1 (E1·E2) 이메일 (관리자는 업무 이메일. AES-256-GCM 암호문. "v1:" + 표준 Base64로 저장한다. Base64 = 앞 12바이트 IV + 암호문 + 16바이트 인증 태그. v1은 키 버전이고, 값마다 새 난수 IV를 쓰며, 키는 DB에 두지 않는다)';
COMMENT ON COLUMN APP_USER.EMAIL_HMAC IS 'v0.3 (E1) 이메일 검색용 HMAC. HMAC-SHA256, 암호화와 다른 별도 키, 소문자 16진수 64자. 앞뒤 공백을 지우고 소문자로 바꾼 값으로 계산한다';
COMMENT ON COLUMN APP_USER.BIRTH_YEAR IS '출생연도 (1930~2006, 2026년 기준 20세 이상만 가입). 연령대는 이 값으로 계산. 관리자는 NULL 가능. TODO 상한 연도는 해마다 바뀌므로 최종 검사는 Spring에서';
COMMENT ON COLUMN APP_USER.WORKER_TYPE_CODE IS '직군 (로그인 후 선택, 선택 전 NULL. N-05-1·N-04-8)';
COMMENT ON COLUMN APP_USER.WORK_PERIOD_MONTHS IS '재직·운영·활동 기간 (개월, 소득 입력에서 받음)';
COMMENT ON COLUMN APP_USER.ACCOUNT_STATUS_CODE IS 'v0.3.2 (W1) 계정 상태 (ACTIVE, LOCKED=비밀번호 5회 실패 또는 관리자 잠금, WITHDRAWN=탈퇴. 탈퇴해도 행은 지우지 않고 개인정보 칸을 표시값으로 덮어쓴다(CK_APU_PII_BY_STATUS), N-04-7)';
COMMENT ON COLUMN APP_USER.WITHDRAWN_AT IS 'v0.3.2 (W1) 탈퇴 시각 (WITHDRAWN일 때만 값). 탈퇴 때 개인정보 칸은 CK_APU_PII_BY_STATUS의 표시값으로 덮어쓴다';
COMMENT ON COLUMN APP_USER.LOGIN_FAIL_COUNT IS '연속 로그인 실패 횟수 (5회면 잠금, 재설정으로 해제)';
COMMENT ON COLUMN APP_USER.PASSWORD_CHANGE_REQUIRED_YN IS '첫 로그인 때 비밀번호 변경 필요 (관리자 임시 비밀번호, N-27-4)';
COMMENT ON COLUMN APP_USER.DUMMY_YN IS '더미·시연 계정 여부';

-- N-01-6 소셜 로그인 연결 (D-25 후보). 한 회원이 여러 제공자를 연결할 수 있다. 관리자는 연결하지 않는다.
CREATE TABLE USER_SOCIAL_ACCOUNT (
    SOCIAL_ACCOUNT_ID      NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    PROVIDER_CODE          VARCHAR2(20 CHAR)    NOT NULL,
    PROVIDER_USER_ID       VARCHAR2(100 CHAR)   NOT NULL,
    LINKED_AT              TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USER_SOCIAL_ACCOUNT PRIMARY KEY (SOCIAL_ACCOUNT_ID),
    CONSTRAINT UK_USA_PROVIDER_USER UNIQUE (PROVIDER_CODE, PROVIDER_USER_ID),
    CONSTRAINT UK_USA_USER_PROVIDER UNIQUE (USER_ID, PROVIDER_CODE),
    CONSTRAINT FK_USA_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_USA_PROVIDER CHECK (PROVIDER_CODE IN ('GOOGLE', 'KAKAO', 'NAVER'))
);
COMMENT ON TABLE  USER_SOCIAL_ACCOUNT IS '소셜 로그인 연결 (N-01-6)';
COMMENT ON COLUMN USER_SOCIAL_ACCOUNT.PROVIDER_USER_ID IS '제공자가 준 사용자 식별값 (원문 저장·해시 저장은 로그인 담당과 결정 예정)';

-- N-02-2 가입 동의 + N-05-9 대안 데이터 정보 제공 동의(항목별) 이력.
CREATE TABLE USER_CONSENT (
    CONSENT_ID             NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    CONSENT_TYPE_CODE      VARCHAR2(30 CHAR)    NOT NULL,
    PROVIDER_CODE          VARCHAR2(30 CHAR),
    ITEM_CODE              VARCHAR2(30 CHAR),
    REQUIRED_YN            CHAR(1)              NOT NULL,
    AGREED_YN              CHAR(1)              NOT NULL,
    TERMS_VERSION          VARCHAR2(20 CHAR),
    EXTERNAL_CONSENT_ID    VARCHAR2(60 CHAR),
    AGREED_AT              TIMESTAMP,
    EXPIRES_AT             TIMESTAMP,
    WITHDRAWN_AT           TIMESTAMP,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USER_CONSENT PRIMARY KEY (CONSENT_ID),
    CONSTRAINT FK_UCS_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_UCS_TYPE CHECK (CONSENT_TYPE_CODE IN ('TERMS_OF_SERVICE', 'PRIVACY_COLLECTION', 'NOTIFICATION_MARKETING', 'ALT_DATA_PROVISION')),
    CONSTRAINT CK_UCS_REQUIRED_YN CHECK (REQUIRED_YN IN ('Y', 'N')),
    CONSTRAINT CK_UCS_AGREED_YN CHECK (AGREED_YN IN ('Y', 'N')),
    CONSTRAINT CK_UCS_ALT_ITEM CHECK (CONSENT_TYPE_CODE <> 'ALT_DATA_PROVISION' OR (PROVIDER_CODE IS NOT NULL AND ITEM_CODE IS NOT NULL))
);
COMMENT ON TABLE  USER_CONSENT IS '동의 이력 (가입 필수 2·선택 1, 대안 데이터 항목별 정보 제공 동의). 철회해도 행을 지우지 않는다';
COMMENT ON COLUMN USER_CONSENT.CONSENT_TYPE_CODE IS 'TERMS_OF_SERVICE·PRIVACY_COLLECTION=가입 필수, NOTIFICATION_MARKETING=가입 선택, ALT_DATA_PROVISION=대안 데이터 제공';
COMMENT ON COLUMN USER_CONSENT.PROVIDER_CODE IS '제공 기관 (대안 데이터 동의만: telecom, utility, payment, public-insurance 등)';
COMMENT ON COLUMN USER_CONSENT.ITEM_CODE IS '제공 항목 (대안 데이터 동의만: TELECOM_BILL, UTILITY_BILL, EASYPAY, NATIONAL_PENSION, HEALTH_INSURANCE 등)';
COMMENT ON COLUMN USER_CONSENT.EXTERNAL_CONSENT_ID IS '가상 기관(목 서버)이 발급한 동의 ID';
COMMENT ON COLUMN USER_CONSENT.EXPIRES_AT IS '동의 만료 시각 (법적 최대 1년)';
COMMENT ON COLUMN USER_CONSENT.WITHDRAWN_AT IS '동의 철회 시각 ([연결 해제])';

-- N-02-3 인증코드 (가입·비밀번호 찾기·이메일 변경 공통) + 관리자 로그인 6자리 인증번호.
CREATE TABLE VERIFICATION_CODE (
    VERIFICATION_ID        NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    PURPOSE_CODE           VARCHAR2(30 CHAR)    NOT NULL,
    CHANNEL_CODE           VARCHAR2(10 CHAR)    NOT NULL,
    TARGET_HMAC            VARCHAR2(64 CHAR)    NOT NULL,
    USER_ID                NUMBER(19),
    CODE_HASH              VARCHAR2(100 CHAR)   NOT NULL,
    ATTEMPT_COUNT          NUMBER(2)            DEFAULT 0 NOT NULL,
    EXPIRES_AT             TIMESTAMP            NOT NULL,
    VERIFIED_AT            TIMESTAMP,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_VERIFICATION_CODE PRIMARY KEY (VERIFICATION_ID),
    CONSTRAINT FK_VCD_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_VCD_PURPOSE CHECK (PURPOSE_CODE IN ('SIGNUP', 'FIND_PASSWORD', 'CHANGE_EMAIL', 'ADMIN_LOGIN')),
    CONSTRAINT CK_VCD_CHANNEL CHECK (CHANNEL_CODE IN ('EMAIL', 'PHONE'))
);
COMMENT ON TABLE  VERIFICATION_CODE IS '인증코드 발송·확인 이력 (N-02-3, N-03-2, N-04-3, 관리자 2단계 인증)';
COMMENT ON COLUMN VERIFICATION_CODE.TARGET_HMAC IS '받는 이메일·휴대폰의 HMAC (원문 저장 안 함). v0.3 (E1) 소문자 16진수 64자. APP_USER의 HMAC과 같은 방식으로 만들어야 대조가 맞는다 (권장)';
COMMENT ON COLUMN VERIFICATION_CODE.USER_ID IS '대상 계정 (가입 전이면 NULL)';
COMMENT ON COLUMN VERIFICATION_CODE.CODE_HASH IS '인증코드 해시 (원문 저장 안 함)';


-- ====================================================================
-- 3. 데이터 입력 (N-05) — 모든 입력은 기준월과 함께 저장 (D-16)
-- 기준월 = 입력 범위의 가장 최근 달(기본값: 입력 시점의 지난달). 범위는 기준월 −11 ~ 기준월 12개월.
-- 기준월은 따로 저장하지 않고 USER_INCOME_MONTH의 가장 늦은 BASE_MONTH로 정한다(11/10 결정).
-- v0.2 (R1) 소득만 달마다 한 행씩 12개월(월별) 받는다. 지출·대출·자산은 달마다 12벌을 받지 않고, 기준월 시점의 현재 값 한 세트만 받는다.
--   지출은 평균 월 지출 금액(USER_EXPENSE_ITEM.MONTHLY_AMT, 회원이 적는 평소 월 금액), 대출은 현재 월 원리금(USER_LOAN.MONTHLY_PAYMENT_AMT) 한 값이다.
--   "한 세트" 규칙: 자산은 UNIQUE (USER_ID, BASE_MONTH)로 DB가 지킨다(회원당 한 행으로 막으면 D-16의 기준월별 저장과 충돌하므로 USER_ID만으로는 걸지 않는다).
--   지출·대출은 항목이 여러 개라 DB 제약으로 못 막으므로, Spring이 같은 회원·같은 기준월의 기존 항목을 지우고 다시 넣는다(한 트랜잭션).
-- v0.2 (R2) 신용평가사 응답 207개 항목용 테이블은 만들지 않고, 응답 원문도 저장하지 않는다. 모델에 넘긴 값만 ASSESSMENT.FEATURE_SNAPSHOT(JSON)에 둔다.
--   피처 정의서의 원천 칸에는 "신용평가사 응답 항목 이름"을 적는다. 원문 보관이 필요해지면 "응답 원문 JSON + 보관 기한" 테이블 1개를 추가한다.
-- ====================================================================

-- N-05-2 소득. 자영업자·프리랜서는 최근 12개월 월별 소득, 급여소득자는 월급(보너스 제외).
CREATE TABLE USER_INCOME_MONTH (
    INCOME_ID              NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    BASE_MONTH             VARCHAR2(7 CHAR)     NOT NULL,
    INCOME_KIND_CODE       VARCHAR2(20 CHAR)    NOT NULL,
    INCOME_AMT             NUMBER(15)           NOT NULL,
    INPUT_DATE             DATE                 NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    UPDATED_AT             TIMESTAMP,
    CONSTRAINT PK_USER_INCOME_MONTH PRIMARY KEY (INCOME_ID),
    CONSTRAINT UK_UIM_USER_MONTH UNIQUE (USER_ID, BASE_MONTH),
    CONSTRAINT FK_UIM_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_UIM_BASE_MONTH CHECK (REGEXP_LIKE(BASE_MONTH, '^\d{4}-(0[1-9]|1[0-2])$')),
    CONSTRAINT CK_UIM_KIND CHECK (INCOME_KIND_CODE IN ('MONTHLY_INCOME', 'SALARY')),
    CONSTRAINT CK_UIM_AMT CHECK (INCOME_AMT >= 0)
);
COMMENT ON TABLE  USER_INCOME_MONTH IS '월별 소득 (N-05-2). 점수 산출에는 자영업자·프리랜서 12개월이 모두 필요';
COMMENT ON COLUMN USER_INCOME_MONTH.BASE_MONTH IS '소득 귀속 월 (YYYY-MM). 달마다 한 행만 두고, 기준월이 바뀌면 새 달만 추가한다 (D-16). 12개월 범위는 조회할 때 기준월(가장 늦은 BASE_MONTH)로 정한다';
COMMENT ON COLUMN USER_INCOME_MONTH.INCOME_KIND_CODE IS 'MONTHLY_INCOME=월별 소득(자영업자·프리랜서), SALARY=월급(급여소득자, 연소득 = 월급×12)';
COMMENT ON COLUMN USER_INCOME_MONTH.INPUT_DATE IS '회원이 값을 입력한 날짜';

-- N-05-3 대출(기존 부채). 고정·변동 금리 칸 포함 (D-27).
CREATE TABLE USER_LOAN (
    LOAN_ID                NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    BASE_MONTH             VARCHAR2(7 CHAR)     NOT NULL,
    LOAN_TYPE_CODE         VARCHAR2(30 CHAR)    NOT NULL,
    BALANCE_AMT            NUMBER(15)           NOT NULL,
    ANNUAL_RATE_PCT        NUMBER(6,3)          NOT NULL,
    RATE_TYPE_CODE         VARCHAR2(10 CHAR)    NOT NULL,
    REMAINING_MONTHS       NUMBER(4)            NOT NULL,
    MONTHLY_PAYMENT_AMT    NUMBER(15)           NOT NULL,
    SOURCE_CODE            VARCHAR2(10 CHAR)    DEFAULT 'MANUAL' NOT NULL,
    CONSENT_ID             NUMBER(19),
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    UPDATED_AT             TIMESTAMP,
    CONSTRAINT PK_USER_LOAN PRIMARY KEY (LOAN_ID),
    CONSTRAINT FK_ULN_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_ULN_LOAN_TYPE FOREIGN KEY (LOAN_TYPE_CODE) REFERENCES DIM_LOAN_TYPE (LOAN_TYPE_CODE),
    CONSTRAINT FK_ULN_CONSENT FOREIGN KEY (CONSENT_ID) REFERENCES USER_CONSENT (CONSENT_ID),
    CONSTRAINT CK_ULN_BASE_MONTH CHECK (REGEXP_LIKE(BASE_MONTH, '^\d{4}-(0[1-9]|1[0-2])$')),
    CONSTRAINT CK_ULN_BALANCE CHECK (BALANCE_AMT >= 0),
    CONSTRAINT CK_ULN_RATE CHECK (ANNUAL_RATE_PCT BETWEEN 0 AND 20),
    CONSTRAINT CK_ULN_RATE_TYPE CHECK (RATE_TYPE_CODE IN ('FIXED', 'VARIABLE', 'UNKNOWN')),
    CONSTRAINT CK_ULN_REMAINING CHECK (REMAINING_MONTHS >= 0),
    CONSTRAINT CK_ULN_PAYMENT CHECK (MONTHLY_PAYMENT_AMT >= 0),
    CONSTRAINT CK_ULN_SOURCE CHECK (SOURCE_CODE IN ('MANUAL', 'IMPORTED')),
    -- v0.3.2 (W3) 불러온 행은 동의 ID 필수, 직접 입력은 NULL (동의 종료 시 CONSENT_ID로 지우기 위해)
    CONSTRAINT CK_ULN_CONSENT_SOURCE CHECK ((SOURCE_CODE = 'IMPORTED' AND CONSENT_ID IS NOT NULL)
                                       OR (SOURCE_CODE = 'MANUAL' AND CONSENT_ID IS NULL))
);
COMMENT ON TABLE  USER_LOAN IS '보유 대출 (N-05-3, N-16-4 보유 대출 표, N-20 DSR)';
COMMENT ON COLUMN USER_LOAN.ANNUAL_RATE_PCT IS '연 금리 (%, 8.9 = 8.9%, 법정 최고금리 20% 이하). 가상 기관 응답(비율 0.089)은 저장할 때 ×100';
COMMENT ON COLUMN USER_LOAN.RATE_TYPE_CODE IS '금리 방식 (FIXED=고정, VARIABLE=변동, UNKNOWN=불러온 자료에 없음)';
COMMENT ON COLUMN USER_LOAN.LOAN_TYPE_CODE IS '대출 종류 (불러온 대출은 가상 기관 응답의 loanTypeCode)';
COMMENT ON COLUMN USER_LOAN.MONTHLY_PAYMENT_AMT IS '월 원리금 (원, 연 원리금 = ×12로 DSR 계산). v0.2 (R1): 현재 월 원리금 한 값만 받는다 (달마다 따로 받지 않는다)';
COMMENT ON COLUMN USER_LOAN.SOURCE_CODE IS 'MANUAL=직접 입력, IMPORTED=가상 금융기관에서 불러옴. v0.3 (S1) 더미 시드: 동의 회원 대출=IMPORTED, 미동의 회원 대출=MANUAL';
COMMENT ON COLUMN USER_LOAN.CONSENT_ID IS 'v0.3.2 (W2) 불러올 때 쓴 동의 (직접 입력이면 NULL). 동의 만료·철회·탈퇴 시 이 값으로 불러온 행을 지운다';

-- N-05-4 자산.
CREATE TABLE USER_ASSET_SNAPSHOT (
    ASSET_ID               NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    BASE_MONTH             VARCHAR2(7 CHAR)     NOT NULL,
    TOTAL_ASSET_AMT        NUMBER(15)           NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    UPDATED_AT             TIMESTAMP,
    CONSTRAINT PK_USER_ASSET_SNAPSHOT PRIMARY KEY (ASSET_ID),
    CONSTRAINT UK_UAS_USER_MONTH UNIQUE (USER_ID, BASE_MONTH),
    CONSTRAINT FK_UAS_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_UAS_BASE_MONTH CHECK (REGEXP_LIKE(BASE_MONTH, '^\d{4}-(0[1-9]|1[0-2])$')),
    CONSTRAINT CK_UAS_AMT CHECK (TOTAL_ASSET_AMT >= 0)
);
COMMENT ON TABLE  USER_ASSET_SNAPSHOT IS '총자산 (N-05-4, N-16 건전성). 월 고정지출은 USER_EXPENSE_ITEM에 둔다';

-- N-05-5 지출 + N-21-3 기타 지출.
CREATE TABLE USER_EXPENSE_ITEM (
    EXPENSE_ID             NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    BASE_MONTH             VARCHAR2(7 CHAR)     NOT NULL,
    EXPENSE_GROUP_CODE     VARCHAR2(20 CHAR)    NOT NULL,
    EXPENSE_CATEGORY       VARCHAR2(30 CHAR),
    DESCRIPTION            VARCHAR2(100 CHAR),
    MONTHLY_AMT            NUMBER(15)           NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    UPDATED_AT             TIMESTAMP,
    CONSTRAINT PK_USER_EXPENSE_ITEM PRIMARY KEY (EXPENSE_ID),
    CONSTRAINT FK_UEI_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_UEI_BASE_MONTH CHECK (REGEXP_LIKE(BASE_MONTH, '^\d{4}-(0[1-9]|1[0-2])$')),
    CONSTRAINT CK_UEI_GROUP CHECK (EXPENSE_GROUP_CODE IN ('FIXED', 'INSTALLMENT', 'SUBSCRIPTION', 'OTHER')),
    CONSTRAINT CK_UEI_AMT CHECK (MONTHLY_AMT >= 0)
);
COMMENT ON TABLE  USER_EXPENSE_ITEM IS '지출 항목 (N-05-5 월 고정 지출·할부·정기결제, N-21-3 기타 지출)';
COMMENT ON COLUMN USER_EXPENSE_ITEM.EXPENSE_GROUP_CODE IS 'FIXED=월 고정 지출, INSTALLMENT=할부, SUBSCRIPTION=정기결제, OTHER=기타 지출(N-21-3)';
COMMENT ON COLUMN USER_EXPENSE_ITEM.EXPENSE_CATEGORY IS '종류 (식비, 교통, 공과금 등). 할부·정기결제처럼 화면에 종류 칸이 없으면 NULL';
COMMENT ON COLUMN USER_EXPENSE_ITEM.DESCRIPTION IS '항목 이름 (예: 휴대폰 할부금)';
COMMENT ON COLUMN USER_EXPENSE_ITEM.MONTHLY_AMT IS 'v0.2 (R1) 평균 월 지출 금액 (원, 평소 한 달에 쓰는 대표 금액을 회원이 적는다. 달마다 달라지는 항목도 평소 수준의 월 금액 하나만 받고, 12개월 값을 따로 받지 않는다)';

-- N-05-6 대안 데이터: 통신비 납부.
CREATE TABLE USER_TELECOM_PAYMENT (
    TELECOM_PAYMENT_ID     NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    BILL_MONTH             VARCHAR2(7 CHAR)     NOT NULL,
    BILLED_AMT             NUMBER(15)           NOT NULL,
    DUE_DATE               DATE                 NOT NULL,
    PAID_DATE              DATE,
    PAYMENT_STATUS_CODE    VARCHAR2(10 CHAR)    NOT NULL,
    SOURCE_CODE            VARCHAR2(10 CHAR)    DEFAULT 'IMPORTED' NOT NULL,
    CONSENT_ID             NUMBER(19),
    BASE_DATE              DATE                 NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USER_TELECOM_PAYMENT PRIMARY KEY (TELECOM_PAYMENT_ID),
    CONSTRAINT UK_UTP_USER_MONTH UNIQUE (USER_ID, BILL_MONTH),
    CONSTRAINT FK_UTP_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_UTP_CONSENT FOREIGN KEY (CONSENT_ID) REFERENCES USER_CONSENT (CONSENT_ID),
    CONSTRAINT CK_UTP_BILL_MONTH CHECK (REGEXP_LIKE(BILL_MONTH, '^\d{4}-(0[1-9]|1[0-2])$')),
    CONSTRAINT CK_UTP_AMT CHECK (BILLED_AMT >= 0),
    CONSTRAINT CK_UTP_STATUS CHECK (PAYMENT_STATUS_CODE IN ('ON_TIME', 'LATE', 'UNPAID')),
    CONSTRAINT CK_UTP_SOURCE CHECK (SOURCE_CODE IN ('MANUAL', 'IMPORTED')),
    -- v0.3.2 (W3) 불러온 행은 동의 ID 필수, 직접 입력은 NULL (동의 종료 시 CONSENT_ID로 지우기 위해)
    CONSTRAINT CK_UTP_CONSENT_SOURCE CHECK ((SOURCE_CODE = 'IMPORTED' AND CONSENT_ID IS NOT NULL)
                                       OR (SOURCE_CODE = 'MANUAL' AND CONSENT_ID IS NULL)),
    -- v0.3.1 (U3) 상태와 납부일이 서로 맞아야 한다. 공과금 표의 CK_UUP_PAID_DATE와 같은 규칙.
    CONSTRAINT CK_UTP_PAID_DATE CHECK ((PAYMENT_STATUS_CODE = 'UNPAID' AND PAID_DATE IS NULL)
                                       OR (PAYMENT_STATUS_CODE = 'ON_TIME' AND PAID_DATE IS NOT NULL AND PAID_DATE <= DUE_DATE)
                                       OR (PAYMENT_STATUS_CODE = 'LATE' AND PAID_DATE IS NOT NULL AND PAID_DATE > DUE_DATE))
);
COMMENT ON TABLE  USER_TELECOM_PAYMENT IS '통신비 청구·납부 (대안 데이터, N-05-6, N-18-1 통신비 정시 납부 기간)';
COMMENT ON COLUMN USER_TELECOM_PAYMENT.PAYMENT_STATUS_CODE IS 'v0.3.1 (U3) ON_TIME=기한 안에 납부, LATE=기한 뒤에 납부, UNPAID=기준일 현재 미납(납부일 NULL). 기관 응답의 "late + 납부일 없음"은 UNPAID로 저장한다';
COMMENT ON COLUMN USER_TELECOM_PAYMENT.PAID_DATE IS '납부일 (미납이면 NULL)';
COMMENT ON COLUMN USER_TELECOM_PAYMENT.CONSENT_ID IS '불러올 때 쓴 동의 (직접 입력이면 NULL)';
COMMENT ON COLUMN USER_TELECOM_PAYMENT.BASE_DATE IS '기관 데이터 기준일';

-- v0.2 (U1) N-05-6 대안 데이터: 공과금 납부. A팀 공과금 API 응답(통신과 같은 bills[] 형식)을 담는다. 통신비 표와 같은 구조.
CREATE TABLE USER_UTILITY_PAYMENT (
    UTILITY_PAYMENT_ID     NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    BILL_MONTH             VARCHAR2(7 CHAR)     NOT NULL,
    BILLED_AMT             NUMBER(15)           NOT NULL,
    DUE_DATE               DATE                 NOT NULL,
    PAID_DATE              DATE,
    PAYMENT_STATUS_CODE    VARCHAR2(10 CHAR)    NOT NULL,
    SOURCE_CODE            VARCHAR2(10 CHAR)    DEFAULT 'IMPORTED' NOT NULL,
    CONSENT_ID             NUMBER(19),
    BASE_DATE              DATE                 NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USER_UTILITY_PAYMENT PRIMARY KEY (UTILITY_PAYMENT_ID),
    CONSTRAINT UK_UUP_USER_MONTH UNIQUE (USER_ID, BILL_MONTH),
    CONSTRAINT FK_UUP_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_UUP_CONSENT FOREIGN KEY (CONSENT_ID) REFERENCES USER_CONSENT (CONSENT_ID),
    CONSTRAINT CK_UUP_BILL_MONTH CHECK (REGEXP_LIKE(BILL_MONTH, '^\d{4}-(0[1-9]|1[0-2])$')),
    CONSTRAINT CK_UUP_AMT CHECK (BILLED_AMT >= 0),
    CONSTRAINT CK_UUP_STATUS CHECK (PAYMENT_STATUS_CODE IN ('ON_TIME', 'LATE', 'UNPAID')),
    CONSTRAINT CK_UUP_SOURCE CHECK (SOURCE_CODE IN ('MANUAL', 'IMPORTED')),
    -- v0.3.2 (W3) 불러온 행은 동의 ID 필수, 직접 입력은 NULL (동의 종료 시 CONSENT_ID로 지우기 위해)
    CONSTRAINT CK_UUP_CONSENT_SOURCE CHECK ((SOURCE_CODE = 'IMPORTED' AND CONSENT_ID IS NOT NULL)
                                       OR (SOURCE_CODE = 'MANUAL' AND CONSENT_ID IS NULL)),
    -- v0.3.1 (U3) 상태와 납부일이 서로 맞아야 한다. 통신비 표의 CK_UTP_PAID_DATE와 같은 규칙.
    CONSTRAINT CK_UUP_PAID_DATE CHECK ((PAYMENT_STATUS_CODE = 'UNPAID' AND PAID_DATE IS NULL)
                                       OR (PAYMENT_STATUS_CODE = 'ON_TIME' AND PAID_DATE IS NOT NULL AND PAID_DATE <= DUE_DATE)
                                       OR (PAYMENT_STATUS_CODE = 'LATE' AND PAID_DATE IS NOT NULL AND PAID_DATE > DUE_DATE))
);
COMMENT ON TABLE  USER_UTILITY_PAYMENT IS 'v0.2 (U1) 공과금 청구·납부 (대안 데이터, N-05-6). 전기·가스·수도 합산 청구를 월 1행으로 받는다. 미납 개월 수 피처(utility_late_months)의 원천. v0.3.1 (U2) 이 피처는 12개월 안에서 LATE 또는 UNPAID인 달의 수(0~12, 학습 데이터 실제 분포 0~5)다. 학습 데이터의 utility_late(기한까지 내지 않은 달)와 같은 정의';
COMMENT ON COLUMN USER_UTILITY_PAYMENT.BILLED_AMT IS 'v0.3 청구액 (원, 전기·가스·수도를 합친 한 달 금액)';
COMMENT ON COLUMN USER_UTILITY_PAYMENT.PAYMENT_STATUS_CODE IS 'v0.3.1 (U3) ON_TIME=기한 안에 납부, LATE=기한 뒤에 납부, UNPAID=기준일 현재 미납(납부일 NULL). 통신비 표와 같은 값·규칙. 기관 응답의 "late + 납부일 없음"은 UNPAID로 저장한다';
COMMENT ON COLUMN USER_UTILITY_PAYMENT.PAID_DATE IS '납부일 (미납이면 NULL)';
COMMENT ON COLUMN USER_UTILITY_PAYMENT.CONSENT_ID IS '불러올 때 쓴 동의 (직접 입력이면 NULL)';
COMMENT ON COLUMN USER_UTILITY_PAYMENT.BASE_DATE IS '기관 데이터 기준일';

-- N-05-6 대안 데이터: 간편결제 이용.
CREATE TABLE USER_EASYPAY_USAGE (
    EASYPAY_USAGE_ID       NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    BASE_MONTH             VARCHAR2(7 CHAR)     NOT NULL,
    OBSERVATION_STATUS_CODE VARCHAR2(15 CHAR)   NOT NULL,
    PAYMENT_COUNT          NUMBER(6),
    PAYMENT_AMT            NUMBER(15),
    ACTIVE_DAYS            NUMBER(2),
    SOURCE_CODE            VARCHAR2(10 CHAR)    DEFAULT 'IMPORTED' NOT NULL,
    CONSENT_ID             NUMBER(19),
    BASE_DATE              DATE                 NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USER_EASYPAY_USAGE PRIMARY KEY (EASYPAY_USAGE_ID),
    CONSTRAINT UK_UEU_USER_MONTH UNIQUE (USER_ID, BASE_MONTH),
    CONSTRAINT FK_UEU_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_UEU_CONSENT FOREIGN KEY (CONSENT_ID) REFERENCES USER_CONSENT (CONSENT_ID),
    CONSTRAINT CK_UEU_BASE_MONTH CHECK (REGEXP_LIKE(BASE_MONTH, '^\d{4}-(0[1-9]|1[0-2])$')),
    CONSTRAINT CK_UEU_OBS CHECK (OBSERVATION_STATUS_CODE IN ('OBSERVED', 'NO_ACTIVITY', 'MISSING')),
    CONSTRAINT CK_UEU_VALUES CHECK (
        (OBSERVATION_STATUS_CODE = 'MISSING' AND PAYMENT_COUNT IS NULL AND PAYMENT_AMT IS NULL AND ACTIVE_DAYS IS NULL)
        OR (OBSERVATION_STATUS_CODE = 'NO_ACTIVITY'
            AND PAYMENT_COUNT IS NOT NULL AND PAYMENT_AMT IS NOT NULL AND ACTIVE_DAYS IS NOT NULL
            AND PAYMENT_COUNT = 0 AND PAYMENT_AMT = 0 AND ACTIVE_DAYS = 0)
        OR (OBSERVATION_STATUS_CODE = 'OBSERVED'
            AND PAYMENT_COUNT IS NOT NULL AND PAYMENT_AMT IS NOT NULL AND ACTIVE_DAYS IS NOT NULL
            AND PAYMENT_COUNT > 0 AND PAYMENT_AMT > 0
            AND ACTIVE_DAYS BETWEEN 1 AND 31 AND ACTIVE_DAYS <= PAYMENT_COUNT)),
    CONSTRAINT CK_UEU_SOURCE CHECK (SOURCE_CODE IN ('MANUAL', 'IMPORTED')),
    -- v0.3.2 (W3) 불러온 행은 동의 ID 필수, 직접 입력은 NULL (동의 종료 시 CONSENT_ID로 지우기 위해)
    CONSTRAINT CK_UEU_CONSENT_SOURCE CHECK ((SOURCE_CODE = 'IMPORTED' AND CONSENT_ID IS NOT NULL)
                                       OR (SOURCE_CODE = 'MANUAL' AND CONSENT_ID IS NULL))
);
COMMENT ON TABLE  USER_EASYPAY_USAGE IS '간편결제 월 이용 (대안 데이터, N-05-6, N-18 간편결제 월 이용 건수, N-21-8). 지출 합계에는 넣지 않는다';
COMMENT ON COLUMN USER_EASYPAY_USAGE.OBSERVATION_STATUS_CODE IS 'OBSERVED=이용 있음, NO_ACTIVITY=이용 0회, MISSING=미수집(건수·금액 NULL)';

-- N-05-6 대안 데이터: 국민연금·건강보험료 납부 (명세의 신규 테이블).
CREATE TABLE USER_SOCIAL_INSURANCE_PAYMENT (
    SI_PAYMENT_ID          NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    INSURANCE_TYPE_CODE    VARCHAR2(20 CHAR)    NOT NULL,
    BASE_MONTH             VARCHAR2(7 CHAR)     NOT NULL,
    COVERAGE_STATUS_CODE   VARCHAR2(15 CHAR)    NOT NULL,
    PAYER_TYPE_CODE        VARCHAR2(15 CHAR)    NOT NULL,
    BILLED_AMT             NUMBER(15),
    INDIVIDUAL_AMT         NUMBER(15),
    PAID_AMT               NUMBER(15),
    DUE_DATE               DATE,
    PAID_DATE              DATE,
    PAYMENT_STATUS_CODE    VARCHAR2(20 CHAR)    NOT NULL,
    SOURCE_CODE            VARCHAR2(10 CHAR)    DEFAULT 'IMPORTED' NOT NULL,
    CONSENT_ID             NUMBER(19),
    BASE_DATE              DATE                 NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USER_SOCIAL_INSURANCE_PAYMENT PRIMARY KEY (SI_PAYMENT_ID),
    CONSTRAINT UK_USI_USER_TYPE_MONTH UNIQUE (USER_ID, INSURANCE_TYPE_CODE, BASE_MONTH),
    CONSTRAINT FK_USI_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_USI_CONSENT FOREIGN KEY (CONSENT_ID) REFERENCES USER_CONSENT (CONSENT_ID),
    CONSTRAINT CK_USI_TYPE CHECK (INSURANCE_TYPE_CODE IN ('NATIONAL_PENSION', 'HEALTH_INSURANCE')),
    CONSTRAINT CK_USI_BASE_MONTH CHECK (REGEXP_LIKE(BASE_MONTH, '^\d{4}-(0[1-9]|1[0-2])$')),
    CONSTRAINT CK_USI_COVERAGE CHECK (COVERAGE_STATUS_CODE IN ('COVERED', 'EXEMPT', 'DEPENDENT', 'NOT_COVERED', 'UNKNOWN')),
    CONSTRAINT CK_USI_PAYER CHECK (PAYER_TYPE_CODE IN ('WORKPLACE', 'REGIONAL', 'VOLUNTARY', 'HOUSEHOLD', 'UNKNOWN')),
    CONSTRAINT CK_USI_STATUS CHECK (PAYMENT_STATUS_CODE IN ('ON_TIME', 'LATE', 'PARTIAL', 'UNPAID', 'NOT_DUE', 'NOT_APPLICABLE', 'UNKNOWN')),
    CONSTRAINT CK_USI_AMT_NONNEG CHECK (BILLED_AMT >= 0 AND INDIVIDUAL_AMT >= 0 AND PAID_AMT >= 0),
    CONSTRAINT CK_USI_AMT_ORDER CHECK (PAID_AMT <= INDIVIDUAL_AMT AND INDIVIDUAL_AMT <= BILLED_AMT),
    CONSTRAINT CK_USI_SOURCE CHECK (SOURCE_CODE IN ('MANUAL', 'IMPORTED')),
    -- v0.3.2 (W3) 불러온 행은 동의 ID 필수, 직접 입력은 NULL (동의 종료 시 CONSENT_ID로 지우기 위해)
    CONSTRAINT CK_USI_CONSENT_SOURCE CHECK ((SOURCE_CODE = 'IMPORTED' AND CONSENT_ID IS NOT NULL)
                                       OR (SOURCE_CODE = 'MANUAL' AND CONSENT_ID IS NULL))
);
COMMENT ON TABLE  USER_SOCIAL_INSURANCE_PAYMENT IS '국민연금·건강보험료 납부 (대안 데이터, N-05-6)';
COMMENT ON COLUMN USER_SOCIAL_INSURANCE_PAYMENT.BILLED_AMT IS '고지된 총 보험료 (사업장 가입자는 사용자 부담분 포함, 납부 의무 없으면 NULL)';
COMMENT ON COLUMN USER_SOCIAL_INSURANCE_PAYMENT.INDIVIDUAL_AMT IS '본인 부담 보험료 (납부 의무 없으면 NULL)';
COMMENT ON COLUMN USER_SOCIAL_INSURANCE_PAYMENT.DUE_DATE IS '납부기한 (납부 의무 없으면 NULL)';
COMMENT ON COLUMN USER_SOCIAL_INSURANCE_PAYMENT.PAID_DATE IS '납부일 (내지 않았으면 NULL)';

-- N-12-1·N-18-1 CB 프로필 (가상 신용평가사 + 카드 이용). 시뮬레이터 입력 값의 출처.
CREATE TABLE USER_CREDIT_PROFILE (
    CREDIT_PROFILE_ID      NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    BASE_DATE              DATE                 NOT NULL,
    CB_AVAILABLE_YN        CHAR(1)              NOT NULL,
    CB_GRADE               NUMBER(2),
    CREDIT_HISTORY_DAYS    NUMBER(6),
    RECENT_DELINQ_YN       CHAR(1),
    DELINQ_COUNT_12M       NUMBER(3),
    MAX_DELINQ_DAYS_3M     NUMBER(4),
    LOAN_COUNT             NUMBER(3),
    LOAN_BALANCE_AMT       NUMBER(15),
    NEW_LOAN_COUNT_3M      NUMBER(3),
    CARD_LIMIT_AMT         NUMBER(15),
    CARD_MONTHLY_SPEND_AMT NUMBER(15),
    CARD_UTIL_PCT          NUMBER(6,2),
    CASH_ADVANCE_MONTHS    NUMBER(3),
    PRIVATE_LENDER_LOAN_BALANCE_AMT NUMBER(15),
    SOURCE_CODE            VARCHAR2(10 CHAR)    DEFAULT 'IMPORTED' NOT NULL,
    CONSENT_ID             NUMBER(19),
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USER_CREDIT_PROFILE PRIMARY KEY (CREDIT_PROFILE_ID),
    CONSTRAINT UK_UCP_USER_DATE UNIQUE (USER_ID, BASE_DATE),
    CONSTRAINT FK_UCP_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_UCP_CONSENT FOREIGN KEY (CONSENT_ID) REFERENCES USER_CONSENT (CONSENT_ID),
    CONSTRAINT CK_UCP_CB_AVAILABLE CHECK (CB_AVAILABLE_YN IN ('Y', 'N')),
    CONSTRAINT CK_UCP_CB_GRADE CHECK ((CB_AVAILABLE_YN = 'Y' AND CB_GRADE IS NOT NULL AND CB_GRADE BETWEEN 1 AND 10) OR (CB_AVAILABLE_YN = 'N' AND CB_GRADE IS NULL)),
    CONSTRAINT CK_UCP_LOAN_BALANCE CHECK (LOAN_BALANCE_AMT >= 0),
    CONSTRAINT CK_UCP_PRIVATE_LENDER CHECK (PRIVATE_LENDER_LOAN_BALANCE_AMT >= 0),
    CONSTRAINT CK_UCP_RECENT_DELINQ CHECK (RECENT_DELINQ_YN IN ('Y', 'N')),
    CONSTRAINT CK_UCP_SOURCE CHECK (SOURCE_CODE IN ('MANUAL', 'IMPORTED')),
    -- v0.3.2 (W3) 불러온 행은 동의 ID 필수, 직접 입력은 NULL (동의 종료 시 CONSENT_ID로 지우기 위해)
    CONSTRAINT CK_UCP_CONSENT_SOURCE CHECK ((SOURCE_CODE = 'IMPORTED' AND CONSENT_ID IS NOT NULL)
                                       OR (SOURCE_CODE = 'MANUAL' AND CONSENT_ID IS NULL))
);
COMMENT ON TABLE  USER_CREDIT_PROFILE IS 'CB 프로필 (N-12-2 입력, N-18-1 연체 횟수·신규 대출·카드 한도·카드 사용액·현금서비스 기간). v0.2 (R2): 신용평가사 응답 원문(207개 항목)은 저장하지 않고 요약 열만 둔다. 모델에 넘긴 값은 ASSESSMENT.FEATURE_SNAPSHOT에 있다';
COMMENT ON COLUMN USER_CREDIT_PROFILE.CB_GRADE IS '교육용 CB 등급 1~10 (공식 점수 아님, 서비스 3등급과 별개. 산출 불가면 NULL)';
COMMENT ON COLUMN USER_CREDIT_PROFILE.DELINQ_COUNT_12M IS '최근 1년 30일 이상 연체 건수 (신용이력 없으면 NULL, 0과 구분)';
COMMENT ON COLUMN USER_CREDIT_PROFILE.LOAN_BALANCE_AMT IS '신용평가사 기준 미상환 대출 총액 (원, USER_LOAN 합계와 출처·기준일이 다를 수 있음)';
COMMENT ON COLUMN USER_CREDIT_PROFILE.CARD_UTIL_PCT IS '카드 한도소진율 (%, 최근 이용 없으면 NULL)';
COMMENT ON COLUMN USER_CREDIT_PROFILE.CASH_ADVANCE_MONTHS IS '현금서비스 이용 기간 (개월)';
COMMENT ON COLUMN USER_CREDIT_PROFILE.PRIVATE_LENDER_LOAN_BALANCE_AMT IS '대부업 대출 잔액 (원, N-18-3). UI 입력 화면의 별도 칸으로 받는다';


-- ====================================================================
-- 4. 점수·SHAP (N-12, N-13, N-14, N-18, N-25, N-26, N-31)
-- ====================================================================

-- --------------------------------------------------------------------
-- 4-A. 버전 관리 표 (v0.2 B1·B2·P1·P2)
-- "이 점수는 어떤 기준표·피처 정의·데이터·모델로 만들었나"에 답하기 위한 장부.
-- --------------------------------------------------------------------

-- v0.2 (B2·P2) 피처 정의서 버전. 피처 정의서(FP-132)가 바뀔 때마다 새 버전을 만든다.
CREATE TABLE FEATURE_SET_VERSION (
    FEATURE_SET_VERSION    VARCHAR2(30 CHAR)    NOT NULL,
    STATUS_CODE            VARCHAR2(10 CHAR)    DEFAULT 'DRAFT' NOT NULL,
    NOTE                   VARCHAR2(500 CHAR),
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_FEATURE_SET_VERSION PRIMARY KEY (FEATURE_SET_VERSION),
    CONSTRAINT CK_FSV_STATUS CHECK (STATUS_CODE IN ('DRAFT', 'CONFIRMED', 'RETIRED'))
);
COMMENT ON TABLE  FEATURE_SET_VERSION IS '피처 정의서 버전 (DRAFT=작성 중, CONFIRMED=확정, RETIRED=사용 종료). 피처 정의서 v1이 확정되면 FS-V1 같은 이름으로 추가';

-- v0.2 (B2) 피처 사전. 항목 이름·단위·대안 여부·시뮬레이터 가능 여부를 여기서 한 번만 관리한다.
-- 내용은 재욱의 피처 정의서가 나온 뒤 채운다 (지금은 빈 표).
CREATE TABLE DIM_FEATURE (
    FEATURE_SET_VERSION    VARCHAR2(30 CHAR)    NOT NULL,
    FEATURE_CODE           VARCHAR2(50 CHAR)    NOT NULL,
    FEATURE_NAME           VARCHAR2(100 CHAR)   NOT NULL,
    UNIT_NAME              VARCHAR2(20 CHAR),
    ALTERNATIVE_YN         CHAR(1)              NOT NULL,
    SIMULATABLE_YN         CHAR(1)              NOT NULL,
    DISPLAY_ORDER          NUMBER(4),
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_DIM_FEATURE PRIMARY KEY (FEATURE_SET_VERSION, FEATURE_CODE),
    CONSTRAINT FK_DFT_FEATURE_SET FOREIGN KEY (FEATURE_SET_VERSION) REFERENCES FEATURE_SET_VERSION (FEATURE_SET_VERSION),
    CONSTRAINT CK_DFT_ALT_YN CHECK (ALTERNATIVE_YN IN ('Y', 'N')),
    CONSTRAINT CK_DFT_SIM_YN CHECK (SIMULATABLE_YN IN ('Y', 'N'))
);
COMMENT ON TABLE  DIM_FEATURE IS '피처 사전 (피처 정의서 버전별 항목 목록). ASSESSMENT_FACTOR가 코드로 이 표를 가리킨다';
COMMENT ON COLUMN DIM_FEATURE.FEATURE_CODE IS '피처 코드 (모델·API·화면이 같은 코드를 쓴다)';
COMMENT ON COLUMN DIM_FEATURE.FEATURE_NAME IS '화면에 보이는 항목 이름';
COMMENT ON COLUMN DIM_FEATURE.UNIT_NAME IS '단위 (원, 개월, 건, % 등). 값에 단위가 없으면 NULL';
COMMENT ON COLUMN DIM_FEATURE.ALTERNATIVE_YN IS '대안 데이터 항목 여부 ([대안] 표시)';
COMMENT ON COLUMN DIM_FEATURE.SIMULATABLE_YN IS '시뮬레이터에서 바꿀 수 있는 항목 여부 (N-18-8)';

-- v0.2 (B1) 등급 구간 버전. 경계 값이 바뀌어도 과거 평가를 같은 기준으로 다시 설명할 수 있다.
CREATE TABLE SCORE_CUTOFF_VERSION (
    CUTOFF_VERSION         VARCHAR2(30 CHAR)    NOT NULL,
    STATUS_CODE            VARCHAR2(10 CHAR)    DEFAULT 'DRAFT' NOT NULL,
    NOTE                   VARCHAR2(500 CHAR),
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    ACTIVATED_AT           TIMESTAMP,
    CONSTRAINT PK_SCORE_CUTOFF_VERSION PRIMARY KEY (CUTOFF_VERSION),
    CONSTRAINT CK_SCV_STATUS CHECK (STATUS_CODE IN ('DRAFT', 'ACTIVE', 'RETIRED')),
    CONSTRAINT CK_SCV_ACTIVATED CHECK (STATUS_CODE <> 'ACTIVE' OR ACTIVATED_AT IS NOT NULL)
);
COMMENT ON TABLE  SCORE_CUTOFF_VERSION IS '등급 구간 버전 (ACTIVE는 동시에 1개만. FastAPI 응답의 cutoffVersion 값과 이 표의 CUTOFF_VERSION이 같아야 한다)';

-- N-04-4·N-12-6 등급 구간. 경계 665·780은 시연용 임시값 (D-01). v0.2: 버전별로 둔다 (B1).
CREATE TABLE SCORE_GRADE_BAND (
    CUTOFF_VERSION         VARCHAR2(30 CHAR)    NOT NULL,
    GRADE_BAND_CODE        VARCHAR2(20 CHAR)    NOT NULL,
    MIN_SCORE              NUMBER(4)            NOT NULL,
    MAX_SCORE              NUMBER(4)            NOT NULL,
    DISPLAY_ORDER          NUMBER(2)            NOT NULL,
    CONSTRAINT PK_SCORE_GRADE_BAND PRIMARY KEY (CUTOFF_VERSION, GRADE_BAND_CODE),
    CONSTRAINT FK_SGB_CUTOFF FOREIGN KEY (CUTOFF_VERSION) REFERENCES SCORE_CUTOFF_VERSION (CUTOFF_VERSION),
    CONSTRAINT CK_SGB_CODE CHECK (GRADE_BAND_CODE IN ('GOOD', 'STANDARD', 'CAUTION')),
    CONSTRAINT CK_SGB_RANGE CHECK (MIN_SCORE BETWEEN 0 AND 1000 AND MAX_SCORE BETWEEN 0 AND 1000 AND MIN_SCORE <= MAX_SCORE)
);
COMMENT ON TABLE  SCORE_GRADE_BAND IS '3등급 구간 (버전별. CUT-0.1: CAUTION 0~664, STANDARD 665~779, GOOD 780~1000, 시연용 임시값이라 모형 학습 후 새 버전으로 추가). 구간이 겹치거나 비는지는 입력할 때 앱에서 검사한다';

-- v0.2 (P1) 데이터셋 버전. 원본(RAW)은 고치지 않고, 정제하면 새 버전(PROCESSED)을 만든다.
CREATE TABLE DATASET_VERSION (
    DATASET_VERSION_ID        NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    DATASET_NAME              VARCHAR2(50 CHAR)    NOT NULL,
    VERSION_NO                NUMBER(4)            NOT NULL,
    STAGE_CODE                VARCHAR2(10 CHAR)    NOT NULL,
    PARENT_DATASET_VERSION_ID NUMBER(19),
    SOURCE_DESC               VARCHAR2(500 CHAR)   NOT NULL,
    COLLECTION_BASIS          VARCHAR2(500 CHAR),
    FILE_URI                  VARCHAR2(500 CHAR)   NOT NULL,
    FILE_SHA256               VARCHAR2(64 CHAR)    NOT NULL,
    ROW_COUNT                 NUMBER(12)           NOT NULL,
    COLUMN_COUNT              NUMBER(5)            NOT NULL,
    NOTE                      VARCHAR2(500 CHAR),
    CREATED_BY_NAME           VARCHAR2(50 CHAR)    NOT NULL,
    CREATED_AT                TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_DATASET_VERSION PRIMARY KEY (DATASET_VERSION_ID),
    CONSTRAINT UK_DSV_NAME_VERSION UNIQUE (DATASET_NAME, VERSION_NO),
    CONSTRAINT FK_DSV_PARENT FOREIGN KEY (PARENT_DATASET_VERSION_ID) REFERENCES DATASET_VERSION (DATASET_VERSION_ID),
    CONSTRAINT CK_DSV_STAGE CHECK (STAGE_CODE IN ('RAW', 'PROCESSED')),
    CONSTRAINT CK_DSV_PARENT CHECK ((STAGE_CODE = 'RAW' AND PARENT_DATASET_VERSION_ID IS NULL)
                                    OR (STAGE_CODE = 'PROCESSED' AND PARENT_DATASET_VERSION_ID IS NOT NULL)),
    CONSTRAINT CK_DSV_BASIS CHECK (STAGE_CODE <> 'RAW' OR COLLECTION_BASIS IS NOT NULL),
    CONSTRAINT CK_DSV_SHA256 CHECK (REGEXP_LIKE(FILE_SHA256, '^[0-9a-f]{64}$')),
    CONSTRAINT CK_DSV_COUNTS CHECK (ROW_COUNT >= 0 AND COLUMN_COUNT >= 1)
);
COMMENT ON TABLE  DATASET_VERSION IS '학습·분석 데이터셋 버전 장부 (데이터 계보). ASSESSMENT.DATASET_CODE(서비스/합성 집단 구분)와는 다른 개념';
COMMENT ON COLUMN DATASET_VERSION.STAGE_CODE IS 'RAW=원본(수정 금지, 읽기 전용으로 보관), PROCESSED=정제본';
COMMENT ON COLUMN DATASET_VERSION.PARENT_DATASET_VERSION_ID IS '정제본이 어느 버전에서 나왔는지 (원본은 NULL)';
COMMENT ON COLUMN DATASET_VERSION.SOURCE_DESC IS '데이터 출처 (기관·데이터명·내려받은 날짜 등)';
COMMENT ON COLUMN DATASET_VERSION.COLLECTION_BASIS IS '수집 근거와 이용 조건 (라이선스, 법적·윤리적 기준). 원본은 필수';
COMMENT ON COLUMN DATASET_VERSION.FILE_URI IS '파일 위치 (경로 또는 저장소 키). 파일 자체는 DB 밖에 둔다';
COMMENT ON COLUMN DATASET_VERSION.FILE_SHA256 IS '파일 지문(SHA-256, 소문자 16진수 64자). 한 글자만 바뀌어도 값이 달라져 몰래 수정한 파일을 찾을 수 있다';

-- v0.2 (P1) 정제 로그. 어떤 규칙으로 몇 행이 바뀌었는지 남긴다.
CREATE TABLE DATASET_CLEANING_LOG (
    LOG_ID                 NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    DATASET_VERSION_ID     NUMBER(19)           NOT NULL,
    STEP_NO                NUMBER(3)            NOT NULL,
    RULE_CODE              VARCHAR2(40 CHAR)    NOT NULL,
    RULE_DESC              VARCHAR2(500 CHAR)   NOT NULL,
    ROWS_BEFORE            NUMBER(12)           NOT NULL,
    ROWS_AFTER             NUMBER(12)           NOT NULL,
    ROWS_AFFECTED          NUMBER(12)           NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_DATASET_CLEANING_LOG PRIMARY KEY (LOG_ID),
    CONSTRAINT UK_DCL_STEP UNIQUE (DATASET_VERSION_ID, STEP_NO),
    CONSTRAINT FK_DCL_DATASET FOREIGN KEY (DATASET_VERSION_ID) REFERENCES DATASET_VERSION (DATASET_VERSION_ID),
    CONSTRAINT CK_DCL_ROWS CHECK (ROWS_BEFORE >= 0 AND ROWS_AFTER >= 0 AND ROWS_AFFECTED >= 0)
);
COMMENT ON TABLE  DATASET_CLEANING_LOG IS '정제 단계별 기록 (예: 3단계 소득 단위 오류 제거, 126행). 이력이라 삭제 연쇄(CASCADE)를 두지 않는다';
COMMENT ON COLUMN DATASET_CLEANING_LOG.DATASET_VERSION_ID IS '이 단계를 거쳐 만들어진 (결과) 데이터셋 버전';
COMMENT ON COLUMN DATASET_CLEANING_LOG.ROWS_AFFECTED IS '이 단계에서 제거·수정된 행 수 (값만 바꾸는 단계는 ROWS_BEFORE와 ROWS_AFTER가 같을 수 있다)';

-- v0.2 (P2) 모델 등록부. 모델 한 묶음(MODEL_VERSION)의 상태를 관리한다. 서비스에는 ACTIVE 1개만 쓴다 (투표 D8).
CREATE TABLE MODEL_REGISTRY (
    MODEL_VERSION          VARCHAR2(50 CHAR)    NOT NULL,
    ALGORITHM_NAME         VARCHAR2(50 CHAR)    NOT NULL,
    FEATURE_SET_VERSION    VARCHAR2(30 CHAR)    NOT NULL,
    STATUS_CODE            VARCHAR2(10 CHAR)    DEFAULT 'CANDIDATE' NOT NULL,
    TRAINED_AT             TIMESTAMP,
    ACTIVATED_AT           TIMESTAMP,
    NOTE                   VARCHAR2(500 CHAR),
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_MODEL_REGISTRY PRIMARY KEY (MODEL_VERSION),
    CONSTRAINT FK_MRG_FEATURE_SET FOREIGN KEY (FEATURE_SET_VERSION) REFERENCES FEATURE_SET_VERSION (FEATURE_SET_VERSION),
    CONSTRAINT CK_MRG_STATUS CHECK (STATUS_CODE IN ('CANDIDATE', 'ACTIVE', 'RETIRED')),
    CONSTRAINT CK_MRG_ACTIVATED CHECK (STATUS_CODE <> 'ACTIVE' OR ACTIVATED_AT IS NOT NULL)
);
COMMENT ON TABLE  MODEL_REGISTRY IS '모델 등록부 (CANDIDATE=후보, ACTIVE=서비스 사용 중(동시에 1개), RETIRED=사용 종료). 같은 이름으로 파일만 바꾸지 말고 새 MODEL_VERSION을 등록한다';
COMMENT ON COLUMN MODEL_REGISTRY.MODEL_VERSION IS 'ASSESSMENT.MODEL_VERSION과 같은 값. FastAPI 응답의 modelVersion과도 일치해야 한다';

-- v0.2 (P2) 모델 파일. 한 MODEL_VERSION 안에 모델이 여러 개일 수 있어(기존/대안, 집단별) 파일 단위로 둔다.
CREATE TABLE MODEL_ARTIFACT (
    ARTIFACT_ID              NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    MODEL_VERSION            VARCHAR2(50 CHAR)    NOT NULL,
    ARTIFACT_NAME            VARCHAR2(50 CHAR)    NOT NULL,
    FILE_URI                 VARCHAR2(500 CHAR)   NOT NULL,
    FILE_SHA256              VARCHAR2(64 CHAR)    NOT NULL,
    TRAIN_DATASET_VERSION_ID NUMBER(19)           NOT NULL,
    AUC_VALID                NUMBER(5,4),
    AUC_TEST                 NUMBER(5,4),
    METRICS_JSON             CLOB,
    CREATED_AT               TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_MODEL_ARTIFACT PRIMARY KEY (ARTIFACT_ID),
    CONSTRAINT UK_MAF_NAME UNIQUE (MODEL_VERSION, ARTIFACT_NAME),
    CONSTRAINT FK_MAF_MODEL FOREIGN KEY (MODEL_VERSION) REFERENCES MODEL_REGISTRY (MODEL_VERSION),
    CONSTRAINT FK_MAF_DATASET FOREIGN KEY (TRAIN_DATASET_VERSION_ID) REFERENCES DATASET_VERSION (DATASET_VERSION_ID),
    CONSTRAINT CK_MAF_SHA256 CHECK (REGEXP_LIKE(FILE_SHA256, '^[0-9a-f]{64}$')),
    CONSTRAINT CK_MAF_AUC CHECK ((AUC_VALID IS NULL OR AUC_VALID BETWEEN 0 AND 1) AND (AUC_TEST IS NULL OR AUC_TEST BETWEEN 0 AND 1)),
    CONSTRAINT CK_MAF_METRICS_JSON CHECK (METRICS_JSON IS JSON)
);
COMMENT ON TABLE  MODEL_ARTIFACT IS '모델 파일 장부 (파일 위치·지문·학습 데이터셋 버전·성능). 학습에는 PROCESSED 데이터셋을 쓴다(앱에서 검사)';
COMMENT ON COLUMN MODEL_ARTIFACT.ARTIFACT_NAME IS '모델 이름 (예: alt_legacy, trad_thinfile)';
COMMENT ON COLUMN MODEL_ARTIFACT.AUC_TEST IS '시험(TEST) 데이터 AUC. 관리자 화면 성능은 이 기준으로 보여 준다';
COMMENT ON COLUMN MODEL_ARTIFACT.METRICS_JSON IS '그 밖의 성능 지표 JSON (KS, Gini 등)';

-- N-12-2 평가 1건 (기존·대안 두 모델). 서비스 회원과 관리자 비교용 합성 고객을 함께 담는다.
CREATE TABLE ASSESSMENT (
    ASSESSMENT_ID          NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    REQUEST_ID             VARCHAR2(36 CHAR)    NOT NULL,
    USER_ID                NUMBER(19),
    DATASET_CODE           VARCHAR2(20 CHAR)    NOT NULL,
    SYNTHETIC_CUSTOMER_ID  VARCHAR2(30 CHAR),
    WORKER_TYPE_CODE       VARCHAR2(20 CHAR)    NOT NULL,
    AGE_BAND_CODE          VARCHAR2(10 CHAR)    NOT NULL,
    INPUT_BASE_MONTH       VARCHAR2(7 CHAR),
    MODEL_VERSION          VARCHAR2(50 CHAR)    NOT NULL,
    FEATURE_SET_VERSION    VARCHAR2(30 CHAR),
    CUTOFF_VERSION         VARCHAR2(30 CHAR),
    GRADE_STATUS_CODE      VARCHAR2(20 CHAR)    NOT NULL,
    NOT_SCORABLE_REASON_CODE VARCHAR2(30 CHAR),
    TRAD_SCORABLE_YN       CHAR(1)              NOT NULL,
    TRAD_SCORE             NUMBER(4),
    TRAD_GRADE_BAND_CODE   VARCHAR2(20 CHAR),
    TRAD_DEFAULT_PROB      NUMBER(7,6),
    ALT_SCORABLE_YN        CHAR(1)              NOT NULL,
    ALT_SCORE              NUMBER(4),
    ALT_GRADE_BAND_CODE    VARCHAR2(20 CHAR),
    ALT_DEFAULT_PROB       NUMBER(7,6),
    SHAP_BASE_SCORE        NUMBER(4),
    FEATURE_SNAPSHOT       CLOB,
    ACTUAL_DEFAULT_YN      CHAR(1),
    LABEL_TYPE_CODE        VARCHAR2(20 CHAR),
    DATA_SPLIT_CODE        VARCHAR2(10 CHAR),
    EVAL_ELIGIBLE_YN       CHAR(1)              DEFAULT 'N' NOT NULL,
    AI_SUMMARY             VARCHAR2(1000 CHAR),
    ASSESSED_AT            TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_ASSESSMENT PRIMARY KEY (ASSESSMENT_ID),
    CONSTRAINT UK_ASM_REQUEST_ID UNIQUE (REQUEST_ID),
    CONSTRAINT UK_ASM_ID_FSV UNIQUE (ASSESSMENT_ID, FEATURE_SET_VERSION),
    CONSTRAINT FK_ASM_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_ASM_WORKER_TYPE FOREIGN KEY (WORKER_TYPE_CODE) REFERENCES DIM_WORKER_TYPE (WORKER_TYPE_CODE),
    CONSTRAINT FK_ASM_MODEL FOREIGN KEY (MODEL_VERSION) REFERENCES MODEL_REGISTRY (MODEL_VERSION),
    CONSTRAINT FK_ASM_FEATURE_SET FOREIGN KEY (FEATURE_SET_VERSION) REFERENCES FEATURE_SET_VERSION (FEATURE_SET_VERSION),
    CONSTRAINT FK_ASM_CUTOFF FOREIGN KEY (CUTOFF_VERSION) REFERENCES SCORE_CUTOFF_VERSION (CUTOFF_VERSION),
    CONSTRAINT FK_ASM_TRAD_GRADE FOREIGN KEY (CUTOFF_VERSION, TRAD_GRADE_BAND_CODE) REFERENCES SCORE_GRADE_BAND (CUTOFF_VERSION, GRADE_BAND_CODE),
    CONSTRAINT FK_ASM_ALT_GRADE FOREIGN KEY (CUTOFF_VERSION, ALT_GRADE_BAND_CODE) REFERENCES SCORE_GRADE_BAND (CUTOFF_VERSION, GRADE_BAND_CODE),
    CONSTRAINT FK_ASM_REASON FOREIGN KEY (NOT_SCORABLE_REASON_CODE) REFERENCES DIM_NOT_SCORABLE_REASON (REASON_CODE),
    CONSTRAINT CK_ASM_REQUEST_ID CHECK (REGEXP_LIKE(REQUEST_ID, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')),
    CONSTRAINT CK_ASM_DATASET CHECK (DATASET_CODE IN ('SERVICE', 'SYNTH_LEGACY', 'SYNTH_THINFILE')),
    CONSTRAINT CK_ASM_SUBJECT CHECK ((DATASET_CODE = 'SERVICE' AND USER_ID IS NOT NULL AND SYNTHETIC_CUSTOMER_ID IS NULL)
                                     OR (DATASET_CODE <> 'SERVICE' AND USER_ID IS NULL AND SYNTHETIC_CUSTOMER_ID IS NOT NULL)),
    CONSTRAINT CK_ASM_AGE_BAND CHECK (AGE_BAND_CODE IN ('20S', '30S', '40S', '50_PLUS')),
    CONSTRAINT CK_ASM_INPUT_BASE_MONTH CHECK ((DATASET_CODE = 'SERVICE' AND INPUT_BASE_MONTH IS NOT NULL AND REGEXP_LIKE(INPUT_BASE_MONTH, '^\d{4}-(0[1-9]|1[0-2])$'))
                                          OR (DATASET_CODE <> 'SERVICE' AND INPUT_BASE_MONTH IS NULL)),
    CONSTRAINT CK_ASM_STATUS CHECK (GRADE_STATUS_CODE IN ('SCORED', 'NOT_SCORABLE')),
    CONSTRAINT CK_ASM_REASON CHECK ((GRADE_STATUS_CODE = 'SCORED' AND NOT_SCORABLE_REASON_CODE IS NULL)
                                    OR (GRADE_STATUS_CODE = 'NOT_SCORABLE' AND NOT_SCORABLE_REASON_CODE IS NOT NULL)),
    CONSTRAINT CK_ASM_TRAD_YN CHECK (TRAD_SCORABLE_YN IN ('Y', 'N')),
    CONSTRAINT CK_ASM_ALT_YN CHECK (ALT_SCORABLE_YN IN ('Y', 'N')),
    CONSTRAINT CK_ASM_TRAD_VALUES CHECK ((TRAD_SCORABLE_YN = 'Y' AND TRAD_SCORE IS NOT NULL AND TRAD_SCORE BETWEEN 0 AND 1000 AND TRAD_GRADE_BAND_CODE IS NOT NULL
                                          AND TRAD_DEFAULT_PROB IS NOT NULL AND TRAD_DEFAULT_PROB BETWEEN 0 AND 1)
                                         OR (TRAD_SCORABLE_YN = 'N' AND TRAD_SCORE IS NULL AND TRAD_GRADE_BAND_CODE IS NULL AND TRAD_DEFAULT_PROB IS NULL)),
    CONSTRAINT CK_ASM_ALT_VALUES CHECK ((ALT_SCORABLE_YN = 'Y' AND ALT_SCORE IS NOT NULL AND ALT_SCORE BETWEEN 0 AND 1000 AND ALT_GRADE_BAND_CODE IS NOT NULL
                                         AND ALT_DEFAULT_PROB IS NOT NULL AND ALT_DEFAULT_PROB BETWEEN 0 AND 1)
                                        OR (ALT_SCORABLE_YN = 'N' AND ALT_SCORE IS NULL AND ALT_GRADE_BAND_CODE IS NULL AND ALT_DEFAULT_PROB IS NULL)),
    CONSTRAINT CK_ASM_CUTOFF CHECK ((TRAD_SCORE IS NULL AND ALT_SCORE IS NULL) OR CUTOFF_VERSION IS NOT NULL),
    CONSTRAINT CK_ASM_STATUS_ALT CHECK ((GRADE_STATUS_CODE = 'SCORED' AND ALT_SCORABLE_YN = 'Y') OR (GRADE_STATUS_CODE = 'NOT_SCORABLE' AND ALT_SCORABLE_YN = 'N')),
    CONSTRAINT CK_ASM_FEATURE_JSON CHECK (FEATURE_SNAPSHOT IS JSON),
    CONSTRAINT CK_ASM_FEATURE_REQUIRED CHECK (GRADE_STATUS_CODE <> 'SCORED' OR FEATURE_SNAPSHOT IS NOT NULL),
    CONSTRAINT CK_ASM_FSV_REQUIRED CHECK (GRADE_STATUS_CODE <> 'SCORED' OR FEATURE_SET_VERSION IS NOT NULL),
    CONSTRAINT CK_ASM_ACTUAL_DEFAULT CHECK (ACTUAL_DEFAULT_YN IN ('Y', 'N')),
    CONSTRAINT CK_ASM_LABEL_TYPE CHECK (LABEL_TYPE_CODE IN ('OBSERVED', 'SYNTHETIC')),
    CONSTRAINT CK_ASM_SPLIT CHECK (DATA_SPLIT_CODE IN ('TRAIN', 'VALID', 'TEST')),
    CONSTRAINT CK_ASM_EVAL_YN CHECK (EVAL_ELIGIBLE_YN IN ('Y', 'N')),
    CONSTRAINT CK_ASM_SPLIT_RULE CHECK ((DATASET_CODE = 'SERVICE' AND DATA_SPLIT_CODE IS NULL AND LABEL_TYPE_CODE IS NULL AND EVAL_ELIGIBLE_YN = 'N')
                                        OR (DATASET_CODE <> 'SERVICE' AND DATA_SPLIT_CODE IS NOT NULL AND LABEL_TYPE_CODE IS NOT NULL)),
    CONSTRAINT CK_ASM_EVAL_TEST_ONLY CHECK (EVAL_ELIGIBLE_YN = 'N' OR (DATA_SPLIT_CODE = 'TEST' AND ACTUAL_DEFAULT_YN IS NOT NULL))
);
COMMENT ON TABLE  ASSESSMENT IS '신용 평가 1건 (기존·대안 점수·등급·부도 확률). B팀 PREDICTION_HISTORY를 합침';
COMMENT ON COLUMN ASSESSMENT.REQUEST_ID IS 'v0.2 (B3) 평가 요청 고유번호(UUID 소문자). 화면·API 주소에는 ASSESSMENT_ID 대신 이 값만 쓴다(번호 추측으로 남의 결과를 보는 것을 막는다). React/Spring이 요청 시작 때 만들고 재시도에도 같은 값을 보낸다. 같은 값이 다시 저장되면(ORA-00001) 새로 저장하지 않고 기존 결과를 돌려주되, 그때 USER_ID가 같은지 반드시 확인한다. 합성 고객은 적재 때 만든다';
COMMENT ON COLUMN ASSESSMENT.USER_ID IS '평가 회원 (서비스 회원만, 합성 고객은 NULL)';
COMMENT ON COLUMN ASSESSMENT.DATASET_CODE IS 'SERVICE=서비스 회원, SYNTH_*=관리자 비교(N-25·N-26)용 합성 집단 (투표 D6)';
COMMENT ON COLUMN ASSESSMENT.SYNTHETIC_CUSTOMER_ID IS '합성 고객 ID (SYN 접두어, 서비스 회원이면 NULL)';
COMMENT ON COLUMN ASSESSMENT.WORKER_TYPE_CODE IS '평가 시점 직군 (진단 내역·비교 분석용 스냅샷)';
COMMENT ON COLUMN ASSESSMENT.AGE_BAND_CODE IS '평가 시점 연령대 (20S, 30S, 40S, 50_PLUS). 가입이 20세 이상이라 4구간으로 모두 나뉜다';
COMMENT ON COLUMN ASSESSMENT.INPUT_BASE_MONTH IS '산출에 쓴 입력의 기준월 (YYYY-MM, 소득 12개월 범위의 끝 달 = 산출 시점의 가장 늦은 소득 달, D-16). 서비스 회원만, 합성 고객은 NULL. v0.2 (R3): 현재 달과의 차이가 APP_SETTING INPUT_MAX_AGE_MONTHS를 넘으면 STALE_INPUT으로 산출하지 않는다';
COMMENT ON COLUMN ASSESSMENT.MODEL_VERSION IS '모델 버전 (MODEL_REGISTRY를 가리킴. 서비스 중 교체 안 함, 투표 D8). v0.2 (P2): 같은 이름으로 파일만 바꾸지 말고 새 버전을 등록한다';
COMMENT ON COLUMN ASSESSMENT.FEATURE_SET_VERSION IS 'v0.2 (B2) 이 평가에 쓴 피처 정의서 버전 (SCORED면 필수)';
COMMENT ON COLUMN ASSESSMENT.CUTOFF_VERSION IS 'v0.2 (B1) 등급을 매길 때 쓴 등급 구간 버전. FastAPI 응답의 cutoffVersion을 그대로 저장한다 (점수가 하나라도 있으면 필수)';
COMMENT ON COLUMN ASSESSMENT.GRADE_STATUS_CODE IS '서비스 등급 상태 (대안 모델 기준: SCORED, NOT_SCORABLE)';
COMMENT ON COLUMN ASSESSMENT.NOT_SCORABLE_REASON_CODE IS 'v0.2 (B4) 산출 불가 사유 (NOT_SCORABLE이면 필수, SCORED면 NULL)';
COMMENT ON COLUMN ASSESSMENT.TRAD_SCORABLE_YN IS '기존 모델 산정 여부 (금융 이력 부족이면 N일 수 있음)';
COMMENT ON COLUMN ASSESSMENT.TRAD_DEFAULT_PROB IS '기존 모델 예상 부도 확률 (0~1)';
COMMENT ON COLUMN ASSESSMENT.ALT_DEFAULT_PROB IS '대안 모델 예상 부도 확률 (0~1, 시뮬레이터 표시)';
COMMENT ON COLUMN ASSESSMENT.SHAP_BASE_SCORE IS 'SHAP 기준점 (639는 시연용 예시)';
COMMENT ON COLUMN ASSESSMENT.FEATURE_SNAPSHOT IS '산출 때 모델에 넘긴 피처 값 JSON (SHAP·시뮬레이터가 같은 값을 쓰도록 저장, SCORED면 필수). 시뮬레이터 입력 9개의 원래 값도 담는다. 빈 객체·필수 키 누락은 저장하는 쪽(Spring)에서 검사. v0.2 (R2): 신용평가사 응답 원문은 따로 저장하지 않으므로 이 JSON이 산출 근거의 유일한 기록이다. 개인 금융정보라 열람은 ACCESS_AUDIT_LOG에 남기고 접근 권한·마스킹을 적용한다';
COMMENT ON COLUMN ASSESSMENT.ACTUAL_DEFAULT_YN IS '정답(부도 여부) 라벨 (합성 고객, N-25 성능 비교. 서비스 회원은 NULL). 라벨의 종류는 LABEL_TYPE_CODE로 구분한다';
COMMENT ON COLUMN ASSESSMENT.LABEL_TYPE_CODE IS 'v0.2 (B5) 정답 라벨의 종류 (OBSERVED=실제 관측, SYNTHETIC=합성 규칙으로 만든 값). 합성 고객만, 서비스 회원은 NULL. 화면에 실제 연체로 보여 주기 전에 확인한다';
COMMENT ON COLUMN ASSESSMENT.DATA_SPLIT_CODE IS 'v0.2 (B5) 합성 고객의 학습·검증·시험 구분 (TRAIN/VALID/TEST). 서비스 회원은 NULL. 분리 기준은 데이터 담당(범영)이 정하고 적재 스크립트가 채운다';
COMMENT ON COLUMN ASSESSMENT.EVAL_ELIGIBLE_YN IS 'v0.2 (B5) 성능 비교(N-25·N-26) 계산 대상 여부. Y는 TEST 구분이고 정답이 있는 행만 가능(DB가 막는다). 이상치를 일부러 넣은 행 등은 N. 성능 쿼리는 EVAL_ELIGIBLE_YN = Y 조건만 쓴다';
COMMENT ON COLUMN ASSESSMENT.AI_SUMMARY IS 'AI 요약 문장 (N-31-2, 저장해 다시 씀)';

-- N-14 항목별 SHAP. B팀 PREDICTION_SHAP_FACTOR를 합침. 항목명·설명 문구는 DIM_FEATURE에서 코드로 찾는다 (v0.2 B2).
CREATE TABLE ASSESSMENT_FACTOR (
    FACTOR_ID              NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    ASSESSMENT_ID          NUMBER(19)           NOT NULL,
    FEATURE_SET_VERSION    VARCHAR2(30 CHAR)    NOT NULL,
    FEATURE_RANK           NUMBER(3)            NOT NULL,
    FEATURE_CODE           VARCHAR2(50 CHAR)    NOT NULL,
    FEATURE_VALUE          VARCHAR2(100 CHAR),
    SHAP_VALUE             NUMBER(12,6),
    SHAP_SCORE             NUMBER(4)            NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_ASSESSMENT_FACTOR PRIMARY KEY (FACTOR_ID),
    CONSTRAINT UK_ASF_RANK UNIQUE (ASSESSMENT_ID, FEATURE_RANK),
    CONSTRAINT UK_ASF_FEATURE UNIQUE (ASSESSMENT_ID, FEATURE_SET_VERSION, FEATURE_CODE),
    CONSTRAINT FK_ASF_ASSESSMENT FOREIGN KEY (ASSESSMENT_ID, FEATURE_SET_VERSION) REFERENCES ASSESSMENT (ASSESSMENT_ID, FEATURE_SET_VERSION) ON DELETE CASCADE,
    CONSTRAINT FK_ASF_FEATURE FOREIGN KEY (FEATURE_SET_VERSION, FEATURE_CODE) REFERENCES DIM_FEATURE (FEATURE_SET_VERSION, FEATURE_CODE),
    CONSTRAINT CK_ASF_RANK CHECK (FEATURE_RANK >= 1)
);
COMMENT ON TABLE  ASSESSMENT_FACTOR IS '대안 모델의 항목별 SHAP (모든 피처). 기준점 + SHAP_SCORE 합 = 대안 점수. v0.2: 대안 여부·시뮬레이터 가능 여부는 DIM_FEATURE에서 조인해서 쓴다 (행마다 중복 저장하지 않음)';
COMMENT ON COLUMN ASSESSMENT_FACTOR.FEATURE_SET_VERSION IS 'v0.2 (B2) 부모 ASSESSMENT의 피처 정의서 버전과 항상 같다 (복합 FK가 보장)';
COMMENT ON COLUMN ASSESSMENT_FACTOR.FEATURE_RANK IS '증감 점수 절댓값 순위 (1=가장 크게 작용)';
COMMENT ON COLUMN ASSESSMENT_FACTOR.FEATURE_CODE IS '피처 코드 (DIM_FEATURE에 없는 코드는 DB가 거절한다)';
COMMENT ON COLUMN ASSESSMENT_FACTOR.FEATURE_VALUE IS '평가 때 피처 값 (문자열로 저장)';
COMMENT ON COLUMN ASSESSMENT_FACTOR.SHAP_VALUE IS '모델 원래 SHAP 값 (소수 6자리, 모델 서버가 주면 저장. API C-4에서 B팀과 협의)';
COMMENT ON COLUMN ASSESSMENT_FACTOR.SHAP_SCORE IS '점수 단위로 바꾼 증감 점수 (+ 올림, − 내림). "작용한 정도"로만 표시';


-- ====================================================================
-- 5. 대출 상품 (N-18-7, N-37) — 모두 더미 데이터 (D-12)
-- ====================================================================

-- N-18-7 같은 점수대의 참고 금리·한도.
CREATE TABLE SCORE_BAND_OFFER (
    OFFER_ID               NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    MIN_SCORE              NUMBER(4)            NOT NULL,
    MAX_SCORE              NUMBER(4)            NOT NULL,
    RATE_MIN_PCT           NUMBER(6,3)          NOT NULL,
    RATE_MAX_PCT           NUMBER(6,3)          NOT NULL,
    RATE_AVG_PCT           NUMBER(6,3),
    LIMIT_AMT              NUMBER(15)           NOT NULL,
    BASE_DATE              DATE                 NOT NULL,
    CONSTRAINT PK_SCORE_BAND_OFFER PRIMARY KEY (OFFER_ID),
    CONSTRAINT UK_SBO_RANGE UNIQUE (MIN_SCORE, MAX_SCORE),
    CONSTRAINT CK_SBO_SCORE CHECK (MIN_SCORE BETWEEN 0 AND 1000 AND MAX_SCORE BETWEEN 0 AND 1000 AND MIN_SCORE <= MAX_SCORE),
    CONSTRAINT CK_SBO_RATE CHECK (RATE_MIN_PCT >= 0 AND RATE_MAX_PCT <= 20 AND RATE_MIN_PCT <= RATE_MAX_PCT),
    CONSTRAINT CK_SBO_RATE_AVG CHECK (RATE_AVG_PCT IS NULL OR (RATE_AVG_PCT >= RATE_MIN_PCT AND RATE_AVG_PCT <= RATE_MAX_PCT)),
    CONSTRAINT CK_SBO_LIMIT CHECK (LIMIT_AMT >= 0)
);
COMMENT ON TABLE  SCORE_BAND_OFFER IS '점수대별 참고 금리·한도 (더미, "같은 점수대의 참고 정보"로만 표시)';
COMMENT ON COLUMN SCORE_BAND_OFFER.RATE_AVG_PCT IS '점수대 평균 금리 (연 %, 없으면 NULL). 화면은 "연 a~b% (평균 c%)"로 표시';

-- N-37·N-18-7 더미 대출 상품 (명세의 신규 테이블).
CREATE TABLE LOAN_PRODUCT (
    PRODUCT_ID             NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    PRODUCT_CODE           VARCHAR2(20 CHAR)    NOT NULL,
    PROVIDER_NAME          VARCHAR2(50 CHAR)    NOT NULL,
    BANNER_COLOR           VARCHAR2(7 CHAR),
    PRODUCT_NAME           VARCHAR2(100 CHAR)   NOT NULL,
    PRODUCT_TYPE_NAME      VARCHAR2(50 CHAR)    NOT NULL,
    SUMMARY                VARCHAR2(200 CHAR)   NOT NULL,
    DESCRIPTION            VARCHAR2(2000 CHAR),
    RATE_MIN_PCT           NUMBER(6,3)          NOT NULL,
    RATE_MAX_PCT           NUMBER(6,3)          NOT NULL,
    LIMIT_MAX_AMT          NUMBER(15)           NOT NULL,
    TERM_MIN_MONTHS        NUMBER(4),
    TERM_MAX_MONTHS        NUMBER(4),
    TERM_TEXT              VARCHAR2(50 CHAR),
    REPAYMENT_METHOD       VARCHAR2(100 CHAR),
    MIN_ALT_SCORE          NUMBER(4),
    ELIGIBILITY_TEXT       VARCHAR2(1000 CHAR),
    REQUIRED_DOCUMENTS     VARCHAR2(1000 CHAR),
    CAUTION_TEXT           VARCHAR2(1000 CHAR),
    DUMMY_YN               CHAR(1)              DEFAULT 'Y' NOT NULL,
    BASE_DATE              DATE                 NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    UPDATED_AT             TIMESTAMP,
    CONSTRAINT PK_LOAN_PRODUCT PRIMARY KEY (PRODUCT_ID),
    CONSTRAINT UK_LPR_CODE UNIQUE (PRODUCT_CODE),
    CONSTRAINT CK_LPR_RATE CHECK (RATE_MIN_PCT >= 0 AND RATE_MAX_PCT <= 20 AND RATE_MIN_PCT <= RATE_MAX_PCT),
    CONSTRAINT CK_LPR_LIMIT CHECK (LIMIT_MAX_AMT >= 0),
    CONSTRAINT CK_LPR_TERM CHECK (TERM_MIN_MONTHS IS NULL OR TERM_MAX_MONTHS IS NULL OR TERM_MIN_MONTHS <= TERM_MAX_MONTHS),
    CONSTRAINT CK_LPR_MIN_SCORE CHECK (MIN_ALT_SCORE BETWEEN 0 AND 1000),
    CONSTRAINT CK_LPR_DUMMY_YN CHECK (DUMMY_YN IN ('Y', 'N'))
);
COMMENT ON TABLE  LOAN_PRODUCT IS '더미 대출 상품 (실제 상품 아님, 가상 기관명만 사용)';
COMMENT ON COLUMN LOAN_PRODUCT.BANNER_COLOR IS '배너 단색 (#RRGGBB, 배너 이미지가 없을 때)';
COMMENT ON COLUMN LOAN_PRODUCT.SUMMARY IS '카드의 한 줄 설명';
COMMENT ON COLUMN LOAN_PRODUCT.DESCRIPTION IS '상세 화면 상품 설명';
COMMENT ON COLUMN LOAN_PRODUCT.TERM_TEXT IS '화면 표시용 대출 기간 문구 (예: 1년(연장 가능)). 숫자 TERM_MIN_MONTHS·TERM_MAX_MONTHS는 필터용';
COMMENT ON COLUMN LOAN_PRODUCT.MIN_ALT_SCORE IS '신청 가능 최소 대안 점수 ("지금 점수로 가능" 판정, NULL이면 조건 없음)';

-- N-37-1 상품 대상 직군.
CREATE TABLE LOAN_PRODUCT_WORKER_TYPE (
    PRODUCT_ID             NUMBER(19)           NOT NULL,
    WORKER_TYPE_CODE       VARCHAR2(20 CHAR)    NOT NULL,
    CONSTRAINT PK_LOAN_PRODUCT_WORKER_TYPE PRIMARY KEY (PRODUCT_ID, WORKER_TYPE_CODE),
    CONSTRAINT FK_LPW_PRODUCT FOREIGN KEY (PRODUCT_ID) REFERENCES LOAN_PRODUCT (PRODUCT_ID) ON DELETE CASCADE,
    CONSTRAINT FK_LPW_WORKER_TYPE FOREIGN KEY (WORKER_TYPE_CODE) REFERENCES DIM_WORKER_TYPE (WORKER_TYPE_CODE)
);
COMMENT ON TABLE  LOAN_PRODUCT_WORKER_TYPE IS '대출 상품 대상 직군 (행이 없으면 전 직군)';

-- N-37 상품 특징 문구 (상세 화면 "신청 조건과 특징" 목록).
CREATE TABLE LOAN_PRODUCT_FEATURE (
    PRODUCT_ID             NUMBER(19)           NOT NULL,
    DISPLAY_ORDER          NUMBER(2)            NOT NULL,
    FEATURE_TEXT           VARCHAR2(200 CHAR)   NOT NULL,
    CONSTRAINT PK_LOAN_PRODUCT_FEATURE PRIMARY KEY (PRODUCT_ID, DISPLAY_ORDER),
    CONSTRAINT FK_LPFT_PRODUCT FOREIGN KEY (PRODUCT_ID) REFERENCES LOAN_PRODUCT (PRODUCT_ID) ON DELETE CASCADE,
    CONSTRAINT CK_LPFT_ORDER CHECK (DISPLAY_ORDER >= 1)
);
COMMENT ON TABLE  LOAN_PRODUCT_FEATURE IS '대출 상품 특징 문구 (N-37, 더미. 예: 중도상환수수료 면제(1년 후))';
COMMENT ON COLUMN LOAN_PRODUCT_FEATURE.DISPLAY_ORDER IS '화면 표시 순서 (1부터)';

-- N-37-3 상품 즐겨찾기.
CREATE TABLE LOAN_PRODUCT_FAVORITE (
    USER_ID                NUMBER(19)           NOT NULL,
    PRODUCT_ID             NUMBER(19)           NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_LOAN_PRODUCT_FAVORITE PRIMARY KEY (USER_ID, PRODUCT_ID),
    CONSTRAINT FK_LPF_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_LPF_PRODUCT FOREIGN KEY (PRODUCT_ID) REFERENCES LOAN_PRODUCT (PRODUCT_ID) ON DELETE CASCADE
);
COMMENT ON TABLE  LOAN_PRODUCT_FAVORITE IS '대출 상품 즐겨찾기 (N-37-3, 마이 페이지 N-04-5)';


-- ====================================================================
-- 6. 공공통계·상권·금리 (N-15, N-17, N-24) — 담당 팀이 원천 자료에 맞춰 열을 확정
-- ====================================================================

-- N-17 정책금리.
CREATE TABLE FACT_POLICY_RATE (
    BASE_DATE              DATE                 NOT NULL,
    RATE_NAME              VARCHAR2(50 CHAR)    NOT NULL,
    RATE_PCT               NUMBER(6,3)          NOT NULL,
    CONSTRAINT PK_FACT_POLICY_RATE PRIMARY KEY (BASE_DATE, RATE_NAME)
);
COMMENT ON TABLE  FACT_POLICY_RATE IS '정책금리 (기준금리 등, N-17 시나리오 테스트)';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN FACT_POLICY_RATE.BASE_DATE IS '기준일. 가장 최근 값을 시나리오 테스트(N-17)의 출발 금리로 쓴다';
COMMENT ON COLUMN FACT_POLICY_RATE.RATE_NAME IS '금리 이름 (예: 한국은행 기준금리)';
COMMENT ON COLUMN FACT_POLICY_RATE.RATE_PCT IS '금리 (연 %, 3.25 = 3.25%)';

-- N-15-2 가계금융복지조사 연령대 평균.
CREATE TABLE FACT_HFS_STAT (
    STAT_YEAR              NUMBER(4)            NOT NULL,
    AGE_BAND_CODE          VARCHAR2(10 CHAR)    NOT NULL,
    AVG_INCOME_AMT         NUMBER(15)           NOT NULL,
    AVG_ASSET_AMT          NUMBER(15)           NOT NULL,
    AVG_DEBT_AMT           NUMBER(15)           NOT NULL,
    CONSTRAINT PK_FACT_HFS_STAT PRIMARY KEY (STAT_YEAR, AGE_BAND_CODE),
    CONSTRAINT CK_FHS_AGE_BAND CHECK (AGE_BAND_CODE IN ('20S', '30S', '40S', '50_PLUS'))
);
COMMENT ON TABLE  FACT_HFS_STAT IS '가계금융복지조사 연령대별 평균 연소득·자산·부채 (N-15 동년배 비교)';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN FACT_HFS_STAT.AGE_BAND_CODE IS '연령대 (ASSESSMENT.AGE_BAND_CODE와 같은 값). 원자료의 50대·60대 이상은 가구 수로 가중 평균해 50_PLUS로 넣는다';
COMMENT ON COLUMN FACT_HFS_STAT.AVG_INCOME_AMT IS '평균 연소득 (원, 조사 전년도 소득)';
COMMENT ON COLUMN FACT_HFS_STAT.AVG_ASSET_AMT IS '평균 총자산 (원)';
COMMENT ON COLUMN FACT_HFS_STAT.AVG_DEBT_AMT IS '평균 총부채 (원)';

-- N-15-2·3 직군·연령대 평균 소득.
CREATE TABLE FACT_INDUSTRY_AGE_INCOME (
    STAT_YEAR              NUMBER(4)            NOT NULL,
    WORKER_TYPE_CODE       VARCHAR2(20 CHAR)    NOT NULL,
    AGE_BAND_CODE          VARCHAR2(10 CHAR)    NOT NULL,
    AVG_INCOME_AMT         NUMBER(15)           NOT NULL,
    CONSTRAINT PK_FACT_INDUSTRY_AGE_INCOME PRIMARY KEY (STAT_YEAR, WORKER_TYPE_CODE, AGE_BAND_CODE),
    CONSTRAINT FK_FIA_WORKER_TYPE FOREIGN KEY (WORKER_TYPE_CODE) REFERENCES DIM_WORKER_TYPE (WORKER_TYPE_CODE),
    CONSTRAINT CK_FIA_AGE_BAND CHECK (AGE_BAND_CODE IN ('20S', '30S', '40S', '50_PLUS'))
);
COMMENT ON TABLE  FACT_INDUSTRY_AGE_INCOME IS '직군·연령대별 평균 연소득 (N-15 "같은 직군 평균과 비교")';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN FACT_INDUSTRY_AGE_INCOME.WORKER_TYPE_CODE IS '직군. 원자료는 산업·종사상지위 기준이라 직군 3개로 묶어 넣는다. TODO 프리랜서 기준은 팀 확정';
COMMENT ON COLUMN FACT_INDUSTRY_AGE_INCOME.AVG_INCOME_AMT IS '평균 연소득 (원)';

-- v0.3.2 (C2) N-15-3 직군(종사상지위)별 평균. FACT_HFS_STAT은 연령대별, FACT_INDUSTRY_AGE_INCOME은 소득만 있어
--   "같은 직군 평균과 비교" 카드의 총자산·총부채를 담을 곳이 없다. TODO 프리랜서를 어느 종사상지위에 맞출지는 팀 확정.
CREATE TABLE FACT_HFS_WORKER_STAT (
    STAT_YEAR              NUMBER(4)            NOT NULL,
    WORKER_TYPE_CODE       VARCHAR2(20 CHAR)    NOT NULL,
    SOURCE_SEGMENT_NAME    VARCHAR2(50 CHAR)    NOT NULL,
    AVG_INCOME_AMT         NUMBER(15)           NOT NULL,
    AVG_ASSET_AMT          NUMBER(15)           NOT NULL,
    AVG_DEBT_AMT           NUMBER(15)           NOT NULL,
    CONSTRAINT PK_FACT_HFS_WORKER_STAT PRIMARY KEY (STAT_YEAR, WORKER_TYPE_CODE),
    CONSTRAINT FK_FHW_WORKER_TYPE FOREIGN KEY (WORKER_TYPE_CODE) REFERENCES DIM_WORKER_TYPE (WORKER_TYPE_CODE),
    CONSTRAINT CK_FHW_AMT CHECK (AVG_INCOME_AMT >= 0 AND AVG_ASSET_AMT >= 0 AND AVG_DEBT_AMT >= 0)
);
COMMENT ON TABLE  FACT_HFS_WORKER_STAT IS '가계금융복지조사 직군(종사상지위)별 평균 연소득·총자산·총부채 (N-15-3 "같은 직군 평균과 비교")';
COMMENT ON COLUMN FACT_HFS_WORKER_STAT.STAT_YEAR IS '통계 연도 (가장 최근 연도만 비교에 쓴다. 소득은 조사 전년도 값)';
COMMENT ON COLUMN FACT_HFS_WORKER_STAT.WORKER_TYPE_CODE IS '직군 (내 직군 평균을 찾는 키)';
COMMENT ON COLUMN FACT_HFS_WORKER_STAT.SOURCE_SEGMENT_NAME IS '값을 가져온 원자료 종사상지위 이름 (예: 상용근로자, 자영업자). 조사에 프리랜서 구분이 없어 무엇에 맞췄는지 남긴다. TODO 프리랜서 매핑은 팀 확정';
COMMENT ON COLUMN FACT_HFS_WORKER_STAT.AVG_INCOME_AMT IS '평균 연소득 (원)';
COMMENT ON COLUMN FACT_HFS_WORKER_STAT.AVG_ASSET_AMT IS '평균 총자산 (원)';
COMMENT ON COLUMN FACT_HFS_WORKER_STAT.AVG_DEBT_AMT IS '평균 총부채 (원)';

-- N-24-2 행정동·업종 분기 매출.
CREATE TABLE FACT_DONG_SALES (
    BASE_QUARTER           VARCHAR2(7 CHAR)     NOT NULL,
    ADM_DONG_CODE          VARCHAR2(10 CHAR)    NOT NULL,
    SERVICE_CATEGORY_CODE  VARCHAR2(10 CHAR)    NOT NULL,
    SALES_AMT              NUMBER(18),
    CONSTRAINT PK_FACT_DONG_SALES PRIMARY KEY (BASE_QUARTER, ADM_DONG_CODE, SERVICE_CATEGORY_CODE),
    CONSTRAINT FK_FDS_DONG FOREIGN KEY (ADM_DONG_CODE) REFERENCES DIM_ADM_DONG (ADM_DONG_CODE),
    CONSTRAINT FK_FDS_CATEGORY FOREIGN KEY (SERVICE_CATEGORY_CODE) REFERENCES DIM_SERVICE_CATEGORY (SERVICE_CATEGORY_CODE),
    CONSTRAINT CK_FDS_QUARTER CHECK (REGEXP_LIKE(BASE_QUARTER, '^\d{4}-Q[1-4]$'))
);
COMMENT ON TABLE  FACT_DONG_SALES IS '행정동·업종 분기 매출 (N-24)';
COMMENT ON COLUMN FACT_DONG_SALES.SALES_AMT IS '분기 매출 (원, 비공개면 NULL → "자료 없음")';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN FACT_DONG_SALES.BASE_QUARTER IS '기준 분기 (YYYY-Qn). 매출 전년비를 내려면 최근 5개 분기 이상을 적재한다';

-- N-24-2 행정동·업종 분기 점포.
CREATE TABLE FACT_DONG_STORE (
    BASE_QUARTER           VARCHAR2(7 CHAR)     NOT NULL,
    ADM_DONG_CODE          VARCHAR2(10 CHAR)    NOT NULL,
    SERVICE_CATEGORY_CODE  VARCHAR2(10 CHAR)    NOT NULL,
    STORE_COUNT            NUMBER(7),
    OPEN_COUNT             NUMBER(7),
    CLOSE_COUNT            NUMBER(7),
    CONSTRAINT PK_FACT_DONG_STORE PRIMARY KEY (BASE_QUARTER, ADM_DONG_CODE, SERVICE_CATEGORY_CODE),
    CONSTRAINT FK_FDT_DONG FOREIGN KEY (ADM_DONG_CODE) REFERENCES DIM_ADM_DONG (ADM_DONG_CODE),
    CONSTRAINT FK_FDT_CATEGORY FOREIGN KEY (SERVICE_CATEGORY_CODE) REFERENCES DIM_SERVICE_CATEGORY (SERVICE_CATEGORY_CODE),
    CONSTRAINT CK_FDT_QUARTER CHECK (REGEXP_LIKE(BASE_QUARTER, '^\d{4}-Q[1-4]$'))
);
COMMENT ON TABLE  FACT_DONG_STORE IS '행정동·업종 분기 점포 수·개업·폐업 (N-24, 개업률·폐업률은 계산)';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN FACT_DONG_STORE.STORE_COUNT IS '점포 수. 점포당 매출의 분모, 경쟁 밀집도, 점포 수 증감';
COMMENT ON COLUMN FACT_DONG_STORE.OPEN_COUNT IS '개업 점포 수. 개업률 = OPEN_COUNT / STORE_COUNT';
COMMENT ON COLUMN FACT_DONG_STORE.CLOSE_COUNT IS '폐업 점포 수. 폐업률 = CLOSE_COUNT / STORE_COUNT (지도 기본 지표)';

-- v0.3.2 (C1) N-24-4·5 행정동 분기 생활인구. 유동인구 증감 = (이번 분기 − 작년 같은 분기) ÷ 작년 같은 분기.
CREATE TABLE FACT_DONG_LIVING_POP (
    BASE_QUARTER           VARCHAR2(7 CHAR)     NOT NULL,
    ADM_DONG_CODE          VARCHAR2(10 CHAR)    NOT NULL,
    AVG_LIVING_POP         NUMBER(12,1)         NOT NULL,
    CONSTRAINT PK_FACT_DONG_LIVING_POP PRIMARY KEY (BASE_QUARTER, ADM_DONG_CODE),
    CONSTRAINT FK_FDL_DONG FOREIGN KEY (ADM_DONG_CODE) REFERENCES DIM_ADM_DONG (ADM_DONG_CODE),
    CONSTRAINT CK_FDL_QUARTER CHECK (REGEXP_LIKE(BASE_QUARTER, '^\d{4}-Q[1-4]$')),
    CONSTRAINT CK_FDL_POP CHECK (AVG_LIVING_POP >= 0)
);
COMMENT ON TABLE  FACT_DONG_LIVING_POP IS '행정동 분기 생활인구 (N-24-4 지도 지표 "유동인구 증감", N-24-5 동 상세 KPI). 원천: 서울 생활인구(행정동 단위)';
COMMENT ON COLUMN FACT_DONG_LIVING_POP.BASE_QUARTER IS '기준 분기 (YYYY-Qn, FACT_DONG_SALES와 같은 형식). 작년 같은 분기와 비교해 증감률을 낸다';
COMMENT ON COLUMN FACT_DONG_LIVING_POP.ADM_DONG_CODE IS '행정동 (상권 FACT 표와 같은 코드)';
COMMENT ON COLUMN FACT_DONG_LIVING_POP.AVG_LIVING_POP IS '분기 일평균 생활인구 (명). 일별·시간대별 원자료를 분기로 평균한 값';


-- ====================================================================
-- 7. 커뮤니티·신고 (N-06, N-33, N-34)
-- ====================================================================

-- N-06 신용 라운지 게시글.
CREATE TABLE BOARD_POST (
    POST_ID                NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19),
    TITLE                  VARCHAR2(200 CHAR)   NOT NULL,
    CONTENT                CLOB                 NOT NULL,
    STATUS_CODE            VARCHAR2(20 CHAR)    DEFAULT 'VISIBLE' NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    UPDATED_AT             TIMESTAMP,
    CONSTRAINT PK_BOARD_POST PRIMARY KEY (POST_ID),
    CONSTRAINT FK_BPT_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_BPT_STATUS CHECK (STATUS_CODE IN ('VISIBLE', 'HIDDEN_BY_REPORT', 'DELETED'))
);
COMMENT ON TABLE  BOARD_POST IS '신용 라운지 게시글 (N-06)';
COMMENT ON COLUMN BOARD_POST.USER_ID IS '작성자 (탈퇴해도 값 유지. 작성자 ACCOUNT_STATUS_CODE가 WITHDRAWN이면 "탈퇴한 회원"으로 표시, N-04-7)';
-- v0.3.2 (C7) 작성자 삭제도 DELETED. 누가 지웠는지는 BOARD_POST_LOG
COMMENT ON COLUMN BOARD_POST.STATUS_CODE IS 'VISIBLE, HIDDEN_BY_REPORT=신고로 숨김, DELETED=작성자 또는 관리자 삭제 (누가 지웠는지는 BOARD_POST_LOG)';

-- N-06-3 댓글.
CREATE TABLE BOARD_COMMENT (
    COMMENT_ID             NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    POST_ID                NUMBER(19)           NOT NULL,
    USER_ID                NUMBER(19),
    CONTENT                VARCHAR2(1000 CHAR)  NOT NULL,
    STATUS_CODE            VARCHAR2(20 CHAR)    DEFAULT 'VISIBLE' NOT NULL,
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    UPDATED_AT             TIMESTAMP,
    CONSTRAINT PK_BOARD_COMMENT PRIMARY KEY (COMMENT_ID),
    CONSTRAINT FK_BCM_POST FOREIGN KEY (POST_ID) REFERENCES BOARD_POST (POST_ID) ON DELETE CASCADE,
    CONSTRAINT FK_BCM_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_BCM_STATUS CHECK (STATUS_CODE IN ('VISIBLE', 'HIDDEN_BY_REPORT', 'DELETED'))
);
COMMENT ON TABLE  BOARD_COMMENT IS '신용 라운지 댓글 (N-06-3)';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN BOARD_COMMENT.STATUS_CODE IS 'BOARD_POST.STATUS_CODE와 같은 값. 댓글도 글과 따로 숨긴다';
COMMENT ON COLUMN BOARD_COMMENT.USER_ID IS '작성자 (탈퇴해도 값 유지. 작성자가 WITHDRAWN이면 "탈퇴한 회원"으로 표시)';

-- N-33 신고 접수, N-34 관리자 처리.
CREATE TABLE CONTENT_REPORT (
    REPORT_ID              NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    TARGET_TYPE_CODE       VARCHAR2(10 CHAR)    NOT NULL,
    POST_ID                NUMBER(19),
    COMMENT_ID             NUMBER(19),
    REPORTER_USER_ID       NUMBER(19),
    REASON_CODE            VARCHAR2(20 CHAR)    NOT NULL,
    DETAIL_TEXT            VARCHAR2(500 CHAR),
    STATUS_CODE            VARCHAR2(20 CHAR)    DEFAULT 'RECEIVED' NOT NULL,
    RESULT_CODE            VARCHAR2(20 CHAR),
    HANDLER_USER_ID        NUMBER(19),
    HANDLER_MEMO           VARCHAR2(500 CHAR),
    REPORTED_AT            TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    HANDLED_AT             TIMESTAMP,
    CONSTRAINT PK_CONTENT_REPORT PRIMARY KEY (REPORT_ID),
    CONSTRAINT FK_CRP_POST FOREIGN KEY (POST_ID) REFERENCES BOARD_POST (POST_ID) ON DELETE CASCADE,
    CONSTRAINT FK_CRP_COMMENT FOREIGN KEY (COMMENT_ID) REFERENCES BOARD_COMMENT (COMMENT_ID) ON DELETE CASCADE,
    CONSTRAINT FK_CRP_REPORTER FOREIGN KEY (REPORTER_USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_CRP_HANDLER FOREIGN KEY (HANDLER_USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_CRP_TARGET CHECK ((TARGET_TYPE_CODE = 'POST' AND POST_ID IS NOT NULL AND COMMENT_ID IS NULL)
                                    OR (TARGET_TYPE_CODE = 'COMMENT' AND COMMENT_ID IS NOT NULL AND POST_ID IS NULL)),
    CONSTRAINT CK_CRP_REASON CHECK (REASON_CODE IN ('ABUSE', 'SPAM', 'PRIVACY_EXPOSURE', 'FALSE_INFO', 'OTHER')),
    CONSTRAINT CK_CRP_DETAIL CHECK (REASON_CODE = 'OTHER' OR DETAIL_TEXT IS NULL),
    CONSTRAINT CK_CRP_STATUS CHECK (STATUS_CODE IN ('RECEIVED', 'IN_REVIEW', 'DONE', 'REJECTED')),
    CONSTRAINT CK_CRP_RESULT CHECK (RESULT_CODE IN ('KEEP_HIDDEN', 'DELETE', 'REJECT')),
    -- v0.3.2 (C4) 접수·검토 중이면 결과 없음, 처리 완료면 숨김 유지·삭제, 반려면 REJECT만.
    -- C조 원본 조건에 NULL 검사 추가(v0.3.2 경환): 완료·반려인데 결과가 NULL이면 UNKNOWN으로 통과하지 않게 한다.
    CONSTRAINT CK_CRP_RESULT_STATUS CHECK (
           (STATUS_CODE IN ('RECEIVED', 'IN_REVIEW') AND RESULT_CODE IS NULL)
        OR (STATUS_CODE = 'DONE' AND RESULT_CODE IS NOT NULL AND RESULT_CODE IN ('KEEP_HIDDEN', 'DELETE'))
        OR (STATUS_CODE = 'REJECTED' AND RESULT_CODE IS NOT NULL AND RESULT_CODE = 'REJECT'))
);
COMMENT ON TABLE  CONTENT_REPORT IS '게시글·댓글 신고 (N-33 접수, N-34 처리). 글·댓글 각각 집계';
COMMENT ON COLUMN CONTENT_REPORT.REASON_CODE IS 'ABUSE=욕설·비방, SPAM=광고·스팸, PRIVACY_EXPOSURE=개인정보 노출, FALSE_INFO=허위 정보, OTHER=기타';
COMMENT ON COLUMN CONTENT_REPORT.DETAIL_TEXT IS '상세 내용 (기타일 때만)';
COMMENT ON COLUMN CONTENT_REPORT.RESULT_CODE IS '처리 결과 (KEEP_HIDDEN=숨김 유지, DELETE=삭제, REJECT=반려)';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN CONTENT_REPORT.STATUS_CODE IS 'RECEIVED=접수, IN_REVIEW=검토 중(관리자가 열어 봄), DONE=처리 완료, REJECTED=반려. 관리자 화면은 같은 대상(POST_ID 또는 COMMENT_ID)의 행을 묶어 보여 주고 함께 처리한다';
COMMENT ON COLUMN CONTENT_REPORT.REPORTER_USER_ID IS '신고자 (관리자 화면에는 가려서 표시. 본인 글 신고 금지와 하루 횟수(REPORT_DAILY_LIMIT)는 Spring에서 검사)';
COMMENT ON COLUMN CONTENT_REPORT.REPORTED_AT IS '신고 시각. 하루 신고 횟수, 기간 필터, 자동 숨김 시각(기준 건수째 신고)에 쓴다';

-- v0.3.2 (C7) N-06 · N-33-2 · N-34-3 게시글 변경 이력. 작성자 삭제, 관리자 처리, 자동 숨김을 구분해 남긴다.
-- v0.3.2 (C7) FK_BPL_POST는 참조 로그가 있는 글만 삭제를 막는다. Spring은 글 작성·CREATE 로그를 한 트랜잭션으로 처리하고 회원·게시글·신고 행 DELETE를 금지한다.
-- Spring 규칙(동시 요청): CHECK는 로그 한 줄만 본다. 상태가 바뀌는 요청끼리의 충돌은 조건부 UPDATE로 막는다.
--   UPDATE BOARD_POST SET STATUS_CODE = :새상태 WHERE POST_ID = :id AND STATUS_CODE = :이전상태
--   바뀐 행 0개면 거절하고 1개면 같은 @Transactional 안에서 로그 INSERT. 상태가 그대로인 수정끼리의 동시 저장은 막지 못하며 시연 범위에서는 허용한다.
CREATE TABLE BOARD_POST_LOG (
    POST_LOG_ID            NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    POST_ID                NUMBER(19)           NOT NULL,
    ACTION_CODE            VARCHAR2(20 CHAR)    NOT NULL,
    ACTOR_TYPE_CODE        VARCHAR2(10 CHAR)    NOT NULL,
    ACTOR_USER_ID          NUMBER(19),
    BEFORE_STATUS_CODE     VARCHAR2(20 CHAR),
    AFTER_STATUS_CODE      VARCHAR2(20 CHAR)    NOT NULL,
    REPORT_ID              NUMBER(19),
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_BOARD_POST_LOG PRIMARY KEY (POST_LOG_ID),
    CONSTRAINT FK_BPL_POST FOREIGN KEY (POST_ID) REFERENCES BOARD_POST (POST_ID),
    CONSTRAINT FK_BPL_ACTOR FOREIGN KEY (ACTOR_USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT FK_BPL_REPORT FOREIGN KEY (REPORT_ID) REFERENCES CONTENT_REPORT (REPORT_ID),
    CONSTRAINT CK_BPL_ACTION CHECK (ACTION_CODE IN ('CREATE', 'UPDATE', 'DELETE', 'HIDE', 'RESTORE')),
    CONSTRAINT CK_BPL_ACTOR_TYPE CHECK (ACTOR_TYPE_CODE IN ('USER', 'ADMIN', 'SYSTEM')),
    -- v0.3.2 (C7) SYSTEM은 회원 ID가 없고 USER·ADMIN은 있어야 한다.
    CONSTRAINT CK_BPL_SYSTEM_ACTOR CHECK ((ACTOR_TYPE_CODE = 'SYSTEM' AND ACTOR_USER_ID IS NULL)
                                      OR (ACTOR_TYPE_CODE IN ('USER', 'ADMIN') AND ACTOR_USER_ID IS NOT NULL)),
    -- 허용 조합. 이전 상태 NULL은 CREATE만 (IS NOT NULL을 적어 UNKNOWN 통과를 막는다).
    -- 숨겨진 글: 작성자 삭제 가능, 수정 불가 (C조 11/12 확정)
    CONSTRAINT CK_BPL_TRANSITION CHECK (
           (ACTION_CODE = 'CREATE'  AND ACTOR_TYPE_CODE = 'USER'
            AND BEFORE_STATUS_CODE IS NULL AND AFTER_STATUS_CODE = 'VISIBLE')
        OR (ACTION_CODE = 'UPDATE'  AND ACTOR_TYPE_CODE = 'USER'
            AND BEFORE_STATUS_CODE IS NOT NULL AND BEFORE_STATUS_CODE = 'VISIBLE' AND AFTER_STATUS_CODE = 'VISIBLE')
        OR (ACTION_CODE = 'DELETE'  AND ACTOR_TYPE_CODE IN ('USER', 'ADMIN')
            AND BEFORE_STATUS_CODE IS NOT NULL AND BEFORE_STATUS_CODE IN ('VISIBLE', 'HIDDEN_BY_REPORT') AND AFTER_STATUS_CODE = 'DELETED')
        OR (ACTION_CODE = 'HIDE'    AND ACTOR_TYPE_CODE IN ('SYSTEM', 'ADMIN')
            AND BEFORE_STATUS_CODE IS NOT NULL AND BEFORE_STATUS_CODE = 'VISIBLE' AND AFTER_STATUS_CODE = 'HIDDEN_BY_REPORT')
        OR (ACTION_CODE = 'RESTORE' AND ACTOR_TYPE_CODE = 'ADMIN'
            AND BEFORE_STATUS_CODE IS NOT NULL AND BEFORE_STATUS_CODE = 'HIDDEN_BY_REPORT' AND AFTER_STATUS_CODE = 'VISIBLE'))
);
COMMENT ON TABLE  BOARD_POST_LOG IS 'v0.3.2 (C7) 게시글 변경 이력 (N-06, N-33-2, N-34-3). 작성·수정·삭제·숨김·해제마다 한 줄. Spring이 글 작성과 CREATE 로그를 한 트랜잭션으로 처리하고 게시글 행 삭제를 금지한다';
COMMENT ON COLUMN BOARD_POST_LOG.ACTION_CODE IS 'CREATE, UPDATE, DELETE, HIDE=신고로 숨김, RESTORE=숨김 해제. 허용 조합은 CK_BPL_TRANSITION';
COMMENT ON COLUMN BOARD_POST_LOG.ACTOR_TYPE_CODE IS 'USER=작성자, ADMIN=관리자, SYSTEM=신고 건수 도달 자동 숨김';
COMMENT ON COLUMN BOARD_POST_LOG.ACTOR_USER_ID IS 'v0.3.2 (C7) 행동한 회원. SYSTEM이면 NULL, USER·ADMIN이면 필수';
COMMENT ON COLUMN BOARD_POST_LOG.REPORT_ID IS 'v0.3.2 (C7) 신고 때문에 생긴 변경일 때. FK는 참조 로그가 있는 신고의 삭제만 막고 Spring이 신고 행 삭제를 금지한다';

-- 설정값 (신고 자동 숨김 기준·하루 신고 횟수·챗봇 하루 질문 횟수 등).
CREATE TABLE APP_SETTING (
    SETTING_KEY            VARCHAR2(50 CHAR)    NOT NULL,
    SETTING_VALUE          VARCHAR2(200 CHAR)   NOT NULL,
    DESCRIPTION            VARCHAR2(200 CHAR),
    UPDATED_BY             NUMBER(19),
    UPDATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_APP_SETTING PRIMARY KEY (SETTING_KEY),
    CONSTRAINT FK_AST_UPDATED_BY FOREIGN KEY (UPDATED_BY) REFERENCES APP_USER (USER_ID)
);
COMMENT ON TABLE  APP_SETTING IS '관리자가 바꾸는 설정값 (예: REPORT_AUTO_HIDE_COUNT=5(3~10), REPORT_DAILY_LIMIT=3, CHATBOT_DAILY_LIMIT=10)';


-- ====================================================================
-- 8. 금융사전·챗봇 (N-30, N-32)
-- ====================================================================

-- N-30 쉬운 금융사전.
CREATE TABLE GLOSSARY_TERM (
    TERM_ID                NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    TERM                   VARCHAR2(50 CHAR)    NOT NULL,
    EASY_TEXT              VARCHAR2(200 CHAR)   NOT NULL,
    EXPLANATION            VARCHAR2(1000 CHAR),
    CONSTRAINT PK_GLOSSARY_TERM PRIMARY KEY (TERM_ID),
    CONSTRAINT UK_GLT_TERM UNIQUE (TERM)
);
COMMENT ON TABLE  GLOSSARY_TERM IS '금융 용어 사전 (N-30 쉬운 말 바꾸기, N-32 용어 설명)';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN GLOSSARY_TERM.EASY_TEXT IS '바꿔 보여 줄 쉬운 말 (N-30-2 [쉬운 말로 보기])';
COMMENT ON COLUMN GLOSSARY_TERM.EXPLANATION IS '툴팁·용어 도우미에 보일 뜻 풀이';

-- N-32-1 미리 정한 질문 버튼 4개.
CREATE TABLE CHATBOT_PRESET_QUESTION (
    PRESET_ID              NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    QUESTION_TEXT          VARCHAR2(200 CHAR)   NOT NULL,
    ANSWER_TEXT            VARCHAR2(2000 CHAR)  NOT NULL,
    DISPLAY_ORDER          NUMBER(2)            NOT NULL,
    CONSTRAINT PK_CHATBOT_PRESET_QUESTION PRIMARY KEY (PRESET_ID)
);
COMMENT ON TABLE  CHATBOT_PRESET_QUESTION IS '용어 도우미 질문 버튼과 답 (N-32-1, 횟수 차감 없음)';

-- N-32-2 자유 질문 횟수 집계 (하루 10회).
CREATE TABLE CHATBOT_QUESTION_LOG (
    QUESTION_LOG_ID        NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    USER_ID                NUMBER(19)           NOT NULL,
    ASKED_AT               TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    SUCCESS_YN             CHAR(1)              NOT NULL,
    CONSTRAINT PK_CHATBOT_QUESTION_LOG PRIMARY KEY (QUESTION_LOG_ID),
    CONSTRAINT FK_CQL_USER FOREIGN KEY (USER_ID) REFERENCES APP_USER (USER_ID),
    CONSTRAINT CK_CQL_SUCCESS_YN CHECK (SUCCESS_YN IN ('Y', 'N'))
);
COMMENT ON TABLE  CHATBOT_QUESTION_LOG IS 'AI 자유 질문 호출 기록 (하루 횟수 계산용). 질문 글은 저장하지 않는다';
-- v0.3.2 (C6) C조 열 주석 보완
COMMENT ON COLUMN CHATBOT_QUESTION_LOG.SUCCESS_YN IS 'AI 호출 성공 여부. 하루 횟수는 Y만 센다(실패한 호출은 차감하지 않음)';


-- ====================================================================
-- 9. 감사 로그 (N-35)
-- ====================================================================

-- N-35 개인신용정보 열람 감사 로그. 애플리케이션 계정에는 INSERT·SELECT 권한만 준다.
CREATE TABLE ACCESS_AUDIT_LOG (
    AUDIT_ID               NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    VIEWER_USER_ID         NUMBER(19)           NOT NULL,
    TARGET_USER_ID         NUMBER(19),
    ACCESS_REASON          VARCHAR2(300 CHAR)   NOT NULL,
    ACCESSED_RESOURCE      VARCHAR2(100 CHAR)   NOT NULL,
    CLIENT_IP              VARCHAR2(50 CHAR),
    ACCESSED_AT            TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_ACCESS_AUDIT_LOG PRIMARY KEY (AUDIT_ID)
);
COMMENT ON TABLE  ACCESS_AUDIT_LOG IS '관리자의 회원 신용·소비 데이터 열람 기록 (N-35). 수정·삭제 금지라 FK 없이 ID만 남긴다';
COMMENT ON COLUMN ACCESS_AUDIT_LOG.VIEWER_USER_ID IS '열람한 관리자 USER_ID';
COMMENT ON COLUMN ACCESS_AUDIT_LOG.TARGET_USER_ID IS '열람 대상 회원 USER_ID (탈퇴 후에도 값 유지)';
COMMENT ON COLUMN ACCESS_AUDIT_LOG.ACCESS_REASON IS '열람 사유 (없으면 열람 불가)';
COMMENT ON COLUMN ACCESS_AUDIT_LOG.ACCESSED_RESOURCE IS '열람한 화면·데이터 (예: CREDIT_PROFILE, ASSESSMENT)';

-- v0.3.2 (W6) N-28 접근·시스템 로그. 인증·정보·경고 이벤트를 시간순으로 남긴다.
CREATE TABLE SYSTEM_LOG (
    SYSTEM_LOG_ID          NUMBER(19)           GENERATED BY DEFAULT ON NULL AS IDENTITY,
    LOG_TYPE_CODE          VARCHAR2(10 CHAR)    NOT NULL,
    LOG_SOURCE             VARCHAR2(30 CHAR)    NOT NULL,
    MESSAGE                VARCHAR2(500 CHAR)   NOT NULL,
    ACTOR_USER_ID          NUMBER(19),
    CREATED_AT             TIMESTAMP            DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_SYSTEM_LOG PRIMARY KEY (SYSTEM_LOG_ID),
    CONSTRAINT CK_SYL_TYPE CHECK (LOG_TYPE_CODE IN ('AUTH', 'INFO', 'WARN'))
);
COMMENT ON TABLE  SYSTEM_LOG IS 'v0.3.2 (W6) 접근·시스템 로그 (N-28). 수정·삭제 금지라 FK 없이 ID만 남긴다. 2년 이상 보관';
COMMENT ON COLUMN SYSTEM_LOG.LOG_TYPE_CODE IS 'AUTH=인증, INFO=정보, WARN=경고';
COMMENT ON COLUMN SYSTEM_LOG.LOG_SOURCE IS '발생한 곳 (예: auth-service, scoring-api, board, batch). 값 목록은 두지 않는다';
COMMENT ON COLUMN SYSTEM_LOG.MESSAGE IS '내용. 이름·연락처 원문은 넣지 않고 마스킹한 값만 쓴다';
COMMENT ON COLUMN SYSTEM_LOG.ACTOR_USER_ID IS '관련 계정 USER_ID (시스템 이벤트면 NULL)';

-- 수정·삭제 차단: 테이블 소유 계정과 애플리케이션 접속 계정을 나누고, 앱 계정에는 아래 권한만 준다.
-- 계정 이름은 배포 때 정한다 (TODO). 앱 계정이 이 스키마 소유자면 아래 GRANT로는 막히지 않는다.
-- GRANT SELECT, INSERT ON ACCESS_AUDIT_LOG TO {앱_계정};
-- GRANT SELECT, INSERT ON SYSTEM_LOG TO {앱_계정};


-- ====================================================================
-- 10. 인덱스
-- ====================================================================
CREATE INDEX IX_APU_PHONE_HMAC ON APP_USER (PHONE_HMAC);
CREATE INDEX IX_UCS_USER_TYPE ON USER_CONSENT (USER_ID, CONSENT_TYPE_CODE);
CREATE INDEX IX_VCD_TARGET ON VERIFICATION_CODE (TARGET_HMAC, PURPOSE_CODE, CREATED_AT);
CREATE INDEX IX_ULN_USER_MONTH ON USER_LOAN (USER_ID, BASE_MONTH);
CREATE INDEX IX_UEI_USER_MONTH ON USER_EXPENSE_ITEM (USER_ID, BASE_MONTH);
CREATE INDEX IX_ASM_USER_ASSESSED ON ASSESSMENT (USER_ID, ASSESSED_AT DESC);
CREATE INDEX IX_ASM_GROUP ON ASSESSMENT (DATASET_CODE, WORKER_TYPE_CODE, AGE_BAND_CODE);
CREATE INDEX IX_BPT_CREATED ON BOARD_POST (CREATED_AT DESC);
CREATE INDEX IX_BCM_POST ON BOARD_COMMENT (POST_ID, CREATED_AT);
CREATE INDEX IX_CRP_POST ON CONTENT_REPORT (POST_ID);
CREATE INDEX IX_CRP_COMMENT ON CONTENT_REPORT (COMMENT_ID);
CREATE INDEX IX_CRP_REPORTER_DAY ON CONTENT_REPORT (REPORTER_USER_ID, REPORTED_AT);
-- 같은 사용자가 같은 글·댓글을 두 번 신고하지 못하게 한다.
-- 신고자와 대상이 모두 있을 때만 키를 채운다. 신고자가 비어 있거나 대상이 다른 종류면 키가 모두 NULL이라 검사에서 빠진다.
CREATE UNIQUE INDEX UX_CRP_REPORTER_POST ON CONTENT_REPORT (
    CASE WHEN REPORTER_USER_ID IS NOT NULL AND POST_ID IS NOT NULL THEN REPORTER_USER_ID END,
    CASE WHEN REPORTER_USER_ID IS NOT NULL AND POST_ID IS NOT NULL THEN POST_ID END);
CREATE UNIQUE INDEX UX_CRP_REPORTER_COMMENT ON CONTENT_REPORT (
    CASE WHEN REPORTER_USER_ID IS NOT NULL AND COMMENT_ID IS NOT NULL THEN REPORTER_USER_ID END,
    CASE WHEN REPORTER_USER_ID IS NOT NULL AND COMMENT_ID IS NOT NULL THEN COMMENT_ID END);
CREATE INDEX IX_CQL_USER_DAY ON CHATBOT_QUESTION_LOG (USER_ID, ASKED_AT);
CREATE INDEX IX_AAL_TARGET ON ACCESS_AUDIT_LOG (TARGET_USER_ID, ACCESSED_AT);
-- v0.3.2 (W6) N-28 시간순·구분별 조회
CREATE INDEX IX_SYL_CREATED ON SYSTEM_LOG (CREATED_AT);
CREATE INDEX IX_SYL_TYPE ON SYSTEM_LOG (LOG_TYPE_CODE, CREATED_AT);
-- v0.3.2 (C5) N-24-2·5 동·업종 최근 4분기 조회 (PK가 분기부터 시작해 앞에서부터 못 씀)
CREATE INDEX IX_FDS_DONG_CAT ON FACT_DONG_SALES (ADM_DONG_CODE, SERVICE_CATEGORY_CODE, BASE_QUARTER);
CREATE INDEX IX_FDT_DONG_CAT ON FACT_DONG_STORE (ADM_DONG_CODE, SERVICE_CATEGORY_CODE, BASE_QUARTER);
-- v0.3.2 (C7) 게시글별 이력 조회, 참조 행이 있으면 삭제를 막는 FK의 부모 삭제 검사 때 표 잠금 방지
CREATE INDEX IX_BPL_POST ON BOARD_POST_LOG (POST_ID, CREATED_AT);
CREATE INDEX IX_BPL_ACTOR ON BOARD_POST_LOG (ACTOR_USER_ID);
CREATE INDEX IX_BPL_REPORT ON BOARD_POST_LOG (REPORT_ID);

-- v0.2: 버전 관리 표. ACTIVE는 동시에 1개만 (ACTIVE인 행만 키가 1이고 나머지는 NULL이라 색인에서 빠진다).
CREATE UNIQUE INDEX UX_SCV_ACTIVE ON SCORE_CUTOFF_VERSION (CASE WHEN STATUS_CODE = 'ACTIVE' THEN 1 END);
CREATE UNIQUE INDEX UX_MRG_ACTIVE ON MODEL_REGISTRY (CASE WHEN STATUS_CODE = 'ACTIVE' THEN 1 END);
CREATE INDEX IX_ASM_MODEL ON ASSESSMENT (MODEL_VERSION, DATASET_CODE);
CREATE INDEX IX_DSV_PARENT ON DATASET_VERSION (PARENT_DATASET_VERSION_ID);
CREATE INDEX IX_MAF_DATASET ON MODEL_ARTIFACT (TRAIN_DATASET_VERSION_ID);


-- ====================================================================
-- 11. 기준 데이터
-- ====================================================================
INSERT INTO DIM_WORKER_TYPE (WORKER_TYPE_CODE, WORKER_TYPE_NAME, DISPLAY_ORDER, REQUIRED_INCOME_MONTHS) VALUES ('EMPLOYEE', '급여소득자', 1, 1);
INSERT INTO DIM_WORKER_TYPE (WORKER_TYPE_CODE, WORKER_TYPE_NAME, DISPLAY_ORDER, REQUIRED_INCOME_MONTHS) VALUES ('SELF_EMPLOYED', '자영업자', 2, 12);
INSERT INTO DIM_WORKER_TYPE (WORKER_TYPE_CODE, WORKER_TYPE_NAME, DISPLAY_ORDER, REQUIRED_INCOME_MONTHS) VALUES ('FREELANCER', '프리랜서', 3, 12);
INSERT INTO DIM_ROLE VALUES ('ROLE_USER', '일반 사용자');
INSERT INTO DIM_ROLE VALUES ('ROLE_ADMIN', '관리자');
-- 대출 종류: UI 입력 화면의 6종
INSERT INTO DIM_LOAN_TYPE VALUES ('CREDIT', '신용대출', 'N', 1);
INSERT INTO DIM_LOAN_TYPE VALUES ('BUSINESS_OPERATING', '사업자 운전자금', 'N', 2);
INSERT INTO DIM_LOAN_TYPE VALUES ('JEONSE', '전세자금대출', 'N', 3);
INSERT INTO DIM_LOAN_TYPE VALUES ('MORTGAGE', '주택담보대출', 'N', 4);
INSERT INTO DIM_LOAN_TYPE VALUES ('CARD_LOAN', '카드론', 'N', 5);
INSERT INTO DIM_LOAN_TYPE VALUES ('OTHER', '기타', 'N', 6);
-- v0.2 (B1) 등급 구간 버전 CUT-0.1 = 시연용 임시값 (D-01). 모형 학습 후 새 버전을 추가하고 ACTIVE를 옮긴다.
INSERT INTO SCORE_CUTOFF_VERSION (CUTOFF_VERSION, STATUS_CODE, NOTE, ACTIVATED_AT) VALUES ('CUT-0.1', 'ACTIVE', '시연용 임시값 (D-01). 모형 완성 후 점수대별 연체율로 재계산', SYSTIMESTAMP);
INSERT INTO SCORE_GRADE_BAND (CUTOFF_VERSION, GRADE_BAND_CODE, MIN_SCORE, MAX_SCORE, DISPLAY_ORDER) VALUES ('CUT-0.1', 'CAUTION', 0, 664, 1);
INSERT INTO SCORE_GRADE_BAND (CUTOFF_VERSION, GRADE_BAND_CODE, MIN_SCORE, MAX_SCORE, DISPLAY_ORDER) VALUES ('CUT-0.1', 'STANDARD', 665, 779, 2);
INSERT INTO SCORE_GRADE_BAND (CUTOFF_VERSION, GRADE_BAND_CODE, MIN_SCORE, MAX_SCORE, DISPLAY_ORDER) VALUES ('CUT-0.1', 'GOOD', 780, 1000, 3);
-- v0.2 (B4) 산출 불가 사유
INSERT INTO DIM_NOT_SCORABLE_REASON (REASON_CODE, REASON_NAME, DISPLAY_ORDER) VALUES ('CONSENT_REQUIRED', '외부 조회 동의 없음', 1);
INSERT INTO DIM_NOT_SCORABLE_REASON (REASON_CODE, REASON_NAME, DISPLAY_ORDER) VALUES ('INPUT_INCOMPLETE', '필수 입력 부족 (소득 개월 수 미달 등)', 2);
INSERT INTO DIM_NOT_SCORABLE_REASON (REASON_CODE, REASON_NAME, DISPLAY_ORDER) VALUES ('STALE_INPUT', '입력 기준월이 오래됨 (갱신 필요)', 3);
INSERT INTO DIM_NOT_SCORABLE_REASON (REASON_CODE, REASON_NAME, DISPLAY_ORDER) VALUES ('MODEL_ERROR', '모델 서버 오류', 4);
-- v0.2 (B2·P2) 피처 정의서 확정 전의 자리표시 버전. 피처 정의서 v1이 나오면 FS-V1을 추가하고 DIM_FEATURE를 채운다.
INSERT INTO FEATURE_SET_VERSION (FEATURE_SET_VERSION, STATUS_CODE, NOTE) VALUES ('FS-DRAFT', 'DRAFT', '피처 정의서(FP-132) 확정 전 자리표시. 개발·더미 데이터용');
-- v0.2 (P2) 개발용 더미 모델. 실제 모델을 등록하면 이 행은 RETIRED로 바꾼다 (ACTIVE는 1개만 가능).
INSERT INTO MODEL_REGISTRY (MODEL_VERSION, ALGORITHM_NAME, FEATURE_SET_VERSION, STATUS_CODE, ACTIVATED_AT, NOTE) VALUES ('DEV-DUMMY', 'DUMMY', 'FS-DRAFT', 'ACTIVE', SYSTIMESTAMP, '프론트·백엔드 테스트용 더미. 실제 모델 아님');
INSERT INTO APP_SETTING (SETTING_KEY, SETTING_VALUE, DESCRIPTION) VALUES ('REPORT_AUTO_HIDE_COUNT', '5', '신고 자동 숨김 기준 건수 (3~10)');
INSERT INTO APP_SETTING (SETTING_KEY, SETTING_VALUE, DESCRIPTION) VALUES ('REPORT_DAILY_LIMIT', '3', '한 사용자의 하루 신고 횟수');
INSERT INTO APP_SETTING (SETTING_KEY, SETTING_VALUE, DESCRIPTION) VALUES ('CHATBOT_DAILY_LIMIT', '10', '자유 질문 하루 횟수');
-- v0.2 (R3) 입력 최신성 한도. 기준월이 현재 달보다 이 개월 수를 넘게 오래되면 산출하지 않고 갱신을 안내한다 (STALE_INPUT).
INSERT INTO APP_SETTING (SETTING_KEY, SETTING_VALUE, DESCRIPTION) VALUES ('INPUT_MAX_AGE_MONTHS', '3', '입력 기준월 최신성 한도(개월). 임시값, 팀 결정 전');
COMMIT;
