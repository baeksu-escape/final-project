// N-24-3, N-12-8 막대 그래프 및 증감(±) 막대 컴포넌트
// 지표별 수치 비교 및 0 기준선 상하 증감 막대를 SVG로 렌더링합니다.
import React from 'react';

export default function BarChart({
  data = [],
  width = 380,
  height = 240,
  positiveColor = 'var(--c-pos, #00e6a5)',
  negativeColor = 'var(--c-neg, #ff8d7d)',
  defaultColor = 'var(--mint, #00e6a5)',
  unit = '',
  ariaLabel = '막대 그래프',
  showValues = true,
}) {
  const items = React.useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map((d, i) => {
      const val = typeof d === 'object' && d !== null ? Number(d.value) || 0 : Number(d) || 0;
      const label = typeof d === 'object' && d !== null ? d.label ?? `${i + 1}` : `${i + 1}`;
      const color = typeof d === 'object' && d !== null && d.color ? d.color : null;
      const tag = typeof d === 'object' && d !== null ? d.tag : null;
      return { label, value: val, color, tag };
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
  const hasNegative = values.some((v) => v < 0);
  const maxVal = Math.max(0, ...values);
  const minVal = Math.min(0, ...values);

  const padTop = 24;
  const padBottom = 48;
  const padLeft = 16;
  const padRight = 16;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const colWidth = chartW / items.length;
  const barWidth = Math.min(36, colWidth * 0.58);

  // 0 기준선 Y좌표 계산
  const totalSpan = maxVal - minVal || 1;
  const zeroY = hasNegative ? padTop + (maxVal / totalSpan) * chartH : padTop + chartH;

  return (
    <div style={{ width: '100%', maxWidth: `${width}px`, margin: '0 auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* 기준선(0 Y축) */}
        <line
          x1={padLeft}
          x2={padLeft + chartW}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--line2, #2d3e5c)"
          strokeWidth="1.5"
        />

        {/* 막대 및 수치 */}
        {items.map((item, i) => {
          const x = padLeft + i * colWidth + (colWidth - barWidth) / 2;
          const isPos = item.value >= 0;
          const barH = totalSpan === 0 ? 0 : (Math.abs(item.value) / totalSpan) * chartH;
          const y = isPos ? zeroY - barH : zeroY;

          const barColor = item.color || (hasNegative ? (isPos ? positiveColor : negativeColor) : defaultColor);

          return (
            <g key={i}>
              {/* 막대 Rect */}
              <rect
                x={x.toFixed(1)}
                y={y.toFixed(1)}
                width={barWidth.toFixed(1)}
                height={Math.max(2, barH).toFixed(1)}
                rx="3"
                fill={barColor}
                style={{ transition: 'all 0.3s ease' }}
              />

              {/* 값 텍스트 */}
              {showValues && (
                <text
                  x={(x + barWidth / 2).toFixed(1)}
                  y={(isPos ? y - 6 : y + barH + 14).toFixed(1)}
                  fontSize="11.5"
                  fontWeight="700"
                  textAnchor="middle"
                  fill={barColor}
                  className="num"
                >
                  {isPos && hasNegative ? `+${item.value}` : item.value}{unit}
                </text>
              )}

              {/* X축 카테고리 라벨 */}
              <text
                x={(padLeft + i * colWidth + colWidth / 2).toFixed(1)}
                y={height - 24}
                fontSize="11"
                fill="var(--mut, #a7b4c6)"
                textAnchor="middle"
              >
                {item.label}
              </text>

              {/* 추가 태그 (예: [대안]) */}
              {item.tag && (
                <text
                  x={(padLeft + i * colWidth + colWidth / 2).toFixed(1)}
                  y={height - 10}
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--vio, #a78bfa)"
                  textAnchor="middle"
                >
                  {item.tag}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

