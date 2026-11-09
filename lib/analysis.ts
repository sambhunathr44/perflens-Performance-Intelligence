/** Domain model & pure analysis functions — no React or browser dependencies. */
export type MetricKey = 'lcp' | 'fcp' | 'tbt' | 'cls';
export type MetricValues = Record<MetricKey, number | null>;
export type AuditSource = 'sample' | 'imported';

export interface Opportunity {
  id: string;
  title: string;
  savingsMs: number | null;
  savingsBytes: number | null;
  description: string;
}

export interface AuditReport {
  id: string;
  url: string;
  timestamp: string;
  device: 'mobile' | 'desktop';
  score: number;
  metrics: MetricValues;
  opportunities: Opportunity[];
  source: AuditSource;
}

export interface Budgets {
  score: number;
  lcp: number;
  fcp: number;
  tbt: number;
  cls: number;
}

export const DEFAULT_BUDGETS: Budgets = {
  score: 90,
  lcp: 2500,
  fcp: 1800,
  tbt: 200,
  cls: 0.1,
};

export const METRIC_INFO: Record<MetricKey, { label: string; short: string; unit: string; description: string }> = {
  lcp: { label: 'Largest Contentful Paint', short: 'LCP', unit: 's', description: 'How quickly the main content appears.' },
  fcp: { label: 'First Contentful Paint', short: 'FCP', unit: 's', description: 'When the first content becomes visible.' },
  tbt: { label: 'Total Blocking Time', short: 'TBT', unit: 'ms', description: 'How long the main thread is blocked.' },
  cls: { label: 'Cumulative Layout Shift', short: 'CLS', unit: '', description: 'How much the page visually shifts.' },
};

const METRIC_AUDIT_IDS: Record<MetricKey, string> = {
  lcp: 'largest-contentful-paint',
  fcp: 'first-contentful-paint',
  tbt: 'total-blocking-time',
  cls: 'cumulative-layout-shift',
};

function object(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeDate(value: unknown): string {
  const candidate = typeof value === 'string' ? new Date(value) : new Date();
  return Number.isNaN(candidate.getTime()) ? new Date().toISOString() : candidate.toISOString();
}

function hostUrl(input: string): string {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return input.slice(0, 200);
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`.slice(0, 200);
  } catch {
    return input.slice(0, 200);
  }
}

function safeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Validate and reduce a real Chrome Lighthouse LHR JSON export.
 * This reads lab metrics, NOT field-based CrUX/real-user data.
 */
export function parseLighthouse(raw: unknown): AuditReport {
  const data = object(raw);
  const categories = object(data?.categories);
  const performance = object(categories?.performance);
  const audits = object(data?.audits);
  const url = data?.finalDisplayedUrl ?? data?.finalUrl ?? data?.requestedUrl;
  if (!data || !performance || !audits || typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('This file is not a valid Lighthouse JSON report. Export the JSON report from Chrome DevTools → Lighthouse.');
  }
  const fraction = performance.score;
  if (typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error('This Lighthouse report does not contain a valid performance score.');
  }
  const settings = object(data.configSettings);
  const device: AuditReport['device'] = settings?.formFactor === 'desktop' ? 'desktop' : 'mobile';
  const metrics = {} as MetricValues;
  (Object.keys(METRIC_AUDIT_IDS) as MetricKey[]).forEach((key) => {
    metrics[key] = finiteNonNegative(object(audits[METRIC_AUDIT_IDS[key]])?.numericValue);
  });

  const opportunities: Opportunity[] = [];
  for (const [key, rawAudit] of Object.entries(audits)) {
    const audit = object(rawAudit);
    if (!audit || typeof audit.title !== 'string') continue;
    const details = object(audit.details);
    const ms = finiteNonNegative(details?.overallSavingsMs);
    const bytes = finiteNonNegative(details?.overallSavingsBytes);
    // Savings estimates are the only reliable signal here; avoid mislabeling generic audits.
    if ((ms !== null && ms > 0) || (bytes !== null && bytes > 0)) {
      opportunities.push({
        id: key,
        title: audit.title.slice(0, 150),
        savingsMs: ms,
        savingsBytes: bytes,
        description: typeof audit.description === 'string'
          ? audit.description.replace(/\[[^\]]+\]\([^)]*\)/g, '').replace(/[`*_#]/g, '').slice(0, 220)
          : 'Potential opportunity identified by Lighthouse.',
      });
    }
  }
  opportunities.sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0) || (b.savingsBytes ?? 0) - (a.savingsBytes ?? 0));
  return {
    id: safeId(),
    url: hostUrl(url),
    timestamp: safeDate(data.fetchTime),
    device,
    score: Math.round(fraction * 100),
    metrics,
    opportunities: opportunities.slice(0, 12),
    source: data.lighthouseVersion === 'sample-only' ? 'sample' : 'imported',
  };
}

