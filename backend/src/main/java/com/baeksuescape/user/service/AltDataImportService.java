package com.baeksuescape.user.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.config.AvenueProperties.MissingMemberMode;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.dto.DataInputRows.BillRow;
import com.baeksuescape.user.dto.DataInputRows.ConsentRow;
import com.baeksuescape.user.dto.DataInputRows.EasypayRow;
import com.baeksuescape.user.dto.DataInputRows.InsuranceRow;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.AltDataMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.service.altdata.AltDataConverter;
import com.baeksuescape.user.service.altdata.AltDataKind;
import com.baeksuescape.user.service.altdata.AltDataSource;
import com.fasterxml.jackson.databind.JsonNode;

// FP-85 N-05-6 대안 데이터 모의 연동 불러오기(API 정의서 v0.2 INP-03). 가상 기관 응답을 받아 SOURCE_CODE='IMPORTED'와 동의 ID로 저장한다(W3).
// 다시 불러오면 이전에 불러온 행을 지우고 새로 넣는다. 불러오기에 성공하면(0건 포함) 동의 행에 가상 기관 동의 ID를 남긴다.
@Service
public class AltDataImportService {

    static final String CONSENT_REQUIRED = "CONSENT_REQUIRED";
    static final String SOURCE_UNAVAILABLE = "ALT_DATA_SOURCE_UNAVAILABLE";
    static final String NO_RECORD_NOTICE = "이 계정은 기관 기록이 없습니다.";
    static final String BORROWED_NOTICE = "시연용 예시 데이터입니다.";
    // 화면 inputRules.js monthRule과 같은 문구.
    static final String BASE_MONTH_FORMAT_MESSAGE = "연-월(YYYY-MM) 형식으로 입력해 주세요.";

    // BORROW 후보 캐시 — key '종류:직군' → 후보 USER_ID 목록(오름차순).
    private final Map<String, List<Long>> borrowCandidates = new ConcurrentHashMap<>();
    private final AltDataSource source;
    private final AltDataMapper altDataMapper;
    private final UserConsentMapper consentMapper;
    private final DataInputUsers users;
    private final AvenueProperties properties;

    public AltDataImportService(AltDataSource source, AltDataMapper altDataMapper, UserConsentMapper consentMapper, DataInputUsers users,
            AvenueProperties properties) {
        this.source = source;
        this.altDataMapper = altDataMapper;
        this.consentMapper = consentMapper;
        this.users = users;
        this.properties = properties;
    }

