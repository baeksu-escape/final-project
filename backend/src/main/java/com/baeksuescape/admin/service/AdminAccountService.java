package com.baeksuescape.admin.service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.dto.AdminRows;
import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.service.AccountRules;
import com.baeksuescape.user.service.AuthErrors;

// FP-80 N-27 계정·권한 관리 — ADM-05 계정 목록·검색, ADM-06 잠금·해제, ADM-07 관리자 추가, 임시 비밀번호 재발급.
// 회원 → 관리자 권한 변경은 만들지 않는다(11/06 결정). 이름은 가린 값만 보내고, 풀리지 않는 암호문은 "(복호화 불가)"로 보여 준다.
@Service
public class AdminAccountService {

    static final int DEFAULT_SIZE = 20;
    static final int MAX_SIZE = 100;
    static final int LOCK_REASON_MAX = 300;
    static final String LOG_SOURCE = "admin-service";
    static final Set<String> ROLES = Set.of(UserAccount.ROLE_USER, UserAccount.ROLE_ADMIN);
    static final Set<String> STATUSES = Set.of(UserAccount.ACTIVE, UserAccount.LOCKED, UserAccount.WITHDRAWN);
    // 관리자 아이디: 영문 소문자로 시작, 영문 소문자·숫자·_ 4~16자
    static final Pattern ADMIN_LOGIN_ID = Pattern.compile("^[a-z][a-z0-9_]{3,15}$");
    // 탈퇴 아이디 접두어는 탈퇴 회원 전용(DDL CK_APU_PII_BY_STATUS)
    static final String RESERVED_PREFIX = "wd_";
    static final String NICKNAME_PREFIX = "관리자";
    static final int TEMP_PASSWORD_LENGTH = 12;
    private static final String TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final int NICKNAME_TRIES = 20;

    private final AdminAccountMapper adminMapper;
    private final UserAccountMapper userMapper;
    private final AdminAuthService adminAuth;
    private final AdminPii pii;
    private final PasswordEncoder passwordEncoder;
    private final PiiCrypto crypto;
    private final PiiHmac hmac;
    private final SystemLogService systemLog;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public AdminAccountService(AdminAccountMapper adminMapper, UserAccountMapper userMapper, AdminAuthService adminAuth, AdminPii pii,
            PasswordEncoder passwordEncoder, PiiCrypto crypto, PiiHmac hmac, SystemLogService systemLog, Clock clock) {
        this.adminMapper = adminMapper;
        this.userMapper = userMapper;
        this.adminAuth = adminAuth;
        this.pii = pii;
        this.passwordEncoder = passwordEncoder;
        this.crypto = crypto;
        this.hmac = hmac;
        this.systemLog = systemLog;
        this.clock = clock;
    }

    // ADM-05 계정 목록·검색. q는 아이디·닉네임 부분 일치(이름은 암호문이라 검색하지 않는다). 상태를 고르지 않으면 탈퇴 계정은 뺀다.
    // FP-273 ACCT-03 workerType(직군 코드 3개 중 하나)으로도 거른다. 틀린 값은 role·status와 같은 400.
    public AdminDtos.PageResponse<AdminDtos.UserRow> list(String q, String role, String status, String workerType, Integer page, Integer size) {
        if (role != null && !role.isBlank() && !ROLES.contains(role)) throw invalid("role", "권한 값을 확인해 주세요.");
        if (status != null && !status.isBlank() && !STATUSES.contains(status)) throw invalid("status", "상태 값을 확인해 주세요.");
        if (workerType != null && !workerType.isBlank() && !AdminStatsService.WORKER_TYPE_CODES.contains(workerType)) {
            throw invalid("workerType", "직군 값을 확인해 주세요.");
        }
        String roleFilter = blankToNull(role);
        String statusFilter = blankToNull(status);
        String workerTypeFilter = blankToNull(workerType);
        String qLike = q == null || q.isBlank() ? null : "%" + escapeLike(q.strip()) + "%";
        int pageNo = page == null || page < 0 ? 0 : page;
        int pageSize = size == null || size < 1 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        List<AdminDtos.UserRow> items = adminMapper.selectUsers(qLike, roleFilter, statusFilter, workerTypeFilter, false, pageNo * pageSize, pageSize)
                .stream().map(this::toRow).toList();
        long total = adminMapper.countUsers(qLike, roleFilter, statusFilter, workerTypeFilter, false);
        return new AdminDtos.PageResponse<>(items, pageNo, pageSize, total);
    }

