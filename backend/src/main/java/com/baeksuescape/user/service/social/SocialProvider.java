package com.baeksuescape.user.service.social;

import java.util.Arrays;
import java.util.Optional;

import com.baeksuescape.user.dto.AuthResponses.SocialProfile;

// FP-87 N-01-6 간편 로그인 제공자 — 프론트 key(socialLoginConfig.js SOCIAL_PROVIDERS)와 DB PROVIDER_CODE(CK_USA_PROVIDER)의 짝.
// DEV 모드에서는 제공자마다 고정 가짜 사용자 하나를 쓴다(외부 호출 없음). 실제 정보가 아니다.
public enum SocialProvider {
    GOOGLE("google", "Google"),
    KAKAO("kakao", "카카오"),
    NAVER("naver", "네이버");

    private final String key;
    private final String displayName;

    SocialProvider(String key, String displayName) {
        this.key = key;
        this.displayName = displayName;
    }

    public String key() {
        return key;
    }

    public static Optional<SocialProvider> fromKey(String key) {
        return Arrays.stream(values()).filter(provider -> provider.key.equals(key)).findFirst();
    }

    // DEV 가짜 제공자가 돌려주는 사용자 식별값(USER_SOCIAL_ACCOUNT.PROVIDER_USER_ID).
    public String devProviderUserId() {
        return "dev-" + key + "-user";
    }

    // DEV 가짜 제공자가 돌려주는 프로필(가입 화면에 미리 채움).
    public SocialProfile devProfile() {
        return new SocialProfile("개발용 " + displayName, "dev-" + key + "@example.com");
    }
}
