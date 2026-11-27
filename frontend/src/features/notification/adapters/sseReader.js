// D-23 SSE 응답의 event·data 줄을 빈 줄 단위로 모아 notification 이벤트만 JSON으로 전달한다.
export async function readNotificationEvents(response, onNotification, signal) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('SSE 스트림을 읽을 수 없습니다.')
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = ''
  let dataLines = []

  const consumeLine = (line) => {
    if (line === '') {
      if (eventName === 'notification' && dataLines.length) {
        try { onNotification(JSON.parse(dataLines.join('\n'))) } catch { /* 잘못된 이벤트는 건너뛴다. */ }
      }
      eventName = ''
      dataLines = []
      return
    }
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon < 0 ? line : line.slice(0, colon)
    const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'event') eventName = value
    if (field === 'data') dataLines.push(value)
  }

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline
      while ((newline = buffer.indexOf('\n')) >= 0) {
        consumeLine(buffer.slice(0, newline).replace(/\r$/, ''))
        buffer = buffer.slice(newline + 1)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
