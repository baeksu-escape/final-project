# 공통 차트 컴포넌트 개발 (FP-156)

- **날짜:** 2026-11-09
- **작성자:** 동주 / Antigravity
- **브랜치:** `feature-C/FP-156-commonChart`
- **관련 N-ID:** N-10(홍보 추이), N-12(SHAP 요약), N-15(동년배 비교), N-24(상권 분석), N-25(모형 성능), N-26(비교 분석/통계)
- **관련 결정:** D-15 (차트 라이브러리: 무거운 외부 라이브러리 대신 경량 SVG 기반 반응형 컴포넌트 채택)

## 무엇을, 왜 바꿨나
- A조(리포트/추이), B조(모형 성능/통계), C조(상권/동년배)에서 공용으로 쓸 수 있는 차트 공통 부품 4종을 `frontend/src/common/components/charts/`에 개발했다.
- 별도의 외부 차트 라이브러리 의존 없이 순수 React 19 + SVG로 구현하여 가볍고 의존성 충돌이 없으며, 프로젝트의 테마 변수(`var(--mint)`, `var(--vio)`, `var(--bad)` 등)와 호환된다.
- `common/components/index.js`에서 한 번에 export하여 다른 팀원이 쉽게 import할 수 있도록 구성했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|---|---|
| `frontend/src/common/components/CompareBar.jsx` | 내 수치 vs 동년배/직군 평균 수평 비교 막대 컴포넌트 신규 생성 (FP-157, N-15-3) |
| `frontend/src/common/components/TrendLineChart.jsx` | 시계열 추이 선 및 기준선/면적 SVG 그래프 컴포넌트 신규 생성 (FP-157, N-24-3, N-10-2) |
| `frontend/src/common/components/BarChart.jsx` | 지표 비교 및 0 기준 증감(±) 막대 그래프 컴포넌트 신규 생성 (FP-157, N-24-3, N-12-8) |
| `frontend/src/common/components/HeatmapGrid.jsx` | 직군 × 연령 매트릭스 2차원 격자형 히트맵 컴포넌트 신규 생성 (FP-158, N-26-3, N-26-6) |
| `frontend/src/common/components/index.js` | 공통 컴포넌트 진입점에 차트 컴포넌트 4종 export 5줄 추가 |

## DB·API 변경
- DB: 없음
- API: 없음
- 영향을 받는 기능·팀원: 전 팀 공용 (A조 N-10/N-12, B조 N-25, C조 동주 N-15/N-24, 광희 N-25/N-26)

## 확인
- 확인함: `cd frontend; npm run lint` 실행 결과 에러 및 경고 0건으로 정적 검사 통과
- 확인 못 함: 화면 렌더링은 각 기능 화면(N-15, N-24 등)에 연결한 뒤 `npm run dev`로 육안 확인 필요

## 다음 사람이 알아야 할 것
- `import { CompareBar, TrendLineChart, BarChart, HeatmapGrid } from '../../common/components/index.js'`로 즉시 불러와 사용할 수 있습니다.
- 모든 컴포넌트는 반응형이며 CSS 변수(`var(--mint)`, `var(--vio)` 등)를 기본 색상으로 사용하므로 테마 전환에도 자연스럽게 어울립니다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|---|---|---|---|
| | | | |

