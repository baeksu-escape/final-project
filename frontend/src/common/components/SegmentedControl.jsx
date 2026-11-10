// 구간 선택 — 한 화면 안에서 보기 방식을 바꾸는 버튼 묶음(예: 월/연). options는 [{ value, label }], onChange에는 고른 value를 넘긴다.
// 페이지 이동용 탭은 common/layout/TabMenu를 쓴다.
// 사용 예: <SegmentedControl label="기간" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
export default function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
