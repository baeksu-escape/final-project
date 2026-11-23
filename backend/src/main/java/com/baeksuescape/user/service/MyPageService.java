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
import com.baeksuescape.user.mapper.FinancialInputMapper;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-87 N-04 마이페이지(MEM-01~04)와 N-05-1 직군 선택(MEM-05). 로그인한 본인(USER_ID는 토큰에서)만 다룬다.
@Service
public class MyPageService {

    // DIM_WORKER_TYPE 코드(프론트 common/config/jobTypes.js와 같은 값).
    static final Set<String> JOB_TYPES = Set.of("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER");
    // FP-222 MEM-04 새 비밀번호가 지금 비밀번호와 같을 때 문구(프론트 authConstants.js SAME_PASSWORD_MESSAGE와 같음).
    static final String SAME_PASSWORD_MESSAGE = "지금 쓰는 비밀번호와 같습니다. 다른 비밀번호를 입력해 주세요.";

    private final UserAccountMapper userMapper;
    private final FinancialInputMapper financialInputMapper;
    private final EmailVerificationService emailVerification;
    private final UserViewFactory userViews;
    private final PasswordEncoder passwordEncoder;
    private final PiiCrypto crypto;
    private final PiiHmac hmac;
    private final Clock clock;

    public MyPageService(UserAccountMapper userMapper, FinancialInputMapper financialInputMapper, EmailVerificationService emailVerification,
            UserViewFactory userViews, PasswordEncoder passwordEncoder, PiiCrypto crypto, PiiHmac hmac, Clock clock) {
        this.userMapper = userMapper;
        this.financialInputMapper = financialInputMapper;
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
    // FP-222 새 비밀번호가 지금 비밀번호와 같으면(BCrypt matches) 400 SAME_PASSWORD로 막는다. 화면 검사를 거치지 않은 요청도 막기 위해서다.
    public void changePassword(long userId, MyPageDtos.PasswordChange request) {
        UserAccount account = require(userId);
        if (!passwordMatches(account, request.currentPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", "현재 비밀번호가 올바르지 않습니다.");
        }
        if (!AccountRules.isValidPassword(request.newPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "비밀번호 규칙을 지켜 주세요.",
                    List.of(new FieldErrorItem("newPassword", "비밀번호 규칙을 지켜 주세요.")));
        }
        if (passwordMatches(account, request.newPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SAME_PASSWORD", SAME_PASSWORD_MESSAGE,
                    List.of(new FieldErrorItem("newPassword", SAME_PASSWORD_MESSAGE)));
        }
        userMapper.updatePassword(userId, passwordEncoder.encode(request.newPassword()), LocalDateTime.now(clock));
    }

    // MEM-05 직군 선택·저장 전 변경(FP-227) — 비어 있으면 저장, 같은 직군이면 그대로 200, 다른 직군이면 저장한 입력도 평가도 없을 때만 바꾼다.
    // 저장한 입력 = 데이터 입력 저장 기록(USER_ASSET_SNAPSHOT, FinancialInputMapper.selectSavedBaseMonths, 기준월 무관), 평가 = ASSESSMENT 행.
    // 관리자는 /api/members/me/**에서 이미 403이다.
    // TODO(N-04-8) 저장 전 변경만 허용(11/19 결정). 저장 후 변경은 미정(D-27).
    @Transactional
    public AuthResponses.Me selectJobType(long userId, MyPageDtos.JobType request) {
        if (request.jobType() == null || !JOB_TYPES.contains(request.jobType())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "직군을 선택해 주세요.",
                    List.of(new FieldErrorItem("jobType", "직군을 선택해 주세요.")));
        }
        // 같은 회원의 입력 저장(INP-02)도 회원 행을 먼저 잠그므로, 확인과 변경 사이에 입력이 저장되지 않는다.
        userMapper.lockUser(userId);
        UserAccount account = require(userId);
        String current = account.getWorkerTypeCode();
        if (request.jobType().equals(current)) return new AuthResponses.Me(userViews.of(account));

        LocalDateTime now = LocalDateTime.now(clock);
        if (current == null) {
            if (userMapper.updateWorkerTypeIfEmpty(userId, request.jobType(), now) == 0) {
                throw new ApiException(HttpStatus.CONFLICT, "JOB_TYPE_ALREADY_SELECTED", "이미 직군이 선택되어 있습니다.");
            }
        } else {
            if (!financialInputMapper.selectSavedBaseMonths(userId).isEmpty() || userMapper.countAssessments(userId) > 0) {
                throw new ApiException(HttpStatus.CONFLICT, "JOB_TYPE_LOCKED", "입력을 저장한 뒤에는 직군을 바꿀 수 없습니다.");
            }
            if (userMapper.updateWorkerTypeFrom(userId, current, request.jobType(), now) == 0) {
                throw new ApiException(HttpStatus.CONFLICT, "JOB_TYPE_ALREADY_SELECTED", "이미 직군이 바뀌었습니다. 새로고침해 주세요.");
            }
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
