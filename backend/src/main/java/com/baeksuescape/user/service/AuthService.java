package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.service.AdminAuthService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.mapper.UserSocialAccountMapper;
import com.baeksuescape.user.service.social.DevSocialStore;

// FP-87 N-01~N-03 로그인·가입·찾기 — AUTH-01 로그인, AUTH-03 내 정보, AUTH-06 가입, AUTH-09 아이디 찾기, AUTH-10 비밀번호 재설정.
@Service
public class AuthService {

    // FP-258 단계적 제한: 5회 실패하면 5분 동안 로그인을 막고, 누적 10회면 잠근다(비밀번호 찾기 재설정이나 관리자가 푼다).
    static final int TEMP_BLOCK_FAILURES = 5;
    static final int TEMP_BLOCK_MINUTES = 5;
    static final int MAX_LOGIN_FAILURES = 10;
    // FP-258 AUTH-09 아이디 찾기 방법(프론트 authConstants.js FIND_ID_METHODS와 같은 값)
    static final String FIND_ID_PHONE = "PHONE";
    static final String FIND_ID_EMAIL = "EMAIL";
    static final String LOG_SOURCE = "auth-service";
    // 아이디 형식 오류 문구 — 가입(AUTH-06)과 아이디 중복 확인(AUTH-16)이 같이 쓴다(프론트 validateLoginId와 같은 문구).
    static final String LOGIN_ID_RULE_MESSAGE = "아이디는 영문 소문자로 시작하는 4~20자 영문 소문자·숫자로 입력해 주세요.";

    private final UserAccountMapper userMapper;
    private final UserConsentMapper consentMapper;
    private final UserSocialAccountMapper socialMapper;
    private final EmailVerificationService emailVerification;
    private final PhoneVerificationService phoneVerification;
    private final DevSocialStore socialStore;
    private final UserViewFactory userViews;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final PiiCrypto crypto;
    private final PiiHmac hmac;
    private final Clock clock;
    private final AdminAuthService adminAuth;
    private final SystemLogService systemLog;
    private final LoginAttemptService loginAttempts;

    public AuthService(UserAccountMapper userMapper, UserConsentMapper consentMapper, UserSocialAccountMapper socialMapper,
            EmailVerificationService emailVerification, PhoneVerificationService phoneVerification, DevSocialStore socialStore,
            UserViewFactory userViews, JwtTokenProvider tokenProvider, PasswordEncoder passwordEncoder, PiiCrypto crypto, PiiHmac hmac, Clock clock,
            AdminAuthService adminAuth, SystemLogService systemLog, LoginAttemptService loginAttempts) {
        this.userMapper = userMapper;
        this.consentMapper = consentMapper;
        this.socialMapper = socialMapper;
        this.emailVerification = emailVerification;
        this.phoneVerification = phoneVerification;
        this.socialStore = socialStore;
        this.userViews = userViews;
        this.tokenProvider = tokenProvider;
        this.passwordEncoder = passwordEncoder;
        this.crypto = crypto;
        this.hmac = hmac;
        this.clock = clock;
        this.adminAuth = adminAuth;
        this.systemLog = systemLog;
        this.loginAttempts = loginAttempts;
    }

    // AUTH-01 로그인. 일반 사용자는 토큰을 준다(응답 그대로).
    // FP-80 관리자는 비밀번호가 맞아도 토큰을 주지 않고, 업무 이메일로 6자리 번호를 보낸 뒤 2단계 인증 대기 응답을 준다(AUTH-11로 이어짐).
    // FP-258 트랜잭션을 걸지 않는다 — 계정 행 잠금과 일반 회원의 성공 처리는 LoginAttemptService 안에서 끝내고, 로그·토큰은 그 뒤에 한다.
    public AuthResponses.LoginResult login(AuthRequests.Login request) {
        UserAccount account = authenticate(request.loginId(), request.password(), true);
        if (account.isAdmin()) {
            return adminAuth.startLogin(account);
        }
        return loginResponse(account);
    }

