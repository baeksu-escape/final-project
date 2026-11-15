package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-85·FP-86 N-05 데이터 입력 API 공통 — 직군을 고른 일반 회원인지 확인하고, 저장 시각을 서울 시각으로 맞춘다.
@Component
public class DataInputUsers {

    // 직군을 고르기 전에 입력·동의·불러오기를 부를 때(mock과 같은 409 코드).
    static final String JOB_TYPE_REQUIRED = "JOB_TYPE_REQUIRED";

    private final UserAccountMapper userMapper;
    private final Clock clock;

    public DataInputUsers(UserAccountMapper userMapper, Clock clock) {
        this.userMapper = userMapper;
        this.clock = clock;
    }

    // 직군을 고른 일반 회원을 돌려준다. 계정이 없으면 401, 직군이 없으면 409 JOB_TYPE_REQUIRED.
    // /api/members/me/**는 보안 설정에서 이미 ROLE_USER만 들어온다.
    public UserAccount requireUserWithJob(long userId) {
        UserAccount user = userMapper.selectById(userId);
        if (user == null || user.isWithdrawn()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        }
        if (user.getWorkerTypeCode() == null) {
            throw new ApiException(HttpStatus.CONFLICT, JOB_TYPE_REQUIRED, "직군을 먼저 선택해 주세요.");
        }
        return user;
    }

    // 같은 회원의 쓰기 트랜잭션 맨 앞에서 회원 행을 잠근다(UserAccountMapper.lockUser). @Transactional 메서드 안에서만 부른다.
    public void lock(long userId) {
        userMapper.lockUser(userId);
    }

    // 지금 시각(서울). DB 기본값 SYSTIMESTAMP 대신 이 값을 넣는다.
    public LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    // DB 시각(서울)을 화면에 보낼 시각(+09:00)으로 바꾼다.
    public OffsetDateTime toOffset(LocalDateTime time) {
        return time == null ? null : time.atZone(clock.getZone()).toOffsetDateTime();
    }
}
