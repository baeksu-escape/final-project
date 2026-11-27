package com.baeksuescape.user.service;

import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

// FP-258 N-02-3 인증코드 발송 잠금 — 같은 대상(채널 + 이메일·휴대폰 HMAC)의 발송을 한 번에 하나씩 하게 해, 동시 요청이 하루 상한(10회)을 넘지 못하게 한다.
// 잠금은 트랜잭션 바깥에서 잡고 커밋이 끝난 뒤 푼다(커밋 전에 풀면 다음 요청이 옛 수를 읽는다). 서버 메모리의 줄무늬 잠금이라 서버가 여러 대면 대마다 따로 센다.
@Component
public class CodeSendGuard {

    // 줄무늬 잠금 개수. 다른 대상이 같은 잠금에 걸리면 잠깐 기다릴 뿐 결과는 같다.
    static final int STRIPES = 64;

    private final ReentrantLock[] locks = new ReentrantLock[STRIPES];
    private final TransactionOperations transaction;

    @Autowired
    public CodeSendGuard(PlatformTransactionManager transactionManager) {
        this(new TransactionTemplate(transactionManager));
    }

    // 테스트에서 트랜잭션 없이 쓸 때(TransactionOperations.withoutTransaction()).
    public CodeSendGuard(TransactionOperations transaction) {
        this.transaction = transaction;
        for (int i = 0; i < STRIPES; i++) locks[i] = new ReentrantLock();
    }

    // 대상 잠금을 쥔 채 work를 한 트랜잭션으로 실행한다. work가 예외를 던지면 트랜잭션은 되돌아가고 예외는 그대로 나간다(예전 @Transactional과 같음).
    public <T> T run(String channel, String targetHmac, Supplier<T> work) {
        ReentrantLock lock = locks[Math.floorMod((channel + "|" + targetHmac).hashCode(), STRIPES)];
        lock.lock();
        try {
            return transaction.execute(status -> work.get());
        } finally {
            lock.unlock();
        }
    }
}
