package com.baeksuescape.notification.config;

import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** FP-301·D-23 알림 저장·전송을 요청 처리와 분리할 실행기와 전용 트랜잭션을 제공한다. */
@Configuration
public class NotificationExecutionConfig {
    // FP-301·D-23 알림 작업은 제한된 큐에 넘기고 포화 시 호출부가 회원 식별값만 기록하도록 거부한다.
    @Bean(name = "notificationExecutor")
    public ThreadPoolTaskExecutor notificationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("notification-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        return executor;
    }

    // FP-301·D-23 알림 저장은 원 업무와 독립된 새 트랜잭션으로 커밋한다.
    @Bean(name = "notificationTransaction")
    public TransactionTemplate notificationTransaction(PlatformTransactionManager transactionManager) {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return transaction;
    }
}