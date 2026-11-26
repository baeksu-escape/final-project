package com.baeksuescape.help.mapper;

import com.baeksuescape.help.dto.ChatbotPresetRow;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;

/**
 * N-32 용어 도우미(챗봇) 매퍼 (FP-181). 지금은 질문 버튼(CHATBOT_PRESET_QUESTION) 조회만 있다.
 */
@Mapper
public interface ChatbotMapper {

    /** 질문 버튼 전체. 표시 순서대로 */
    List<ChatbotPresetRow> selectPresets();
}
