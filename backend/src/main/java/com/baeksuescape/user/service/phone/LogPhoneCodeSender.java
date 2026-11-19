package com.baeksuescape.user.service.phone;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.util.PiiMasking;

// N-02 개발용 LOG 모드(기본값) — 문자를 보내지 않고 서버 로그에 인증번호를 남긴다. 번호는 가린 값만 남긴다(이메일 LogEmailCodeSender와 같은 방식).
@Component
@ConditionalOnProperty(prefix = "avenue.auth.phone", name = "mode", havingValue = "LOG", matchIfMissing = true)
public class LogPhoneCodeSender implements PhoneCodeSender {

    private static final Logger log = LoggerFactory.getLogger(LogPhoneCodeSender.class);

    @Override
    public void send(String phone, String code, String purpose) {
        log.info("[개발용 휴대폰 인증코드] 번호={} 목적={} 코드={}", PiiMasking.phone(phone), purpose, code);
    }
}
