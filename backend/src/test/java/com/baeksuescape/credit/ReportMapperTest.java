package com.baeksuescape.credit;

import java.io.InputStream;
import java.lang.reflect.Method;
import java.sql.PreparedStatement;
import java.util.List;
import java.util.Map;
import com.baeksuescape.credit.mapper.ReportMapper;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.scripting.defaults.DefaultParameterHandler;
import org.apache.ibatis.reflection.ParamNameResolver;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.mapping.BoundSql;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

// N-12-1·N-14-1 실제 MyBatis XML 파싱과 바인딩을 검사한다. Oracle 실행 검사는 별도다.
class ReportMapperTest {
    private Configuration config;

    // N-12-1 실제 리소스 XML을 MyBatis로 파싱하되 데이터소스와 Oracle 연결은 만들지 않는다.
    @BeforeEach
    void parseMapper() throws Exception {
        config = new Configuration();
        String resource = "mapper/credit/ReportMapper.xml";
        try (InputStream stream = getClass().getClassLoader().getResourceAsStream(resource)) {
            assertNotNull(stream);
            new XMLMapperBuilder(stream, config, resource, config.getSqlFragments()).parse();
        }
    }

    // N-12-1·N-14-1 모든 조회가 소유 회원·서비스 집단으로 제한되고 버전별 조인이 유지되어야 한다.
    @Test
    void parsesMapperAndBindsOwnerAcrossAllQueries() {
        Map<String, Object> params = Map.of("userId", 102L, "assessmentId", 9L,
                "requestId", "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c");
        for (String name : new String[]{"findLatest", "findByRequestId", "findGradeBands", "findFactors"}) {
            var bound = config.getMappedStatement("com.baeksuescape.credit.mapper.ReportMapper." + name).getBoundSql(params);
            String sql = bound.getSql().replaceAll("\\s+", " ");
            assertTrue(sql.contains("a.USER_ID = ?"), name);
            assertTrue(sql.contains("a.DATASET_CODE = 'SERVICE'"), name);
            assertEquals("userId", bound.getParameterMappings().get(0).getProperty());
            if (name.equals("findLatest")) {
                assertTrue(sql.contains("a.ASSESSED_AT DESC, a.ASSESSMENT_ID DESC"));
                assertTrue(sql.contains("FETCH FIRST 1 ROW ONLY"));
            }
            if (name.equals("findGradeBands")) {
                assertTrue(sql.contains("b.CUTOFF_VERSION = a.CUTOFF_VERSION"));
            }
            if (name.equals("findFactors")) {
                assertTrue(sql.contains("f.ASSESSMENT_ID = a.ASSESSMENT_ID"));
                assertTrue(sql.contains("f.FEATURE_SET_VERSION = a.FEATURE_SET_VERSION"));
                assertTrue(sql.contains("d.FEATURE_SET_VERSION = f.FEATURE_SET_VERSION"));
                assertTrue(sql.contains("d.FEATURE_CODE = f.FEATURE_CODE"));
                assertTrue(sql.contains("ORDER BY f.FEATURE_RANK ASC"));
                assertFalse(sql.matches("(?is).*(FETCH|ROWNUM|LIMIT|FEATURE_RANK\\s*[<>=]).*"));
            }
            if (!name.equals("findLatest")) {
                String property = name.equals("findByRequestId") ? "requestId" : "assessmentId";
                assertEquals(List.of("userId", property), bound.getParameterMappings().stream().map(p -> p.getProperty()).toList());
                assertTrue(sql.contains(name.equals("findByRequestId") ? "a.REQUEST_ID = ?" : "a.ASSESSMENT_ID = ?"));
            }
        }
    }

    // N-12-1 매퍼 인터페이스의 실제 @Param 이름을 해석해 회원·요청 번호가 JDBC에 함께 바인딩되는지 확인한다.
    @Test
    void bindsInterfaceOwnerAndRequestIdAsPreparedStatementParameters() throws Exception {
        String requestId = "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c";
        Method method = ReportMapper.class.getMethod("findByRequestId", Long.class, String.class);
        Object params = new ParamNameResolver(config, method).getNamedParams(new Object[]{102L, requestId});
        PreparedStatement statement = bind("findByRequestId", params);
        verify(statement).setLong(1, 102L);
        verify(statement).setString(2, requestId);
        verifyNoMoreInteractions(statement);
    }

    // N-12-1·N-14-1 최신 조회와 두 하위 조회도 실제 인터페이스에서 회원과 평가 번호를 바인딩한다.
    @Test
    void bindsLatestAndChildQueriesFromActualMapperMethods() throws Exception {
        Method latest = ReportMapper.class.getMethod("findLatest", Long.class);
        PreparedStatement statement = bind("findLatest", new ParamNameResolver(config, latest).getNamedParams(new Object[]{203L}));
        verify(statement).setLong(1, 203L);
        verifyNoMoreInteractions(statement);
        for (String name : List.of("findGradeBands", "findFactors")) {
            Method method = ReportMapper.class.getMethod(name, Long.class, Long.class);
            statement = bind(name, new ParamNameResolver(config, method).getNamedParams(new Object[]{203L, 19L}));
            verify(statement).setLong(1, 203L);
            verify(statement).setLong(2, 19L);
            verifyNoMoreInteractions(statement);
        }
    }

    // N-12-6 조회 SQL은 저장된 NULL·음수를 그대로 선택하고 고정값으로 대체하거나 미산출 행을 제외하지 않는다.
    @Test
    void selectsStoredScoresAndStatusWithoutDefaultingOrFiltering() {
        for (String name : List.of("findLatest", "findByRequestId")) {
            String sql = config.getMappedStatement("com.baeksuescape.credit.mapper.ReportMapper." + name)
                    .getBoundSql(Map.of("userId", 102L, "requestId", "synthetic-request")).getSql().replaceAll("\\s+", " ");
            assertTrue(sql.contains("a.TRAD_SCORE AS tradScore"));
            assertTrue(sql.contains("a.ALT_SCORE AS altScore"));
            assertTrue(sql.contains("a.NOT_SCORABLE_REASON_CODE AS notScorableReasonCode"));
            assertTrue(sql.contains("a.SHAP_BASE_SCORE AS shapBaseScore"));
            assertFalse(sql.matches("(?is).*(NVL\\s*\\(|COALESCE\\s*\\(|GREATEST\\s*\\().*"));
            String where = sql.substring(sql.indexOf("WHERE"));
            assertFalse(where.matches("(?is).*(TRAD_SCORE|ALT_SCORE|SCORABLE_YN|GRADE_STATUS_CODE).*"));
        }
    }

    // N-12-1 MyBatis 기본 파라미터 처리기로 JDBC 바인딩만 수행하며 SQL은 실행하지 않는다.
    private PreparedStatement bind(String name, Object params) throws Exception {
        var mapped = config.getMappedStatement("com.baeksuescape.credit.mapper.ReportMapper." + name);
        BoundSql bound = mapped.getBoundSql(params);
        PreparedStatement statement = mock(PreparedStatement.class);
        new DefaultParameterHandler(mapped, params, bound).setParameters(statement);
        return statement;
    }
}
