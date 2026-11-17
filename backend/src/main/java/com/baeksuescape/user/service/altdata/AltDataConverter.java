package com.baeksuescape.user.service.altdata;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import com.baeksuescape.user.dto.DataInputRows.BillRow;
import com.baeksuescape.user.dto.DataInputRows.EasypayRow;
import com.baeksuescape.user.dto.DataInputRows.InsuranceRow;
import com.fasterxml.jackson.databind.JsonNode;

// FP-85 N-05-6 가상 기관 응답 → DB 행·화면 표 행 변환. 규칙은 더미 시드 생성기(docs/spec/sql/dummy_db/tools/build_db.py)와 같다.
// USER_ID·CONSENT_ID·BASE_DATE·CREATED_AT은 저장할 때 서비스가 채운다.
public final class AltDataConverter {

    private static final Pattern MEMBER_ID = Pattern.compile("^MEM\\d{6}$");

    // DDL CHECK 목록. 목록 밖 값은 UNKNOWN으로 바꿔 CHECK 오류를 막는다.
    private static final Set<String> COVERAGE_CODES = Set.of("COVERED", "EXEMPT", "DEPENDENT", "NOT_COVERED", "UNKNOWN");
    private static final Set<String> PAYER_CODES = Set.of("WORKPLACE", "REGIONAL", "VOLUNTARY", "HOUSEHOLD", "UNKNOWN");
    private static final Set<String> INSURANCE_STATUS_CODES = Set.of("ON_TIME", "LATE", "PARTIAL", "UNPAID", "NOT_DUE", "NOT_APPLICABLE", "UNKNOWN");
    private static final Set<String> OBSERVATION_CODES = Set.of("OBSERVED", "NO_ACTIVITY", "MISSING");

    // 화면 표의 납부 상태 글자(mock altDataMock.js PAYMENT_STATUS_TEXT와 같고, 보험 상태를 더했다).
    private static final Map<String, String> PAYMENT_STATUS_TEXT = Map.of(
            "ON_TIME", "정상 납부", "LATE", "연체", "UNPAID", "미납", "PARTIAL", "일부 납부", "NOT_DUE", "납부 기한 전",
            "NOT_APPLICABLE", "납부 대상 아님", "UNKNOWN", "확인 불가");

    private AltDataConverter() {
    }

    // member_id 'MEM000102' → USER_ID 102(숫자 부분, 앞의 0 제거).
    public static long userIdOf(String memberId) {
        if (memberId == null || !MEMBER_ID.matcher(memberId).matches()) {
            throw new IllegalArgumentException("member_id 형식이 아닙니다");
        }
        return Long.parseLong(memberId.substring(3));
    }

    // 응답의 기준일(as_of_date). 없으면 null.
    public static LocalDate asOfDate(JsonNode response) {
        return date(response, "as_of_date");
    }

    // 통신·공과금 납부 상태(v0.3.1 U3): on_time → ON_TIME, late + 납부일 → LATE, late + 납부일 없음 → UNPAID.
    public static String billStatus(String paymentStatus, LocalDate paidDate) {
        String status = upper(paymentStatus);
        return "LATE".equals(status) && paidDate == null ? "UNPAID" : status;
    }

    // 통신비·공과금 bills[] → 청구 월마다 한 행.
    public static List<BillRow> bills(JsonNode response) {
        List<BillRow> rows = new ArrayList<>();
        for (JsonNode bill : response.path("bills")) {
            BillRow row = new BillRow();
            row.setBillMonth(bill.path("bill_month").asText());
            row.setBilledAmt(number(bill, "billed_amount_krw"));
            row.setDueDate(date(bill, "due_date"));
            row.setPaidDate(date(bill, "paid_date"));
            row.setPaymentStatusCode(billStatus(text(bill, "payment_status"), row.getPaidDate()));
            rows.add(row);
        }
        return rows;
    }

