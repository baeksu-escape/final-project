package com.baeksuescape.global.search;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.core.io.ClassPathResource;

/**
 * FP-305 Elasticsearch 색인 하나의 이름과 설정·매핑 JSON 파일(classpath) 위치.
 * 기능마다 이 값을 빈(@Bean)으로 하나 등록하면 SearchIndexInitializer가 서버를 켤 때 없는 색인을 만든다(예: 라운지 LoungeSearchIndex).
 */
public record SearchIndexDefinition(String name, String resourcePath) {

    /** 설정·매핑 JSON 글을 읽는다. 파일이 없으면 개발 실수이므로 IllegalStateException. */
    public String readJson() {
        try (InputStream in = new ClassPathResource(resourcePath).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("색인 설정 파일을 읽지 못했습니다: " + resourcePath, e);
        }
    }
}
