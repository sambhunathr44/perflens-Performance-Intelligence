import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PerfLens — Performance Intelligence',
  description: 'Compare real Lighthouse JSON audits, detect regressions, and track frontend performance budgets.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