export function displayMetric(key: MetricKey, value: number | null): string {
  if (value === null) return 'N/A';
  if (key === 'cls') return value.toFixed(3);
  if (key === 'tbt') return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

export function metricDelta(key: MetricKey, baseline: number | null, current: number | null): string {
  if (baseline === null || current === null) return '—';
  const difference = current - baseline;
  if (Math.abs(difference) < (key === 'cls' ? 0.0005 : 0.5)) return 'No change';
  const value = displayMetric(key, Math.abs(difference));
  return `${difference > 0 ? '+' : '−'}${value}`;
}

export function metricStatus(key: MetricKey, value: number | null, budgets: Budgets): 'pass' | 'fail' | 'unknown' {
  if (value === null) return 'unknown';
  return value <= budgets[key] ? 'pass' : 'fail';
}

export function scoreStatus(score: number, budgets: Budgets): 'pass' | 'fail' {
  return score >= budgets.score ? 'pass' : 'fail';
}

export function regressionCount(baseline: AuditReport, current: AuditReport): number {
  let count = current.score < baseline.score ? 1 : 0;
  (Object.keys(METRIC_INFO) as MetricKey[]).forEach((key) => {
    const before = baseline.metrics[key];
    const after = current.metrics[key];
    if (before !== null && after !== null && after > before + (key === 'cls' ? 0.005 : 25)) count += 1;
  });
  return count;
}

export function budgetViolations(report: AuditReport, budgets: Budgets): string[] {
  const issues: string[] = [];
  if (scoreStatus(report.score, budgets) === 'fail') issues.push(`Performance score below ${budgets.score}`);
  (Object.keys(METRIC_INFO) as MetricKey[]).forEach((key) => {
    if (metricStatus(key, report.metrics[key], budgets) === 'fail') {
      issues.push(`${METRIC_INFO[key].short} exceeds budget (${displayMetric(key, report.metrics[key])} > ${displayMetric(key, budgets[key])})`);
    }
  });
  return issues;
}

export function buildMarkdown(baseline: AuditReport, current: AuditReport, budgets: Budgets): string {
  const scoreDiff = current.score - baseline.score;
  const lines = [
    '# PerfLens — Audit Comparison',
    '',
    `- **URL:** ${current.url}`,
    `- **Device:** ${current.device}`,
    `- **Baseline:** ${new Date(baseline.timestamp).toLocaleString('en-US')}${baseline.source === 'sample' ? ' (sample)' : ''}`,
    `- **Candidate:** ${new Date(current.timestamp).toLocaleString('en-US')}${current.source === 'sample' ? ' (sample)' : ''}`,
    '',
    '## Performance score',
    `**${baseline.score} → ${current.score}** (${scoreDiff > 0 ? '+' : ''}${scoreDiff} points)`,
    '',
    '## Lab metrics',
    '| Metric | Baseline | Candidate | Change |',
    '|---|---:|---:|---:|',
    ...(Object.keys(METRIC_INFO) as MetricKey[]).map((key) =>
      `| ${METRIC_INFO[key].label} | ${displayMetric(key, baseline.metrics[key])} | ${displayMetric(key, current.metrics[key])} | ${metricDelta(key, baseline.metrics[key], current.metrics[key])} |`
    ),
    '',
    '## Performance budget checks',
    ...((budgetViolations(current, budgets).length > 0)
      ? budgetViolations(current, budgets).map((item) => `- FAIL: ${item}`)
      : ['- All available candidate metrics pass the configured budgets.']),
    '',
    '## Lighthouse opportunities',
    ...(current.opportunities.length > 0
      ? current.opportunities.map((item) => `- ${item.title}${item.savingsMs !== null ? ` (~${Math.round(item.savingsMs)} ms estimated savings)` : ''}`)
      : ['- No savings-based opportunities found in this report.']),
    '',
    '> Note: Lighthouse metrics are lab measurements. Sample audits are illustrative, not independently verified performance results.',
  ];
  return lines.join('\n');
}
