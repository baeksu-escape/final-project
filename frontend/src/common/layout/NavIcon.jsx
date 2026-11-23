// 사이드바 메뉴 아이콘 — 메뉴 key(navigation.js)마다 선 아이콘 하나. 없는 key는 점 하나.
const PATHS = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  credit: 'M3 6h18v12H3zM3 10h18M7 15h4',
  finance: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  chevron: 'M9 6l6 6-6 6',
  report: 'M4 15a8 8 0 0 1 16 0M12 15l4-5M3 19h18',
  'asset-debt': 'M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z',
  scenario: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
  'cash-flow': 'M3 17l5-6 4 3 5-7 4 4M3 21h18',
  market: 'M4 9l1-5h14l1 5M4 9h16v11H4zM9 20v-6h6v6',
  simulator: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  loans: 'M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 21h18',
  comparison: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  lounge: 'M4 5h16v11H9l-5 4z',
  model: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  stats: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M22 20a6 6 0 0 0-4-5.6',
  accounts: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  reports: 'M5 21V4M5 4h11l-2 4 2 4H5',
  audit: 'M8 6h12M8 12h12M8 18h12M4 6h0M4 12h0M4 18h0',
}

export default function NavIcon({ name, size = 20 }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? 'M12 12h0'} />
    </svg>
  )
}
