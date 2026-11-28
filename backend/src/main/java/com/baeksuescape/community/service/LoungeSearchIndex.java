package com.baeksuescape.community.service;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.baeksuescape.global.search.SearchIndexDefinition;

/**
 * FP-305 N-06-1 신용 라운지 글 검색 색인 lounge_posts 등록(2차 FP-304).
 * 설정·매핑(한글 분석기 nori, 필드)은 resources/search/lounge-posts.json에 있고, 서버를 켤 때 없으면 만든다.
 * 글을 색인에 넣고 지우는 일과 검색을 바꾸는 일은 FP-306에서 한다.
 */
@Configuration
public class LoungeSearchIndex {

    public static final String INDEX_NAME = "lounge_posts";
    static final String RESOURCE_PATH = "search/lounge-posts.json";

    @Bean
    SearchIndexDefinition loungePostsIndex() {
        return new SearchIndexDefinition(INDEX_NAME, RESOURCE_PATH);
    }
}
