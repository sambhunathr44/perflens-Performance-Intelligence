# PerfLens — Frontend Performance Intelligence

A local-first, developer-focused dashboard for **comparing Lighthouse lab audits**, identifying performance regressions, enforcing performance budgets, and exporting shareable engineering summaries.

Built with **Next.js App Router, React, TypeScript**, and hand-written responsive CSS. No API keys, accounts, databases, or paid services are required to run the initial version.

> **Portfolio MVP (v1):** The dashboard is fully intended to work with actual user-imported Lighthouse JSON exports. It does not run Lighthouse automatically, collect real-user analytics, or measure INP. Included demo data is synthetic and clearly labelled. Imported JSON remains in the browser (`localStorage`).

## What it does

- **Compare two audits:** pick a baseline and candidate, and inspect the performance score delta, LCP, FCP, TBT, and CLS.
- **Catch regressions:** flag a lower overall Lighthouse score and significant increases in individual lab metrics.
- **Set performance budgets:** change thresholds for score and metrics; inspect pass/fail states.
- **Import actual Lighthouse JSON:** support multiple files and estimated improvement opportunities.
- **See audit history:** review, search, delete, and compare saved audits.
- **Export a Markdown report:** share a before/after comparison in pull requests or release notes.
- **Use it on mobile:** the interface adapts to smaller screens.
- **Keep audits private:** all state is local to the browser; no audit JSON is uploaded to a server.

## Requirements

- Node.js **22 or newer**
- npm
- A modern browser

## Run locally

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

To run unit tests:

```bash
npm test
```

To check TypeScript and produce a production build:

```bash
npm run typecheck
npm run build
npm run start
```

`npm run start` starts the production build at http://localhost:3000. Stop `npm run dev` first if it is still running.

### Live Demo

[Try PerfLens](https://perflens-performance-intelligence.vercel.app/)

### Source Code

[GitHub Repository](https://github.com/sambhunathr44/perflens-Performance-Intelligence)

## Try the demo

The app initially loads two **synthetic demo audits** of the same page: before optimisation (62/100) and after optimisation (92/100). Try the comparison selectors and update budget settings. These numbers are fabricated _to illustrate the application_; they are **not** results from an actual website.

You can also use the two illustrative files in `samples/` to exercise the importer. Their `lighthouseVersion` is explicitly `sample-only`, so the app labels them as samples.

## Import a genuine Lighthouse report

1. Open your own website in Chrome.
2. Open **DevTools → Lighthouse**.
3. Select the same device type for each test, and run the first audit.
4. Export the Lighthouse report **as JSON**, not HTML.
5. Make a change to the website, repeat the audit under comparable conditions, and export the second JSON.
6. In PerfLens, click **Import Lighthouse JSON** and select both files.
7. Pick the baseline and candidate, check the score/metric changes, tune the budgets, and export a Markdown comparison.

Lighthouse JSON is expected to have `categories.performance.score` and `audits.*.numericValue`, as described in the [Lighthouse results reference](https://github.com/GoogleChrome/lighthouse/blob/main/docs/understanding-results.md). Input JSON is validated and reduced into the app's domain model.

**Important measurement notes:** Lighthouse reports represent _lab_ measurements; they are not field data collected from actual users. TBT is a lab proxy for main-thread blocking and is not a replacement for real-user INP. Some Lighthouse versions may omit metrics; PerfLens displays `N/A` in those cases. Try multiple runs to account for run-to-run variability. Compare the same URL and device type for meaningful conclusions.

## Application architecture

```text
Lighthouse JSON file
        │
        ▼
lib/analysis.ts (validate + normalise)
        │
        ├── Lighthouse score and lab metrics
        ├── estimated savings opportunities
        └── metadata (URL, date, device)
        │
        ▼
components/Dashboard.tsx (React state)
        │
        ├── comparison + score history visualisation
        ├── configurable performance budgets
        ├── regressions and opportunities
        └── Markdown export
        │
        ▼
lib/storage.ts (browser localStorage)
```

### Project structure

```text
app/              Next.js App Router layout and page, global styles
components/       Dashboard UI and reusable SVG icon component
lib/analysis.ts   Pure parsing, comparison, metrics, and Markdown helpers
lib/demo.ts       Explicitly synthetic demo audit data
lib/storage.ts    Browser persistence layer
tests/            Node.js unit tests for core logic
samples/          Synthetic Lighthouse-shaped input JSON files
docs/             Portfolio and interview notes
.github/workflows/verify.yml  Automated test + type check + build
```

## Limitations and roadmap

This MVP is **not** a replacement for Lighthouse, CrUX, or an observability system.

Potential v2 improvements:

- Lighthouse CI integration with GitHub Actions to generate and compare real reports per pull request.
- Backend & PostgreSQL for cross-device history and team-level accounts.
- Per-URL baselines and route-level budgets.
- Statistical comparisons across repeated runs.
- CI status checks for failed budgets.
- Field data integration (CrUX / RUM), clearly separated from lab data.
- End-to-end browser tests and accessibility audits.

## Author / usage

This is a starter project for hands-on development and portfolio learning. Review and understand the implementation, make meaningful improvements, and publish only after testing it yourself.

## Application Preview

### Performance Dashboard

![PerfLens Performance Dashboard](./public/screenshots/dashboard.png)

### Lighthouse Performance Comparison

![Lighthouse Report Comparison](./public/screenshots/comparison.png)

### Responsive Mobile Interface

![PerfLens Mobile View](./public/screenshots/mobile.png)
