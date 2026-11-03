import { NavLink } from 'react-router-dom'

// N-08 탭 메뉴 — tabs 배열(config/navigation.js의 USER_TABS·ADMIN_TABS)을 링크 목록으로 그린다.
// 현재 탭 링크에는 react-router가 'active' 클래스와 aria-current="page"를 붙인다.
export default function TabMenu({ tabs, label = '주 메뉴' }) {
  return (
    <nav className="tab-menu" aria-label={label}>
      <ul className="tab-menu__list">
        {tabs.map((tab) => (
          <li key={tab.key} className="tab-menu__item">
            <NavLink to={tab.path} className="tab-menu__link">
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
