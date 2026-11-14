package com.baeksuescape.user.service.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.util.PiiMasking;

// FP-87 개발용 LOG 모드(기본값) — 메일을 보내지 않고 서버 로그에 코드를 남긴다. 이메일은 가린 값만 남긴다.
@Component
@ConditionalOnProperty(prefix = "avenue.auth.email", name = "mode", havingValue = "LOG", matchIfMissing = true)
public class LogEmailCodeSender implements EmailCodeSender {

    private static final Logger log = LoggerFactory.getLogger(LogEmailCodeSender.class);

    @Override
    public void send(String email, String code, String purpose) {
        log.info("[개발용 인증코드] 받는 사람={} 목적={} 코드={}", PiiMasking.email(email), purpose, code);
    }
}
