package com.baeksuescape.global.security;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// FP-87 보안·오류 처리 테스트 전용 컨트롤러(src/test에만 있다). 실제 API와 겹치지 않게 경로에 __test를 넣는다.
@RestController
class SecurityTestController {

    record NicknameBody(@NotBlank(message = "닉네임을 넣어 주세요.") @Size(min = 2, max = 12, message = "닉네임은 2~12자로 넣어 주세요.") String nickname) {
    }

    @GetMapping("/api/members/me/__test/ping")
    Map<String, Object> memberPing(@AuthenticationPrincipal AuthUser user) {
        return Map.of("userId", user.userId(), "role", user.role());
    }

    @GetMapping("/api/admin/__test/ping")
    Map<String, Object> adminPing(@AuthenticationPrincipal AuthUser user) {
        return Map.of("userId", user.userId());
    }

    @GetMapping("/api/finance/__test/ping")
    Map<String, Object> temporaryOpenPing() {
        return Map.of("ok", true);
    }

    @GetMapping("/api/other/__test/ping")
    Map<String, Object> otherPing() {
        return Map.of("ok", true);
    }

    @PostMapping("/api/members/me/__test/validate")
    Map<String, Object> validate(@Valid @RequestBody NicknameBody body) {
        return Map.of("nickname", body.nickname());
    }

    @PostMapping("/api/members/me/__test/conflict")
    Map<String, Object> conflict() {
        throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_NICKNAME", "이미 사용 중인 닉네임입니다.",
                java.util.List.of(new FieldErrorItem("nickname", "이미 사용 중인 닉네임입니다.")));
    }


    // FP-143 경로 변수에 든 값이 오류 로그에 남지 않는지 보는 용도(상품 코드·관리자 경로의 회원 번호와 같은 모양)
    @PostMapping("/api/members/me/__test/items/{code}/conflict")
    Map<String, Object> conflictWithPathVariable(@PathVariable String code) {
        throw new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "상품을 찾을 수 없습니다.");
    }

    @PostMapping("/api/members/me/__test/items/{code}/boom")
    Map<String, Object> boomWithPathVariable(@PathVariable String code) {
        throw new IllegalStateException("boom");
    }

    @PostMapping("/api/members/me/__test/boom")
    Map<String, Object> boom() {
        throw new IllegalStateException("SELECT * FROM APP_USER WHERE EMAIL = 'secret@example.com'");
    }
}
