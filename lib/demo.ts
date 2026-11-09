import type { AuditReport } from './analysis';

// Synthetic examples. They are NOT claimed to be real Lighthouse measurements.
export const DEMO_REPORTS: AuditReport[] = [
  {
    id: 'demo-before', url: 'https://demo.storefront.test', timestamp: '2026-10-09T09:00:00.000Z',
    device: 'mobile', score: 62, source: 'sample',
    metrics: { lcp: 4200, fcp: 2600, tbt: 640, cls: 0.21 },
    opportunities: [
      { id: 'unused-javascript', title: 'Reduce unused JavaScript', savingsMs: 940, savingsBytes: 180000, description: 'Load only the JavaScript needed for the current page.' },
      { id: 'render-blocking-resources', title: 'Eliminate render-blocking resources', savingsMs: 480, savingsBytes: null, description: 'Defer noncritical styles and scripts.' },
    ],
  },
  {
    id: 'demo-after', url: 'https://demo.storefront.test', timestamp: '2026-10-16T09:00:00.000Z',
    device: 'mobile', score: 92, source: 'sample',
    metrics: { lcp: 2050, fcp: 1200, tbt: 115, cls: 0.045 },
    opportunities: [
      { id: 'offscreen-images', title: 'Defer offscreen images', savingsMs: 130, savingsBytes: 20000, description: 'Lazy-load images that are not immediately visible.' },
    ],
  },
];
