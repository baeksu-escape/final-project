// N-26-3, N-26-6 직군 × 연령 격자형 히트맵 컴포넌트
// 2차원 매트릭스 형태로 집단별 수치를 명도 램프로 표시하고, 내 위치 및 셀 선택 인터랙션을 제공합니다.
// props
//   rows    : 행 이름 목록 (기본 직군 3개)
//   columns : 열 이름 목록 (기본 연령대 4개)
//   data    : 2차원 배열. data[행 번호][열 번호] = 칸 값
//     칸 값은 숫자 또는 { value: 수치, count: 인원 수(없으면 생략) }
//     예: [[612, 640, ...], [{ value: 590, count: 1200 }, ...], ...]
//   myCell       : 내 위치 칸 [행 번호, 열 번호]. '나' 표시를 붙인다. 없으면 null
//   selectedCell : 선택된 칸 [행 번호, 열 번호]. 테두리를 강조한다
//   onSelectCell : 칸을 눌렀을 때 호출 (rowIndex, colIndex, { value, count })
//   unit         : 숫자 뒤 단위 (기본 '점')
//   rowSummary   : 행마다 오른쪽 끝에 붙일 요약값 배열 (제목 '직군 평균'). 비우면 열을 그리지 않는다
//   colSummary   : 열마다 맨 아래에 붙일 요약값 배열 (제목 '연령 평균')
//   totalSummary : 맨 아래 오른쪽 끝 전체 평균 (colSummary가 있을 때만 보인다)
// 칸 색은 data 안의 최솟값~최댓값 기준으로 진하기가 정해진다.
// 사용 예: <HeatmapGrid data={scores} myCell={[1, 2]} onSelectCell={(r, c, cell) => setPicked([r, c])} />
import React from 'react';

