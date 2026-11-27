package com.baeksuescape.user.mapper;

import java.time.LocalDateTime;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.user.dto.VerificationCode;

// FP-87 VERIFICATION_CODE 조회·저장(N-02-3, N-03-2, N-04-3). SQL은 resources/mapper/user/VerificationCodeMapper.xml.
@Mapper
public interface VerificationCodeMapper {

    // 발송 이력 저장. 저장한 VERIFICATION_ID를 code.verificationId에 채운다.
    int insertCode(VerificationCode code);

    // 같은 목적·대상으로 가장 최근에 보낸 코드. 없으면 null.
    VerificationCode selectLatest(@Param("purposeCode") String purposeCode, @Param("targetHmac") String targetHmac);

    // FP-258 13차 N-02-3 하루 발송 상한 — since 뒤로 같은 채널(EMAIL·PHONE)·대상에 보낸 횟수(모든 목적, 관리자 로그인 번호 제외).
    int countSentSince(@Param("channelCode") String channelCode, @Param("targetHmac") String targetHmac, @Param("since") LocalDateTime since);

    VerificationCode selectById(@Param("verificationId") long verificationId);

    // 틀린 코드를 넣으면 시도 횟수를 1 올린다.
    int increaseAttempt(@Param("verificationId") long verificationId);

    // 코드가 맞으면 확인 시각과 대상 계정을 적고, EXPIRES_AT을 인증 토큰 유효 시각으로 바꾼다.
    int markVerified(@Param("verificationId") long verificationId, @Param("userId") Long userId,
            @Param("now") LocalDateTime now, @Param("tokenExpiresAt") LocalDateTime tokenExpiresAt);

    // 인증 토큰을 한 번 쓴다. 아직 쓰지 않았고 유효하면 EXPIRES_AT을 지금으로 당기고 1을 돌려준다(0이면 이미 썼거나 만료).
    int consume(@Param("verificationId") long verificationId, @Param("now") LocalDateTime now);

    // N-04-7 회원 탈퇴 — 이 회원의 인증 기록을 지운다. 회원 번호뿐 아니라 이메일·휴대폰 HMAC으로도 찾는다(가입 인증은 USER_ID가 NULL).
    // phoneHmac은 휴대폰이 없으면 null이다. HMAC은 개인정보를 덮어쓰기 전에 읽어 둔 값을 넘긴다.
    int deleteForWithdrawal(@Param("userId") long userId, @Param("emailHmac") String emailHmac, @Param("phoneHmac") String phoneHmac);
}
