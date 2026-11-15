package com.baeksuescape.global.log;

import java.time.Clock;
import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

// FP-80 N-28-1 시스템 로그 기록 — 인증·정보·경고 이벤트를 SYSTEM_LOG에 남긴다.
// 부르는 쪽 트랜잭션과 따로(REQUIRES_NEW) 저장하고, 저장에 실패해도 예외를 던지지 않는다(본 요청은 성공, 앱 로그에 경고만).
// message에는 이름·연락처·이메일 원문, 비밀번호·코드·토큰을 넣지 않는다. 아이디는 maskLoginId로 가린 값만 쓴다.
// 사용 예: systemLog.record(SystemLogService.Type.AUTH, "auth-service", "로그인 성공 (" + SystemLogService.maskLoginId(loginId) + ")", userId);
@Service
public class SystemLogService {

    // DDL CK_SYL_TYPE: AUTH=인증, INFO=정보, WARN=경고
    public enum Type { AUTH, INFO, WARN }

    private static final Logger log = LoggerFactory.getLogger(SystemLogService.class);
    private static final int SOURCE_MAX = 30;
    private static final int MESSAGE_MAX = 500;

    private final SystemLogMapper mapper;
    private final TransactionOperations requiresNew;
    private final Clock clock;

    @Autowired
    public SystemLogService(SystemLogMapper mapper, PlatformTransactionManager transactionManager, Clock clock) {
        this(mapper, requiresNewTemplate(transactionManager), clock);
    }

    // 테스트에서 트랜잭션 없이 쓸 때.
    public SystemLogService(SystemLogMapper mapper, TransactionOperations requiresNew, Clock clock) {
        this.mapper = mapper;
        this.requiresNew = requiresNew;
        this.clock = clock;
    }

    private static TransactionTemplate requiresNewTemplate(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template;
    }

    // 로그 1건. actorUserId는 관련 계정(시스템 이벤트면 null). 실패하면 앱 로그에 종류·출처만 경고로 남긴다(내용은 남기지 않는다).
    public void record(Type type, String source, String message, Long actorUserId) {
        try {
            requiresNew.executeWithoutResult(status ->
                    mapper.insertLog(type.name(), cut(source, SOURCE_MAX), cut(message, MESSAGE_MAX), actorUserId, LocalDateTime.now(clock)));
        } catch (RuntimeException e) {
            log.warn("시스템 로그를 남기지 못했습니다(type={}, source={}, actor={}): {}", type, source, actorUserId, e.getClass().getSimpleName());
        }
    }

    // 로그용 아이디 — 앞 2자만 남기고 '***'를 붙인다. 예) admin01 → ad***
    public static String maskLoginId(String loginId) {
        if (loginId == null || loginId.isEmpty()) return "***";
        return loginId.substring(0, Math.min(2, loginId.length())) + "***";
    }

    private static String cut(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max);
    }
}
