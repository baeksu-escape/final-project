// N-24-3, N-10-2 시계열 추이 선 그래프 컴포넌트
// 최근 분기별 또는 월별 수치 변화 추이와 기준선을 SVG로 부드럽게 렌더링합니다.
// props
//   data : 시간 순서대로 그릴 점 목록
//     [{ label: 'X축에 표시할 이름 (예: 1분기)', value: 수치 }, ...]
//     숫자 배열 [100, 120, ...]도 받는다(라벨은 1, 2, 3…)
//   width, height : 차트 가로·세로 크기(px). 화면이 좁으면 가로는 줄어든다
//   strokeColor   : 선·점·면적 색 (기본 민트)
//   areaOpacity   : 선 아래 면적 투명도 0~1 (0이면 면적 없음)
//   baseline      : 가로 점선으로 그릴 기준값 (예: 평균). 없으면 그리지 않는다
//   baselineLabel : 기준선 오른쪽 위 글자 (예: '서울 평균')
//   baselineColor : 기준선 색
//   unit          : 숫자 뒤 단위 (예: '%')
//   minY, maxY    : Y축 범위를 직접 정할 때. 없으면 data·baseline으로 자동
//   ariaLabel     : 화면 낭독기용 설명
// 마지막 점에만 값을 표시한다.
// 사용 예: <TrendLineChart data={[{ label: '1분기', value: 3.1 }, { label: '2분기', value: 3.4 }]} baseline={3.0} baselineLabel="서울 평균" unit="%" />
import React from 'react';

export default function TrendLineChart({
  data = [],
  width = 460,
  height = 160,
  strokeColor = 'var(--mint, #00e6a5)',
  areaOpacity = 0.14,
  baseline,
  baselineLabel,
  baselineColor = 'var(--line2, #2d3e5c)',
  unit = '',
  minY,
  maxY,
  ariaLabel = '추이 선 그래프',
}) {
  // data 형식을 표준화: [{ label: '1분기', value: 100 }, ...]
  const items = React.useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map((d, i) => {
      if (typeof d === 'object' && d !== null && 'value' in d) {
        return { label: d.label ?? `${i + 1}`, value: Number(d.value) || 0 };
      }
      return { label: `${i + 1}`, value: Number(d) || 0 };
    });
  }, [data]);

  if (items.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--mut2, #8a9bb4)', fontSize: '13px' }}>
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const values = items.map((d) => d.value);
  const minVal = minY !== undefined ? minY : Math.min(...values, baseline !== undefined ? baseline : Infinity);
  const maxVal = maxY !== undefined ? maxY : Math.max(...values, baseline !== undefined ? baseline : -Infinity);
  const valRange = maxVal === minVal ? 1 : maxVal - minVal;

  const padLeft = 44;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 28;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getX = (i) => {
    if (items.length === 1) return padLeft + chartW / 2;
    return padLeft + (i * chartW) / (items.length - 1);
  };

  const getY = (val) => {
    return padTop + chartH - ((val - minVal) / valRange) * chartH;
  };

  const pointsStr = items.map((d, i) => `${getX(i).toFixed(1)},${getY(d.value).toFixed(1)}`).join(' ');
  const areaPolygon = `${getX(0).toFixed(1)},${padTop + chartH} ${pointsStr} ${getX(items.length - 1).toFixed(1)},${padTop + chartH}`;

  const lastIndex = items.length - 1;
  const lastX = getX(lastIndex);
  const lastY = getY(items[lastIndex].value);

  // Y축 3단계 눈금 (최소, 중간, 최대)
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal];

  return (
    <div style={{ width: '100%', maxWidth: `${width}px`, margin: '0 auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Y축 그리드선 및 눈금 텍스트 */}
        {yTicks.map((tickVal, idx) => {
          const yPos = getY(tickVal);
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                x2={padLeft + chartW}
                y1={yPos}
                y2={yPos}
                stroke="var(--line, #22314b)"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={yPos + 4}
                fontSize="10.5"
                fill="var(--mut2, #8a9bb4)"
                textAnchor="end"
                className="num"
              >
                {Math.round(tickVal)}{unit}
              </text>
            </g>
          );
        })}

        {/* 기준선(Baseline) */}
        {baseline !== undefined && (
          <g>
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={getY(baseline)}
              y2={getY(baseline)}
              stroke={baselineColor}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {baselineLabel && (
              <text
                x={padLeft + chartW}
                y={getY(baseline) - 6}
                fontSize="10"
                fill="var(--mut2, #8a9bb4)"
                textAnchor="end"
              >
                {baselineLabel}
              </text>
            )}
          </g>
        )}

        {/* 면적 채우기 (Gradient 또는 투명색) */}
        {areaOpacity > 0 && (
          <polygon
            points={areaPolygon}
            fill={strokeColor}
            fillOpacity={areaOpacity}
          />
        )}

        {/* 추이선 (Polyline) */}
        <polyline
          points={pointsStr}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 각 데이터 지점 원형 마커 */}
        {items.map((d, i) => (
          <circle
            key={i}
            cx={getX(i)}
            cy={getY(d.value)}
            r={i === lastIndex ? 4.5 : 3}
            fill={i === lastIndex ? strokeColor : 'var(--panel, #131f37)'}
            stroke={strokeColor}
            strokeWidth="2"
          />
        ))}

        {/* 마지막 지점 값 텍스트 */}
        <text
          x={lastX}
          y={lastY - 9}
          fontSize="11.5"
          fontWeight="700"
          fill={strokeColor}
          textAnchor="middle"
          className="num"
        >
          {items[lastIndex].value}{unit}
        </text>

        {/* X축 라벨 */}
        {items.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={height - 6}
            fontSize="10.5"
            fill="var(--mut2, #8a9bb4)"
            textAnchor="middle"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

