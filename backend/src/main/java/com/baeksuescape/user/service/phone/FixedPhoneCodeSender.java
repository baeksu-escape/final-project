package com.baeksuescape.user.service.phone;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.util.PiiMasking;

// N-02 시연용 FIXED 모드 — 문자를 보내지 않는다. 번호는 늘 avenue.auth.phone.fixed-code라서 로그에 코드를 남기지 않는다.
@Component
@ConditionalOnProperty(prefix = "avenue.auth.phone", name = "mode", havingValue = "FIXED")
public class FixedPhoneCodeSender implements PhoneCodeSender {

    private static final Logger log = LoggerFactory.getLogger(FixedPhoneCodeSender.class);

    @Override
    public void send(String phone, String code, String purpose) {
        log.info("[고정 휴대폰 인증코드 모드] 번호={} 목적={} (문자는 보내지 않음)", PiiMasking.phone(phone), purpose);
    }
}
