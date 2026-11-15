package com.baeksuescape.admin.service;

import java.util.function.UnaryOperator;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiMasking;

// FP-80 관리자 화면용 개인정보 가리기 — 암호문을 풀어 가린 값만 돌려준다.
// 다른 키로 암호화된 행(예: 팀 키로 만든 시드 회원)은 풀리지 않으므로 500을 내지 않고 그 칸만 "(복호화 불가)"로 보여 준다.
// 이때 서버 로그에는 USER_ID와 실패 사실만 남긴다(원문·암호문은 남기지 않는다).
@Component
public class AdminPii {

    public static final String UNREADABLE = "(복호화 불가)";
    // 탈퇴 회원은 개인정보 칸이 표시값 'WITHDRAWN'으로 덮어써져 있다(DDL CK_APU_PII_BY_STATUS).
    public static final String WITHDRAWN = "(탈퇴 회원)";
    private static final String WITHDRAWN_MARK = "WITHDRAWN";
    private static final Logger log = LoggerFactory.getLogger(AdminPii.class);

    private final PiiCrypto crypto;

    public AdminPii(PiiCrypto crypto) {
        this.crypto = crypto;
    }

    public String maskedName(Long userId, String nameEnc) {
        return masked(userId, nameEnc, PiiMasking::name);
    }

    public String maskedEmail(Long userId, String emailEnc) {
        return masked(userId, emailEnc, PiiMasking::email);
    }

    public String maskedPhone(Long userId, String phoneEnc) {
        return masked(userId, phoneEnc, PiiMasking::phone);
    }

    // 값이 없으면 null(휴대폰이 없는 계정 등).
    private String masked(Long userId, String stored, UnaryOperator<String> mask) {
        if (stored == null) return null;
        if (WITHDRAWN_MARK.equals(stored)) return WITHDRAWN;
        try {
            return mask.apply(crypto.decrypt(stored));
        } catch (RuntimeException e) {
            log.warn("개인정보를 복호화하지 못했습니다(userId={})", userId);
            return UNREADABLE;
        }
    }
}