    // 아이디·비밀번호를 확인한다. 로그인·관리자 로그인과 간편 로그인 연결(AUTH-05)이 같은 규칙을 쓴다(FP-258 단계적 제한).
    //   없는 계정·탈퇴·비밀번호 없는 계정·틀린 비밀번호 → 401(어느 쪽이 틀렸는지 알리지 않음)
    //   잠긴 계정은 횟수를 세지 않고, 비밀번호가 맞을 때만 423(관리자는 ADMIN_ACCOUNT_LOCKED). 5회째 실패부터 5분 동안 429, 10회째면 잠그고 423.
    //   DB 처리(행 잠금 뒤 다시 읽기, FP-290)는 LoginAttemptService 트랜잭션에서 끝내고, 로그(REQUIRES_NEW)는 커넥션을 돌려준 뒤 남긴다.
    //   그래서 부르는 쪽도 트랜잭션 밖에서 불러야 한다(안에서 부르면 잠금과 커넥션을 그 트랜잭션 끝까지 쥔다).
    //   간편 로그인 연결은 성공 처리를 하지 않고 확인만 한다(연결을 저장한 뒤 confirmLogin).
    public UserAccount authenticate(String loginId, String password) {
        return authenticate(loginId, password, false);
    }

    // recordSuccess면 비밀번호가 맞은 일반 회원의 성공 처리를 확인과 같은 잠금 안에서 한다(관리자는 2단계 인증 뒤).
    private UserAccount authenticate(String loginId, String password, boolean recordSuccess) {
        LoginAttemptService.Attempt attempt = loginAttempts.attempt(loginId, password, recordSuccess);
        UserAccount account = attempt.account();
        switch (attempt.outcome()) {
            case SUCCESS:
                return account;
            case REJECTED:
                throw AuthErrors.loginFailed();
            case LOCKED:
                throw lockedError(account);
            case BLOCKED:
                throw AuthErrors.loginTemporarilyBlocked(attempt.blockedMinutes());
            default:
                break;
        }
        // FP-80 N-28-1 로그인 실패 n/10회(WARN), 5회째 5분 제한, 10회째 자동 잠금. 아이디는 가린 값만 남긴다.
        warn("로그인 실패 " + attempt.failures() + "/" + MAX_LOGIN_FAILURES + "회", account);
        if (attempt.outcome() == LoginAttemptService.Outcome.AUTO_LOCKED) {
            warn("로그인 " + MAX_LOGIN_FAILURES + "회 실패로 계정 자동 잠금", account);
            throw lockedError(account);
        }
        if (attempt.outcome() == LoginAttemptService.Outcome.TEMP_BLOCKED) {
            warn("로그인 " + TEMP_BLOCK_FAILURES + "회 실패로 " + TEMP_BLOCK_MINUTES + "분 제한", account);
            throw AuthErrors.loginTemporarilyBlocked(TEMP_BLOCK_MINUTES);
        }
        throw AuthErrors.loginFailed();
    }

    // 로그인 실패 WARN 로그 한 줄 — 끝에 가린 아이디를 붙인다(예: "로그인 실패 1/10회 (abc***)").
    private void warn(String text, UserAccount account) {
        systemLog.record(SystemLogService.Type.WARN, LOG_SOURCE, text + " (" + SystemLogService.maskLoginId(account.getLoginId()) + ")", account.getUserId());
    }

    // FP-258 잠긴 계정 안내 — 관리자는 다른 관리자에게 풀어 달라는 문구(423 ADMIN_ACCOUNT_LOCKED), 회원은 비밀번호 찾기 안내(423 ACCOUNT_LOCKED).
    private static ApiException lockedError(UserAccount account) {
        return account.isAdmin() ? AuthErrors.adminAccountLocked() : AuthErrors.accountLocked();
    }

    // FP-258 비밀번호 확인 없이 들어오는 로그인 성공(간편 로그인·연결) — 잠금 안에서 성공 처리하고, 그사이 잠겼으면 423(관리자는 ADMIN_ACCOUNT_LOCKED).
    public AuthResponses.Login confirmLogin(UserAccount account) {
        if (!loginAttempts.recordSuccess(account.getUserId())) throw lockedError(account);
        return loginResponse(account);
    }