    // INP-03 불러오기 — 요청의 consentId가 내 것이고, 같은 기관·항목의 유효한 동의여야 한다(아니면 409 CONSENT_REQUIRED).
    // baseMonth는 화면 기준월 확인용이다: 형식(YYYY-MM)만 검사하고 저장에는 쓰지 않는다. 기관 파일의 기간을 그대로 저장한다(더미 시드와 같다).
    // 맨 앞에서 회원 행을 잠가, 같은 항목을 동시에 불러와도 지우기·넣기가 겹쳐 행이 중복되지 않게 한다(PR #52 리뷰 4·5).
    @Transactional
    public DataInputDtos.AltDataImportResponse importData(long userId, String apiSegment, DataInputDtos.AltDataImportRequest request) {
        users.lock(userId);
        AltDataKind kind = AltDataKind.fromApiSegment(apiSegment)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "요청한 주소를 찾을 수 없습니다."));
        UserAccount user = users.requireUserWithJob(userId);
        if (request == null || request.baseMonth() == null || request.baseMonth().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "기준월을 먼저 입력해 주세요.",
                    List.of(new FieldErrorItem("baseMonth", "기준월을 먼저 입력해 주세요.")));
        }
        if (!DataInputRules.isValidMonth(request.baseMonth())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", BASE_MONTH_FORMAT_MESSAGE,
                    List.of(new FieldErrorItem("baseMonth", BASE_MONTH_FORMAT_MESSAGE)));
        }
        LocalDateTime now = users.now();
        ConsentRow consent = request.consentId() == null ? null : consentMapper.selectAltConsent(userId, request.consentId());
        if (consent == null || !matches(consent, kind) || !ConsentService.isActive(consent, now)) {
            throw new ApiException(HttpStatus.CONFLICT, CONSENT_REQUIRED, "정보 제공 동의를 먼저 해 주세요.");
        }
        if (!source.isAvailable(kind)) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, SOURCE_UNAVAILABLE, "기관 데이터를 지금 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
        }

        Optional<JsonNode> response = source.find(kind, userId);
        String notice = null;
        if (response.isEmpty()) {
            // 시연 중 새로 가입한 계정은 기관 응답 파일에 없다(external_api/README.md). 설정에 따라 빈 결과 또는 같은 직군 예시를 쓴다.
            if (properties.getAltdata().getMissingMemberMode() == MissingMemberMode.BORROW) {
                response = borrowedMember(user, kind).flatMap(memberId -> source.find(kind, memberId));
            }
            notice = response.isPresent() ? BORROWED_NOTICE : NO_RECORD_NOTICE;
        }

        LocalDate baseDate = response.map(AltDataConverter::asOfDate).orElse(null);
        if (baseDate == null) {
            // 통신·공과금 응답에는 기준일이 없어 원천 전체의 기준일을 쓴다(더미 시드도 전체 기준일 하나를 쓴다).
            baseDate = Objects.requireNonNullElse(source.defaultAsOfDate(), now.toLocalDate());
        }
        List<Map<String, Object>> rows = replaceRows(kind, userId, consent.getConsentId(), response.orElse(null), baseDate, now);
        consentMapper.markImported(consent.getConsentId(), kind.externalConsentId(userId));
        return new DataInputDtos.AltDataImportResponse(kind.key(), users.toOffset(now), rows, consent.getConsentId(), notice);
    }

    // BORROW — 같은 직군의 더미 회원 중 이 계정이 늘 같은 회원을 고르도록 USER_ID로 정한다(후보[USER_ID % 후보 수]).
    private Optional<Long> borrowedMember(UserAccount user, AltDataKind kind) {
        List<Long> candidates = borrowCandidates(user.getWorkerTypeCode(), kind);
        if (candidates.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(candidates.get(Math.floorMod(user.getUserId(), candidates.size())));
    }

    // BORROW 후보 — 이 직군의 더미 회원 중 기관 파일에 있는 USER_ID(오름차순). 종류·직군마다 처음 한 번만 만들어 둔다(PR #52 리뷰 6).
    // 기관 파일은 서버 시작 때 읽어 고정되므로 다시 만들 필요가 없다. 후보가 없으면(시드 적재 전 등) 저장하지 않고 다음에 다시 찾는다.
    List<Long> borrowCandidates(String workerTypeCode, AltDataKind kind) {
        String key = kind.name() + ":" + workerTypeCode;
        List<Long> cached = borrowCandidates.get(key);
        if (cached != null) {
            return cached;
        }
        List<Long> candidates = altDataMapper.selectDummyUserIds(workerTypeCode).stream()
                .filter(memberId -> source.find(kind, memberId).isPresent())
                .sorted()
                .toList();
        if (!candidates.isEmpty()) {
            borrowCandidates.putIfAbsent(key, candidates);
        }
        return candidates;
    }

    // 이전에 불러온 행(이 회원·이 항목)을 지우고 응답을 새로 넣은 뒤, 화면 표 행으로 돌려준다. 응답이 없으면 지우기만 한다.
    private List<Map<String, Object>> replaceRows(AltDataKind kind, long userId, long consentId, JsonNode response, LocalDate baseDate,
            LocalDateTime now) {
        List<Map<String, Object>> views = new ArrayList<>();
        switch (kind) {
            case TELECOM -> {
                altDataMapper.deleteImportedTelecom(userId);
                for (BillRow row : response == null ? List.<BillRow>of() : AltDataConverter.bills(response)) {
                    fill(row, userId, consentId, baseDate, now);
                    altDataMapper.insertTelecom(row);
                    views.add(AltDataConverter.telecomView(row));
                }
            }
            case UTILITY -> {
                altDataMapper.deleteImportedUtility(userId);
                for (BillRow row : response == null ? List.<BillRow>of() : AltDataConverter.bills(response)) {
                    fill(row, userId, consentId, baseDate, now);
                    altDataMapper.insertUtility(row);
                    views.add(AltDataConverter.utilityView(row));
                }
            }
            case EASYPAY -> {
                altDataMapper.deleteImportedEasypay(userId);
                for (EasypayRow row : response == null ? List.<EasypayRow>of() : AltDataConverter.easypay(response)) {
                    row.setUserId(userId);
                    row.setConsentId(consentId);
                    row.setBaseDate(baseDate);
                    row.setCreatedAt(now);
                    altDataMapper.insertEasypay(row);
                    views.add(AltDataConverter.easypayView(row));
                }
            }
            case NATIONAL_PENSION, HEALTH_INSURANCE -> {
                // 동의 항목 코드가 보험 종류 코드와 같다(NATIONAL_PENSION·HEALTH_INSURANCE).
                altDataMapper.deleteImportedInsurance(userId, kind.itemCode());
                for (InsuranceRow row : response == null ? List.<InsuranceRow>of() : AltDataConverter.insurance(response, kind.itemCode())) {
                    row.setUserId(userId);
                    row.setConsentId(consentId);
                    row.setBaseDate(baseDate);
                    row.setCreatedAt(now);
                    altDataMapper.insertInsurance(row);
                    views.add(AltDataConverter.insuranceView(row));
                }
            }
        }
        return views;
    }

    private static void fill(BillRow row, long userId, long consentId, LocalDate baseDate, LocalDateTime now) {
        row.setUserId(userId);
        row.setConsentId(consentId);
        row.setBaseDate(baseDate);
        row.setCreatedAt(now);
    }

    private static boolean matches(ConsentRow consent, AltDataKind kind) {
        return kind.providerCode().equals(consent.getProviderCode()) && kind.itemCode().equals(consent.getItemCode());
    }

    // ── INP-01 조회용 ──

    // N-05-8 대안 데이터 완료 현황 — 유효한 동의가 있고 그 동의로 불러오기를 마쳤으면(EXTERNAL_CONSENT_ID, 0건 포함) true.
    public Map<String, Boolean> completion(long userId) {
        List<ConsentRow> consents = consentMapper.selectAltConsents(userId);
        LocalDateTime now = users.now();
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (AltDataKind kind : AltDataKind.values()) {
            result.put(kind.key(), completedConsent(consents, kind, now).isPresent());
        }
        return result;
    }

    // 불러온 대안 데이터(완료된 종류만) — 화면에 들어올 때 표를 다시 그린다.
    public Map<String, DataInputDtos.ImportedAltData> importedData(long userId) {
        List<ConsentRow> consents = consentMapper.selectAltConsents(userId);
        LocalDateTime now = users.now();
        Map<String, DataInputDtos.ImportedAltData> result = new LinkedHashMap<>();
        for (AltDataKind kind : AltDataKind.values()) {
            Optional<ConsentRow> consent = completedConsent(consents, kind, now);
            consent.ifPresent(found -> result.put(kind.key(), importedOf(kind, found.getConsentId())));
        }
        return result;
    }

    private DataInputDtos.ImportedAltData importedOf(AltDataKind kind, long consentId) {
        return switch (kind) {
            case TELECOM -> imported(altDataMapper.selectTelecomByConsent(consentId), AltDataConverter::telecomView, BillRow::getCreatedAt, consentId);
            case UTILITY -> imported(altDataMapper.selectUtilityByConsent(consentId), AltDataConverter::utilityView, BillRow::getCreatedAt, consentId);
            case EASYPAY -> imported(altDataMapper.selectEasypayByConsent(consentId), AltDataConverter::easypayView, EasypayRow::getCreatedAt,
                    consentId);
            case NATIONAL_PENSION, HEALTH_INSURANCE -> imported(altDataMapper.selectInsuranceByConsent(consentId), AltDataConverter::insuranceView,
                    InsuranceRow::getCreatedAt, consentId);
        };
    }

    // 표 행과 불러온 시각(가장 늦은 행 저장 시각, 0건이면 null)을 묶는다.
    private <T> DataInputDtos.ImportedAltData imported(List<T> rows, Function<T, Map<String, Object>> view, Function<T, LocalDateTime> createdAt,
            long consentId) {
        LocalDateTime importedAt = rows.stream().map(createdAt).filter(Objects::nonNull).max(LocalDateTime::compareTo).orElse(null);
        return new DataInputDtos.ImportedAltData(users.toOffset(importedAt), rows.stream().map(view).toList(), consentId);
    }

    // 이 종류의 유효하고 불러오기까지 마친 동의(가장 최근 것).
    private static Optional<ConsentRow> completedConsent(List<ConsentRow> consents, AltDataKind kind, LocalDateTime now) {
        for (int i = consents.size() - 1; i >= 0; i--) {
            ConsentRow consent = consents.get(i);
            if (matches(consent, kind) && ConsentService.isActive(consent, now) && consent.getExternalConsentId() != null) {
                return Optional.of(consent);
            }
        }
        return Optional.empty();
    }
}
