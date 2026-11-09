import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLighthouse, budgetViolations, regressionCount, metricDelta,
  DEFAULT_BUDGETS, buildMarkdown, displayMetric,
} from '../lib/analysis.ts';

const lighthouse = {
  finalDisplayedUrl: 'https://example.org/products?campaign=123',
  fetchTime: '2026-10-15T10:00:00.000Z',
  configSettings: { formFactor: 'desktop' },
  categories: { performance: { score: 0.86 } },
  audits: {
    'largest-contentful-paint': { numericValue: 2200 },
    'first-contentful-paint': { numericValue: 1100 },
    'total-blocking-time': { numericValue: 290 },
    'cumulative-layout-shift': { numericValue: 0.07 },
    'unused-javascript': { title: 'Reduce unused JavaScript', description: 'JavaScript can be deferred.', details: { overallSavingsMs: 560, overallSavingsBytes: 40000 } },
    'something-else': { title: 'Unscored audit', score: null },
  },
};

test('parses real Lighthouse-shaped JSON into concise dashboard data', () => {
  const result = parseLighthouse(lighthouse);
  assert.equal(result.score, 86);
  assert.equal(result.url, 'https://example.org/products');
  assert.equal(result.device, 'desktop');
  assert.equal(result.metrics.lcp, 2200);
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].savingsMs, 560);
  assert.equal(result.source, 'imported');
});

test('rejects ordinary JSON and malformed or absent performance scores', () => {
  assert.throws(() => parseLighthouse({ hello: 'world' }), /not a valid Lighthouse/);
  assert.throws(() => parseLighthouse({ ...lighthouse, categories: { performance: { score: null } } }), /performance score/);
});

test('preserves missing metrics as unknown, not falsely as zero', () => {
  const result = parseLighthouse({ ...lighthouse, audits: { 'first-contentful-paint': { numericValue: 1000 } } });
  assert.equal(result.metrics.cls, null);
  assert.equal(displayMetric('cls', result.metrics.cls), 'N/A');
});

test('flags budget failures without mixing lab and real-user measurements', () => {
  const report = parseLighthouse(lighthouse);
  const violations = budgetViolations(report, DEFAULT_BUDGETS);
  assert.equal(violations.length, 2);
  assert.ok(violations.some(v => v.includes('Performance score')));
  assert.ok(violations.some(v => v.includes('TBT')));
});

test('compares before/after reports and exports readable markdown', () => {
  const before = parseLighthouse({ ...lighthouse, categories: { performance: { score: 0.68 } }, audits: {
    ...lighthouse.audits,
    'largest-contentful-paint': { numericValue: 3900 },
    'total-blocking-time': { numericValue: 500 },
  } });
  const after = parseLighthouse(lighthouse);
  assert.equal(regressionCount(before, after), 0);
  assert.equal(metricDelta('lcp', before.metrics.lcp, after.metrics.lcp), '−1.70 s');
  const markdown = buildMarkdown(before, after, DEFAULT_BUDGETS);
  assert.ok(markdown.includes('## Lab metrics'));
  assert.ok(markdown.includes('86'));
});

test('flags a deteriorating score and one metric as regressions', () => {
  const before = parseLighthouse(lighthouse);
  const after = parseLighthouse({
    ...lighthouse,
    categories: { performance: { score: 0.75 } },
    audits: { ...lighthouse.audits, 'total-blocking-time': { numericValue: 400 } },
  });
  assert.equal(regressionCount(before, after), 2);
});

test('synthetic fixture imports remain labelled as sample', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../samples/sample-lighthouse-after.json');
  const report = parseLighthouse(JSON.parse(await readFile(path, 'utf8')));
  assert.equal(report.source, 'sample');
  assert.equal(report.score, 91);
});
