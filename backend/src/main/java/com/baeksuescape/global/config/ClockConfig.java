package com.baeksuescape.global.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// FP-87 현재 시각 — 서비스가 시각을 직접 만들지 않고 이 Clock을 받아 쓴다. 테스트에서는 고정 시각으로 바꿔 만료를 확인한다.
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of("Asia/Seoul"));
    }
}
