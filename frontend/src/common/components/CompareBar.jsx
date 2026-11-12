// N-15-3 나와 동년배·같은 직군 평균 수평 비교 막대 컴포넌트
// 내 수치와 평균값을 수평 트랙 막대로 나란히 비교하여 보여 줍니다.
// props
//   label       : 비교 항목 이름 (예: '연소득'). 없으면 제목 줄을 그리지 않는다
//   myValue     : 내 수치 (숫자)
//   avgValue    : 비교 대상 평균 수치 (숫자)
//   unit        : 숫자 뒤에 붙는 단위 (기본 '만원')
//   maxValue    : 막대 100% 기준값. 없으면 myValue·avgValue 중 큰 값
//   myLabel     : 내 막대 이름 (기본 '나')
//   avgLabel    : 평균 막대 이름 (기본 '평균'. 예: '동년배 평균', '같은 직군 평균')
//   formatValue : 숫자 표시 함수 (기본 천 단위 쉼표)
// 사용 예: <CompareBar label="연소득" myValue={4200} avgValue={3800} avgLabel="동년배 평균" />

export default function CompareBar({
  label,
  myValue = 0,
  avgValue = 0,
  unit = '만원',
  maxValue,
  myLabel = '나',
  avgLabel = '평균',
  formatValue = (v) => Number(v || 0).toLocaleString(),
}) {
  const numMy = Number(myValue) || 0;
  const numAvg = Number(avgValue) || 0;
  const max = maxValue || Math.max(numMy, numAvg, 1);

  const myPercent = Math.min(100, Math.max(0, (numMy / max) * 100));
  const avgPercent = Math.min(100, Math.max(0, (numAvg / max) * 100));

  return (
    <div className="compare-bar-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
          <span>{label}</span>
          <span style={{ fontSize: '12px', color: 'var(--mut2, #8a9bb4)' }}>단위: {unit}</span>
        </div>
      )}

      {/* 내 수치 */}
      <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 90px', gap: '8px', alignItems: 'center', fontSize: '12.5px' }}>
        <span style={{ fontWeight: 600, color: 'var(--mint, #00e6a5)' }}>{myLabel}</span>
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
        <b className="num" style={{ textAlign: 'right', color: 'var(--mint, #00e6a5)', fontFamily: 'inherit' }}>
          {formatValue(numMy)}{unit}
        </b>
      </div>

      {/* 평균 수치 */}
      <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 90px', gap: '8px', alignItems: 'center', fontSize: '12.5px' }}>
        <span style={{ color: 'var(--mut, #a7b4c6)' }}>{avgLabel}</span>
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
        <span className="num" style={{ textAlign: 'right', color: 'var(--mut2, #8a9bb4)', fontFamily: 'inherit' }}>
          {formatValue(numAvg)}{unit}
        </span>
      </div>
    </div>
  );
}

