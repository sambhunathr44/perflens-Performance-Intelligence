import { DEFAULT_BUDGETS, type AuditReport, type Budgets } from './analysis';
import { DEMO_REPORTS } from './demo';

const KEY = 'perflens:audits:v1';
const BUDGET_KEY = 'perflens:budgets:v1';

// Validate persisted data before trusting it, but don't alter valid Lighthouse imports.
function validReport(report: unknown): report is AuditReport {
  if (!report || typeof report !== 'object') return false;
  const r = report as Partial<AuditReport>;
  return typeof r.id === 'string' && typeof r.url === 'string' && typeof r.timestamp === 'string' &&
    (r.device === 'mobile' || r.device === 'desktop') && typeof r.score === 'number' &&
    Number.isFinite(r.score) && r.score >= 0 && r.score <= 100 &&
    !!r.metrics && typeof r.metrics === 'object' && Array.isArray(r.opportunities) &&
    (r.source === 'sample' || r.source === 'imported');
}

export function getReports(): AuditReport[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEMO_REPORTS;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(validReport).slice(0, 40) : DEMO_REPORTS;
  } catch {
    return DEMO_REPORTS;
  }
}

export function saveReports(reports: AuditReport[]) {
  try { localStorage.setItem(KEY, JSON.stringify(reports.slice(0, 40))); return true; }
  catch { return false; }
}

export function getBudgets(): Budgets {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (!raw) return DEFAULT_BUDGETS;
    const obj = JSON.parse(raw) as Partial<Budgets>;
    const parsed: Budgets = { ...DEFAULT_BUDGETS };
    for (const key of Object.keys(DEFAULT_BUDGETS) as (keyof Budgets)[]) {
      if (typeof obj[key] === 'number' && Number.isFinite(obj[key]) && obj[key]! >= 0) parsed[key] = obj[key]!;
    }
    return parsed;
  } catch { return DEFAULT_BUDGETS; }
}

export function saveBudgets(budgets: Budgets): boolean {
  try { localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets)); return true; }
  catch { return false; }
}
