package com.baeksuescape.user.service.social;

import java.net.URI;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserSocialAccountMapper;
import com.baeksuescape.user.service.AuthErrors;
import com.baeksuescape.user.service.AuthService;

// FP-87 N-01-6 간편 로그인(AUTH-04·05) — avenue.auth.social.mode=DEV에서 실제 제공자 대신 개발용 가짜 제공자로 프론트 흐름을 끝까지 돌린다.
//   시작 주소 → 프론트 콜백(?code) → 교환: 연결된 계정이면 바로 로그인, 처음이면 LINK_REQUIRED(기존 계정 연결 또는 가입).
//   제공자마다 가짜 사용자가 하나라서, DEV에서는 먼저 연결한 계정 하나로만 그 제공자 로그인이 된다.
// TODO(REAL 모드) 실제 OAuth는 아직 만들지 않는다. 만들 때 클라이언트 ID·시크릿은 환경변수로만 받는다.
@Service
public class SocialLoginService {

    // 사용자가 취소하거나 실패했을 때 프론트 콜백이 읽는 error 값과 다른, 서버 설정 문제 표시.
    static final String MODE_NOT_SUPPORTED_ERROR = "social_mode_not_supported";

    private final AvenueProperties properties;
    private final DevSocialStore store;
    private final UserSocialAccountMapper socialMapper;
    private final UserAccountMapper userMapper;
    private final AuthService authService;

    public SocialLoginService(AvenueProperties properties, DevSocialStore store, UserSocialAccountMapper socialMapper,
            UserAccountMapper userMapper, AuthService authService) {
        this.properties = properties;
        this.store = store;
        this.socialMapper = socialMapper;
        this.userMapper = userMapper;
        this.authService = authService;
    }

    // 시작 주소(GET /oauth2/authorization/{provider}) — DEV면 일회용 코드를 붙인 프론트 콜백 주소, 아니면 error를 붙인 주소.
    public URI authorizationRedirect(String providerKey) {
        UriComponentsBuilder callback = UriComponentsBuilder.fromUriString(properties.getAuth().getSocial().getCallbackUrl());
        SocialProvider provider = SocialProvider.fromKey(providerKey).orElse(null);
        if (!isDevMode() || provider == null) {
            return callback.queryParam("error", isDevMode() ? "invalid_provider" : MODE_NOT_SUPPORTED_ERROR).build().toUri();
        }
        return callback.queryParam("code", store.issueCode(provider)).build().toUri();
    }

    // AUTH-04 일회용 코드 교환.
    @Transactional
    public AuthResponses.SocialExchange exchange(AuthRequests.SocialExchange request) {
        requireDevMode();
        SocialProvider provider = store.takeCode(request.code())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SOCIAL_CODE", "소셜 로그인 코드를 확인할 수 없습니다."));
        String providerUserId = provider.devProviderUserId();
        Long userId = socialMapper.selectUserId(provider.name(), providerUserId);
        UserAccount account = userId == null ? null : userMapper.selectById(userId);
        if (account == null || account.isWithdrawn()) {
            String linkKey = store.issueLinkKey(new DevSocialStore.PendingLink(provider.name(), providerUserId));
            return AuthResponses.SocialExchange.linkRequired(linkKey, provider.key(), provider.devProfile());
        }
        if (account.isLocked()) throw AuthErrors.accountLocked();
        if (account.isAdmin()) throw AuthErrors.socialAdminNotAllowed();
        return AuthResponses.SocialExchange.linked(authService.loginResponse(account));
    }

    // AUTH-05 기존 계정에 연결 — 아이디·비밀번호는 일반 로그인과 같은 규칙(실패 횟수·잠금)으로 확인한다. 관리자 계정은 연결하지 않는다.
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponses.Login link(AuthRequests.SocialLink request) {
        requireDevMode();
        DevSocialStore.PendingLink pending = store.findLinkKey(request.linkKey()).orElseThrow(AuthErrors::socialLinkExpired);
        UserAccount account = authService.authenticate(request.loginId(), request.password());
        if (account.isAdmin()) throw AuthErrors.socialAdminNotAllowed();
        if (socialMapper.countByUserAndProvider(account.getUserId(), pending.providerCode()) > 0) throw alreadyLinked();
        try {
            socialMapper.insertLink(account.getUserId(), pending.providerCode(), pending.providerUserId());
        } catch (DuplicateKeyException e) {
            throw alreadyLinked();
        }
        store.removeLinkKey(request.linkKey());
        AuthResponses.Login login = authService.loginResponse(account);
        return new AuthResponses.Login(login.accessToken(), login.user(), true);
    }

    private boolean isDevMode() {
        return properties.getAuth().getSocial().getMode() == AvenueProperties.SocialMode.DEV;
    }

    private void requireDevMode() {
        if (!isDevMode()) {
            throw new ApiException(HttpStatus.NOT_IMPLEMENTED, "SOCIAL_MODE_NOT_SUPPORTED", "실제 간편 로그인(REAL 모드)은 아직 지원하지 않습니다.");
        }
    }

    private static ApiException alreadyLinked() {
        return new ApiException(HttpStatus.CONFLICT, "SOCIAL_ALREADY_LINKED", "이미 다른 계정과 연결된 간편 로그인이거나, 이 계정에 같은 간편 로그인이 연결돼 있습니다.");
    }
}
