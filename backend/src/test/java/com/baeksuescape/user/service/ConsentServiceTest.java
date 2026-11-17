package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.DataInputFixtures.NOW;
import static com.baeksuescape.user.service.DataInputFixtures.codeOf;
import static com.baeksuescape.user.service.DataInputFixtures.consent;
import static com.baeksuescape.user.service.DataInputFixtures.member;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.dto.DataInputRows.ConsentRow;
import com.baeksuescape.user.mapper.AltDataMapper;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.service.altdata.AltDataKind;

// FP-85 N-05-9 정보 제공 동의(INP-04~06). DB는 mock으로 대신한다.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ConsentServiceTest {

    @Mock
    private UserConsentMapper consentMapper;
    @Mock
    private AltDataMapper altDataMapper;
    @Mock
    private UserAccountMapper userMapper;

    private ConsentService service;

    @BeforeEach
    void setUp() {
        service = new ConsentService(consentMapper, altDataMapper, new DataInputUsers(userMapper, UserFixtures.CLOCK));
        given(userMapper.selectById(1L)).willReturn(member(1L, "EMPLOYEE"));
    }

    private static DataInputDtos.ConsentAgree agree(AltDataKind kind) {
        return new DataInputDtos.ConsentAgree("ALT_DATA_PROVISION", kind.providerCode(), kind.itemCode());
    }

    @Test
    void agreeCreatesOptionalConsentLikeSeed() {
        given(consentMapper.selectAltConsents(1L)).willReturn(List.of());
        doAnswer(invocation -> {
            invocation.<ConsentRow>getArgument(0).setConsentId(77L);
            return 1;
        }).when(consentMapper).insertAltConsent(any());

        DataInputDtos.ConsentAgreed result = service.agree(1L, agree(AltDataKind.TELECOM));

        ArgumentCaptor<ConsentRow> saved = ArgumentCaptor.forClass(ConsentRow.class);
        verify(consentMapper).insertAltConsent(saved.capture());
        assertThat(saved.getValue().getProviderCode()).isEqualTo("telecom");
        assertThat(saved.getValue().getItemCode()).isEqualTo("TELECOM_BILL");
        // 더미 시드(build_db.py)와 같은 값: 선택 동의(N), 약관 DEV-0.2, 동의 시각 + 365일.
        assertThat(saved.getValue().getRequiredYn()).isEqualTo("N");
        assertThat(saved.getValue().getAgreedYn()).isEqualTo("Y");
        assertThat(saved.getValue().getTermsVersion()).isEqualTo("DEV-0.2");
        assertThat(saved.getValue().getAgreedAt()).isEqualTo(NOW);
        assertThat(saved.getValue().getExpiresAt()).isEqualTo(NOW.plusDays(365));
        assertThat(result.consentId()).isEqualTo(77L);
        assertThat(result.agreedAt().toString()).isEqualTo("2026-11-14T12:00+09:00");
    }

    @Test
    void agreeReturnsExistingActiveConsentOfSameItem() {
        given(consentMapper.selectAltConsents(1L)).willReturn(List.of(consent(5L, 1L, AltDataKind.EASYPAY, false)));

        DataInputDtos.ConsentAgreed result = service.agree(1L, agree(AltDataKind.EASYPAY));

        assertThat(result.consentId()).isEqualTo(5L);
        verify(consentMapper, never()).insertAltConsent(any());
    }

    @Test
    void agreeMakesNewConsentWhenOldOneWasWithdrawnOrExpired() {
        ConsentRow withdrawn = consent(5L, 1L, AltDataKind.EASYPAY, true);
        withdrawn.setWithdrawnAt(NOW.minusDays(1));
        ConsentRow expired = consent(6L, 1L, AltDataKind.EASYPAY, true);
        expired.setExpiresAt(NOW.minusMinutes(1));
        given(consentMapper.selectAltConsents(1L)).willReturn(List.of(withdrawn, expired));

        service.agree(1L, agree(AltDataKind.EASYPAY));

        verify(consentMapper).insertAltConsent(any());
    }

    @Test
    void agreeRejectsOtherConsentTypesAndItems() {
        assertThat(codeOf(() -> service.agree(1L, new DataInputDtos.ConsentAgree("TERMS_OF_SERVICE", "telecom", "TELECOM_BILL"))))
                .isEqualTo("INVALID_INPUT");
        assertThat(codeOf(() -> service.agree(1L, new DataInputDtos.ConsentAgree("ALT_DATA_PROVISION", "credit-bureau", "CREDIT_PROFILE"))))
                .isEqualTo("INVALID_INPUT");
        assertThat(codeOf(() -> service.agree(1L, new DataInputDtos.ConsentAgree("ALT_DATA_PROVISION", "telecom", "EASYPAY"))))
                .isEqualTo("INVALID_INPUT");
    }

    @Test
    void withdrawFillsWithdrawnAtAndDeletesImportedRowsEverywhere() {
        given(consentMapper.selectAltConsent(1L, 9L)).willReturn(consent(9L, 1L, AltDataKind.TELECOM, true));

        DataInputDtos.ConsentWithdrawn result = service.withdraw(1L, 9L);

        verify(consentMapper).withdraw(9L, NOW);
        verify(altDataMapper).deleteTelecomByConsent(9L);
        verify(altDataMapper).deleteUtilityByConsent(9L);
        verify(altDataMapper).deleteEasypayByConsent(9L);
        verify(altDataMapper).deleteInsuranceByConsent(9L);
        verify(altDataMapper).deleteLoanByConsent(9L);
        verify(altDataMapper).deleteCreditProfileByConsent(9L);
        assertThat(result.consentId()).isEqualTo(9L);
        assertThat(result.withdrawnAt()).isNotNull();
    }

    @Test
    void withdrawOfOthersConsentIs404AndAlreadyWithdrawnKeepsTime() {
        given(consentMapper.selectAltConsent(1L, 99L)).willReturn(null);
        assertThat(codeOf(() -> service.withdraw(1L, 99L))).isEqualTo("NOT_FOUND");
        verify(altDataMapper, never()).deleteTelecomByConsent(anyLong());

        ConsentRow withdrawn = consent(9L, 1L, AltDataKind.TELECOM, true);
        withdrawn.setWithdrawnAt(NOW.minusDays(2));
        given(consentMapper.selectAltConsent(1L, 9L)).willReturn(withdrawn);
        DataInputDtos.ConsentWithdrawn result = service.withdraw(1L, 9L);
        verify(consentMapper, never()).withdraw(eq(9L), any());
        assertThat(result.withdrawnAt().toLocalDateTime()).isEqualTo(NOW.minusDays(2));
    }

    // PR #52 리뷰 4 — 동의·철회는 맨 앞에서 회원 행을 잠근다. 같은 항목 동의가 동시에 들어와도 두 번째는 첫 번째 동의를 보고 돌려받는다.
    @Test
    void agreeAndWithdrawLockMemberRowFirst() {
        given(consentMapper.selectAltConsents(1L)).willReturn(List.of());
        given(consentMapper.selectAltConsent(1L, 9L)).willReturn(consent(9L, 1L, AltDataKind.TELECOM, true));

        service.agree(1L, agree(AltDataKind.TELECOM));
        InOrder agreeOrder = inOrder(userMapper, consentMapper);
        agreeOrder.verify(userMapper).lockUser(1L);
        agreeOrder.verify(userMapper).selectById(1L);
        agreeOrder.verify(consentMapper).selectAltConsents(1L);
        agreeOrder.verify(consentMapper).insertAltConsent(any());

        service.withdraw(1L, 9L);
        InOrder withdrawOrder = inOrder(userMapper, consentMapper);
        withdrawOrder.verify(userMapper, times(2)).lockUser(1L);
        withdrawOrder.verify(consentMapper).selectAltConsent(1L, 9L);
        withdrawOrder.verify(consentMapper).withdraw(9L, NOW);
    }

    @Test
    void consentApisNeedJobType() {
        given(userMapper.selectById(2L)).willReturn(member(2L, null));
        assertThat(codeOf(() -> service.list(2L))).isEqualTo("JOB_TYPE_REQUIRED");
    }
}