    // 로그인 성공 로그와 응답(토큰). 성공 처리(실패 횟수 0, 마지막 로그인 시각)는 부르기 전에 계정 잠금 안에서 끝낸다(LoginAttemptService).
    private AuthResponses.Login loginResponse(UserAccount account) {
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, "로그인 성공 (" + SystemLogService.maskLoginId(account.getLoginId()) + ")",
                account.getUserId());
        return new AuthResponses.Login(tokenProvider.issue(account.getUserId(), account.getRoleCode()), userViews.of(account));
    }

    // AUTH-03 내 정보. 탈퇴 회원은 인증 필터에서 이미 401이다.
    public AuthResponses.Me me(long userId) {
        UserAccount account = userMapper.selectById(userId);
        if (account == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        return new AuthResponses.Me(userViews.of(account));
    }

    // N-02-1 닉네임 중복 확인(11/18 1차 시연 후속) — 형식이 틀리면 400(nickname 칸 오류), 아니면 쓸 수 있는지만 돌려준다.
    // '탈퇴'로 시작하는 닉네임은 형식 검사에서 먼저 막으므로 탈퇴 회원의 대체 닉네임('탈퇴'+번호)과 비교할 일이 없다.
    public AuthResponses.NicknameAvailability checkNickname(AuthRequests.NicknameCheck request) {
        String nicknameError = AccountRules.nicknameError(request.nickname());
        if (nicknameError != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", nicknameError, List.of(new FieldErrorItem("nickname", nicknameError)));
        }
        return new AuthResponses.NicknameAvailability(userMapper.countByNickname(request.nickname().strip()) == 0);
    }

    // AUTH-16 N-02-1 아이디 중복 확인(FP-258) — 가입(AUTH-06)과 같은 형식 검사·문구로 틀리면 400(loginId 칸), 아니면 가입 중복 검사와 같은 countByLoginId로 쓸 수 있는지만 돌려준다.
    // 가입처럼 값을 바꾸지 않고 그대로 본다(형식이 영문 소문자만 받으므로 대소문자 차이가 없고, 탈퇴 회원 아이디는 표시값으로 덮여 잡히지 않는다).
    public AuthResponses.LoginIdAvailability checkLoginId(AuthRequests.LoginIdCheck request) {
        String loginId = request.loginId();
        String loginIdError = isBlank(loginId) ? "아이디를 입력해 주세요."
                : AccountRules.isValidLoginId(loginId) ? null : LOGIN_ID_RULE_MESSAGE;
        if (loginIdError != null) throw AuthErrors.invalidField("loginId", loginIdError);
        return new AuthResponses.LoginIdAvailability(userMapper.countByLoginId(loginId) == 0);
    }

    // AUTH-06 회원가입 — 칸 검사 → 중복(아이디·이메일·닉네임 순) → 간편 로그인 키 → 이메일·휴대폰 인증 토큰 사용 → 계정·동의·간편 로그인 연결 저장을 한 트랜잭션으로 한다.
    @Transactional
    public AuthResponses.Signup signup(AuthRequests.Signup request) {
        LocalDateTime now = LocalDateTime.now(clock);
        validateSignup(request, now.getYear());

        String loginId = request.loginId();
        // FP-258 이메일은 소문자로 바꿔 HMAC·암호문(EMAIL_ENC) 모두 같은 값으로 저장한다.
        String email = AccountRules.normalizeEmail(request.email());
        String nickname = request.nickname().strip();
        String phone = AccountRules.normalizePhone(request.phone());
        String emailHmac = hmac.email(email);
        if (userMapper.countByLoginId(loginId) > 0) throw AuthErrors.duplicateLoginId();
        if (userMapper.countByEmailHmac(emailHmac) > 0) throw AuthErrors.duplicateEmail();
        // 탈퇴 회원 닉네임은 '탈퇴'+번호라 일반 닉네임과 겹치지 않는다('탈퇴' 접두어는 위에서 막음).
        if (userMapper.countByNickname(nickname) > 0) throw AuthErrors.duplicateNickname();

        DevSocialStore.PendingLink socialLink = null;
        if (request.socialLinkKey() != null) {
            socialLink = socialStore.findLinkKey(request.socialLinkKey()).orElseThrow(AuthErrors::socialLinkExpired);
        }
        emailVerification.consume(request.emailVerificationToken(), EmailPurpose.SIGNUP, email, null);
        // 11/18 1차 시연 후속: 휴대폰 인증 토큰도 한 번 쓴다(토큰의 번호 HMAC·목적 SIGNUP이 가입 번호와 같아야 한다).
        phoneVerification.consume(request.phoneVerificationToken(), PhonePurpose.SIGNUP, phone);

        UserAccount account = new UserAccount();
        account.setLoginId(loginId);
        account.setPasswordHash(passwordEncoder.encode(request.password()));
        account.setNickname(nickname);
        account.setNameEnc(crypto.encrypt(request.name().strip()));
        account.setPhoneEnc(phone.isEmpty() ? null : crypto.encrypt(phone));
        account.setPhoneHmac(phone.isEmpty() ? null : hmac.phone(phone));
        account.setEmailEnc(crypto.encrypt(email));
        account.setEmailHmac(emailHmac);
        account.setBirthYear(request.birthYear());
        account.setCreatedAt(now);
        try {
            userMapper.insertUser(account);
        } catch (DuplicateKeyException e) {
            throw duplicateFromConstraint(e);
        }
        saveSignupConsents(account.getUserId(), Boolean.TRUE.equals(request.agreeMarketing()), now);
        if (socialLink != null) {
            socialMapper.insertLink(account.getUserId(), socialLink.providerCode(), socialLink.providerUserId());
            socialStore.removeLinkKey(request.socialLinkKey());
        }
        return new AuthResponses.Signup(account.getUserId());
    }

    // N-02-2 가입 동의 기록(USER_CONSENT). FP-258 가입 화면이 필수 2개(이용약관·개인정보 수집·이용)와 선택 1개(점수 변동 알림·혜택 안내)를 따로 받는다.
    //   필수 2개는 검사(validateSignup)를 통과해야 여기까지 오므로 동의(Y)로 남긴다. 선택 동의는 체크하지 않아도 N·동의 시각 없음으로 한 행을 남겨 늘 3행이다(더미 시드와 같은 모양).
    private void saveSignupConsents(long userId, boolean agreeMarketing, LocalDateTime now) {
        consentMapper.insertSignupConsent(userId, "TERMS_OF_SERVICE", "Y", "Y", now, now);
        consentMapper.insertSignupConsent(userId, "PRIVACY_COLLECTION", "Y", "Y", now, now);
        consentMapper.insertSignupConsent(userId, "NOTIFICATION_MARKETING", "N", agreeMarketing ? "Y" : "N", agreeMarketing ? now : null, now);
    }

    // 가입 칸 검사 — 프론트 validateSignup과 같은 규칙·문구. 틀린 칸을 모두 모아 400 INVALID_INPUT으로 돌려준다.
    private void validateSignup(AuthRequests.Signup r, int thisYear) {
        List<FieldErrorItem> errors = new ArrayList<>();
        if (isBlank(r.loginId())) errors.add(new FieldErrorItem("loginId", "아이디를 입력해 주세요."));
        else if (!AccountRules.isValidLoginId(r.loginId())) {
            errors.add(new FieldErrorItem("loginId", LOGIN_ID_RULE_MESSAGE));
        }
        // 11/18 1차 시연 후속: 이름은 완성형 한글 2~20자만 받는다(화면과 같은 문구).
        String nameError = AccountRules.nameError(r.name());
        if (nameError != null) errors.add(new FieldErrorItem("name", nameError));
        String nicknameError = AccountRules.nicknameError(r.nickname());
        if (nicknameError != null) errors.add(new FieldErrorItem("nickname", nicknameError));
        // 11/18 1차 시연 후속: 휴대폰은 필수이고 인증을 거쳐야 한다.
        String phone = AccountRules.normalizePhone(r.phone());
        if (phone.isEmpty()) errors.add(new FieldErrorItem("phone", "휴대폰 번호를 입력해 주세요."));
        else if (!AccountRules.isValidPhone(phone)) errors.add(new FieldErrorItem("phone", "휴대폰 번호 형식이 올바르지 않습니다. 예) 010-1234-5678"));
        else if (isBlank(r.phoneVerificationToken())) errors.add(new FieldErrorItem("phone", PhoneVerificationService.VERIFICATION_REQUIRED_MESSAGE));
        if (isBlank(r.email())) errors.add(new FieldErrorItem("email", "이메일을 입력해 주세요."));
        else if (!AccountRules.isValidEmail(r.email().strip())) errors.add(new FieldErrorItem("email", "이메일 형식이 올바르지 않습니다. 예) name@example.com"));
        else if (isBlank(r.emailVerificationToken())) errors.add(new FieldErrorItem("email", "이메일 인증을 완료해 주세요."));
        if (isBlank(r.password())) errors.add(new FieldErrorItem("password", "비밀번호를 입력해 주세요."));
        else {
            String passwordError = AccountRules.newPasswordError(r.password(), "비밀번호 규칙을 모두 지켜 주세요.");
            if (passwordError != null) errors.add(new FieldErrorItem("password", passwordError));
        }
        String birthYearError = AccountRules.birthYearError(r.birthYear(), thisYear);
        if (birthYearError != null) errors.add(new FieldErrorItem("birthYear", birthYearError));
        // FP-258 필수 동의 2개는 각각 true여야 한다(예전 agreeCreditInfo 하나로 대신하지 않는다). 빠진 칸마다 알린다.
        if (!Boolean.TRUE.equals(r.agreeTerms())) errors.add(new FieldErrorItem("agreeTerms", "필수 동의 항목입니다."));
        if (!Boolean.TRUE.equals(r.agreePrivacy())) errors.add(new FieldErrorItem("agreePrivacy", "필수 동의 항목입니다."));
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", errors.get(0).message(), errors);
    }

    // 동시에 같은 값으로 가입해 DB UNIQUE에 걸린 경우를 프론트가 아는 중복 code로 바꾼다. 제약 이름만 보고 값은 보지 않는다.
    private static ApiException duplicateFromConstraint(DuplicateKeyException e) {
        String message = String.valueOf(e.getMessage());
        if (message.contains("UK_APU_NICKNAME")) return AuthErrors.duplicateNickname();
        if (message.contains("UK_APU_EMAIL_HMAC")) return AuthErrors.duplicateEmail();
        return AuthErrors.duplicateLoginId();
    }

    // AUTH-09 N-03-1 아이디 찾기(FP-258) — 이름 + 휴대폰 또는 이메일 인증(FIND_ID 토큰)으로 찾은 일반 회원의 아이디를 가리지 않고 준다.
    // 일치하는 계정이 없으면 404이고 트랜잭션이 되돌아가 토큰은 다시 쓸 수 있다. 탈퇴·관리자 계정은 찾지 않는다.
    @Transactional
    public AuthResponses.FoundId findId(AuthRequests.FindId request) {
        // 이름 형식을 먼저 본다(틀리면 400 name 칸, 토큰은 쓰지 않음).
        AuthErrors.requireValidName(request.name());
        String method = request.method() == null ? "" : request.method().strip();
        if (!FIND_ID_PHONE.equals(method) && !FIND_ID_EMAIL.equals(method)) throw AuthErrors.invalidField("method", "아이디를 찾을 방법을 골라 주세요.");
        // 토큰이 없으면 가입과 같은 오류로 막는다: 휴대폰은 400 INVALID_INPUT(phone 칸), 이메일은 400 EMAIL_VERIFICATION_REQUIRED.
        if (isBlank(request.verificationToken())) {
            throw FIND_ID_PHONE.equals(method) ? PhoneVerificationService.verificationRequired() : EmailVerificationService.verificationRequired();
        }
        List<UserAccount> candidates;
        if (FIND_ID_PHONE.equals(method)) {
            String phone = AccountRules.normalizePhone(request.phone());
            phoneVerification.consume(request.verificationToken(), PhonePurpose.FIND_ID, phone);
            candidates = userMapper.selectUsersByPhoneHmac(hmac.phone(phone));
        } else {
            String email = AccountRules.normalizeEmail(request.email());
            emailVerification.consume(request.verificationToken(), EmailPurpose.FIND_ID, email, null);
            UserAccount account = userMapper.selectUserByEmailHmac(hmac.email(email));
            candidates = account == null ? List.of() : List.of(account);
        }
        return candidates.stream()
                .filter(account -> AccountRules.nameMatches(request.name(), crypto.decrypt(account.getNameEnc())))
                .findFirst()
                .map(account -> new AuthResponses.FoundId(AccountRules.maskLoginId(account.getLoginId()), account.getLoginId()))
                .orElseThrow(AuthErrors::accountNotFound);
    }

    // AUTH-10 비밀번호 재설정 — 이메일 인증 토큰(재설정 목적, 확인 때 찾은 계정)을 한 번 쓰고 새 비밀번호로 바꾼다. 잠긴 계정은 풀린다.
    // FP-258 아이디·이메일에 이름(복호화 비교)까지 같은 계정만 통과한다. 하나라도 다르면 같은 404.
    // FP-80 관리자는 쓸 수 없다: 조회가 일반 회원만 찾으므로(selectUserByLoginIdAndEmailHmac) 관리자 아이디는 "없는 계정"과 같은 404가 된다.
    @Transactional
    public void resetPassword(AuthRequests.PasswordReset request) {
        // 이름 형식(가입과 같은 규칙)을 먼저 본다.
        AuthErrors.requireValidName(request.name());
        String passwordError = AccountRules.newPasswordError(request.newPassword(), "비밀번호 규칙을 지켜 주세요.");
        if (passwordError != null) throw AuthErrors.invalidField("newPassword", passwordError);
        String email = AccountRules.normalizeEmail(request.email());
        UserAccount account = userMapper.selectUserByLoginIdAndEmailHmac(AccountRules.normalizeLoginId(request.loginId()), hmac.email(email));
        if (account == null || !AccountRules.nameMatches(request.name(), crypto.decrypt(account.getNameEnc()))) throw AuthErrors.accountNotFound();
        emailVerification.consume(request.emailVerificationToken(), EmailPurpose.RESET_PASSWORD, email, account.getUserId());
        userMapper.updatePasswordAndUnlock(account.getUserId(), passwordEncoder.encode(request.newPassword()), LocalDateTime.now(clock));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
