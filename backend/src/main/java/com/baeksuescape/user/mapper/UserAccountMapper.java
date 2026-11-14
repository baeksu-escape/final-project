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

    // N-04-3 이메일 변경: 암호문과 검색 HMAC을 함께 바꾼다.
    int updateEmail(@Param("userId") long userId, @Param("emailEnc") String emailEnc, @Param("emailHmac") String emailHmac,
            @Param("now") LocalDateTime now);

    // N-05-1 직군 첫 선택 — 직군이 비어 있을 때만 저장한다. 바뀐 행 수(0이면 이미 선택됨).
    int updateWorkerTypeIfEmpty(@Param("userId") long userId, @Param("workerTypeCode") String workerTypeCode, @Param("now") LocalDateTime now);
}
