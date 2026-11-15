package com.baeksuescape.admin.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.dto.AdminRows;
import com.baeksuescape.admin.mapper.AdminAuditMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.service.AccountRules;

// FP-80 N-28-2 로그 조회 — ADM-09 열람 감사 로그, ADM-10 시스템 로그. 둘 다 최신순·읽기 전용(수정·삭제 API는 없다, DDL W6).
@Service
public class AdminLogQueryService {

    static final int DEFAULT_SIZE = 50;
    static final int MAX_SIZE = 100;
    static final Set<String> LOG_TYPES = Set.of("AUTH", "INFO", "WARN");

    private final AdminAuditMapper auditMapper;
    private final AdminPii pii;
    private final Clock clock;

    public AdminLogQueryService(AdminAuditMapper auditMapper, AdminPii pii, Clock clock) {
        this.auditMapper = auditMapper;
        this.pii = pii;
        this.clock = clock;
    }

    // ADM-09 열람 감사 로그. 대상은 '가린 이름 (가린 아이디)'로 보여 준다.
    public AdminDtos.PageResponse<AdminDtos.AccessLogRow> accessLogs(Integer page, Integer size) {
        int pageNo = pageOf(page);
        int pageSize = sizeOf(size);
        List<AdminDtos.AccessLogRow> items = auditMapper.selectAccessLogs(pageNo * pageSize, pageSize).stream().map(this::toAccessRow).toList();
        return new AdminDtos.PageResponse<>(items, pageNo, pageSize, auditMapper.countAccessLogs());
    }

    // ADM-10 시스템 로그. type(AUTH|INFO|WARN)을 주면 그 종류만.
    public AdminDtos.PageResponse<AdminDtos.SystemLogRow> systemLogs(String type, Integer page, Integer size) {
        String typeFilter = type == null || type.isBlank() ? null : type;
        if (typeFilter != null && !LOG_TYPES.contains(typeFilter)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "로그 종류를 확인해 주세요.",
                    List.of(new FieldErrorItem("type", "로그 종류를 확인해 주세요.")));
        }
        int pageNo = pageOf(page);
        int pageSize = sizeOf(size);
        List<AdminDtos.SystemLogRow> items = auditMapper.selectSystemLogs(typeFilter, pageNo * pageSize, pageSize).stream()
                .map(row -> new AdminDtos.SystemLogRow(offset(row.getCreatedAt()), row.getLogTypeCode(), row.getLogSource(), row.getMessage()))
                .toList();
        return new AdminDtos.PageResponse<>(items, pageNo, pageSize, auditMapper.countSystemLogs(typeFilter));
    }

    private AdminDtos.AccessLogRow toAccessRow(AdminRows.AccessLogData row) {
        String maskedId = row.getTargetLoginId() == null ? "-" : AccountRules.maskLoginId(row.getTargetLoginId());
        String maskedName = row.getTargetNameEnc() == null ? "-" : pii.maskedName(row.getTargetUserId(), row.getTargetNameEnc());
        return new AdminDtos.AccessLogRow(offset(row.getAccessedAt()), row.getViewerLoginId(), maskedName + " (" + maskedId + ")", row.getReason(),
                row.getAccessedResource());
    }

    private static int pageOf(Integer page) {
        return page == null || page < 0 ? 0 : page;
    }

    private static int sizeOf(Integer size) {
        return size == null || size < 1 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    }

    private OffsetDateTime offset(LocalDateTime time) {
        return time == null ? null : time.atZone(clock.getZone()).toOffsetDateTime();
    }
}
