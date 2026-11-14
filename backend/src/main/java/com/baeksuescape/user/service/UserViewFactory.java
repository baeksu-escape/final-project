package com.baeksuescape.user.service;

import org.springframework.stereotype.Component;

import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiMasking;
import com.baeksuescape.user.dto.AuthResponses.UserView;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-87 N-01-2 화면용 사용자 정보 { userId, name, role, jobType, hasScore }를 만든다. 로그인·내 정보·간편 로그인·직군 저장이 함께 쓴다.
// name은 원문 대신 가린 값이다(응답에 개인정보 원문을 넣지 않는다). hasScore는 일반 사용자만 넣는다(관리자는 mock처럼 없음).
@Component
public class UserViewFactory {

    private final UserAccountMapper userMapper;
    private final PiiCrypto crypto;

    public UserViewFactory(UserAccountMapper userMapper, PiiCrypto crypto) {
        this.userMapper = userMapper;
        this.crypto = crypto;
    }

    public UserView of(UserAccount account) {
        Boolean hasScore = account.isAdmin() ? null : userMapper.countScoredAssessments(account.getUserId()) > 0;
        return new UserView(account.getUserId(), PiiMasking.name(crypto.decrypt(account.getNameEnc())), account.getRoleCode(),
                account.getWorkerTypeCode(), hasScore);
    }
}