export default function HeatmapGrid({
  columns = ['20대', '30대', '40대', '50대 이상'],
  rows = ['급여소득자', '자영업자', '프리랜서'],
  data = [], // rows.length x columns.length 2D array or flat objects
  myCell = null, // [rowIndex, colIndex]
  selectedCell = null, // [rowIndex, colIndex]
  onSelectCell,
  unit = '점',
  rowSummary = [], // 각 행의 평균/합계
  colSummary = [], // 각 열의 평균/합계
  totalSummary = null, // 전체 평균
}) {
  // 값 범위(min, max) 계산
  const flatValues = React.useMemo(() => {
    const list = [];
    data.forEach((row) => {
      if (Array.isArray(row)) {
        row.forEach((cell) => {
          const val = typeof cell === 'object' && cell !== null ? Number(cell.value) : Number(cell);
          if (!isNaN(val)) list.push(val);
        });
      }
    });
    return list;
  }, [data]);

  const minVal = flatValues.length > 0 ? Math.min(...flatValues) : 0;
  const maxVal = flatValues.length > 0 ? Math.max(...flatValues) : 100;
  const range = maxVal === minVal ? 1 : maxVal - minVal;

  const getCellData = (rIdx, cIdx) => {
    const row = data[rIdx];
    if (!row) return { value: 0, count: null };
    const cell = row[cIdx];
    if (typeof cell === 'object' && cell !== null) {
      return { value: Number(cell.value) || 0, count: cell.count ?? null };
    }
    return { value: Number(cell) || 0, count: null };
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div
        role="grid"
        aria-label="직군 및 연령별 히트맵 격자"
        style={{
          display: 'grid',
          gridTemplateColumns: `100px repeat(${columns.length}, minmax(70px, 1fr)) ${rowSummary.length > 0 ? 'minmax(75px, 1fr)' : ''}`,
          gap: '6px',
          minWidth: '500px',
          alignItems: 'center',
          fontSize: '13px',
        }}
      >
        {/* 헤더 빈 칸 */}
        <span />

        {/* 열 헤더 */}
        {columns.map((colName, cIdx) => (
          <div
            key={cIdx}
            style={{
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '12px',
              color: 'var(--mut2, #8a9bb4)',
              padding: '4px 0',
            }}
          >
            {colName}
          </div>
        ))}

        {/* 행 요약 헤더 (직군 평균) */}
        {rowSummary.length > 0 && (
          <div
            style={{
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '12px',
              color: 'var(--mut2, #8a9bb4)',
              padding: '4px 0',
            }}
          >
            직군 평균
          </div>
        )}

        {/* 행 데이터 출력 */}
        {rows.map((rowName, rIdx) => (
          <React.Fragment key={rIdx}>
            {/* 행 헤더 */}
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--fg, #eaf1fa)', whiteSpace: 'nowrap' }}>
              {rowName}
            </div>

            {/* 행 내의 셀들 */}
            {columns.map((_, cIdx) => {
              const cell = getCellData(rIdx, cIdx);
              const ratio = Math.min(1, Math.max(0, (cell.value - minVal) / range));
              const isMine = myCell && myCell[0] === rIdx && myCell[1] === cIdx;
              const isSelected = selectedCell && selectedCell[0] === rIdx && selectedCell[1] === cIdx;

              // 시안의 민트 톤 히트맵 채도 계산
              const bgOpacity = 0.15 + ratio * 0.75;
              const isDarkText = ratio > 0.65;

              return (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => onSelectCell && onSelectCell(rIdx, cIdx, cell)}
                  style={{
                    position: 'relative',
                    height: '56px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid var(--vio, #a78bfa)' : '1px solid var(--line2, #2d3e5c)',
                    backgroundColor: `rgba(0, 230, 165, ${bgOpacity.toFixed(2)})`,
                    color: isDarkText ? '#0f172a' : 'var(--fg, #eaf1fa)',
                    cursor: onSelectCell ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '4px',
                    outline: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${rowName} ${columns[cIdx]} ${cell.value}${unit}`}
                >
                  {/* 내 위치 마커 */}
                  {isMine && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        fontSize: '9.5px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'var(--panel, #131f37)',
                        color: 'var(--mint, #00e6a5)',
                        border: '1px solid var(--mint, #00e6a5)',
                        lineHeight: 1.2,
                      }}
                    >
                      나
                    </span>
                  )}

                  <b className="num" style={{ fontSize: '13.5px', fontWeight: 700 }}>
                    {cell.value}
                    {unit}
                  </b>
                  {cell.count != null && (
                    <span style={{ fontSize: '11px', opacity: 0.85 }} className="num">
                      {Number(cell.count).toLocaleString()}명
                    </span>
                  )}
                </button>
              );
            })}

            {/* 행 요약 셀 */}
            {rowSummary.length > 0 && (
              <div
                style={{
                  height: '56px',
                  borderRadius: '8px',
                  border: '1px dashed var(--line2, #2d3e5c)',
                  backgroundColor: 'var(--panel2, #0f1a30)',
                  color: 'var(--mut, #a7b4c6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  fontSize: '13px',
                }}
              >
                <b className="num">{rowSummary[rIdx] ?? '-'}{unit}</b>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* 연령 평균 행 (하단) */}
        {colSummary.length > 0 && (
          <>
            <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--mut2, #8a9bb4)', whiteSpace: 'nowrap' }}>
              연령 평균
            </div>
            {colSummary.map((avgVal, cIdx) => (
              <div
                key={cIdx}
                style={{
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px dashed var(--line2, #2d3e5c)',
                  backgroundColor: 'var(--panel2, #0f1a30)',
                  color: 'var(--mut, #a7b4c6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12.5px',
                }}
              >
                <b className="num">{avgVal}{unit}</b>
              </div>
            ))}
            {totalSummary != null && (
              <div
                style={{
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px dashed var(--line2, #2d3e5c)',
                  backgroundColor: 'var(--panel2, #0f1a30)',
                  color: 'var(--mint, #00e6a5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12.5px',
                }}
              >
                <b className="num">{totalSummary}{unit}</b>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

