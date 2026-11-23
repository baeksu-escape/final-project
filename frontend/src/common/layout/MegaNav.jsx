import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// 위쪽 큰 분류 메뉴 + 마우스를 올리면 그 메뉴 바로 아래로 세부 메뉴가 한 줄로 내려오는 흰 판(카카오뱅크·토스처럼).
// 세부 항목이 있는 분류만 판을 연다.
//   groups: [{ key, label, path, items: [{ key, label, path }] }]
//   hrefFor: 링크 주소를 바꿀 때(로그인 전에는 모두 로그인 화면으로)
export default function MegaNav({ groups, label, isActive = () => false, hrefFor = (entry) => entry.path }) {
  const [open, setOpen] = useState(null)
  const current = groups.find((group) => group.key === open?.key)
  // 메뉴 글자에서 판으로 내려가는 사이 잠깐 벗어나도 닫히지 않게, 닫기는 조금 늦춘다
  const timer = useRef(null)
  const cancelClose = () => clearTimeout(timer.current)
  const close = () => { cancelClose(); setOpen(null) }
  const closeSoon = () => { cancelClose(); timer.current = setTimeout(() => setOpen(null), 260) }
  // 판 안의 목록을 그 메뉴 글자의 왼쪽 끝에 맞춘다
  const openFor = (group, element) => {
    cancelClose()
    if (!group.items?.length) return setOpen(null)
    const left = element.getBoundingClientRect().left
    return setOpen({ key: group.key, left })
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <nav className="mega" aria-label={label} onMouseLeave={closeSoon} onMouseEnter={cancelClose} onKeyDown={(event) => event.key === 'Escape' && close()}>
      <ul className="mega__bar">
        {groups.map((group) => (
          <li key={group.key} onMouseEnter={(event) => openFor(group, event.currentTarget.firstElementChild)}>
            <Link
              to={hrefFor(group)}
              className="mega__link"
              aria-current={isActive(group) ? 'page' : undefined}
              aria-expanded={group.items?.length ? open?.key === group.key : undefined}
              onFocus={(event) => openFor(group, event.currentTarget)}
              onClick={close}
            >
              {group.label}
            </Link>
          </li>
        ))}
      </ul>
      {current && (
        <>
          <div className="mega__panel" onMouseEnter={cancelClose}>
            <ul className="mega__items" style={{ left: open.left }}>
              {current.items.map((tab) => (
                <li key={tab.key}>
                  <Link to={hrefFor(tab)} className="mega__item" onClick={close}>{tab.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mega__scrim" aria-hidden="true" />
        </>
      )}
    </nav>
  )
}
