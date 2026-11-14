package com.baeksuescape.global.exception;

import java.util.List;

// FP-87 공통 오류 응답 — { code, message, fieldErrors: [{ field, message }] }. 프론트 client.js·serverErrors.js가 읽는 모양이다(D-20 A팀 임시 형식).
// fieldErrors는 칸별 오류가 없어도 빈 배열로 보낸다.
public record ErrorResponse(String code, String message, List<FieldErrorItem> fieldErrors) {

    // 칸 하나의 오류. field는 Spring 검증 경로 그대로 쓴다(예: 'baseMonth', 'loans.items[0].balanceAmount').
    public record FieldErrorItem(String field, String message) {
    }

    public ErrorResponse {
        fieldErrors = fieldErrors == null ? List.of() : List.copyOf(fieldErrors);
    }

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, List.of());
    }
}
