import { useState } from 'react'
import { Card, FieldError } from '../../../common/components/index.js'
import { formatWithComma } from '../../../common/utils/number.js'
import { importAltData } from '../api/dataInputApi.js'
import { ALT_DATA_MONTHS, ALT_DATA_SOURCES } from '../config/altDataSources.js'

// 표의 칸 값을 형식에 맞춰 글자로 바꾼다.
function formatCell(value, format) {
  if (format === 'money') return `${formatWithComma(value)}원`
  if (format === 'count') return `${formatWithComma(value)}건`
  return value
}

// N-05 대안 데이터 모의 연동 — 종류마다 [불러오기]를 누르면 더미 데이터를 받아 표로 보여 준다. 실제 외부 기관은 호출하지 않는다.
// imported: { [종류 key]: { importedAt, rows } }   onImported(key, { importedAt, rows }): 불러오기에 성공하면 부모에 알린다.
export default function AltDataImport({ baseMonth, imported, onImported }) {
  const [pendingKey, setPendingKey] = useState(null)
  const [errors, setErrors] = useState({})

  // 종류 하나를 불러온다. 불러오는 동안 다른 [불러오기]는 막고, 실패하면 그 종류 아래에 오류를 보여 준다.
  const handleImport = async (source) => {
    setPendingKey(source.key)
    setErrors((prev) => ({ ...prev, [source.key]: '' }))
    try {
      const { importedAt, rows } = await importAltData(source, baseMonth)
      onImported(source.key, { importedAt, rows })
    } catch (error) {
      setErrors((prev) => ({ ...prev, [source.key]: error.message }))
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <section className="alt-data">
      <h2 className="alt-data__title">대안 데이터 불러오기 (모의 연동)</h2>
      <p className="alt-data__notice">
        실제 외부 기관에 연결하지 않고, 기준월을 포함한 최근 {ALT_DATA_MONTHS}개월의 더미 데이터를 불러옵니다.
      </p>
      {ALT_DATA_SOURCES.map((source) => {
        const result = imported?.[source.key]
        return (
          <Card key={source.key} title={source.label} className={`alt-data-source alt-data-source--${source.key}`}>
            <button
              type="button"
              className="alt-data-source__import"
              onClick={() => handleImport(source)}
              disabled={!baseMonth || pendingKey !== null}
              aria-label={`${source.label} 불러오기`}
            >
              {result ? '다시 불러오기' : '불러오기'}
            </button>
            <FieldError message={errors[source.key]} />
            {result && (
              <table className="alt-data-table">
                <thead>
                  <tr>
                    {source.columns.map((column) => (
                      <th key={column.key} scope="col">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={`${row.month}-${index}`}>
                      {source.columns.map((column) => (
                        <td key={column.key}>{formatCell(row[column.key], column.format)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )
      })}
    </section>
  )
}
