package com.baeksuescape.user.service.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.util.PiiMasking;

// FP-87 시연용 FIXED 모드 — 메일을 보내지 않는다. 코드는 늘 avenue.auth.email.fixed-code라서 로그에 코드를 남기지 않는다.
@Component
@ConditionalOnProperty(prefix = "avenue.auth.email", name = "mode", havingValue = "FIXED")
public class FixedEmailCodeSender implements EmailCodeSender {

    private static final Logger log = LoggerFactory.getLogger(FixedEmailCodeSender.class);

    @Override
    public void send(String email, String code, String purpose) {
        log.info("[고정 인증코드 모드] 받는 사람={} 목적={} (메일은 보내지 않음)", PiiMasking.email(email), purpose);
    }
}
