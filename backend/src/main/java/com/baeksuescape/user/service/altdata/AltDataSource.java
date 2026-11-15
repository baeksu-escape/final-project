package com.baeksuescape.user.service.altdata;

import java.time.LocalDate;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;

// FP-85 N-05-6 가상 기관 응답 원천. 1차는 더미 JSONL 파일(JsonlAltDataSource), 2차에는 mock 서버 구현으로 바꿀 수 있게 나눠 둔다.
public interface AltDataSource {

    // 이 종류의 응답을 읽을 수 있는지(폴더·파일이 없으면 false → 불러오기 503).
    boolean isAvailable(AltDataKind kind);

    // 회원 한 명의 기관 응답(JSONL 한 줄). 파일에 없는 회원이면 빈 값.
    Optional<JsonNode> find(AltDataKind kind, long userId);

    // 응답에 기준일(as_of_date)이 없을 때 쓸 원천 전체의 기준일. 모르면 null.
    LocalDate defaultAsOfDate();
}
