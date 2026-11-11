// Set mínimo de iconos inline usados por el Dashboard — mismos paths que el
// diseño (dashboard.js `ip`), sólo los que este componente realmente usa.
const PATHS: Record<string, string> = {
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  flat: 'M5 12h14',
  chevR: 'M9 6l6 6-6 6',
  chevD: 'M6 9l6 6 6-6',
  x: 'M6 6l12 12M18 6L6 18',
  cal: 'M3 4h18v18H3zM8 2v4M16 2v4M3 10h18',
  cmp: 'M7 4v16M17 4v16M3 8h8M13 16h8',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
  check: 'M20 6L9 17l-5-5',
  checkC: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8 12l3 3 5-6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  userX: 'M9 4a4 4 0 100 8 4 4 0 000-8zM2 21a7 7 0 0114 0M17 8l4 4M21 8l-4 4',
  xC: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15 9l-6 6M9 9l6 6',
  video: 'M2 6h14v12H2zM16 10l6-3v10l-6-3',
  wa: 'M21 12a9 9 0 10-13.4 7.9L3 21l1.2-4.4A9 9 0 1021 12zM9 9.5c.5 2.5 2.5 4.5 5 5',
  file: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M8 13h8M8 17h5',
  users: 'M9 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2.5 20a6.5 6.5 0 0113 0M17.5 6.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM22 18a4.5 4.5 0 00-7-3.7',
  wallet: 'M3 6h18v14H3zM16 13h2M3 10h18M7 6V4h10v2',
  shield: 'M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3',
  table: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16',
  chart: 'M3 3v18h18M8 17V11M13 17V7M18 17v-4',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v.01M11 12h1v5h1',
  plus: 'M12 5v14M5 12h14',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  lock: 'M4 11h16v10H4zM8 11V7a4 4 0 018 0v4',
}

export default function DbIcon({ name, className = '' }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg className={`db-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
