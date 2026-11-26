import { useEffect, useRef, useState } from 'react'
import { ALL_GU } from '../config/marketConfig.js'
import { formatMetric, verdictOf } from '../utils/marketStats.js'

// 지도 칸의 가로:세로 비율(market.css의 .market-map__svg aspect-ratio와 같게 둔다)
const ASPECT = 1.6
// 이 폭보다 좁게 확대하면 구 이름 대신 동 이름을 보여 준다(데모 상권 탭과 같은 값)
const DONG_LABEL_WIDTH = 700
const MIN_WIDTH = 120
// 화면에 보이는 글자 크기(px). 확대해도 같은 크기로 보이게 viewBox 단위로 바꿔 쓴다
const GU_FONT_PX = 13
// 동 이름이 잘 안 보인다는 의견(11/26)으로 10.5 → 13px, 글자 둘레에 바탕색 테두리(market.css)
const DONG_FONT_PX = 13

// 영역(x, y, w, h)이 가운데 오도록 지도 비율에 맞춘 viewBox를 만든다.
function fitBox([x, y, w, h], pad) {
  let W = w + pad * 2
  let H = h + pad * 2
  if (W / H > ASPECT) H = W / ASPECT
  else W = H * ASPECT
  return [x + w / 2 - W / 2, y + h / 2 - H / 2, W, H]
}

// 서울 전체 또는 고른 구에 맞춘 viewBox.
function fitGu(geo, gu) {
  if (gu === ALL_GU) return fitBox([0, 0, geo.w, geo.h], 10)
  const found = geo.gu.find((g) => g.name === gu)
  return found ? fitBox(found.box, 30) : fitBox([0, 0, geo.w, geo.h], 10)
}

