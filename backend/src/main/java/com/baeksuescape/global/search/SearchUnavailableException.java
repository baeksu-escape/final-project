package com.baeksuescape.global.search;

/**
 * FP-305 Elasticsearch를 쓸 수 없을 때(연결 안 됨·시간 초과·4xx·5xx·응답 모양 이상) 던지는 예외 하나.
 * 사용자에게 바로 보이는 오류가 아니라, 부르는 쪽이 받아서 기존 검색으로 대신하거나 경고만 남기게 한다.
 */
public class SearchUnavailableException extends RuntimeException {

    public SearchUnavailableException(String message) {
        super(message);
    }
}
