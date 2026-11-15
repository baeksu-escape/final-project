package com.baeksuescape.user.service.altdata;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.config.AvenueProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// FP-85 N-05-6 1차 원천 — docs/spec/sql/dummy_db/external_api/*_responses.jsonl(v3.6.1)을 시작할 때 읽어 USER_ID별로 둔다.
// 폴더(avenue.altdata.source-dir)가 없거나 비어도 앱은 뜨고, 그 종류의 불러오기만 503이 된다. 파일은 읽기만 한다.
@Component
public class JsonlAltDataSource implements AltDataSource {

    private static final Logger log = LoggerFactory.getLogger(JsonlAltDataSource.class);

    private final ObjectMapper objectMapper;
    // 파일 이름 → (USER_ID → 응답 한 줄)
    private final Map<String, Map<Long, JsonNode>> responsesByFile = new HashMap<>();
    private LocalDate defaultAsOfDate;

    public JsonlAltDataSource(AvenueProperties properties, ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        load(properties.getAltdata().getSourceDir());
    }

    // 폴더의 응답 파일을 읽는다. 경로는 설정값이라 로그에 남기지 않고 읽은 건수만 남긴다.
    private void load(String sourceDir) {
        if (sourceDir == null || sourceDir.isBlank() || !Files.isDirectory(Path.of(sourceDir))) {
            log.warn("대안 데이터 원천 폴더가 없어 불러오기를 쓸 수 없습니다(avenue.altdata.source-dir).");
            return;
        }
        for (AltDataKind kind : AltDataKind.values()) {
            String fileName = kind.fileName();
            Path file = Path.of(sourceDir, fileName);
            if (responsesByFile.containsKey(fileName) || !Files.isRegularFile(file)) {
                continue;
            }
            try {
                Map<Long, JsonNode> responses = readFile(file);
                if (!responses.isEmpty()) {
                    responsesByFile.put(fileName, responses);
                    log.info("대안 데이터 원천 {}: 회원 {}명", fileName, responses.size());
                }
            } catch (IOException | RuntimeException e) {
                log.warn("대안 데이터 원천 {}을(를) 읽지 못했습니다: {}", fileName, e.getClass().getSimpleName());
            }
        }
    }

    // JSONL 한 줄 = 회원 한 명. member_id(MEM000102)를 USER_ID(102)로 바꿔 둔다.
    private Map<Long, JsonNode> readFile(Path file) throws IOException {
        Map<Long, JsonNode> responses = new HashMap<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                JsonNode response = objectMapper.readTree(line.startsWith("﻿") ? line.substring(1) : line);
                responses.put(AltDataConverter.userIdOf(response.path("member_id").asText()), response);
                LocalDate asOf = AltDataConverter.asOfDate(response);
                if (asOf != null && (defaultAsOfDate == null || asOf.isAfter(defaultAsOfDate))) {
                    defaultAsOfDate = asOf;
                }
            }
        }
        return responses;
    }

    @Override
    public boolean isAvailable(AltDataKind kind) {
        return responsesByFile.containsKey(kind.fileName());
    }

    @Override
    public Optional<JsonNode> find(AltDataKind kind, long userId) {
        return Optional.ofNullable(responsesByFile.getOrDefault(kind.fileName(), Map.of()).get(userId));
    }

    @Override
    public LocalDate defaultAsOfDate() {
        return defaultAsOfDate;
    }
}
