package com.baeksuescape.user.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.dto.DataInputRows.ConsentRow;
import com.baeksuescape.user.mapper.AltDataMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.service.altdata.AltDataKind;

// FP-85 N-05-9 대안 데이터 정보 제공 동의(API 정의서 v0.2 INP-04~06, 🟡 제안 경로). USER_CONSENT의 ALT_DATA_PROVISION 행을 다룬다.
// 철회해도 행은 지우지 않고 WITHDRAWN_AT만 채우며, 그 동의로 불러온 행은 모든 대안 데이터 표에서 지운다(DDL v0.3.2 W1).
@Service
public class ConsentService {

    static final String ALT_DATA_PROVISION = "ALT_DATA_PROVISION";
    // 동의 유효 기간 — DDL USER_CONSENT.EXPIRES_AT 주석 "법적 최대 1년". 더미 시드(build_db.py)와 같이 동의 시각 + 365일.
    private static final int CONSENT_VALID_DAYS = 365;
    // 동의 약관 버전 — 더미 시드와 같은 값.
    static final String TERMS_VERSION = "DEV-0.2";

    private final UserConsentMapper consentMapper;
    private final AltDataMapper altDataMapper;
    private final DataInputUsers users;

    public ConsentService(UserConsentMapper consentMapper, AltDataMapper altDataMapper, DataInputUsers users) {
        this.consentMapper = consentMapper;
        this.altDataMapper = altDataMapper;
        this.users = users;
    }

    // INP-04 내 정보 제공 동의 목록(철회·만료 이력 포함). 화면이 유효한 동의만 골라 쓴다.
    public DataInputDtos.ConsentList list(long userId) {
        users.requireUserWithJob(userId);
        List<DataInputDtos.ConsentItem> items = consentMapper.selectAltConsents(userId).stream().map(this::toItem).toList();
        return new DataInputDtos.ConsentList(items);
    }

    // INP-05 항목 하나에 동의 — 대안 데이터 5종의 제공 기관·항목만 받는다. 같은 항목에 유효한 동의가 있으면 그 동의를 돌려준다.
    // 맨 앞에서 회원 행을 잠가, 같은 항목 동의가 동시에 두 번 들어와도 두 번째는 첫 번째의 동의를 돌려받는다(PR #52 리뷰 4).
    @Transactional
    public DataInputDtos.ConsentAgreed agree(long userId, DataInputDtos.ConsentAgree request) {
        users.lock(userId);
        users.requireUserWithJob(userId);
        if (request == null || !ALT_DATA_PROVISION.equals(request.consentTypeCode())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "동의 종류를 확인해 주세요.");
        }
        AltDataKind kind = AltDataKind.fromConsent(request.providerCode(), request.itemCode())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "제공 기관과 항목을 확인해 주세요."));
        Optional<ConsentRow> active = findActive(userId, kind);
        if (active.isPresent()) {
            return new DataInputDtos.ConsentAgreed(active.get().getConsentId(), users.toOffset(active.get().getAgreedAt()));
        }
        LocalDateTime now = users.now();
        ConsentRow row = new ConsentRow();
        row.setUserId(userId);
        row.setConsentTypeCode(ALT_DATA_PROVISION);
        row.setProviderCode(kind.providerCode());
        row.setItemCode(kind.itemCode());
        // 대안 데이터 제공 동의는 선택 동의(N) — 더미 시드와 같다.
        row.setRequiredYn("N");
        row.setAgreedYn("Y");
        row.setTermsVersion(TERMS_VERSION);
        row.setAgreedAt(now);
        row.setExpiresAt(now.plusDays(CONSENT_VALID_DAYS));
        row.setCreatedAt(now);
        consentMapper.insertAltConsent(row);
        return new DataInputDtos.ConsentAgreed(row.getConsentId(), users.toOffset(now));
    }

    // INP-06 [연결 해제] — 본인 동의가 아니면 404. 이미 철회했으면 그 시각을 그대로 돌려준다. 맨 앞에서 회원 행을 잠근다.
    @Transactional
    public DataInputDtos.ConsentWithdrawn withdraw(long userId, long consentId) {
        users.lock(userId);
        users.requireUserWithJob(userId);
        ConsentRow consent = consentMapper.selectAltConsent(userId, consentId);
        if (consent == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "동의 내역을 찾을 수 없습니다.");
        }
        LocalDateTime withdrawnAt = consent.getWithdrawnAt();
        if (withdrawnAt == null) {
            withdrawnAt = users.now();
            consentMapper.withdraw(consentId, withdrawnAt);
        }
        deleteImportedRows(consentId);
        return new DataInputDtos.ConsentWithdrawn(consentId, users.toOffset(withdrawnAt));
    }

    // N-04-7 회원 탈퇴(MEM-07) — 이 회원의 대안 데이터 동의를 모두 돌며 불러온 행을 지우고, 아직 철회하지 않은 동의(만료 포함)에 철회 시각을 채운다.
    // 탈퇴 트랜잭션(WithdrawalService) 안에서 부른다. 동의 행은 지우지 않는다(W1·W4, 동의 이력 보관).
    void withdrawAllForLeave(long userId, LocalDateTime now) {
        for (ConsentRow consent : consentMapper.selectAltConsents(userId)) {
            deleteImportedRows(consent.getConsentId());
            if (consent.getWithdrawnAt() == null) consentMapper.withdraw(consent.getConsentId(), now);
        }
    }

    // W1 그 동의로 불러온 행을 모든 대안 데이터 표에서 지운다(대출·신용평가 표 포함 — 2차에 불러오기가 생겨도 같이 지워진다).
    private void deleteImportedRows(long consentId) {
        altDataMapper.deleteTelecomByConsent(consentId);
        altDataMapper.deleteUtilityByConsent(consentId);
        altDataMapper.deleteEasypayByConsent(consentId);
        altDataMapper.deleteInsuranceByConsent(consentId);
        altDataMapper.deleteLoanByConsent(consentId);
        altDataMapper.deleteCreditProfileByConsent(consentId);
    }

    // 이 종류(제공 기관·항목)의 유효한 동의 — 동의함, 철회 안 함, 만료 안 됨. 여러 개면 가장 최근 것.
    public Optional<ConsentRow> findActive(long userId, AltDataKind kind) {
        LocalDateTime now = users.now();
        List<ConsentRow> consents = consentMapper.selectAltConsents(userId);
        for (int i = consents.size() - 1; i >= 0; i--) {
            ConsentRow consent = consents.get(i);
            if (kind.providerCode().equals(consent.getProviderCode()) && kind.itemCode().equals(consent.getItemCode())
                    && isActive(consent, now)) {
                return Optional.of(consent);
            }
        }
        return Optional.empty();
    }

    // 유효한 동의인지 — 동의(Y)했고, 철회하지 않았고, 만료되지 않았다.
    static boolean isActive(ConsentRow consent, LocalDateTime now) {
        return "Y".equals(consent.getAgreedYn()) && consent.getWithdrawnAt() == null
                && (consent.getExpiresAt() == null || consent.getExpiresAt().isAfter(now));
    }

    private DataInputDtos.ConsentItem toItem(ConsentRow row) {
        return new DataInputDtos.ConsentItem(row.getConsentId(), row.getConsentTypeCode(), row.getProviderCode(), row.getItemCode(),
                users.toOffset(row.getAgreedAt()), users.toOffset(row.getExpiresAt()), users.toOffset(row.getWithdrawnAt()));
    }
}
