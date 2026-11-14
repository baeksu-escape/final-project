package com.baeksuescape.global.exception;

import java.util.List;

import org.springframework.http.HttpStatus;

import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

// FP-87 업무 오류 — 서비스에서 던지면 GlobalExceptionHandler가 { code, message, fieldErrors } 응답으로 바꾼다.
// 사용 예: throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_NICKNAME", "이미 사용 중인 닉네임입니다.");
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<FieldErrorItem> fieldErrors;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public ApiException(HttpStatus status, String code, String message, List<FieldErrorItem> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors == null ? List.of() : List.copyOf(fieldErrors);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public List<FieldErrorItem> getFieldErrors() {
        return fieldErrors;
    }
}