    // ADM-06 잠금·해제. 잠글 때는 사유(1~300자)가 필요하다. 본인 계정·탈퇴 계정은 409. 응답은 바뀐 행(목록과 같은 모양).
    @Transactional
    public AdminDtos.UserRow lock(long adminId, long userId, AdminDtos.LockRequest request) {
        if (request == null || request.locked() == null) throw invalid("locked", "잠금 여부를 보내 주세요.");
        boolean locking = request.locked();
        String reason = request.reason() == null ? "" : request.reason().strip();
        if (locking && reason.isEmpty()) throw invalid("reason", "잠금 사유를 입력해 주세요.");
        if (locking && reason.length() > LOCK_REASON_MAX) throw invalid("reason", "잠금 사유는 300자 이하로 입력해 주세요.");
        if (adminId == userId) throw new ApiException(HttpStatus.CONFLICT, "CANNOT_CHANGE_SELF", "본인 계정은 잠그거나 풀 수 없습니다.");
        AdminRows.UserData target = adminMapper.selectUser(userId);
        if (target == null) throw notFound();
        if (UserAccount.WITHDRAWN.equals(target.getAccountStatusCode())) throw withdrawn();

        LocalDateTime now = LocalDateTime.now(clock);
        int changed = locking ? adminMapper.updateLocked(userId, reason, now) : adminMapper.updateUnlocked(userId, now);
        if (changed == 0) throw withdrawn();
        // 사유는 관리자가 쓴 글이라 개인정보가 섞일 수 있어 시스템 로그에는 남기지 않는다(APP_USER.LOCK_REASON에만 저장).
        String action = locking ? "계정 잠금" : "계정 잠금 해제";
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, "관리자가 " + action + " (" + SystemLogService.maskLoginId(target.getLoginId()) + ")",
                adminId);
        return toRow(adminMapper.selectUser(userId));
    }

    // ADM-07 관리자 추가 — 재확인 토큰(X-Step-Up-Token) 필요. 임시 비밀번호(12자)를 응답에 한 번만 준다(로그에 남기지 않는다).
    // 닉네임은 필수·중복 불가라 '관리자' + 숫자로 자동으로 짓고, 겹치면 다시 짓는다. 첫 로그인 때 비밀번호를 바꿔야 한다.
    @Transactional
    public AdminDtos.TemporaryPassword addAdmin(long adminId, AdminDtos.NewAdmin request, String stepUpToken) {
        String jti = adminAuth.checkStepUp(adminId, stepUpToken);
        String loginId = request == null || request.loginId() == null ? "" : request.loginId().strip();
        String name = request == null || request.name() == null ? "" : request.name().strip();
        String email = request == null || request.workEmail() == null ? "" : request.workEmail().strip();
        validateNewAdmin(loginId, name, email);
        String emailHmac = hmac.email(email);
        if (userMapper.countByLoginId(loginId) > 0) throw AuthErrors.duplicateLoginId();
        if (userMapper.countByEmailHmac(emailHmac) > 0) throw AuthErrors.duplicateEmail();
        adminAuth.consumeStepUp(jti);

        String temporaryPassword = newTemporaryPassword();
        UserAccount account = new UserAccount();
        account.setLoginId(loginId);
        account.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        account.setNameEnc(crypto.encrypt(name));
        account.setEmailEnc(crypto.encrypt(email));
        account.setEmailHmac(emailHmac);
        account.setCreatedAt(LocalDateTime.now(clock));
        insertWithNickname(account);
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, "관리자 계정 추가 (" + SystemLogService.maskLoginId(loginId) + ")", adminId);
        return new AdminDtos.TemporaryPassword(account.getUserId(), loginId, temporaryPassword);
    }

    // 5-2 임시 비밀번호 재발급 — 재확인 토큰 필요. 대상은 본인이 아닌 관리자. 잠겼으면 풀고, 다음 로그인 때 비밀번호를 바꾸게 한다.
    @Transactional
    public AdminDtos.TemporaryPassword reissueTemporaryPassword(long adminId, long userId, String stepUpToken) {
        String jti = adminAuth.checkStepUp(adminId, stepUpToken);
        if (adminId == userId) throw new ApiException(HttpStatus.CONFLICT, "CANNOT_CHANGE_SELF", "본인 계정의 임시 비밀번호는 발급할 수 없습니다.");
        UserAccount target = userMapper.selectById(userId);
        if (target == null || !target.isAdmin()) throw notFound();
        if (target.isWithdrawn()) throw withdrawn();
        adminAuth.consumeStepUp(jti);

        String temporaryPassword = newTemporaryPassword();
        if (adminMapper.updateTemporaryPassword(userId, passwordEncoder.encode(temporaryPassword), LocalDateTime.now(clock)) == 0) throw withdrawn();
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE,
                "관리자 임시 비밀번호 재발급 (" + SystemLogService.maskLoginId(target.getLoginId()) + ")", adminId);
        return new AdminDtos.TemporaryPassword(userId, target.getLoginId(), temporaryPassword);
    }

    // ── 내부 ──

    private void validateNewAdmin(String loginId, String name, String email) {
        List<FieldErrorItem> errors = new ArrayList<>();
        if (loginId.isEmpty()) errors.add(new FieldErrorItem("loginId", "아이디를 입력해 주세요."));
        else if (!ADMIN_LOGIN_ID.matcher(loginId).matches()) {
            errors.add(new FieldErrorItem("loginId", "아이디는 영문 소문자로 시작하는 4~16자 영문 소문자·숫자·_로 입력해 주세요."));
        } else if (loginId.startsWith(RESERVED_PREFIX)) errors.add(new FieldErrorItem("loginId", "쓸 수 없는 아이디입니다."));
        if (name.isEmpty()) errors.add(new FieldErrorItem("name", "이름을 입력해 주세요."));
        else if (name.length() > AccountRules.NAME_MAX) errors.add(new FieldErrorItem("name", "이름은 50자 이하로 입력해 주세요."));
        if (email.isEmpty()) errors.add(new FieldErrorItem("workEmail", "업무 이메일을 입력해 주세요."));
        // FP-258 업무 이메일은 develop처럼 기본 형식만 본다(새 이메일 규칙은 회원 가입·이메일 변경만).
        else if (!AccountRules.isBasicEmail(email)) errors.add(new FieldErrorItem("workEmail", "이메일 형식이 올바르지 않습니다. 예) name@example.com"));
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", errors.get(0).message(), errors);
    }

    // '관리자' + 4자리 숫자 닉네임으로 저장한다. 이미 있거나 동시에 같은 닉네임이 들어가면 다시 짓는다.
    private void insertWithNickname(UserAccount account) {
        for (int i = 0; i < NICKNAME_TRIES; i++) {
            String nickname = NICKNAME_PREFIX + (1000 + random.nextInt(9000));
            if (userMapper.countByNickname(nickname) > 0) continue;
            account.setNickname(nickname);
            try {
                adminMapper.insertAdmin(account);
                return;
            } catch (DuplicateKeyException e) {
                String message = String.valueOf(e.getMessage());
                if (message.contains("UK_APU_NICKNAME")) continue;
                if (message.contains("UK_APU_EMAIL_HMAC")) throw AuthErrors.duplicateEmail();
                throw AuthErrors.duplicateLoginId();
            }
        }
        throw new ApiException(HttpStatus.CONFLICT, "NICKNAME_UNAVAILABLE", "관리자 닉네임을 정하지 못했습니다. 다시 시도해 주세요.");
    }

    // 영문·숫자를 섞은 12자 임시 비밀번호(SecureRandom). 헷갈리는 글자(0·O·1·l·I)는 뺐다. 비밀번호 규칙을 만족할 때까지 다시 만든다.
    String newTemporaryPassword() {
        while (true) {
            StringBuilder password = new StringBuilder(TEMP_PASSWORD_LENGTH);
            for (int i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
                password.append(TEMP_PASSWORD_CHARS.charAt(random.nextInt(TEMP_PASSWORD_CHARS.length())));
            }
            if (AccountRules.isValidPassword(password.toString())) return password.toString();
        }
    }

    AdminDtos.UserRow toRow(AdminRows.UserData data) {
        return new AdminDtos.UserRow(data.getUserId(), data.getLoginId(), pii.maskedName(data.getUserId(), data.getNameEnc()), data.getRoleCode(),
                data.getWorkerTypeCode(), data.getLatestAltScore(), data.getAccountStatusCode(),
                data.getReportedPostCount() == null ? 0 : data.getReportedPostCount(), offset(data.getCreatedAt()), offset(data.getLastLoginAt()),
                data.getNickname());
    }

    private OffsetDateTime offset(LocalDateTime time) {
        return time == null ? null : time.atZone(clock.getZone()).toOffsetDateTime();
    }

    // LIKE 특수문자(\ % _)를 \로 막는다(SQL은 ESCAPE '\').
    static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static ApiException invalid(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message, List.of(new FieldErrorItem(field, message)));
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "계정을 찾을 수 없습니다.");
    }

    private static ApiException withdrawn() {
        return new ApiException(HttpStatus.CONFLICT, "ACCOUNT_WITHDRAWN", "탈퇴한 계정은 바꿀 수 없습니다.");
    }
}
