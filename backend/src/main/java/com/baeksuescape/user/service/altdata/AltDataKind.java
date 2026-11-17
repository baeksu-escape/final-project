package com.baeksuescape.user.service.altdata;

import java.util.Arrays;
import java.util.Optional;

// FP-85 N-05-6 대안 데이터 5종 — 화면 key·요청 경로(apiSegment)·동의 항목(DDL USER_CONSENT 주석)·기관 응답 파일을 한 곳에 묶는다.
// 프론트 config/altDataSources.js와 같은 값이다. TODO(2차) 금융(financial/LOANS) 불러오기는 1차 화면에 없어 만들지 않는다.
public enum AltDataKind {

    EASYPAY("easypay", "easypay", "payment", "EASYPAY", "payment_responses.jsonl"),
    TELECOM("telecom", "telecom", "telecom", "TELECOM_BILL", "telecom_responses.jsonl"),
    NATIONAL_PENSION("nationalPension", "national-pension", "public-insurance", "NATIONAL_PENSION", "public_insurance_responses.jsonl"),
    HEALTH_INSURANCE("healthInsurance", "health-insurance", "public-insurance", "HEALTH_INSURANCE", "public_insurance_responses.jsonl"),
    UTILITY("utility", "utility", "utility", "UTILITY_BILL", "utility_responses.jsonl");

    private final String key;
    private final String apiSegment;
    private final String providerCode;
    private final String itemCode;
    private final String fileName;

    AltDataKind(String key, String apiSegment, String providerCode, String itemCode, String fileName) {
        this.key = key;
        this.apiSegment = apiSegment;
        this.providerCode = providerCode;
        this.itemCode = itemCode;
        this.fileName = fileName;
    }

    public String key() {
        return key;
    }

    public String apiSegment() {
        return apiSegment;
    }

    public String providerCode() {
        return providerCode;
    }

    public String itemCode() {
        return itemCode;
    }

    public String fileName() {
        return fileName;
    }

    // 불러오기에 성공한 동의에 남기는 가상 기관 동의 ID — 더미 시드(build_db.py)와 같은 'DUMMY-{회원코드}-{ITEM_CODE}'.
    // 회원코드는 'MEM' + USER_ID 6자리(예: MEM000102). BORROW 모드에서도 빌린 회원이 아니라 이 회원의 코드를 쓴다.
    public String externalConsentId(long userId) {
        return "DUMMY-" + String.format("MEM%06d", userId) + "-" + itemCode;
    }

    public static Optional<AltDataKind> fromApiSegment(String segment) {
        return Arrays.stream(values()).filter(kind -> kind.apiSegment.equals(segment)).findFirst();
    }

    public static Optional<AltDataKind> fromConsent(String providerCode, String itemCode) {
        return Arrays.stream(values())
                .filter(kind -> kind.providerCode.equals(providerCode) && kind.itemCode.equals(itemCode))
                .findFirst();
    }
}
