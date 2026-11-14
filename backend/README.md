# Avenue 백엔드 (Spring Boot)

## 실행 준비

1. `src/main/resources/application.properties.example`를 같은 폴더에 `application.properties`로 복사하고 DB 접속 정보를 채운다. `application.properties`는 커밋하지 않는다.
2. 비밀값은 환경변수로 넣는다. 값은 디스코드 비공개 채널의 팀 개발 env 파일에 있다. 더미 시드와 같은 키여야 암호문 복호화와 HMAC 검색이 맞는다.

| 환경변수 | 설정 이름 | 형식 |
|---|---|---|
| `AVENUE_JWT_SECRET` | `avenue.auth.jwt.secret` | Base64, 32바이트 이상 |
| `AVENUE_DEV_AES_KEY` | `avenue.pii.aes-key` | Base64, 정확히 32바이트 (AES-256-GCM) |
| `AVENUE_DEV_HMAC_KEY` | `avenue.pii.hmac-key` | Base64, 32바이트 이상. AES 키와 달라야 한다 |

키가 없거나 형식이 틀리면 서버가 시작할 때 설정 이름을 알려 주는 오류로 멈춘다. 오류에 키 값은 나오지 않는다.

3. 테스트: `./mvnw test`. test 프로필(`src/test/resources/application-test.properties`)이 메모리 DB(H2)와 **공개 테스트 키**를 쓰므로 실제 DB·키 없이 돈다.

## 인증 사용법 (FP-87)

### 현재 사용자 받기
URL에 회원 번호를 넣지 않는다. 로그인한 사용자는 토큰에서 꺼낸 `AuthUser`로 받는다.

```java
@GetMapping("/api/members/me/profile")
public ProfileResponse profile(@AuthenticationPrincipal AuthUser user) {
    long userId = user.userId();   // APP_USER.USER_ID
    String role = user.role();     // ROLE_USER 또는 ROLE_ADMIN
    ...
}
```

### 권한 규칙 (`global/security/SecurityConfig`)
| 경로 | 권한 |
|---|---|
| `POST /api/auth/login`, `signup`, `email/**`, `find-id`, `password/reset`, `social/**`, `admin/verify-code` | 인증 없음 |
| `avenue.auth.temporary-open-paths`에 있는 경로 | 인증 없음 (임시) |
| `/api/admin/**` | `ROLE_ADMIN` |
| `/api/members/me/**`, `/api/report/**` | `ROLE_USER` |
| 그 밖의 `/api/**` | 로그인 필요 |

- 요청 헤더는 `Authorization: Bearer {JWT}`다.
- 탈퇴(`WITHDRAWN`)한 계정은 토큰이 있어도 401이다. 필터가 요청마다 `APP_USER.ACCOUNT_STATUS_CODE`를 확인한다.
- 잠긴(`LOCKED`) 계정은 로그인만 막는다.
- 실패 응답: 401 `{ "code": "UNAUTHORIZED", ... }`, 403 `{ "code": "FORBIDDEN", ... }`.
- 비밀번호 해시는 `PasswordEncoder` 빈(BCrypt)을 주입받아 쓴다.

### 오류 던지기 (`global/exception`)
모든 오류 응답은 `{ "code", "message", "fieldErrors": [{ "field", "message" }] }`이다. 프론트 `serverErrors.js`가 이 모양을 읽는다.

```java
throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_NICKNAME", "이미 사용 중인 닉네임입니다.");
throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.",
        List.of(new ErrorResponse.FieldErrorItem("nickname", "닉네임은 2~12자로 넣어 주세요.")));
```

- `@Valid` 실패는 자동으로 400 `INVALID_INPUT`이 된다. `fieldErrors`의 `field`는 Spring 경로 그대로다(예: `loans.items[0].balanceAmount`).
- 예상 못 한 오류는 500 `INTERNAL_ERROR`와 고정 문구만 보낸다. 로그에도 예외 종류만 남긴다.

### 개인정보 (`global/util`)
- `PiiCrypto.encrypt/decrypt`: 이름·휴대폰·이메일을 AES-256-GCM으로 암호화·복호화한다. 저장값은 `v1:`로 시작한다.
- `PiiHmac.email/phone`: 검색용 HMAC을 만든다(`EMAIL_HMAC`·`PHONE_HMAC`).
- `PiiMasking.name/phone/email`: 화면·로그에 보낼 가린 값을 만든다. 값이 없으면 null이다.
- 원문은 로그에 남기지 않는다.

### 다른 팀 경로 임시 개방
지금 기본값은 `/api/finance/**`(C팀 FP-152), `/api/diagnosis/**`(C팀 FP-183), `/api/simulation/**`(C팀 프론트 FP-176)이다. 이 경로들은 로그인 없이 열려 있다.

**빼는 방법:**
1. 자기 기능에 로그인을 붙일 준비가 되면 인증 담당(A팀 우찬)에게 말한다.
2. 인증 담당이 `AvenueProperties`의 기본값과 `application.properties.example`에서 그 경로를 뺀다.
3. 빠진 경로는 "그 밖의 `/api/**`" 규칙(로그인 필요)을 따른다. 컨트롤러에서는 `@AuthenticationPrincipal AuthUser`로 사용자를 받는다.
