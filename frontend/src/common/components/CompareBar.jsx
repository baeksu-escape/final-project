// N-15-3 나와 동년배·같은 직군 평균 수평 비교 막대 컴포넌트
// 내 수치와 평균값을 수평 트랙 막대로 나란히 비교하여 보여 줍니다.
// props
//   label       : 비교 항목 이름 (예: '연소득'). 없으면 제목 줄을 그리지 않는다
//   myValue     : 내 수치 (숫자)
//   avgValue    : 비교 대상 평균 수치 (숫자)
//   unit        : 숫자 뒤에 붙는 단위 (기본 '만원')
//   maxValue    : 막대 100% 기준값. 없으면 myValue·avgValue 중 큰 값
//   myLabel     : 내 막대 이름 (기본 '나')
//   myUnavailableText — 여러 평균 행에서 내 수치를 표시할 수 없을 때 쓰는 문구 (기본 '미입력')
//   avgLabel    : 평균 막대 이름 (기본 '평균'. 예: '동년배 평균', '같은 직군 평균')
//   averages    : 여러 평균 행([{ label, value, unavailableText }]). null 값은 안내 문구로 표시한다
//   formatValue : 숫자 표시 함수 (기본 천 단위 쉼표)
// 사용 예: <CompareBar label="연소득" myValue={4200} avgValue={3800} avgLabel="동년배 평균" />

export default function CompareBar({
  label,
  myValue = 0,
  avgValue = 0,
  unit = '만원',
  maxValue,
  myLabel = '나',
  myUnavailableText = '미입력',
  avgLabel = '평균',
  averages,
  formatValue = (v) => Number(v || 0).toLocaleString(),
}) {
  const numMy = Number(myValue) || 0;
  const numAvg = Number(avgValue) || 0;
  const avgRows = averages ?? [{ label: avgLabel, value: avgValue }];
  const max = maxValue || (averages ? Math.max(numMy, ...avgRows.map((row) => Number(row.value) || 0), 1) : Math.max(numMy, numAvg, 1));
  // N-15-3 여러 평균 행은 내용에 맞춘 열을 공유해 라벨이나 금액이 길어도 막대의 범위를 맞춘다.
  const groupStyle = averages
    ? { display: 'grid', gridTemplateColumns: 'minmax(0, max-content) minmax(1rem, 1fr) minmax(0, max-content)', gap: '6px 8px', alignItems: 'center', minWidth: 0 }
    : { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 };
  const rowStyle = averages
    ? { display: 'contents', fontSize: '12.5px' }
    : { display: 'grid', gridTemplateColumns: '48px 1fr 90px', gap: '8px', alignItems: 'center', fontSize: '12.5px' };
  const overflowWrap = averages ? 'anywhere' : undefined;
  // N-15-3 여러 평균 행에서 값이 숫자가 아니라 안내 문구면 막대를 그리지 않고 막대 칸부터 값 칸까지 문구가 차지해 좁은 화면에서도 읽힌다.
  const noticeStyle = { gridColumn: '2 / -1', color: 'var(--mut2, #8a9bb4)', overflowWrap, minWidth: 0 };

  const myPercent = Math.min(100, Math.max(0, (numMy / max) * 100));

  return (
    <div className="compare-bar-group" style={groupStyle}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, gridColumn: averages ? '1 / -1' : undefined }}>
          <span>{label}</span>
          <span style={{ fontSize: '12px', color: 'var(--mut2, #8a9bb4)' }}>단위: {unit}</span>
        </div>
      )}

      {/* 내 수치 */}
      <div style={rowStyle}>
        <span style={{ fontWeight: 600, color: 'var(--mint, #00e6a5)', overflowWrap }}>{myLabel}</span>
        {averages && myValue == null ? (
          <b className="num" style={{ ...noticeStyle, color: 'var(--mint, #00e6a5)', fontFamily: 'inherit' }}>{myUnavailableText}</b>
        ) : (
          <>
            <div style={{ position: 'relative', height: '10px', borderRadius: '5px', background: 'var(--line, #22314b)', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${myPercent.toFixed(1)}%`,
                  backgroundColor: 'var(--mint, #00e6a5)',
                  borderRadius: '5px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <b className="num" style={{ textAlign: 'right', color: 'var(--mint, #00e6a5)', fontFamily: 'inherit', overflowWrap }}>
              <>{formatValue(numMy)}{unit}</>
            </b>
          </>
        )}
      </div>

      {/* 평균 수치 */}
      {avgRows.map((row, index) => {
        const number = Number(row.value) || 0;
        const avgPercent = Math.min(100, Math.max(0, (number / max) * 100));
        return <div key={index} data-avg-index={index} style={rowStyle}>
          <span style={{ color: 'var(--mut, #a7b4c6)', overflowWrap }}>{row.label}</span>
          {averages && row.value == null ? (
            <span className="num" style={{ ...noticeStyle, fontFamily: 'inherit' }}>{row.unavailableText ?? '비교 회원 부족'}</span>
          ) : (
            <>
              <div style={{ position: 'relative', height: '10px', borderRadius: '5px', background: 'var(--line, #22314b)', overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${avgPercent.toFixed(1)}%`,
                    backgroundColor: 'var(--line2, #4a5b78)',
                    borderRadius: '5px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span className="num" style={{ textAlign: 'right', color: 'var(--mut2, #8a9bb4)', fontFamily: 'inherit', overflowWrap }}>
                <>{formatValue(number)}{unit}</>
              </span>
            </>
          )}
        </div>
      })}
    </div>
  );
}

