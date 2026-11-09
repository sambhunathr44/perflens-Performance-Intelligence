import type { SVGProps } from 'react';

export type IconName =
  | 'pulse' | 'grid' | 'history' | 'settings' | 'upload' | 'download' | 'arrowUp'
  | 'arrowDown' | 'check' | 'alert' | 'chevron' | 'external' | 'x' | 'trash'
  | 'info' | 'menu' | 'clock' | 'monitor' | 'phone' | 'code' | 'plus'
  | 'target' | 'file' | 'refresh' | 'sparkles' | 'chart';

export default function Icon({ name, size = 18, ...rest }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const, ...rest };
  const paths: Record<IconName, React.ReactNode> = {
    pulse: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    history: <><path d="M3 11a9 9 0 1 1 3 7"/><path d="M3 4v7h7"/><path d="M12 7v5l3 2"/></>,
    settings: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M18.4 5.6l-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="3.4"/></>,
    upload: <><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
    download: <><path d="M12 4v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v3h16v-3"/></>,
    arrowUp: <><path d="M12 20V4m0 0-6 6m6-6 6 6"/></>,
    arrowDown: <><path d="M12 4v16m0 0-6-6m6 6 6-6"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    alert: <><path d="M10.3 3.9 2.4 17.6c-.8 1.4.2 3.1 1.8 3.1h15.6c1.6 0 2.6-1.7 1.8-3.1L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5m0 3h.01"/></>,
    chevron: <><path d="m7 10 5 5 5-5"/></>,
    external: <><path d="M13 5h6v6m0-6-9 9"/><path d="M19 14v5H5V5h5"/></>,
    x: <><path d="M5 5 19 19M19 5 5 19"/></>,
    trash: <><path d="M4 7h16M10 4h4m4 3-.7 13H6.7L6 7m4 4v6m4-6v6"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    monitor: <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8m-4-4v4"/></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/></>,
    file: <><path d="M7 3h8l4 4v14H5V3h2Zm8 0v5h4M8 12h8m-8 4h8"/></>,
    refresh: <><path d="M20 8a8 8 0 1 0 1 6m-1-10v4h-4"/></>,
    sparkles: <><path d="m12 2 2.3 6.7L21 11l-6.7 2.3L12 20l-2.3-6.7L3 11l6.7-2.3L12 2ZM19 18v4m-2-2h4"/></>,
    chart: <><path d="M3 21V3m0 18h18"/><path d="m7 15 4-5 4 2 5-7"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}
