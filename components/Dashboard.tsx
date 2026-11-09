'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import Icon from './Icons';
import {
  DEFAULT_BUDGETS, METRIC_INFO, budgetViolations, buildMarkdown,
  displayMetric, metricDelta, metricStatus, parseLighthouse, regressionCount,
  type AuditReport, type Budgets, type MetricKey,
} from '../lib/analysis';
import { DEMO_REPORTS } from '../lib/demo';
import { getBudgets, getReports, saveBudgets, saveReports } from '../lib/storage';

type Screen = 'overview' | 'reports';

const formatDate = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const shorten = (url: string) => { try { const u = new URL(url); return u.hostname + (u.pathname === '/' ? '' : u.pathname); } catch { return url; } };
const metricKeys: MetricKey[] = ['lcp', 'fcp', 'tbt', 'cls'];

function Badge({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: 'neutral' | 'success' | 'danger' | 'info' | 'warning' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

function ScoreRing({ score, size = 'large' }: { score: number; size?: 'small' | 'large' }) {
  const color = score >= 90 ? '#71e7b2' : score >= 50 ? '#ffcc77' : '#ff847c';
  const style: CSSProperties = { background: `conic-gradient(${color} ${Math.min(100, Math.max(0, score))}%, #263148 0)` };
  return <div className={`score-ring ${size}`} style={style} role="img" aria-label={`Performance score ${score} of 100`}>
    <div className="score-ring-inner"><strong>{score}</strong>{size === 'large' && <span>/ 100</span>}</div>
  </div>;
}

function Sparkline({ reports, selectedId }: { reports: AuditReport[]; selectedId: string }) {
  const points = [...reports].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-12);
  if (points.length < 2) return <div className="empty-plot">Import another Lighthouse report to see your trend.</div>;
  const x = (i: number) => 18 + (i * 524) / (points.length - 1);
  const y = (score: number) => 128 - (score / 100) * 110;
  const coords = points.map((r, i) => `${x(i)},${y(r.score)}`).join(' ');
  const area = `18,138 ${coords} 542,138`;
  return <div className="sparkline" role="img" aria-label="Performance score history line chart">
    <svg viewBox="0 0 560 148" preserveAspectRatio="none" aria-hidden="true">
      {[25, 50, 75, 100].map(v => <g key={v}><line x1="18" x2="542" y1={y(v)} y2={y(v)} stroke="#26334a" strokeDasharray="4 6"/><text x="0" y={y(v) + 3} fill="#728199" fontSize="10">{v}</text></g>)}
      <polygon points={area} fill="#6ce7b9" opacity=".12"/>
      <polyline points={coords} stroke="#70e6ba" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      {points.map((r, i) => <circle key={r.id} cx={x(i)} cy={y(r.score)} r={r.id === selectedId ? 6 : 4} fill={r.id === selectedId ? '#fff' : '#70e6ba'} stroke="#132237" strokeWidth="2"/>)}
    </svg>
    <div className="chart-labels"><span>{formatDate(points[0].timestamp)}</span><span>{formatDate(points[points.length - 1].timestamp)}</span></div>
  </div>;
}

function downloadContent(filename: string, content: string, type: string) {
  const file = new Blob([content], { type });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Dashboard() {
  const [reports, setReports] = useState<AuditReport[]>(DEMO_REPORTS);
  const [budgets, setBudgets] = useState<Budgets>(DEFAULT_BUDGETS);
  const [baselineId, setBaselineId] = useState('demo-before');
  const [currentId, setCurrentId] = useState('demo-after');
  const [screen, setScreen] = useState<Screen>('overview');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Budgets>(DEFAULT_BUDGETS);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = getReports();
    const storedBudgets = getBudgets();
    setReports(stored);
    setBudgets(storedBudgets);
    const sorted = [...stored].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setBaselineId(sorted.at(-2)?.id ?? '');
    setCurrentId(sorted.at(-1)?.id ?? '');
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) saveReports(reports); }, [hydrated, reports]);

  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 5000); }, []);

  const baseline = reports.find(r => r.id === baselineId) ?? reports[0];
  const current = reports.find(r => r.id === currentId) ?? reports.at(-1);
  const ordered = useMemo(() => [...reports].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [reports]);
  const compared = baseline && current && baseline.id !== current.id;
  const mismatched = compared && (baseline.url !== current.url || baseline.device !== current.device);
  const warnings = current ? budgetViolations(current, budgets) : [];
  const regressionTotal = compared ? regressionCount(baseline, current) : 0;
  const diff = compared ? current.score - baseline.score : 0;
  const samplesPresent = !!(current?.source === 'sample' || baseline?.source === 'sample');

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(event.target.files ?? [])];
    if (chosen.length === 0) return;
    const valid: AuditReport[] = [];
    const errors: string[] = [];
    for (const file of chosen) {
      try {
        if (file.size > 12 * 1024 * 1024) throw new Error('File exceeds 12 MB');
        const text = await file.text();
        valid.push(parseLighthouse(JSON.parse(text) as unknown));
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
      }
    }
    if (valid.length) {
      const existing = reports.filter(r => r.source === 'imported');
      const next = [...reports, ...valid].slice(-40);
      setReports(next);
      const newest = valid.at(-1)!;
      setCurrentId(newest.id);
      const match = [...valid.slice(0, -1), ...existing].reverse().find(r => r.url === newest.url && r.device === newest.device);
      if (match) setBaselineId(match.id);
      else if (next.length > 1) setBaselineId(next.find(r => r.id !== newest.id)?.id ?? '');
      setScreen('overview');
    }
    notify(`${valid.length ? `${valid.length} report${valid.length === 1 ? '' : 's'} imported. ` : ''}${errors.length ? `${errors.length} failed: ${errors[0].slice(0, 110)}` : 'Ready to compare.'}`);
    event.target.value = '';
  };

  const handleDelete = (id: string) => {
    const next = reports.filter(r => r.id !== id);
    setReports(next);
    if (baselineId === id) setBaselineId(next[0]?.id ?? '');
    if (currentId === id) setCurrentId(next.at(-1)?.id ?? '');
    notify('Audit removed from this browser.');
  };

  const handleReset = () => {
    if (!window.confirm('Replace saved audits with the two sample reports? This cannot be undone.')) return;
    setReports(DEMO_REPORTS);
    setBaselineId('demo-before');
    setCurrentId('demo-after');
    setScreen('overview');
    notify('Sample reports restored.');
  };

  const openSettings = () => { setSettingsDraft(budgets); setSettingsOpen(true); setMobileNavOpen(false); };
  const saveSettings = () => {
    if (settingsDraft.score > 100 || settingsDraft.score < 0 || Object.values(settingsDraft).some(x => !Number.isFinite(x) || x < 0)) {
      notify('Please enter valid, non-negative budget values.'); return;
    }
    setBudgets(settingsDraft);
    if (!saveBudgets(settingsDraft)) notify('Storage is unavailable; settings will reset on reload.');
    else notify('Performance budgets updated.');
    setSettingsOpen(false);
  };

  const handleExport = () => {
    if (!baseline || !current || baseline.id === current.id) { notify('Select two different audits to export a comparison.'); return; }
    downloadContent('perflens-comparison.md', buildMarkdown(baseline, current, budgets), 'text/markdown;charset=utf-8');
    notify('Markdown comparison exported.');
  };

  const filtered = ordered.filter(r => `${r.url} ${r.device} ${r.source}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Icon name="pulse" size={25}/></div><div><strong>Perf<span>Lens</span></strong><small>PERFORMANCE INTELLIGENCE</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav">
        <button className={`nav-item ${screen === 'overview' ? 'active' : ''}`} onClick={() => { setScreen('overview'); setMobileNavOpen(false); }}><Icon name="grid"/><span>Overview</span></button>
        <button className={`nav-item ${screen === 'reports' ? 'active' : ''}`} onClick={() => { setScreen('reports'); setMobileNavOpen(false); }}><Icon name="history"/><span>Audit history</span><span className="nav-count">{reports.length}</span></button>
        <button className="nav-item" onClick={openSettings}><Icon name="target"/><span>Performance budgets</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="side-note"><div className="side-note-icon"><Icon name="sparkles" size={17}/></div><strong>Measure what matters.</strong><p>Import Lighthouse JSON to compare real lab audits. No API key or account required.</p><button onClick={() => input.current?.click()}>Import an audit <Icon name="arrowUp" size={14}/></button></div><div className="side-footer"><span className="online-dot"/> Local-first · Your data stays in this browser</div></div>
    </aside>
    {mobileNavOpen && <div className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} role="presentation"/>}

    <main className="main">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={15}/><strong>{screen === 'overview' ? 'Overview' : 'Audit history'}</strong></div><div className="topbar-actions"><span className="privacy-note"><Icon name="check" size={14}/> No external tracking</span><div className="avatar" title="Local workspace">PL</div></div></header>
      <div className="content">
        <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-dot"/> FRONTEND ENGINEERING TOOLKIT</div><h1>{screen === 'overview' ? 'Performance overview' : 'Your audit history'}<span className="h1-accent">.</span></h1><p>{screen === 'overview' ? 'Understand the impact of every release. Compare Lighthouse audits and catch regressions early.' : 'Explore imported audits, select baselines, and keep your frontend performance in check.'}</p></div><div className="intro-actions"><button className="button button-ghost" onClick={screen === 'overview' ? handleExport : handleReset}><Icon name={screen === 'overview' ? 'download' : 'refresh'}/>{screen === 'overview' ? 'Export report' : 'Restore demo'}</button><button className="button button-primary" onClick={() => input.current?.click()}><Icon name="upload"/> Import Lighthouse JSON</button><input type="file" accept=".json,application/json" multiple ref={input} className="sr-only" onChange={handleImport} aria-label="Import Lighthouse JSON reports"/></div></div>
        <div className="context-strip"><Icon name="info" size={17}/><span><strong>Local-first analysis.</strong> No API key, no server uploads. {reports.some(r => r.source === 'sample') ? 'The included demo reports are synthetic examples — import your own JSON for real measurements.' : 'All audits shown are user-imported Lighthouse lab reports.'}</span></div>

        {screen === 'overview' ? <>
          {reports.length === 0 || !current ? <section className="panel empty-state"><Icon name="upload" size={35}/><h2>No audits yet</h2><p>Import exported Lighthouse JSON reports to start analysing your frontend performance.</p><button className="button button-primary" onClick={() => input.current?.click()}>Import JSON</button><button className="text-button" onClick={handleReset}>Or load the sample reports</button></section> : <>
            <section className="compare-bar"><div className="compare-label"><Icon name="code"/><div><strong>Compare builds</strong><small>Choose your baseline and candidate</small></div></div><div className="compare-controls"><label>BASELINE<select value={baseline?.id ?? ''} onChange={e => setBaselineId(e.target.value)}>{ordered.map(r => <option key={r.id} value={r.id}>{r.source === 'sample' ? 'DEMO · ' : ''}{formatDate(r.timestamp)} · {r.score}/100 · {shorten(r.url)}</option>)}</select></label><div className="compare-arrow">→</div><label>CANDIDATE<select value={current.id} onChange={e => setCurrentId(e.target.value)}>{ordered.map(r => <option key={r.id} value={r.id}>{r.source === 'sample' ? 'DEMO · ' : ''}{formatDate(r.timestamp)} · {r.score}/100 · {shorten(r.url)}</option>)}</select></label></div></section>
            {(!compared || mismatched || samplesPresent) && <div className="notice-row">
              {!compared ? <span><Icon name="alert" size={15}/> Select two different reports to compare.</span> : mismatched ? <span><Icon name="alert" size={15}/> Reports target different URLs or device types. Comparisons may be misleading.</span> : null}
              {samplesPresent && <span><Icon name="info" size={15}/> Sample data is illustrative; import two audits of the same URL/device for meaningful results.</span>}
            </div>}
            <section className="stats-grid">
              <div className="panel score-panel"><div className="panel-header"><span className="panel-kicker">CURRENT PERFORMANCE</span><Icon name="pulse" size={18}/></div><div className="score-panel-main"><ScoreRing score={current.score}/><div className="score-summary"><span className="score-name">Lighthouse score</span><strong>{current.score >= 90 ? 'Looking good' : current.score >= 50 ? 'Needs attention' : 'Needs improvement'}</strong><span className={`delta ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'muted'}`}><Icon name={diff >= 0 ? 'arrowUp' : 'arrowDown'} size={15}/>{compared ? `${diff > 0 ? '+' : ''}${diff} pts vs. baseline` : 'Choose a baseline'}</span></div></div><div className="score-meta"><Icon name={current.device === 'desktop' ? 'monitor' : 'phone'} size={16}/>{current.device} audit<span className="divider-dot">·</span>{shorten(current.url)}</div></div>
              <div className="panel top-stat"><div className="panel-header"><span className="panel-kicker">BUDGET CHECKS</span><Icon name="target" size={18}/></div><div className="stat-main"><strong>{5 - warnings.length}<span>/ 5</span></strong><Badge variant={warnings.length === 0 ? 'success' : 'warning'}>{warnings.length ? `${warnings.length} failing` : 'All passing'}</Badge></div><p>Checks passed for current score and four lab metrics.</p><button className="inline-link" onClick={openSettings}>Edit budgets <span>↗</span></button></div>
              <div className="panel top-stat"><div className="panel-header"><span className="panel-kicker">REGRESSION SIGNALS</span><Icon name="chart" size={18}/></div><div className="stat-main"><strong>{compared ? regressionTotal : '—'}</strong><Badge variant={!compared ? 'neutral' : regressionTotal ? 'danger' : 'success'}>{!compared ? 'Not compared' : regressionTotal ? 'Review needed' : 'Stable / improved'}</Badge></div><p>Score drops and significant metric slowdowns compared with baseline.</p><span className="stat-caption">Checks tolerate small measurement noise.</span></div>
            </section>

            <div className="section-heading"><div><h2>Core performance metrics</h2><p>Measured in the Lighthouse test environment (lab data).</p></div><Badge variant="info">Candidate audit</Badge></div>
            <section className="metrics-grid">{metricKeys.map(key => {
              const value = current.metrics[key];
              const status = metricStatus(key, value, budgets);
              const before = compared ? baseline.metrics[key] : null;
              const delta = compared && value !== null && before !== null ? value - before : null;
              return <div className="panel metric-panel" key={key}><div className="metric-top"><span>{METRIC_INFO[key].short}</span><span className={`metric-chip ${status}`}>{status === 'pass' ? 'Within budget' : status === 'fail' ? 'Over budget' : 'No data'}</span></div><strong className="metric-value">{displayMetric(key, value)}</strong><span className="metric-full-name">{METRIC_INFO[key].label}</span><div className="metric-bottom"><span className="metric-target">Target {displayMetric(key, budgets[key])}</span><span className={`metric-diff ${delta === null ? 'muted' : delta > 0 ? 'negative' : delta < 0 ? 'positive' : 'muted'}`}>{delta === null ? 'No comparison' : metricDelta(key, before, value)}</span></div></div>;
            })}</section>

            <div className="bottom-grid">
              <section className="panel trend-panel"><div className="card-heading"><div><h2>Performance trend</h2><p>Score history across your saved audits</p></div><Badge variant="neutral">{reports.length} audits</Badge></div><Sparkline reports={reports} selectedId={current.id}/><div className="chart-legend"><span className="legend-dot"/> Lighthouse performance score <span className="chart-note">Higher is better</span></div></section>
              <section className="panel opportunities-panel"><div className="card-heading"><div><h2>Top opportunities</h2><p>Estimated savings from Lighthouse</p></div><Icon name="sparkles"/></div>{current.opportunities.length ? <div className="opportunities-list">{current.opportunities.slice(0, 4).map((op, i) => <div className="opportunity-row" key={op.id}><span className="op-index">{String(i + 1).padStart(2, '0')}</span><div><strong>{op.title}</strong><small>{op.savingsMs !== null ? `≈ ${Math.round(op.savingsMs)} ms potential savings` : op.savingsBytes !== null ? `≈ ${Math.round(op.savingsBytes / 1024)} KB potential savings` : 'Opportunity'}</small></div><Icon name="chevron" size={17}/></div>)}</div> : <div className="none-found"><Icon name="check"/><strong>No savings-based opportunities found.</strong><span>Check the full Lighthouse report for detailed findings.</span></div>}</section>
            </div>
            <section className="tip-strip"><div className="tip-icon"><Icon name="info"/></div><div><strong>Know your metrics.</strong><span>Lighthouse reports provide simulated lab data. TBT is not the same as real-user INP. Audit results can vary between runs; compare under similar conditions.</span></div><a href="https://developer.chrome.com/docs/lighthouse/overview" target="_blank" rel="noopener noreferrer">Lighthouse docs <Icon name="external" size={14}/></a></section>
          </>}
        </> : <>
          <section className="panel history-panel"><div className="history-title"><div><h2>Saved audit reports</h2><p>Your reports are stored only in this browser. Import multiple JSON files at once.</p></div><input className="search-input" type="search" placeholder="Filter by URL or device..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Filter audit reports"/></div><div className="table-scroller"><table className="history-table"><thead><tr><th>PAGE / SOURCE</th><th>DATE</th><th>DEVICE</th><th>SCORE</th><th>STATUS</th><th>OPERATIONS</th></tr></thead><tbody>{filtered.map(r => <tr key={r.id}><td><div className="url-cell"><div className="url-icon"><Icon name="code" size={17}/></div><div><strong title={r.url}>{shorten(r.url)}</strong><span>{r.source === 'sample' ? 'Synthetic sample report' : 'Imported Lighthouse JSON'}</span></div></div></td><td>{formatTime(r.timestamp)}</td><td><span className="device-cell"><Icon name={r.device === 'desktop' ? 'monitor' : 'phone'} size={15}/>{r.device}</span></td><td><span className={`table-score ${r.score >= 90 ? 'great' : r.score >= 50 ? 'okay' : 'poor'}`}>{r.score}</span></td><td><Badge variant={r.source === 'sample' ? 'warning' : 'info'}>{r.source === 'sample' ? 'Demo' : 'Real import'}</Badge></td><td><div className="table-actions"><button onClick={() => { setCurrentId(r.id); setScreen('overview'); }} title="View in dashboard" aria-label={`View ${shorten(r.url)}`}><Icon name="chart" size={17}/></button><button onClick={() => handleDelete(r.id)} title="Delete report" aria-label={`Delete ${shorten(r.url)}`}><Icon name="trash" size={17}/></button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-history">No matching audits found.</div>}</div><div className="history-footer"><span>{filtered.length} shown · {reports.length} saved</span><button className="text-button" onClick={handleReset}><Icon name="refresh" size={15}/> Restore sample data</button></div></section>
        </>}
        <footer className="footer"><span>PerfLens / Built for thoughtful frontend engineering</span><span>Open source · Local storage · Lighthouse JSON</span></footer>
      </div>
    </main>

    {settingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title"><div className="modal-top"><div className="modal-icon"><Icon name="target"/></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><Icon name="x"/></button></div><h2 id="budget-modal-title">Performance budgets</h2><p>Define acceptable thresholds for the candidate audit. Budget values are stored in this browser.</p><div className="budget-form"><label>Minimum Lighthouse score <span>out of 100</span><input type="number" min="0" max="100" step="1" value={settingsDraft.score} onChange={e => setSettingsDraft(s => ({ ...s, score: Number(e.target.value) }))}/></label>{metricKeys.map(key => <label key={key}>Maximum {METRIC_INFO[key].short} <span>{key === 'cls' ? 'unitless' : 'milliseconds'}</span><input type="number" min="0" step={key === 'cls' ? '.01' : '50'} value={settingsDraft[key]} onChange={e => setSettingsDraft(s => ({ ...s, [key]: Number(e.target.value) }))}/></label>)}</div><div className="modal-actions"><button className="button button-ghost" onClick={() => setSettingsDraft(DEFAULT_BUDGETS)}>Restore defaults</button><button className="button button-primary" onClick={saveSettings}>Save budgets</button></div></div></div>}
    {toast && <div className="toast" role="status"><Icon name="info" size={16}/>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="x" size={15}/></button></div>}
  </div>;
}