// N-24-4 상권 공간 시각화 — 미리 계산한 행정동 보로노이 다각형(geo.json)을 지표 값 크기(지표 색 5단계)로 칠한다. 지도 API는 쓰지 않는다.
// 멀리서 볼 때는 구 단위 색(누르면 그 구로 확대), 동 이름이 뜰 만큼 확대하면 동 단위 색(누르면 상세 창 onOpen)으로 바뀐다(FP-278 11/26).
// 드래그로 이동, 휠·버튼으로 확대한다. 고른 구 밖의 동은 흐리게 보인다.
// rows: 서울 전체 동 { dong, value, score, storeCount }, guHeat: 구 이름 → { value, heat }, onLevel: 'gu'|'dong' 바뀔 때 알림
export default function MarketMap({ geo, rows, guHeat, metric, category, gu, openCode, onOpen, onPickGu, onLevel, onReset }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const [view, setView] = useState(() => ({ gu, box: fitGu(geo, gu) }))
  const [tip, setTip] = useState(null)
  const [svgWidth, setSvgWidth] = useState(1000)

  // 지도의 실제 화면 폭을 재 둔다(글자 크기 계산용)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSvgWidth(entry.contentRect.width || 1000))
    observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [])

  // 구를 바꾸면 그 구에 맞춰 다시 확대한다(렌더 중 상태 맞추기).
  if (view.gu !== gu) setView({ gu, box: fitGu(geo, gu) })
  const box = view.box

  const byCode = Object.fromEntries(rows.map((row) => [row.dong.code, row]))

  // 점(cx, cy)을 중심으로 factor배 확대·축소(1보다 크면 축소)
  const zoomBox = (current, factor, cx, cy) => {
    const [x, y, w, h] = current
    const nw = Math.min(Math.max(w * factor, MIN_WIDTH), geo.w * 1.4)
    const nh = (nw * h) / w
    const px = cx ?? x + w / 2
    const py = cy ?? y + h / 2
    return [px - ((px - x) * nw) / w, py - ((py - y) * nh) / h, nw, nh]
  }
  const zoom = (factor) => setView((v) => ({ ...v, box: zoomBox(v.box, factor) }))

  // 휠 확대 — 페이지 스크롤을 막아야 해서 passive가 아닌 리스너로 직접 단다.
  useEffect(() => {
    const svg = svgRef.current
    const handleWheel = (event) => {
      event.preventDefault()
      setView((v) => {
        const [cx, cy] = toMapPoint(svg, event, v.box)
        return { ...v, box: zoomBox(v.box, event.deltaY > 0 ? 1.15 : 0.87, cx, cy) }
      })
    }
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  })

  const handlePointerDown = (event) => {
    dragRef.current = { x: event.clientX, y: event.clientY, box: box, moved: false, id: event.pointerId }
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (drag) {
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) > 5) {
        drag.moved = true
        svgRef.current.setPointerCapture(drag.id)
      }
      if (drag.moved) {
        const rect = svgRef.current.getBoundingClientRect()
        const [x, y, w, h] = drag.box
        setView((v) => ({ ...v, box: [x - (dx / rect.width) * w, y - (dy / rect.height) * h, w, h] }))
        setTip(null)
        return
      }
    }
    // 동 칸은 data-code, 구 칸(구 색일 때)은 data-gu를 단다
    const code = event.target.dataset?.code
    const guName = event.target.dataset?.gu
    if (!code && !guName) {
      setTip(null)
      return
    }
    const wrap = svgRef.current.parentElement.getBoundingClientRect()
    setTip({ code, gu: guName, left: event.clientX - wrap.left + 14, top: event.clientY - wrap.top + 14, flip: event.clientX - wrap.left > wrap.width - 220 })
  }

  const handlePointerUp = (event) => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag?.moved) return
    // 구 색일 때는 누른 구를 골라 확대하고, 동 색일 때는 동 상세 창을 연다.
    // 구를 고른 상태에서 다른 구의 동(흐린 회색)을 누르면 상세 창 대신 그 구로 옮겨 간다(11/26).
    const { code, gu: guName } = event.target.dataset ?? {}
    if (guName) onPickGu(guName)
    else if (code && isOtherGu(code)) onPickGu(byCode[code].dong.gu)
    else if (code) onOpen(code)
  }

  // 구를 골랐을 때 그 구 밖의 동인지
  const isOtherGu = (code) => gu !== ALL_GU && byCode[code] != null && byCode[code].dong.gu !== gu

  const showDongLabels = box[2] < DONG_LABEL_WIDTH
  // 동 이름이 뜨는 확대 정도부터 동 색, 그보다 멀면 구 색
  const isGuLevel = !showDongLabels
  const level = isGuLevel ? 'gu' : 'dong'
  useEffect(() => {
    onLevel(level)
  }, [level, onLevel])
  // 화면 1px이 viewBox 몇 단위인지
  const unitPerPx = box[2] / svgWidth
  const tipRow = !isGuLevel && tip?.code && !isOtherGu(tip.code) ? byCode[tip.code] : null
  // 다른 구 동에 올렸을 때는 구 이름만 보여 준다
  const tipOther = !isGuLevel && tip?.code && isOtherGu(tip.code) ? byCode[tip.code].dong.gu : null
  const tipGu = isGuLevel ? tip?.gu : null
  const guDongCount = (name) => rows.filter((row) => row.dong.gu === name).length

  return (
    <div className="market-map__wrap">
      <svg
        ref={svgRef}
        className={`market-map__svg market-map__svg--${level}`}
        viewBox={box.map((v) => v.toFixed(1)).join(' ')}
        role="img"
        aria-label={`서울 행정동 ${category.name} ${metric.name} 지도`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setTip(null)}
      >
        <path d={geo.outline} className="market-map__land" />
        {/* 구 색일 때는 구 경계 모양을 그대로 칠한다. 동 칸(모식도)은 구 경계와 모양이 달라 색이 경계선 밖으로 삐져나오기 때문이다(11/26) */}
        {isGuLevel ? (
          <g>
            {geo.gu.map((g) => {
              const classes = ['market-map__gu-fill', `market-heat--${guHeat[g.name]?.heat ?? 'none'}`]
              if (gu !== ALL_GU && g.name !== gu) classes.push('market-map__dong--dim')
              return <path key={g.name} d={g.path} data-gu={g.name} className={classes.join(' ')} />
            })}
          </g>
        ) : (
          <g>
            {Object.entries(geo.dongs).map(([code, shape]) => {
              const row = byCode[code]
              // 1차 시연 후속: 칸 색은 값의 크기(지표 색 5단계). 좋고 나쁨은 툴팁·상세 창 글자로 알려 준다.
              const classes = ['market-map__dong', `market-heat--${row?.heat ?? 'none'}`]
              if (gu !== ALL_GU && row?.dong.gu !== gu) classes.push('market-map__dong--dim')
              if (code === openCode) classes.push('market-map__dong--on')
              return <path key={code} d={shape.path} data-code={code} className={classes.join(' ')} vectorEffect="non-scaling-stroke" />
            })}
          </g>
        )}
        <g pointerEvents="none">
          {geo.gu.map((g) => (
            <path
              key={g.name}
              d={g.path}
              className={g.name === tipGu ? 'market-map__gu market-map__gu--on' : 'market-map__gu'}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={geo.outline} className="market-map__outline" vectorEffect="non-scaling-stroke" />
          {showDongLabels
            ? rows
                .filter((row) => gu === ALL_GU || row.dong.gu === gu)
                .map((row) => {
                  const shape = geo.dongs[row.dong.code]
                  return (
                    <text key={row.dong.code} x={shape.x} y={shape.y} fontSize={DONG_FONT_PX * unitPerPx} className="market-map__dong-label">
                      {row.dong.name}
                    </text>
                  )
                })
            : geo.gu.map((g) => (
                <text key={g.name} x={g.x} y={g.y} fontSize={GU_FONT_PX * unitPerPx} className="market-map__gu-label">
                  {g.name}
                </text>
              ))}
        </g>
      </svg>

      <div className="market-map__ctl">
        <button type="button" className="button button--sm" aria-label="확대" onClick={() => zoom(0.75)}>
          +
        </button>
        <button type="button" className="button button--sm" aria-label="축소" onClick={() => zoom(1.33)}>
          −
        </button>
        <button
          type="button"
          className="button button--sm"
          aria-label="서울 전체 보기"
          onClick={() => {
            setView({ gu: ALL_GU, box: fitGu(geo, ALL_GU) })
            onReset()
          }}
        >
          ⤢
        </button>
      </div>

      {tipGu && (
        <div className={tip.flip ? 'market-map__tip market-map__tip--flip' : 'market-map__tip'} style={{ left: tip.left, top: tip.top }}>
          <b>{tipGu}</b>
          <br />
          {category.name} {metric.name} <b className="market-num">{formatMetric(metric, guHeat[tipGu]?.value ?? null)}</b>
          <br />
          <span className="market-hint">행정동 {guDongCount(tipGu)}곳 · 누르면 확대</span>
        </div>
      )}

      {tipOther && (
        <div className={tip.flip ? 'market-map__tip market-map__tip--flip' : 'market-map__tip'} style={{ left: tip.left, top: tip.top }}>
          <b>{tipOther}</b>
          <br />
          <span className="market-hint">누르면 이 구로 이동</span>
        </div>
      )}

      {tipRow && !tipGu && (
        <div className={tip.flip ? 'market-map__tip market-map__tip--flip' : 'market-map__tip'} style={{ left: tip.left, top: tip.top }}>
          <b>{tipRow.dong.name}</b> <span className="market-hint">{tipRow.dong.gu}</span>
          <br />
          {category.name} {metric.name} <b className="market-num">{formatMetric(metric, tipRow.value)}</b>
          <br />
          <span className="market-hint">
            {verdictOf(tipRow.score).text} · 점포 {tipRow.storeCount.toLocaleString('ko-KR')}곳
          </span>
        </div>
      )}
    </div>
  )
}

// 휠 이벤트 위치 → 지도 좌표 (리스너 안에서 최신 viewBox로 계산하려고 따로 둔다)
function toMapPoint(svg, event, current) {
  const rect = svg.getBoundingClientRect()
  const [x, y, w, h] = current
  return [x + ((event.clientX - rect.left) / rect.width) * w, y + ((event.clientY - rect.top) / rect.height) * h]
}
