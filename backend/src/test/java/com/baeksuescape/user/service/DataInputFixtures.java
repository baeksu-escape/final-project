package com.baeksuescape.user.service;

import java.time.LocalDateTime;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.DataInputRows.ConsentRow;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.altdata.AltDataKind;

// FP-85·FP-86 데이터 입력 서비스 테스트용 합성 계정·동의 행. 시각 기준은 UserFixtures.CLOCK(2026-11-14 12:00 서울)이다.
final class DataInputFixtures {

    static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 14, 12, 0);

    private DataInputFixtures() {
    }

    static UserAccount member(long userId, String workerTypeCode) {
        UserAccount account = UserFixtures.user(userId, "member" + userId);
        account.setWorkerTypeCode(workerTypeCode);
        return account;
    }

    // 유효한 대안 데이터 동의(10일 전 동의, 365일 유효, 시드와 같은 값). importedYn이면 불러오기를 마친 동의다.
    static ConsentRow consent(long consentId, long userId, AltDataKind kind, boolean imported) {
        ConsentRow row = new ConsentRow();
        row.setConsentId(consentId);
        row.setUserId(userId);
        row.setConsentTypeCode("ALT_DATA_PROVISION");
        row.setProviderCode(kind.providerCode());
        row.setItemCode(kind.itemCode());
        row.setRequiredYn("N");
        row.setAgreedYn("Y");
        row.setAgreedAt(NOW.minusDays(10));
        row.setExpiresAt(NOW.minusDays(10).plusDays(365));
        row.setExternalConsentId(imported ? kind.externalConsentId(userId) : null);
        return row;
    }

    // ApiException이면 그 code, 아니면 null.
    static String codeOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            return e.getCode();
        }
        return null;
    }
}
