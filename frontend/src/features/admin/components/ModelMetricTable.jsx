import { MODEL_METRICS, formatRate } from '../modelPerformanceCodes.js'

// 지표 값을 종류에 맞춰 글자로 — AUC·비용은 소수 셋째 자리, 비율은 %
function formatValue(type, value) {
  return type === 'rate' ? formatRate(value) : value.toFixed(3)
}

// 차이(대안 − 기존) 글자와 나빠졌는지 — 비율은 %p, 나머지는 소수. 지표마다 좋은 방향이 다르다.
function diffOf(metric, legacyValue, altValue) {
  const diff = altValue - legacyValue
  const text = metric.type === 'rate' ? `${(diff * 100).toFixed(1)}%p` : diff.toFixed(3)
  const sign = diff > 0 ? '+' : ''
  const worse = metric.lowerIsBetter ? diff > 0 : diff < 0
  return { text: `${sign}${text}`, worse: Math.abs(diff) >= 0.0005 && worse }
}

// N-25-2 성능 지표 비교 표 — 지표 6개를 기존·대안·차이로 나란히 보여 준다. 대안이 나쁜 지표도 그대로 '나빠짐'으로 표시한다.
export default function ModelMetricTable({ legacy, alternative }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">지표</th>
            <th scope="col" className="is-num">
              기존
            </th>
            <th scope="col" className="is-num">
              대안
            </th>
            <th scope="col" className="is-num">
              차이
            </th>
          </tr>
        </thead>
        <tbody>
          {MODEL_METRICS.map((metric) => {
            const diff = diffOf(metric, legacy[metric.key], alternative[metric.key])
            return (
              <tr key={metric.key}>
                <td>{metric.label}</td>
                <td className="is-num num">{formatValue(metric.type, legacy[metric.key])}</td>
                <td className="is-num num">
                  <b>{formatValue(metric.type, alternative[metric.key])}</b>
                </td>
                <td className={diff.worse ? 'is-num num text-error' : 'is-num num'}>
                  {diff.text}
                  {diff.worse && <span className="sr-only"> (나빠짐)</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
