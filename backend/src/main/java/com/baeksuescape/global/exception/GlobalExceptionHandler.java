package com.baeksuescape.global.exception;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

// FP-87 공통 오류 처리 — 모든 오류를 { code, message, fieldErrors } 모양으로 돌려준다.
// 응답과 로그에는 SQL·개인정보·키가 들어가지 않게, 예상 못 한 오류는 고정 문구만 보내고 로그에는 예외 종류만 남긴다.
@RestControllerAdvice
public class GlobalExceptionHandler {

    public static final String INVALID_INPUT = "INVALID_INPUT";
    private static final String INVALID_INPUT_MESSAGE = "입력값을 확인해 주세요.";
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // 업무 오류: 던진 쪽이 정한 상태·코드·문구를 그대로 쓴다.
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(new ErrorResponse(e.getCode(), e.getMessage(), e.getFieldErrors()));
    }

    // @Valid 본문 검증 실패 → 400 INVALID_INPUT + 칸별 오류.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleBodyValidation(MethodArgumentNotValidException e) {
        List<FieldErrorItem> items = e.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldErrorItem(error.getField(), error.getDefaultMessage()))
                .toList();
        return badRequest(items);
    }

    // 경로·쿼리 값 검증 실패(@Validated 파라미터) → 400 INVALID_INPUT. field는 파라미터 이름이다.
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleParamValidation(HandlerMethodValidationException e) {
        List<FieldErrorItem> items = new ArrayList<>();
        e.getAllValidationResults().forEach(result -> result.getResolvableErrors().forEach(error ->
                items.add(new FieldErrorItem(result.getMethodParameter().getParameterName(), error.getDefaultMessage()))));
        return badRequest(items);
    }

    // 쿼리 값 누락·형식 오류 → 400 INVALID_INPUT.
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException e) {
        return badRequest(List.of(new FieldErrorItem(e.getParameterName(), "값이 필요합니다.")));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return badRequest(List.of(new FieldErrorItem(e.getName(), "형식이 올바르지 않습니다.")));
    }

    // JSON을 읽지 못함(형식 오류·빈 본문) → 400 INVALID_INPUT.
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(ErrorResponse.of(INVALID_INPUT, "요청 형식이 올바르지 않습니다."));
    }

    // 컨트롤러 안에서 권한 오류가 나면 403으로 맞춘다(필터 단계의 403은 JsonAccessDeniedHandler가 보낸다).
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse.of("FORBIDDEN", "접근 권한이 없습니다."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse.of("NOT_FOUND", "요청한 주소를 찾을 수 없습니다."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethod(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(ErrorResponse.of("METHOD_NOT_ALLOWED", "지원하지 않는 요청 방식입니다."));
    }

    // 예상 못 한 오류 → 500 INTERNAL_ERROR. 예외 메시지에 SQL·값이 섞일 수 있어 응답·로그 모두 예외 종류만 쓴다.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        log.error("처리하지 못한 오류: {}", e.getClass().getName());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of("INTERNAL_ERROR", "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."));
    }

    private static ResponseEntity<ErrorResponse> badRequest(List<FieldErrorItem> items) {
        return ResponseEntity.badRequest().body(new ErrorResponse(INVALID_INPUT, INVALID_INPUT_MESSAGE, items));
    }
}
