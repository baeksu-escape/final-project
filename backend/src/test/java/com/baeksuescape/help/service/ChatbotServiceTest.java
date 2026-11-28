package com.baeksuescape.help.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.baeksuescape.admin.service.AppSettingService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.help.client.OpenAiClient;
import com.baeksuescape.help.dto.ChatbotPresetResponse;
import com.baeksuescape.help.dto.ChatbotPresetRow;
import com.baeksuescape.help.dto.ChatbotQuestionResponse;
import com.baeksuescape.help.mapper.ChatbotMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * FP-181 N-32 용어 도우미 서비스 테스트 — 질문 버튼 조회(횟수 차감 없음)와 자유 질문의 하루 횟수·실패 기록·AI에 넘기는 글을 DB 없이 확인한다.
 */
class ChatbotServiceTest {

    // 2026-11-26 15:30 (Asia/Seoul) — 오늘 0시는 2026-11-26T00:00
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-26T06:30:00Z"), ZoneId.of("Asia/Seoul"));
    private static final LocalDateTime TODAY = LocalDateTime.of(2026, 11, 26, 0, 0);
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 26, 15, 30);

    private ChatbotMapper mapper;
    private OpenAiClient openAi;
    private AppSettingService settings;
    private ChatbotService service;

    @BeforeEach
    void setUp() {
        mapper = mock(ChatbotMapper.class);
        openAi = mock(OpenAiClient.class);
        settings = mock(AppSettingService.class);
        when(settings.intValue("CHATBOT_DAILY_LIMIT", 10)).thenReturn(10);
        when(openAi.enabled()).thenReturn(true);
        service = new ChatbotService(mapper, openAi, settings, CLOCK);
    }

    private static ChatbotPresetRow row(long id, String question, String answer, int order) {
        ChatbotPresetRow row = new ChatbotPresetRow();
        row.setPresetId(id);
        row.setQuestionText(question);
        row.setAnswerText(answer);
        row.setDisplayOrder(order);
        return row;
    }

    @Test
    @DisplayName("질문 버튼을 매퍼가 준 순서 그대로 돌려주고, 오늘 남은 자유 질문 횟수를 함께 준다(AI·기록 없음)")
    void findPresets() {
        when(mapper.selectPresets()).thenReturn(List.of(
                row(3L, "대안 신용 점수는 무엇이 다른가요?", "생활 기록을 더해 본 점수입니다.", 1),
                row(1L, "DSR이 높으면 어떤 뜻인가요?", "소득에 비해 빚 갚는 부담이 크다는 뜻입니다.", 2)));
        when(mapper.countSuccessSince(2L, TODAY)).thenReturn(3);

        ChatbotPresetResponse response = service.findPresets(2L);

        assertEquals(2, response.presets().size());
        assertEquals(3L, response.presets().get(0).presetId());
        assertEquals("대안 신용 점수는 무엇이 다른가요?", response.presets().get(0).question());
        assertEquals("생활 기록을 더해 본 점수입니다.", response.presets().get(0).answer());
        assertEquals("DSR이 높으면 어떤 뜻인가요?", response.presets().get(1).question());
        assertEquals(7, response.remainingCount());
        assertEquals(10, response.dailyLimit());
        verifyNoInteractions(openAi);
        verify(mapper, never()).insertQuestionLog(anyLong(), eq(NOW), anyString());
    }

    @Test
    @DisplayName("등록된 질문 버튼이 없으면 오류가 아니라 빈 목록이고, 한도를 넘게 썼어도 남은 횟수는 0 아래로 내려가지 않는다")
    void emptyPresets() {
        when(mapper.selectPresets()).thenReturn(List.of());
        when(mapper.countSuccessSince(2L, TODAY)).thenReturn(12);

        ChatbotPresetResponse response = service.findPresets(2L);

        assertTrue(response.presets().isEmpty());
        assertEquals(0, response.remainingCount());
    }

    @Test
    @DisplayName("자유 질문 성공: 질문 글(앞뒤 공백 뗌)만 AI에 넘기고, 성공(Y)으로 기록하고, 남은 횟수를 하나 줄여 준다")
    void askSuccess() {
        when(mapper.countSuccessSince(2L, TODAY)).thenReturn(4);
        when(openAi.complete(ChatbotService.SYSTEM_PROMPT, "DSR이 뭐예요?", ChatbotService.ANSWER_MAX_TOKENS))
                .thenReturn("DSR은 소득 중 빚 갚는 데 쓰는 비율입니다.");

        ChatbotQuestionResponse response = service.ask(2L, "  DSR이 뭐예요?  ");

        assertEquals("DSR은 소득 중 빚 갚는 데 쓰는 비율입니다.", response.answer());
        assertEquals(5, response.remainingCount());
        assertEquals(10, response.dailyLimit());
        verify(openAi).complete(ChatbotService.SYSTEM_PROMPT, "DSR이 뭐예요?", ChatbotService.ANSWER_MAX_TOKENS);
        verify(mapper).insertQuestionLog(2L, NOW, "Y");
    }

    @Test
    @DisplayName("오늘 성공한 질문이 하루 횟수에 이르면 429 DAILY_LIMIT_EXCEEDED이고 AI를 부르지 않는다")
    void dailyLimit() {
        when(mapper.countSuccessSince(2L, TODAY)).thenReturn(10);

        ApiException error = assertThrows(ApiException.class, () -> service.ask(2L, "DSR이 뭐예요?"));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatus());
        assertEquals("DAILY_LIMIT_EXCEEDED", error.getCode());
        verify(openAi, never()).complete(anyString(), anyString(), anyInt());
        verify(mapper, never()).insertQuestionLog(anyLong(), eq(NOW), anyString());
    }

    @Test
    @DisplayName("AI 호출이 실패하면 실패(N)로 기록하고 502를 그대로 알린다 — 성공만 세므로 횟수는 줄지 않는다")
    void aiFailed() {
        ApiException failed = new ApiException(HttpStatus.BAD_GATEWAY, OpenAiClient.AI_FAILED, "AI 답변을 받지 못했습니다.");
        when(mapper.countSuccessSince(2L, TODAY)).thenReturn(0);
        when(openAi.complete(anyString(), anyString(), anyInt())).thenThrow(failed);

        ApiException error = assertThrows(ApiException.class, () -> service.ask(2L, "DSR이 뭐예요?"));

        assertSame(failed, error);
        verify(mapper).insertQuestionLog(2L, NOW, "N");
        verify(mapper, never()).insertQuestionLog(2L, NOW, "Y");
    }

    @Test
    @DisplayName("같은 사용자가 동시에 50번 보내도 AI는 1번만 부르고 나머지는 409 QUESTION_IN_PROGRESS다(PR #170 리뷰 재현)")
    void concurrentAskIsOneAtATime() throws Exception {
        CountDownLatch aiStarted = new CountDownLatch(1);
        CountDownLatch releaseAi = new CountDownLatch(1);
        AtomicInteger aiCalls = new AtomicInteger();
        when(mapper.countSuccessSince(2L, TODAY)).thenReturn(0);
        when(openAi.complete(anyString(), anyString(), anyInt())).thenAnswer((invocation) -> {
            aiCalls.incrementAndGet();
            aiStarted.countDown();
            releaseAi.await(5, TimeUnit.SECONDS);
            return "답";
        });
        ExecutorService pool = Executors.newFixedThreadPool(50);
        try {
            // 첫 질문이 AI 답을 기다리는 동안 49번을 더 보낸다
            Future<ChatbotQuestionResponse> first = pool.submit(() -> service.ask(2L, "첫 질문"));
            assertTrue(aiStarted.await(5, TimeUnit.SECONDS));
            List<Future<String>> others = new ArrayList<>();
            for (int i = 0; i < 49; i++) {
                others.add(pool.submit(() -> {
                    try {
                        service.ask(2L, "같은 사람의 다른 질문");
                        return "OK";
                    } catch (ApiException e) {
                        return e.getStatus().value() + " " + e.getCode();
                    }
                }));
            }
            for (Future<String> other : others) {
                assertEquals("409 " + ChatbotService.QUESTION_IN_PROGRESS, other.get(5, TimeUnit.SECONDS));
            }
            releaseAi.countDown();
            assertEquals("답", first.get(5, TimeUnit.SECONDS).answer());
        } finally {
            releaseAi.countDown();
            pool.shutdownNow();
        }
        assertEquals(1, aiCalls.get());
        verify(mapper).insertQuestionLog(2L, NOW, "Y");
    }

    @Test
    @DisplayName("경계: 오늘 9회 쓴 회원이 거의 동시에 2번 보내면 1번만 성공(10회째)하고 나머지는 409라 11회가 되지 않는다(PR #170 검수)")
    void ninthUsedTwoConcurrent() throws Exception {
        AtomicInteger used = new AtomicInteger(9);
        CountDownLatch aiStarted = new CountDownLatch(1);
        CountDownLatch releaseAi = new CountDownLatch(1);
        // 기록이 들어가면 센 값도 늘어나게 해서 실제 DB처럼 동작시킨다
        when(mapper.countSuccessSince(2L, TODAY)).thenAnswer((invocation) -> used.get());
        when(mapper.insertQuestionLog(2L, NOW, "Y")).thenAnswer((invocation) -> used.incrementAndGet());
        when(openAi.complete(anyString(), anyString(), anyInt())).thenAnswer((invocation) -> {
            aiStarted.countDown();
            releaseAi.await(5, TimeUnit.SECONDS);
            return "답";
        });
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<ChatbotQuestionResponse> first = pool.submit(() -> service.ask(2L, "첫 번째"));
            assertTrue(aiStarted.await(5, TimeUnit.SECONDS));
            Future<String> second = pool.submit(() -> {
                try {
                    service.ask(2L, "두 번째");
                    return "OK";
                } catch (ApiException e) {
                    return e.getStatus().value() + " " + e.getCode();
                }
            });
            assertEquals("409 " + ChatbotService.QUESTION_IN_PROGRESS, second.get(5, TimeUnit.SECONDS));
            releaseAi.countDown();
            assertEquals(0, first.get(5, TimeUnit.SECONDS).remainingCount());
        } finally {
            releaseAi.countDown();
            pool.shutdownNow();
        }
        assertEquals(10, used.get(), "성공 기록은 10회에서 멈춘다");
        // 처리가 끝난 뒤 다시 보내면 이제 하루 횟수 초과다
        ApiException limit = assertThrows(ApiException.class, () -> service.ask(2L, "세 번째"));
        assertEquals("DAILY_LIMIT_EXCEEDED", limit.getCode());
        verify(openAi, times(1)).complete(anyString(), anyString(), anyInt());
    }

    @Test
    @DisplayName("앞 질문이 끝나면(성공·실패 모두) 같은 사용자가 다시 물을 수 있고, 다른 사용자는 처리 중 잠금과 상관없다")
    void inFlightIsReleased() {
        when(mapper.countSuccessSince(anyLong(), eq(TODAY))).thenReturn(0);
        when(openAi.complete(anyString(), anyString(), anyInt()))
                .thenThrow(new ApiException(HttpStatus.BAD_GATEWAY, OpenAiClient.AI_FAILED, "실패"))
                .thenReturn("두 번째 답", "다른 사람 답");

        assertThrows(ApiException.class, () -> service.ask(2L, "첫 질문"));
        assertEquals("두 번째 답", service.ask(2L, "다시 질문").answer());
        assertEquals("다른 사람 답", service.ask(3L, "다른 사람 질문").answer());
    }

    @Test
    @DisplayName("키가 없으면 503 AI_UNAVAILABLE이고 횟수를 세지도, 기록하지도 않는다")
    void aiUnavailable() {
        when(openAi.enabled()).thenReturn(false);

        ApiException error = assertThrows(ApiException.class, () -> service.ask(2L, "DSR이 뭐예요?"));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatus());
        assertEquals(OpenAiClient.AI_UNAVAILABLE, error.getCode());
        verifyNoInteractions(mapper);
    }
}
