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

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
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

    static final int MAX_LOGIN_FAILURES = 5;

    private final UserAccountMapper userMapper;
    private final UserConsentMapper consentMapper;
    private final UserSocialAccountMapper socialMapper;
    private final EmailVerificationService emailVerification;
    private final DevSocialStore socialStore;
    private final UserViewFactory userViews;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final PiiCrypto crypto;
    private final PiiHmac hmac;
    private final Clock clock;

    public AuthService(UserAccountMapper userMapper, UserConsentMapper consentMapper, UserSocialAccountMapper socialMapper,
            EmailVerificationService emailVerification, DevSocialStore socialStore, UserViewFactory userViews, JwtTokenProvider tokenProvider,
            PasswordEncoder passwordEncoder, PiiCrypto crypto, PiiHmac hmac, Clock clock) {
        this.userMapper = userMapper;
        this.consentMapper = consentMapper;
        this.socialMapper = socialMapper;
        this.emailVerification = emailVerification;
        this.socialStore = socialStore;
        this.userViews = userViews;
        this.tokenProvider = tokenProvider;
        this.passwordEncoder = passwordEncoder;
        this.crypto = crypto;
        this.hmac = hmac;
        this.clock = clock;
    }

    // AUTH-01 로그인. 관리자는 2단계 인증(AUTH-11)이 준비될 때까지 비밀번호가 맞아도 토큰을 주지 않는다.
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponses.Login login(AuthRequests.Login request) {
        UserAccount account = authenticate(request.loginId(), request.password());
        if (account.isAdmin()) {
            // TODO(작업 7) 관리자 로그인 2단계 인증(AUTH-11 /api/auth/admin/verify-code)을 만들면 여기서 인증번호 단계로 넘긴다.
            throw new ApiException(HttpStatus.CONFLICT, "ADMIN_2FA_NOT_READY", "관리자 로그인은 2단계 인증을 준비하고 있어 아직 쓸 수 없습니다.");
        }
        return loginResponse(account);
    }

    // 아이디·비밀번호를 확인한다. 로그인과 간편 로그인 연결(AUTH-05)이 같은 규칙을 쓴다.
    //   없는 계정·탈퇴·비밀번호 없는 계정·틀린 비밀번호 → 401(어느 쪽이 틀렸는지 알리지 않음)
    //   틀리면 실패 횟수 +1, 5회째면 잠그고 423. 잠긴 계정은 비밀번호가 맞을 때만 423으로 알린다(프론트 mock과 같은 순서).
    @Transactional(noRollbackFor = ApiException.class)
    public UserAccount authenticate(String loginId, String password) {
        UserAccount account = userMapper.selectByLoginId(loginId.strip());
        if (account == null || account.isWithdrawn() || account.getPasswordHash() == null) throw AuthErrors.loginFailed();
        if (!passwordEncoder.matches(password, account.getPasswordHash())) {
            if (!account.isLocked()) {
                int failures = account.getLoginFailCount() + 1;
                boolean lock = failures >= MAX_LOGIN_FAILURES;
                userMapper.updateLoginFailure(account.getUserId(), failures, lock, LocalDateTime.now(clock));
                if (lock) throw AuthErrors.accountLocked();
            }
            throw AuthErrors.loginFailed();
        }
        if (account.isLocked()) throw AuthErrors.accountLocked();
        return account;
    }

    // 로그인 성공 처리(실패 횟수 0, 마지막 로그인 시각)와 응답. 간편 로그인도 쓴다.
    public AuthResponses.Login loginResponse(UserAccount account) {
        userMapper.updateLoginSuccess(account.getUserId(), LocalDateTime.now(clock));
        return new AuthResponses.Login(tokenProvider.issue(account.getUserId(), account.getRoleCode()), userViews.of(account));
    }

    // AUTH-03 내 정보. 탈퇴 회원은 인증 필터에서 이미 401이다.
    public AuthResponses.Me me(long userId) {
        UserAccount account = userMapper.selectById(userId);
        if (account == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        return new AuthResponses.Me(userViews.of(account));
    }

    // AUTH-06 회원가입 — 칸 검사 → 중복(아이디·이메일·닉네임 순) → 간편 로그인 키 → 이메일 인증 토큰 사용 → 계정·동의·간편 로그인 연결 저장을 한 트랜잭션으로 한다.
    @Transactional
    public AuthResponses.Signup signup(AuthRequests.Signup request) {
        LocalDateTime now = LocalDateTime.now(clock);
        validateSignup(request, now.getYear());

        String loginId = request.loginId();
        String email = request.email().strip();
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

    // N-02-2 가입 동의 3행(필수 2·선택 1, 더미 시드와 같은 모양).
    // TODO(프론트) 지금 화면은 체크 하나(agreeCreditInfo)뿐이라 이용약관(TERMS_OF_SERVICE) 동의를 그 체크로 대신 기록한다 — 시연용 임시 처리다.
    //   실제로 쓰기 전에 가입 화면에 필수 2개(이용약관·개인정보 수집·이용)와 선택 1개(점수 변동 알림·혜택 안내) 체크박스를 반드시 추가해야 한다.
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
            errors.add(new FieldErrorItem("loginId", "아이디는 영문 소문자로 시작하는 4~20자 영문 소문자·숫자로 입력해 주세요."));
        }
        if (isBlank(r.name())) errors.add(new FieldErrorItem("name", "이름을 입력해 주세요."));
        else if (r.name().strip().length() > AccountRules.NAME_MAX) errors.add(new FieldErrorItem("name", "이름은 50자 이하로 입력해 주세요."));
        String nicknameError = AccountRules.nicknameError(r.nickname());
        if (nicknameError != null) errors.add(new FieldErrorItem("nickname", nicknameError));
        String phone = AccountRules.normalizePhone(r.phone());
        if (!phone.isEmpty() && !AccountRules.isValidPhone(phone)) {
            errors.add(new FieldErrorItem("phone", "휴대폰 번호 형식이 올바르지 않습니다. 예) 010-1234-5678"));
        }
        if (isBlank(r.email())) errors.add(new FieldErrorItem("email", "이메일을 입력해 주세요."));
        else if (!AccountRules.isValidEmail(r.email().strip())) errors.add(new FieldErrorItem("email", "이메일 형식이 올바르지 않습니다. 예) name@example.com"));
        else if (isBlank(r.emailVerificationToken())) errors.add(new FieldErrorItem("email", "이메일 인증을 완료해 주세요."));
        if (isBlank(r.password())) errors.add(new FieldErrorItem("password", "비밀번호를 입력해 주세요."));
        else if (!AccountRules.isValidPassword(r.password())) errors.add(new FieldErrorItem("password", "비밀번호 규칙을 모두 지켜 주세요."));
        String birthYearError = AccountRules.birthYearError(r.birthYear(), thisYear);
        if (birthYearError != null) errors.add(new FieldErrorItem("birthYear", birthYearError));
        if (!Boolean.TRUE.equals(r.agreeCreditInfo())) errors.add(new FieldErrorItem("agreeCreditInfo", "필수 동의 항목입니다."));
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", errors.get(0).message(), errors);
    }

    // 동시에 같은 값으로 가입해 DB UNIQUE에 걸린 경우를 프론트가 아는 중복 code로 바꾼다. 제약 이름만 보고 값은 보지 않는다.
    private static ApiException duplicateFromConstraint(DuplicateKeyException e) {
        String message = String.valueOf(e.getMessage());
        if (message.contains("UK_APU_NICKNAME")) return AuthErrors.duplicateNickname();
        if (message.contains("UK_APU_EMAIL_HMAC")) return AuthErrors.duplicateEmail();
        return AuthErrors.duplicateLoginId();
    }

    // AUTH-09 아이디 찾기(이름·휴대폰). 휴대폰 HMAC으로 후보를 찾고 이름을 복호화해 비교한다. 탈퇴·관리자 계정은 찾지 않는다.
    public AuthResponses.FoundId findId(AuthRequests.FindId request) {
        String phone = AccountRules.normalizePhone(request.phone());
        String name = request.name().strip();
        if (phone.isEmpty()) throw AuthErrors.accountNotFound();
        return userMapper.selectUsersByPhoneHmac(hmac.phone(phone)).stream()
                .filter(account -> name.equals(crypto.decrypt(account.getNameEnc())))
                .findFirst()
                .map(account -> new AuthResponses.FoundId(AccountRules.maskLoginId(account.getLoginId())))
                .orElseThrow(AuthErrors::accountNotFound);
    }

    // AUTH-10 비밀번호 재설정 — 이메일 인증 토큰(재설정 목적, 확인 때 찾은 계정)을 한 번 쓰고 새 비밀번호로 바꾼다. 잠긴 계정은 풀린다.
    @Transactional
    public void resetPassword(AuthRequests.PasswordReset request) {
        if (!AccountRules.isValidPassword(request.newPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "비밀번호 규칙을 지켜 주세요.",
                    List.of(new FieldErrorItem("newPassword", "비밀번호 규칙을 지켜 주세요.")));
        }
        String email = request.email().strip();
        UserAccount account = userMapper.selectUserByLoginIdAndEmailHmac(request.loginId().strip(), hmac.email(email));
        if (account == null) throw AuthErrors.accountNotFound();
        emailVerification.consume(request.emailVerificationToken(), EmailPurpose.RESET_PASSWORD, email, account.getUserId());
        userMapper.updatePasswordAndUnlock(account.getUserId(), passwordEncoder.encode(request.newPassword()), LocalDateTime.now(clock));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
