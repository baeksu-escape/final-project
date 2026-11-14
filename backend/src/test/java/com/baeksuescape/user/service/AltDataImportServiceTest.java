package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.DataInputFixtures.NOW;
import static com.baeksuescape.user.service.DataInputFixtures.codeOf;
import static com.baeksuescape.user.service.DataInputFixtures.consent;
import static com.baeksuescape.user.service.DataInputFixtures.member;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.config.AvenueProperties.MissingMemberMode;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.dto.DataInputRows.BillRow;
import com.baeksuescape.user.dto.DataInputRows.ConsentRow;
import com.baeksuescape.user.dto.DataInputRows.InsuranceRow;
import com.baeksuescape.user.mapper.AltDataMapper;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.service.altdata.AltDataKind;
import com.baeksuescape.user.service.altdata.JsonlAltDataSource;
import com.fasterxml.jackson.databind.ObjectMapper;

// FP-85 N-05-6 대안 데이터 불러오기(INP-03). 원천은 테스트 리소스 altdata/*.jsonl(합성 2명분), DB는 mock으로 대신한다.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AltDataImportServiceTest {

    @Mock
    private AltDataMapper altDataMapper;
    @Mock
    private UserConsentMapper consentMapper;
    @Mock
    private UserAccountMapper userMapper;

    private AvenueProperties properties;
    private AltDataImportService service;

    private static String testSourceDir() {
        try {
            return Path.of(AltDataImportServiceTest.class.getResource("/altdata").toURI()).toString();
        } catch (URISyntaxException e) {
            throw new IllegalStateException(e);
        }
    }

    // 설정(폴더·빈 회원 처리 방식)에 맞춰 서비스를 새로 만든다.
    private void build(String sourceDir, MissingMemberMode mode) {
        properties = TestKeys.properties();
        properties.getAltdata().setSourceDir(sourceDir);
        properties.getAltdata().setMissingMemberMode(mode);
        JsonlAltDataSource source = new JsonlAltDataSource(properties, new ObjectMapper());
        service = new AltDataImportService(source, altDataMapper, consentMapper, new DataInputUsers(userMapper, UserFixtures.CLOCK), properties);
    }

    @BeforeEach
    void setUp() {
        build(testSourceDir(), MissingMemberMode.EMPTY);
        given(userMapper.selectById(1L)).willReturn(member(1L, "EMPLOYEE"));
        given(userMapper.selectById(500L)).willReturn(member(500L, "EMPLOYEE"));
        given(userMapper.selectById(501L)).willReturn(member(501L, "EMPLOYEE"));
        given(consentMapper.selectAltConsent(1L, 10L)).willReturn(consent(10L, 1L, AltDataKind.TELECOM, false));
        given(consentMapper.selectAltConsent(1L, 11L)).willReturn(consent(11L, 1L, AltDataKind.NATIONAL_PENSION, false));
        given(consentMapper.selectAltConsent(500L, 20L)).willReturn(consent(20L, 500L, AltDataKind.TELECOM, false));
        given(consentMapper.selectAltConsent(501L, 21L)).willReturn(consent(21L, 501L, AltDataKind.TELECOM, false));
    }

    private DataInputDtos.AltDataImportResponse importTelecom(long userId, Long consentId) {
        return service.importData(userId, "telecom", new DataInputDtos.AltDataImportRequest("2026-10", consentId));
    }

    @Test
    void importNeedsOwnActiveConsentOfSameItem() {
        assertThat(codeOf(() -> importTelecom(1L, null))).isEqualTo("CONSENT_REQUIRED");
        // 다른 회원의 동의 번호(조회 결과 없음)
        assertThat(codeOf(() -> importTelecom(1L, 99L))).isEqualTo("CONSENT_REQUIRED");
        // 다른 항목(국민연금) 동의로 통신비를 부름
        assertThat(codeOf(() -> importTelecom(1L, 11L))).isEqualTo("CONSENT_REQUIRED");
        ConsentRow withdrawn = consent(12L, 1L, AltDataKind.TELECOM, true);
        withdrawn.setWithdrawnAt(NOW.minusHours(1));
        given(consentMapper.selectAltConsent(1L, 12L)).willReturn(withdrawn);
        assertThat(codeOf(() -> importTelecom(1L, 12L))).isEqualTo("CONSENT_REQUIRED");
        ConsentRow expired = consent(13L, 1L, AltDataKind.TELECOM, false);
        expired.setExpiresAt(NOW.minusSeconds(1));
        given(consentMapper.selectAltConsent(1L, 13L)).willReturn(expired);
        assertThat(codeOf(() -> importTelecom(1L, 13L))).isEqualTo("CONSENT_REQUIRED");
        verify(altDataMapper, never()).insertTelecom(any());
    }

    @Test
    void importReplacesPreviousRowsAndRecordsExternalConsentId() {
        DataInputDtos.AltDataImportResponse response = importTelecom(1L, 10L);

        InOrder order = inOrder(altDataMapper, consentMapper);
        order.verify(altDataMapper).deleteImportedTelecom(1L);
        order.verify(altDataMapper, times(3)).insertTelecom(any());
        order.verify(consentMapper).markImported(10L, "DUMMY-MEM000001-TELECOM_BILL");
        ArgumentCaptor<BillRow> rows = ArgumentCaptor.forClass(BillRow.class);
        verify(altDataMapper, times(3)).insertTelecom(rows.capture());
        BillRow first = rows.getAllValues().get(0);
        assertThat(first.getUserId()).isEqualTo(1L);
        assertThat(first.getConsentId()).isEqualTo(10L);
        assertThat(first.getCreatedAt()).isEqualTo(NOW);
        // 통신비 응답에는 기준일이 없어 원천 전체 기준일(가장 늦은 as_of_date)을 쓴다.
        assertThat(first.getBaseDate()).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(response.source()).isEqualTo("telecom");
        assertThat(response.consentId()).isEqualTo(10L);
        assertThat(response.notice()).isNull();
        assertThat(response.rows()).extracting(row -> row.get("paymentStatusCode")).containsExactly("ON_TIME", "LATE", "UNPAID");

        // 다시 불러오면 또 지우고 새로 넣는다.
        importTelecom(1L, 10L);
        verify(altDataMapper, times(2)).deleteImportedTelecom(1L);
        verify(altDataMapper, times(6)).insertTelecom(any());
    }

    @Test
    void insuranceUsesResponseAsOfDateAndOnlyItsType() {
        DataInputDtos.AltDataImportResponse response = service.importData(1L, "national-pension",
                new DataInputDtos.AltDataImportRequest("2026-10", 11L));

        verify(altDataMapper).deleteImportedInsurance(1L, "NATIONAL_PENSION");
        ArgumentCaptor<InsuranceRow> rows = ArgumentCaptor.forClass(InsuranceRow.class);
        verify(altDataMapper, times(2)).insertInsurance(rows.capture());
        assertThat(rows.getAllValues()).allMatch(row -> "NATIONAL_PENSION".equals(row.getInsuranceTypeCode()));
        assertThat(rows.getValue().getBaseDate()).isEqualTo(LocalDate.of(2026, 9, 18));
        assertThat(response.source()).isEqualTo("nationalPension");
        verify(consentMapper).markImported(11L, "DUMMY-MEM000001-NATIONAL_PENSION");
    }

    @Test
    void emptyModeGivesNoRowsWithNoticeButStillCompletes() {
        DataInputDtos.AltDataImportResponse response = importTelecom(500L, 20L);

        assertThat(response.rows()).isEmpty();
        assertThat(response.notice()).isEqualTo("이 계정은 기관 기록이 없습니다.");
        verify(altDataMapper).deleteImportedTelecom(500L);
        verify(altDataMapper, never()).insertTelecom(any());
        verify(consentMapper).markImported(20L, "DUMMY-MEM000500-TELECOM_BILL");
    }

    @Test
    void borrowModeUsesSameJobDummyMemberChosenByUserId() {
        build(testSourceDir(), MissingMemberMode.BORROW);
        // 3번 더미 회원은 통신비 파일에 없어서 후보에서 빠진다 → 후보 [1, 2]
        given(altDataMapper.selectDummyUserIds("EMPLOYEE")).willReturn(List.of(1L, 2L, 3L));

        DataInputDtos.AltDataImportResponse first = importTelecom(500L, 20L);
        DataInputDtos.AltDataImportResponse again = importTelecom(500L, 20L);
        DataInputDtos.AltDataImportResponse other = importTelecom(501L, 21L);

        // 500 % 2 = 0 → 1번 회원(3건), 501 % 2 = 1 → 2번 회원(1건). 같은 계정은 늘 같은 회원.
        assertThat(first.rows()).hasSize(3);
        assertThat(again.rows()).isEqualTo(first.rows());
        assertThat(other.rows()).hasSize(1);
        assertThat(first.notice()).isEqualTo("시연용 예시 데이터입니다.");
        ArgumentCaptor<BillRow> rows = ArgumentCaptor.forClass(BillRow.class);
        verify(altDataMapper, times(7)).insertTelecom(rows.capture());
        assertThat(rows.getAllValues().get(0).getUserId()).isEqualTo(500L);
        // PR #52 리뷰 6 — 후보 목록은 종류·직군마다 처음 한 번만 만든다(세 번 불러와도 DB 조회 1번).
        verify(altDataMapper, times(1)).selectDummyUserIds("EMPLOYEE");
        assertThat(service.borrowCandidates("EMPLOYEE", AltDataKind.TELECOM)).containsExactly(1L, 2L);
    }

    @Test
    void borrowCandidatesAreNotCachedWhileEmpty() {
        build(testSourceDir(), MissingMemberMode.BORROW);
        given(altDataMapper.selectDummyUserIds("EMPLOYEE")).willReturn(List.of());
        assertThat(service.borrowCandidates("EMPLOYEE", AltDataKind.TELECOM)).isEmpty();
        // 시드를 넣은 뒤에는 다시 찾아 후보를 만든다.
        given(altDataMapper.selectDummyUserIds("EMPLOYEE")).willReturn(List.of(2L, 1L));
        assertThat(service.borrowCandidates("EMPLOYEE", AltDataKind.TELECOM)).containsExactly(1L, 2L);
        verify(altDataMapper, times(2)).selectDummyUserIds("EMPLOYEE");
    }

    // PR #52 리뷰 4·5 — 같은 회원의 동시 불러오기가 지우기·넣기를 겹치지 않도록 맨 앞에서 회원 행을 잠근다.
    @Test
    void importLocksMemberRowFirst() {
        importTelecom(1L, 10L);

        InOrder order = inOrder(userMapper, consentMapper, altDataMapper);
        order.verify(userMapper).lockUser(1L);
        order.verify(userMapper).selectById(1L);
        order.verify(consentMapper).selectAltConsent(1L, 10L);
        order.verify(altDataMapper).deleteImportedTelecom(1L);
    }

    // PR #52 리뷰 3 — baseMonth는 형식만 검사한다(저장에는 쓰지 않음). 틀리면 400 + baseMonth 칸 오류.
    @Test
    void badBaseMonthFormatIs400OnBaseMonthField() {
        for (String bad : new String[] { "2026-13", "202610", "2026-1" }) {
            ApiException error = catchThrowableOfType(
                    () -> service.importData(1L, "telecom", new DataInputDtos.AltDataImportRequest(bad, 10L)), ApiException.class);
            assertThat(error.getStatus().value()).isEqualTo(400);
            assertThat(error.getFieldErrors()).containsExactly(new FieldErrorItem("baseMonth", "연-월(YYYY-MM) 형식으로 입력해 주세요."));
        }
        verify(altDataMapper, never()).deleteImportedTelecom(anyLong());
        // 형식이 맞으면 기준월과 상관없이 파일 기간 그대로 저장한다(기준월 2020-01이어도 2025-09~ 행).
        DataInputDtos.AltDataImportResponse response = service.importData(1L, "telecom", new DataInputDtos.AltDataImportRequest("2020-01", 10L));
        assertThat(response.rows()).isNotEmpty();
    }

    @Test
    void missingSourceIs503AndUnknownSourceIs404() {
        build(Path.of("no-such-altdata-dir").toAbsolutePath().toString(), MissingMemberMode.EMPTY);
        assertThat(codeOf(() -> importTelecom(1L, 10L))).isEqualTo("ALT_DATA_SOURCE_UNAVAILABLE");
        assertThat(codeOf(() -> service.importData(1L, "financial", new DataInputDtos.AltDataImportRequest("2026-10", 10L))))
                .isEqualTo("NOT_FOUND");
    }

    @Test
    void importNeedsJobTypeAndBaseMonth() {
        given(userMapper.selectById(2L)).willReturn(member(2L, null));
        assertThat(codeOf(() -> importTelecom(2L, 10L))).isEqualTo("JOB_TYPE_REQUIRED");
        assertThat(codeOf(() -> service.importData(1L, "telecom", new DataInputDtos.AltDataImportRequest(" ", 10L)))).isEqualTo("INVALID_INPUT");
    }

    @Test
    void completionNeedsActiveConsentWithExternalConsentId() {
        ConsentRow withdrawn = consent(3L, 1L, AltDataKind.EASYPAY, true);
        withdrawn.setWithdrawnAt(NOW.minusDays(1));
        given(consentMapper.selectAltConsents(1L)).willReturn(List.of(
                consent(1L, 1L, AltDataKind.TELECOM, true),
                consent(2L, 1L, AltDataKind.UTILITY, false),
                withdrawn));
        given(altDataMapper.selectTelecomByConsent(anyLong())).willReturn(List.of());

        Map<String, Boolean> completion = service.completion(1L);

        assertThat(completion).containsEntry("telecom", true).containsEntry("utility", false).containsEntry("easypay", false)
                .containsEntry("nationalPension", false).containsEntry("healthInsurance", false);
        // 0건이어도 불러오기를 마쳤으면 표 데이터(빈 목록)를 돌려준다.
        Map<String, DataInputDtos.ImportedAltData> imported = service.importedData(1L);
        assertThat(imported).containsOnlyKeys("telecom");
        assertThat(imported.get("telecom").rows()).isEmpty();
        assertThat(imported.get("telecom").consentId()).isEqualTo(1L);
    }
}
