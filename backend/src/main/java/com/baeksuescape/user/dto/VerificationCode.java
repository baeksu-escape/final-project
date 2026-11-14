package com.baeksuescape.user.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

// FP-87 VERIFICATION_CODE 한 행 — 인증코드 발송·확인 이력(N-02-3, N-03-2, N-04-3). 코드·이메일 원문은 없고 해시·HMAC만 있다.
// EXPIRES_AT: 확인 전에는 코드 만료 시각, 확인한 뒤에는 인증 토큰을 쓸 수 있는 마지막 시각이다(한 번 쓰면 지금 시각으로 당긴다).
@Getter
@Setter
public class VerificationCode {

    private Long verificationId;
    private String purposeCode;
    private String channelCode;
    private String targetHmac;
    private Long userId;
    private String codeHash;
    private int attemptCount;
    private LocalDateTime expiresAt;
    private LocalDateTime verifiedAt;
    private LocalDateTime createdAt;
}
