package com.baeksuescape.user.service.email;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.config.AvenueProperties;

// FP-87 SMTP 모드 — 실제 메일로 인증코드를 보낸다. 메일 서버는 spring.mail.*(환경변수 SPRING_MAIL_HOST 등), 보내는 주소는 avenue.auth.email.from.
// 설정이 없으면 서버가 시작할 때 오류로 멈춘다.
@Component
@ConditionalOnProperty(prefix = "avenue.auth.email", name = "mode", havingValue = "SMTP")
public class SmtpEmailCodeSender implements EmailCodeSender {

    private final JavaMailSender mailSender;
    private final String from;

    public SmtpEmailCodeSender(ObjectProvider<JavaMailSender> mailSenderProvider, AvenueProperties properties) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new IllegalStateException("avenue.auth.email.mode=SMTP에는 spring.mail.host(환경변수 SPRING_MAIL_HOST) 설정이 필요합니다");
        }
        this.from = properties.getAuth().getEmail().getFrom();
        if (from == null || from.isBlank()) {
            throw new IllegalStateException("avenue.auth.email.mode=SMTP에는 avenue.auth.email.from(보내는 주소) 설정이 필요합니다");
        }
    }

    @Override
    public void send(String email, String code, String purpose) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("[Avenue] 이메일 인증코드");
        message.setText("인증코드는 " + code + " 입니다. 5분 안에 입력해 주세요.\n본인이 요청하지 않았다면 이 메일을 무시해 주세요.");
        try {
            mailSender.send(message);
        } catch (MailException e) {
            // 메일 서버 오류 문구에 받는 주소가 섞일 수 있어 원래 예외를 넘기지 않는다.
            throw new IllegalStateException("인증 메일을 보내지 못했습니다");
        }
    }
}
