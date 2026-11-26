// FP-278 지도 모양 다듬기 — geo.json 다각형의 뾰족한 가시를 지우고, 구 이름을 구 모양 안쪽 넓은 곳에 놓는다(11/26).
// 자료 파일(geo.json)은 그대로 두고 화면에 그릴 때만 고친다.

// 경로 글자("M1,2L3,4Z...")를 점 배열 묶음으로 바꾼다(조각마다 하나).
function parsePath(d) {
  return d
    .split('M')
    .filter(Boolean)
    .map((part) => {
      const nums = part.match(/-?\d+(\.\d+)?/g).map(Number)
      const points = []
      for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]])
      return points
    })
}

function toPath(polygons) {
  return polygons.map((points) => `M${points.map(([x, y]) => `${x},${y}`).join('L')}Z`).join('')
}

// 갔다가 거의 같은 길로 되돌아오는 점(가시)을 지운다. 지도 위에 가는 선처럼 보이던 부분이다.
function removeSpikes(points) {
  let list = points
  let changed = true
  while (changed && list.length > 3) {
    changed = false
    for (let i = 0; i < list.length; i += 1) {
      const a = list[(i - 1 + list.length) % list.length]
      const b = list[i]
      const c = list[(i + 1) % list.length]
      const ux = a[0] - b[0]
      const uy = a[1] - b[1]
      const vx = c[0] - b[0]
      const vy = c[1] - b[1]
      const lu = Math.hypot(ux, uy)
      const lv = Math.hypot(vx, vy)
      // 같은 점이 겹쳤거나, 두 변이 거의 같은 방향(사이 각 약 15도 미만)이면 가시로 본다
      if (lu === 0 || lv === 0 || (ux * vx + uy * vy) / (lu * lv) > 0.966) {
        list = list.filter((_, j) => j !== i)
        changed = true
        break
      }
    }
  }
  return list
}

// 경로의 가시를 지운 새 경로 글자.
export function cleanPath(d) {
  return toPath(parsePath(d).map(removeSpikes))
}

// 점이 다각형 안에 있는지(짝홀 규칙).
function isInside(x, y, polygons) {
  let inside = false
  for (const points of polygons) {
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i]
      const [xj, yj] = points[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

// 점에서 가장 가까운 경계까지 거리. 글자는 가로로 길어서 세로 거리를 2배로 쳐 좌우 여유가 큰 곳을 고르게 한다.
function edgeDistance(x, y, polygons) {
  let best = Infinity
  for (const points of polygons) {
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [ax, ay] = points[j]
      const [bx, by] = points[i]
      const dx = bx - ax
      const dy = by - ay
      const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
      const ex = x - (ax + t * dx)
      const ey = (y - (ay + t * dy)) * 2
      best = Math.min(best, Math.hypot(ex, ey))
    }
  }
  return best
}

// 구 모양 안에서 경계와 가장 먼 점(이름 놓을 곳)을 격자로 찾은 뒤 그 주변을 더 촘촘히 찾는다. 못 찾으면 원래 점.
function labelPoint(polygons, [bx, by, bw, bh], fallback) {
  let best = { x: fallback[0], y: fallback[1], d: isInside(fallback[0], fallback[1], polygons) ? edgeDistance(fallback[0], fallback[1], polygons) : -1 }
  let step = Math.max(bw, bh) / 30
  let [x0, y0, x1, y1] = [bx, by, bx + bw, by + bh]
  for (let round = 0; round < 3; round += 1) {
    for (let x = x0; x <= x1; x += step) {
      for (let y = y0; y <= y1; y += step) {
        if (!isInside(x, y, polygons)) continue
        const d = edgeDistance(x, y, polygons)
        if (d > best.d) best = { x, y, d }
      }
    }
    ;[x0, y0, x1, y1] = [best.x - step, best.y - step, best.x + step, best.y + step]
    step /= 5
  }
  return [best.x, best.y]
}

// geo.json을 화면용으로 다듬는다: 구·동·서울 외곽선의 가시를 지우고, 구 이름 위치를 구 안쪽으로 옮긴다.
export function tidyGeo(geo) {
  return {
    ...geo,
    outline: cleanPath(geo.outline),
    dongs: Object.fromEntries(Object.entries(geo.dongs).map(([code, shape]) => [code, { ...shape, path: cleanPath(shape.path) }])),
    gu: geo.gu.map((g) => {
      const polygons = parsePath(g.path).map(removeSpikes)
      const [x, y] = labelPoint(polygons, g.box, [g.x, g.y])
      return { ...g, path: toPath(polygons), x, y }
    }),
  }
}
