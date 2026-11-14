package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.global.util.PiiMasking;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.MyPageDtos;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-87 N-04 마이페이지(MEM-01~04)와 N-05-1 직군 선택(MEM-05). 로그인한 본인(USER_ID는 토큰에서)만 다룬다.
@Service
public class MyPageService {

    // DIM_WORKER_TYPE 코드(프론트 common/config/jobTypes.js와 같은 값).
    static final Set<String> JOB_TYPES = Set.of("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER");

    private final UserAccountMapper userMapper;
    private final EmailVerificationService emailVerification;
    private final UserViewFactory userViews;
    private final PasswordEncoder passwordEncoder;
    private final PiiCrypto crypto;
    private final PiiHmac hmac;
    private final Clock clock;

    public MyPageService(UserAccountMapper userMapper, EmailVerificationService emailVerification, UserViewFactory userViews,
            PasswordEncoder passwordEncoder, PiiCrypto crypto, PiiHmac hmac, Clock clock) {
        this.userMapper = userMapper;
        this.emailVerification = emailVerification;
        this.userViews = userViews;
        this.passwordEncoder = passwordEncoder;
        this.crypto = crypto;
        this.hmac = hmac;
        this.clock = clock;
    }

    // MEM-01 내 정보 — 이름·휴대폰·이메일은 가린 값. 휴대폰이 없으면 null, 가입일은 CREATED_AT의 날짜.
    public MyPageDtos.ProfileResponse profile(long userId) {
        UserAccount account = require(userId);
        String joinedAt = account.getCreatedAt() == null ? null : account.getCreatedAt().toLocalDate().toString();
        return new MyPageDtos.ProfileResponse(new MyPageDtos.Profile(
                account.getLoginId(),
                account.getNickname(),
                PiiMasking.name(crypto.decrypt(account.getNameEnc())),
                PiiMasking.phone(crypto.decrypt(account.getPhoneEnc())),
                PiiMasking.email(crypto.decrypt(account.getEmailEnc())),
                joinedAt,
                account.getWorkerTypeCode()));
    }

    // MEM-02 가림 해제 — 비밀번호가 맞을 때만 원래 값을 준다. 틀리면 400(401은 프론트에서 로그아웃을 일으켜 mock도 400).
    public MyPageDtos.UnmaskedResponse unmask(long userId, MyPageDtos.Unmask request) {
        UserAccount account = require(userId);
        if (!passwordMatches(account, request.password())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", "비밀번호가 올바르지 않습니다.");
        }
        return new MyPageDtos.UnmaskedResponse(new MyPageDtos.UnmaskedProfile(
                crypto.decrypt(account.getNameEnc()),
                formatPhone(crypto.decrypt(account.getPhoneEnc())),
                crypto.decrypt(account.getEmailEnc())));
    }

    // MEM-03 이메일 변경 — 새 이메일의 인증 토큰(CHANGE_EMAIL)을 한 번 쓰고 암호문·HMAC을 함께 바꾼다.
    @Transactional
    public void changeEmail(long userId, MyPageDtos.EmailChange request) {
        UserAccount account = require(userId);
        String email = request.email().strip();
        if (!AccountRules.isValidEmail(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "이메일 형식이 올바르지 않습니다.",
                    List.of(new FieldErrorItem("email", "이메일 형식이 올바르지 않습니다.")));
        }
        String emailHmac = hmac.email(email);
        if (emailHmac.equals(account.getEmailHmac())) throw new ApiException(HttpStatus.BAD_REQUEST, "SAME_EMAIL", "지금 쓰는 이메일과 같습니다.");
        if (userMapper.countByEmailHmac(emailHmac) > 0) throw AuthErrors.duplicateEmail();
        emailVerification.consume(request.emailVerificationToken(), EmailPurpose.CHANGE_EMAIL, email, null);
        userMapper.updateEmail(userId, crypto.encrypt(email), emailHmac, LocalDateTime.now(clock));
    }

    // MEM-04 비밀번호 변경 — 현재 비밀번호를 확인하고 새 비밀번호 규칙을 검사한다.
    public void changePassword(long userId, MyPageDtos.PasswordChange request) {
        UserAccount account = require(userId);
        if (!passwordMatches(account, request.currentPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", "현재 비밀번호가 올바르지 않습니다.");
        }
        if (!AccountRules.isValidPassword(request.newPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "비밀번호 규칙을 지켜 주세요.",
                    List.of(new FieldErrorItem("newPassword", "비밀번호 규칙을 지켜 주세요.")));
        }
        userMapper.updatePassword(userId, passwordEncoder.encode(request.newPassword()), LocalDateTime.now(clock));
    }

    // MEM-05 직군 선택 — 직군이 비어 있을 때만 저장한다(프론트 mock과 같음). 관리자는 /api/members/me/**에서 이미 403이다.
    // TODO(N-04-8) 직군 변경은 우선순위 미정(D-27)이라 막는다. 정해지면 updateWorkerTypeIfEmpty 대신 변경 쿼리를 쓰고 소득 재입력 안내를 붙인다.
    @Transactional
    public AuthResponses.Me selectJobType(long userId, MyPageDtos.JobType request) {
        if (request.jobType() == null || !JOB_TYPES.contains(request.jobType())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "직군을 선택해 주세요.",
                    List.of(new FieldErrorItem("jobType", "직군을 선택해 주세요.")));
        }
        require(userId);
        if (userMapper.updateWorkerTypeIfEmpty(userId, request.jobType(), LocalDateTime.now(clock)) == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "JOB_TYPE_ALREADY_SELECTED", "이미 직군이 선택되어 있습니다.");
        }
        return new AuthResponses.Me(userViews.of(require(userId)));
    }

    private UserAccount require(long userId) {
        UserAccount account = userMapper.selectById(userId);
        if (account == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        return account;
    }

    // 간편 로그인으로만 가입해 비밀번호가 없는 계정은 비밀번호 확인을 통과하지 못한다.
    private boolean passwordMatches(UserAccount account, String password) {
        return password != null && !password.isEmpty() && account.getPasswordHash() != null
                && passwordEncoder.matches(password, account.getPasswordHash());
    }

    // 숫자만 있는 휴대폰에 하이픈을 넣는다(프론트 mock formatPhone과 같음). 예) 01012345678 → 010-1234-5678. 없으면 null.
    static String formatPhone(String phone) {
        if (phone == null || phone.isEmpty()) return null;
        if (phone.length() < 7) return phone;
        int middleEnd = phone.length() == 11 ? 7 : 6;
        return phone.substring(0, 3) + "-" + phone.substring(3, middleEnd) + "-" + phone.substring(middleEnd);
    }
}