    // 간편결제 months[] → 달마다 한 행. MISSING(미수집)이면 건수·금액·이용일 수를 비운다(CK_UEU_VALUES).
    public static List<EasypayRow> easypay(JsonNode response) {
        List<EasypayRow> rows = new ArrayList<>();
        for (JsonNode month : response.path("months")) {
            String status = upper(text(month, "observation_status"));
            EasypayRow row = new EasypayRow();
            row.setBaseMonth(month.path("month").asText());
            // 목록 밖 관측 상태는 값을 믿을 수 없어 미수집으로 둔다.
            row.setObservationStatusCode(OBSERVATION_CODES.contains(status) ? status : "MISSING");
            if (!"MISSING".equals(row.getObservationStatusCode())) {
                row.setPaymentCount(integer(month, "payment_count"));
                row.setPaymentAmt(number(month, "payment_amount_krw"));
                row.setActiveDays(integer(month, "active_days"));
            }
            rows.add(row);
        }
        return rows;
    }

    // 사회보험 records[] 중 한 보험 종류(NATIONAL_PENSION·HEALTH_INSURANCE)만 골라 행으로 바꾼다.
    public static List<InsuranceRow> insurance(JsonNode response, String insuranceTypeCode) {
        List<InsuranceRow> rows = new ArrayList<>();
        for (JsonNode record : response.path("records")) {
            if (!insuranceTypeCode.equals(upper(text(record, "insurance_type")))) {
                continue;
            }
            InsuranceRow row = new InsuranceRow();
            row.setInsuranceTypeCode(insuranceTypeCode);
            row.setBaseMonth(record.path("month").asText());
            row.setCoverageStatusCode(code(text(record, "coverage_status"), COVERAGE_CODES));
            row.setPayerTypeCode(code(text(record, "payer_type"), PAYER_CODES));
            row.setBilledAmt(number(record, "billed_amount_krw"));
            row.setIndividualAmt(number(record, "individual_responsibility_krw"));
            row.setPaidAmt(number(record, "paid_amount_krw"));
            row.setDueDate(date(record, "due_date"));
            row.setPaidDate(date(record, "paid_date"));
            row.setPaymentStatusCode(code(text(record, "payment_status"), INSURANCE_STATUS_CODES));
            rows.add(row);
        }
        return rows;
    }

    // ── 화면 표 행(mock altDataMock.js와 같은 필드) ──

    public static Map<String, Object> telecomView(BillRow row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("month", row.getBillMonth());
        view.put("billedAmount", row.getBilledAmt());
        view.put("paymentStatus", statusText(row.getPaymentStatusCode()));
        view.put("paymentStatusCode", row.getPaymentStatusCode());
        view.put("dueDate", text(row.getDueDate()));
        view.put("paidDate", text(row.getPaidDate()));
        return view;
    }

    public static Map<String, Object> utilityView(BillRow row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("billMonth", row.getBillMonth());
        view.put("billedAmt", row.getBilledAmt());
        view.put("paymentStatusCode", row.getPaymentStatusCode());
        view.put("dueDate", text(row.getDueDate()));
        view.put("paidDate", text(row.getPaidDate()));
        return view;
    }

    public static Map<String, Object> easypayView(EasypayRow row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("month", row.getBaseMonth());
        view.put("paymentCount", row.getPaymentCount());
        view.put("paymentAmount", row.getPaymentAmt());
        view.put("observationStatusCode", row.getObservationStatusCode());
        view.put("activeDays", row.getActiveDays());
        return view;
    }

    public static Map<String, Object> insuranceView(InsuranceRow row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("month", row.getBaseMonth());
        view.put("paidAmount", row.getPaidAmt());
        view.put("paymentStatus", statusText(row.getPaymentStatusCode()));
        view.put("insuranceTypeCode", row.getInsuranceTypeCode());
        view.put("coverageStatusCode", row.getCoverageStatusCode());
        view.put("payerTypeCode", row.getPayerTypeCode());
        view.put("paymentStatusCode", row.getPaymentStatusCode());
        view.put("dueDate", text(row.getDueDate()));
        view.put("paidDate", text(row.getPaidDate()));
        return view;
    }

    static String statusText(String code) {
        return PAYMENT_STATUS_TEXT.getOrDefault(code, code);
    }

    // ── JSON 읽기 도우미 ──

    private static String code(String value, Set<String> allowed) {
        String upper = upper(value);
        return allowed.contains(upper) ? upper : "UNKNOWN";
    }

    private static String upper(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static Long number(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asLong();
    }

    private static Integer integer(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asInt();
    }

    private static LocalDate date(JsonNode node, String field) {
        String value = text(node, field);
        return value == null || value.isBlank() ? null : LocalDate.parse(value);
    }

    private static String text(LocalDate date) {
        return date == null ? null : date.toString();
    }
}
