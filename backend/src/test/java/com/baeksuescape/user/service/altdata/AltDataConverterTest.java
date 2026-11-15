package com.baeksuescape.user.service.altdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.baeksuescape.user.dto.DataInputRows.BillRow;
import com.baeksuescape.user.dto.DataInputRows.EasypayRow;
import com.baeksuescape.user.dto.DataInputRows.InsuranceRow;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// FP-85 N-05-6 가상 기관 응답 변환 규칙 — build_db.py와 같은지 본다. 테스트 리소스 altdata/*.jsonl은 합성 2명분이다.
class AltDataConverterTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // 테스트 리소스 파일의 n번째 줄(0부터)을 읽는다.
    private JsonNode line(String fileName, int index) throws IOException {
        try (InputStream in = getClass().getResourceAsStream("/altdata/" + fileName)) {
            String[] lines = new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\\R");
            return objectMapper.readTree(lines[index]);
        }
    }

    @Test
    void memberIdBecomesUserIdWithoutLeadingZeros() {
        assertThat(AltDataConverter.userIdOf("MEM000102")).isEqualTo(102L);
        assertThat(AltDataConverter.userIdOf("MEM000001")).isEqualTo(1L);
        assertThatThrownBy(() -> AltDataConverter.userIdOf("M102")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> AltDataConverter.userIdOf(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void billStatusesFollowU3Rule() throws IOException {
        List<BillRow> rows = AltDataConverter.bills(line("telecom_responses.jsonl", 0));

        assertThat(rows).extracting(BillRow::getPaymentStatusCode).containsExactly("ON_TIME", "LATE", "UNPAID");
        assertThat(rows.get(1).getPaidDate()).isEqualTo(LocalDate.of(2025, 11, 2));
        assertThat(rows.get(2).getPaidDate()).isNull();
        assertThat(rows.get(0).getBilledAmt()).isEqualTo(78430L);
        assertThat(rows.get(0).getDueDate()).isEqualTo(LocalDate.of(2025, 9, 25));
    }

    @Test
    void easypayMissingAndUnknownStatusesHaveNoValues() throws IOException {
        List<EasypayRow> rows = AltDataConverter.easypay(line("payment_responses.jsonl", 0));

        assertThat(rows).extracting(EasypayRow::getObservationStatusCode).containsExactly("OBSERVED", "NO_ACTIVITY", "MISSING", "MISSING");
        assertThat(rows.get(0).getPaymentCount()).isEqualTo(16);
        assertThat(rows.get(0).getPaymentAmt()).isEqualTo(361540L);
        assertThat(rows.get(1).getPaymentCount()).isZero();
        assertThat(rows.get(2).getPaymentCount()).isNull();
        assertThat(rows.get(3).getPaymentAmt()).isNull();
        assertThat(rows.get(3).getActiveDays()).isNull();
    }

    @Test
    void publicInsuranceSplitsByTypeAndUppercasesCodes() throws IOException {
        JsonNode response = line("public_insurance_responses.jsonl", 0);

        List<InsuranceRow> pension = AltDataConverter.insurance(response, "NATIONAL_PENSION");
        List<InsuranceRow> health = AltDataConverter.insurance(response, "HEALTH_INSURANCE");

        assertThat(pension).hasSize(2);
        assertThat(health).hasSize(1);
        assertThat(pension.get(0).getPaymentStatusCode()).isEqualTo("PARTIAL");
        assertThat(pension.get(0).getPayerTypeCode()).isEqualTo("REGIONAL");
        assertThat(pension.get(1).getCoverageStatusCode()).isEqualTo("EXEMPT");
        assertThat(pension.get(1).getPaymentStatusCode()).isEqualTo("NOT_APPLICABLE");
        // DDL CHECK 목록 밖 값은 UNKNOWN으로 바꾼다.
        assertThat(pension.get(1).getPayerTypeCode()).isEqualTo("UNKNOWN");
        assertThat(pension.get(1).getBilledAmt()).isNull();
        assertThat(pension.get(1).getDueDate()).isNull();
        assertThat(health.get(0).getInsuranceTypeCode()).isEqualTo("HEALTH_INSURANCE");
        assertThat(health.get(0).getCoverageStatusCode()).isEqualTo("COVERED");
        assertThat(AltDataConverter.asOfDate(response)).isEqualTo(LocalDate.of(2026, 9, 18));
    }

    @Test
    void viewsUseMockFieldNames() throws IOException {
        BillRow bill = AltDataConverter.bills(line("telecom_responses.jsonl", 0)).get(2);

        assertThat(AltDataConverter.telecomView(bill)).containsOnlyKeys("month", "billedAmount", "paymentStatus", "paymentStatusCode", "dueDate",
                "paidDate");
        assertThat(AltDataConverter.telecomView(bill)).containsEntry("paymentStatus", "미납").containsEntry("dueDate", "2025-11-25")
                .containsEntry("paidDate", null);
        assertThat(AltDataConverter.utilityView(bill)).containsOnlyKeys("billMonth", "billedAmt", "paymentStatusCode", "dueDate", "paidDate");
        EasypayRow easypay = AltDataConverter.easypay(line("payment_responses.jsonl", 0)).get(0);
        assertThat(AltDataConverter.easypayView(easypay)).containsOnlyKeys("month", "paymentCount", "paymentAmount", "observationStatusCode",
                "activeDays");
        InsuranceRow insurance = AltDataConverter.insurance(line("public_insurance_responses.jsonl", 0), "HEALTH_INSURANCE").get(0);
        assertThat(AltDataConverter.insuranceView(insurance)).containsOnlyKeys("month", "paidAmount", "paymentStatus", "insuranceTypeCode",
                "coverageStatusCode", "payerTypeCode", "paymentStatusCode", "dueDate", "paidDate");
    }
}
