package com.baeksuescape.help.mapper;

import com.baeksuescape.help.dto.ChatbotPresetRow;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * N-32 용어 도우미(챗봇) 매퍼 (FP-181). 질문 버튼(CHATBOT_PRESET_QUESTION) 조회와 자유 질문 호출 기록(CHATBOT_QUESTION_LOG).
 */
@Mapper
public interface ChatbotMapper {

    /** 질문 버튼 전체. 표시 순서대로 */
    List<ChatbotPresetRow> selectPresets();

    /** N-32-2 since 이후 성공한(SUCCESS_YN = 'Y') 자유 질문 수. 실패한 호출은 세지 않는다 */
    int countSuccessSince(@Param("userId") long userId, @Param("since") LocalDateTime since);

    /** N-32-2 자유 질문 호출 기록 한 줄(시각·성공 여부만, 질문 글은 저장하지 않는다) */
    int insertQuestionLog(@Param("userId") long userId, @Param("askedAt") LocalDateTime askedAt, @Param("successYn") String successYn);
}
