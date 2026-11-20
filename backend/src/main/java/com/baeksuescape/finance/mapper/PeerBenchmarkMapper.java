package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.peer.PeerIncomeRow;
import com.baeksuescape.finance.dto.peer.PeerMemberRow;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * N-15-2 같은 직군·연령대 회원 평균(DIAG-01)에 쓰는 회원 표 조회.
 * 평균에 넣는 회원: 일반 회원, 탈퇴 아님, 직군·출생연도 있음, 소득 행 1개 이상.
 */
@Mapper
public interface PeerBenchmarkMapper {

    /** 평균에 넣을 회원 목록과 기준월(가장 늦은 소득월)의 총자산·총부채 (회원 번호 순) */
    List<PeerMemberRow> selectPeerMembers();

    /** 위 회원들의 최근 12개월 소득 (회원 번호·기준월 오름차순) */
    List<PeerIncomeRow> selectRecentIncomes();
}
