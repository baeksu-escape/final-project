package com.baeksuescape.user.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.user.dto.UserAccount;

// FP-87 APP_USER 조회·저장(인증 필터, N-01~N-05). SQL은 resources/mapper/user/UserAccountMapper.xml에 있다.
@Mapper
public interface UserAccountMapper {

    // 계정 상태(ACTIVE·LOCKED·WITHDRAWN)를 돌려준다. 회원이 없으면 null.
    String selectAccountStatus(@Param("userId") long userId);

    UserAccount selectById(@Param("userId") long userId);

    UserAccount selectByLoginId(@Param("loginId") String loginId);

    // N-03 아이디 찾기 후보 — 휴대폰 HMAC이 같은 일반 회원(탈퇴 제외). 휴대폰은 UNIQUE가 아니라 여러 명일 수 있다.
    List<UserAccount> selectUsersByPhoneHmac(@Param("phoneHmac") String phoneHmac);

    // FP-258 N-03-1 이메일로 아이디 찾기 대상 — 이메일 HMAC이 같은 일반 회원(탈퇴 제외). 없으면 null.
    UserAccount selectUserByEmailHmac(@Param("emailHmac") String emailHmac);

    // N-03 비밀번호 재설정 대상 — 아이디·이메일 HMAC이 모두 맞는 일반 회원(탈퇴 제외). 없으면 null.
    UserAccount selectUserByLoginIdAndEmailHmac(@Param("loginId") String loginId, @Param("emailHmac") String emailHmac);

    int countByLoginId(@Param("loginId") String loginId);

    int countByEmailHmac(@Param("emailHmac") String emailHmac);

    int countByNickname(@Param("nickname") String nickname);

    // N-01-2 점수 있음 여부 — 이 회원의 SCORED 평가 수(ASSESSMENT는 읽기만 한다).
    int countScoredAssessments(@Param("userId") long userId);

    // N-02-4 가입. 저장한 USER_ID를 account.userId에 채운다.
    int insertUser(UserAccount account);

    // 로그인 성공: 실패 횟수 0, 마지막 로그인 시각 기록.
    int updateLoginSuccess(@Param("userId") long userId, @Param("now") LocalDateTime now);

    // 로그인 실패: 실패 횟수 저장. lock이면 LOCKED·LOCKED_AT·LOCK_REASON도 기록한다.
    int updateLoginFailure(@Param("userId") long userId, @Param("failCount") int failCount, @Param("lock") boolean lock,
            @Param("now") LocalDateTime now);

    // N-03-3 비밀번호 재설정: 새 해시, 실패 횟수 0, 잠김이면 ACTIVE로 푼다.
    int updatePasswordAndUnlock(@Param("userId") long userId, @Param("passwordHash") String passwordHash, @Param("now") LocalDateTime now);

    // N-04-3 비밀번호 변경(로그인한 상태).
    int updatePassword(@Param("userId") long userId, @Param("passwordHash") String passwordHash, @Param("now") LocalDateTime now);

    // MEM-08 N-04-3 닉네임 변경(FP-222). 겹침은 서비스가 먼저 확인하고, 동시에 바꾸면 UK_APU_NICKNAME이 막는다.
    int updateNickname(@Param("userId") long userId, @Param("nickname") String nickname, @Param("now") LocalDateTime now);

    // N-04-3 이메일 변경: 암호문과 검색 HMAC을 함께 바꾼다.
    int updateEmail(@Param("userId") long userId, @Param("emailEnc") String emailEnc, @Param("emailHmac") String emailHmac,
            @Param("now") LocalDateTime now);

    // N-05-1 직군 첫 선택 — 직군이 비어 있을 때만 저장한다. 바뀐 행 수(0이면 이미 선택됨).
    int updateWorkerTypeIfEmpty(@Param("userId") long userId, @Param("workerTypeCode") String workerTypeCode, @Param("now") LocalDateTime now);

    // FP-227 N-05-1 저장 전 직군 변경 — 지금 직군이 fromCode일 때만 toCode로 바꾼다. 바뀐 행 수(0이면 그사이 다른 요청이 바꿈).
    int updateWorkerTypeFrom(@Param("userId") long userId, @Param("fromCode") String fromCode, @Param("toCode") String toCode,
            @Param("now") LocalDateTime now);

    // FP-227 직군 변경 잠금 판단 — 점수 산출 결과와 관계없이 이 회원의 평가(ASSESSMENT) 행 수.
    int countAssessments(@Param("userId") long userId);

    // 같은 회원의 쓰기 요청을 한 줄로 세운다 — 트랜잭션 맨 앞에서 회원 행을 잠그고(FOR UPDATE), 커밋·롤백 때 풀린다.
    // 동시에 들어온 동의·불러오기·입력 저장·탈퇴가 서로 끼어들어 행이 중복되는 것을 막는다(PR #52 리뷰 4·5, DB 제약 대신). 회원이 없으면 null.
    Long lockUser(@Param("userId") long userId);

    // N-04-7 회원 탈퇴 — 행은 남기고 상태를 WITHDRAWN으로 바꾸며 개인정보 칸을 CK_APU_PII_BY_STATUS의 표시값으로 덮어쓴다.
    // 바뀐 행 수(0이면 이미 탈퇴했거나 회원이 없음).
    int updateWithdrawn(@Param("userId") long userId, @Param("now") LocalDateTime now);
}
