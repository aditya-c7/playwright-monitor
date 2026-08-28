# ðŸ” Web Accessibility & Performance Monitor

Automated daily audits of your website(s) using **Playwright**, **axe-core**, and the
**Performance API** â€” with a beautiful HTML report and GitHub Actions automation.

Every run checks each configured page for:

| Check | Tool | Output |
|---|---|---|
| â™¿ Accessibility (WCAG 2.x A/AA + best practices) | `@axe-core/playwright` | Violations with impact, affected nodes & fix links |
| âš¡ Core Web Vitals (LCP, CLS, FID, TTFB) | Performance API | Values with PASS/FAIL vs Google thresholds |
| ðŸ“¸ Responsive screenshots | Playwright | Full-page captures at 375 / 768 / 1440 px |

Results are written to `results/` and rendered into `results/reports/report.html`.

---

## âœ¨ Features

- **Accessibility audits** with axe-core: rule, impact severity, affected elements, and "how to fix" links
- **Core Web Vitals** captured via `PerformanceObserver` (buffered entries) + Navigation Timing
- **3-viewport screenshot gallery** (mobile 375px, tablet 768px, desktop 1440px)
- **Zero-dependency HTML report** â€” self-contained, works offline
- **Strict mode** (`STRICT=true`) â€” exits non-zero when critical/serious violations exist
- **Daily GitHub Actions workflow** that commits fresh results back to the repo
- **Error-resilient** â€” one unreachable page never aborts the whole run

## ðŸ“ Project Structure

```
portfolio-monitor/
â”œâ”€â”€ .github/
â”‚   â””â”€â”€ workflows/
â”‚       â””â”€â”€ monitor.yml          # Daily cron workflow
â”œâ”€â”€ results/
â”‚   â”œâ”€â”€ screenshots/             # 3 screenshots per page (committed)
â”‚   â”œâ”€â”€ reports/
â”‚   â”‚   â””â”€â”€ report.html          # Generated HTML report (committed)
â”‚   â””â”€â”€ results.json             # Raw metrics data (committed)
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ config.js                # ðŸ‘ˆ URLs, viewports, thresholds â€” EDIT ME
â”‚   â”œâ”€â”€ monitor.js               # Browser automation + audits
â”‚   â””â”€â”€ report-generator.js      # JSON -> HTML report
â”œâ”€â”€ playwright.config.js         # VS Code extension + optional tests
â”œâ”€â”€ package.json
â””â”€â”€ README.md
```

## ðŸš€ Setup (step by step)

### 1. Prerequisites
- **Node.js 18+** (`node -v` to check)
- **VS Code** with the **Playwright Test for VS Code** extension (`ms-playwright.playwright`)

### 2. Install dependencies

```bash
npm install            # installs playwright + @axe-core/playwright
npx playwright install chromium   # downloads the browser binary (one-time)
```

### 3. Configure your target site

Open **`src/config.js`** and edit the `targets` array:

```js
targets: [
  { url: 'https://your-portfolio.com', name: 'My Portfolio' },
  // Add as many pages as you like:
  { url: 'https://your-portfolio.com/projects', name: 'Projects' },
],
```

Adjust thresholds if you want stricter/looser pass-fail:

```js
thresholds: {
  lcp: 2500,  // ms â€” Google "good" is < 2.5s
  cls: 0.1,   //    â€” < 0.1
  fid: 100,   // ms â€” < 100ms
  ttfb: 800,  // ms â€” < 800ms
},
```

## ðŸƒ Run locally

```bash
# One command to do everything (audit + report):
node src/monitor.js && node src/report-generator.js
```

Or use the npm script:

```bash
npm run monitor
```

Then open the report:
- In VS Code: right-click `results/reports/report.html` â†’ **Open with Live Server**
- Or double-click the file in Explorer

**Watch it run** (headed mode): set `headless: false` in `src/config.js` â†’ `behavior`.

## ðŸ¤- Daily automation with GitHub Actions

1. Push this repo to GitHub:
   ```bash
   git add -A
   git commit -m "feat: accessibility & performance monitor"
   git remote add origin https://github.com/YOUR_USERNAME/portfolio-monitor.git
   git push -u origin main
   ```
2. That's it â€” `.github/workflows/monitor.yml` runs **daily at 9:00 AM IST**
   (`cron: '30 3 * * *'` = 03:30 UTC) and pushes fresh results to the repo.
3. Optional strict mode: add a repository **variable** `STRICT=true`
   (Settings â†’ Secrets and variables â†’ Actions â†’ Variables tab) and the workflow
   will **fail** whenever critical/serious violations appear.

## âš™ï¸ Debugging in VS Code

1. Set `headless: false` in `src/config.js` to watch the browser.
2. Add a `launch.json` (Run â†’ Add Configuration â†’ Node.js) with:
   ```json
   {
     "type": "node",
     "request": "launch",
     "name": "Run Monitor",
     "program": "${workspaceFolder}/src/monitor.js",
     "console": "integratedTerminal",
     "env": { "STRICT": "false" }
   }
   ```
3. Set breakpoints in `src/monitor.js`, press **F5**, and step through the audit.
4. The **Playwright Test for VS Code** extension also gives you a Test Explorer,
   Pick Locator, and live browser preview via `playwright.config.js`.

## ðŸ“¸ Sample Report

The generated report contains, per page:

- **Summary cards** â€” pages scanned, total violations, avg LCP/CLS/FID
- **Core Web Vitals table** â€” value vs target with green âœ… PASS / red âŒ FAIL badges
- **Violations table** â€” rule ID, impact chip (critical/serious/moderate/minor),
  number of affected nodes, and code snippets of each element
- **Screenshot gallery** â€” MOBILE / TABLET / DESKTOP full-page captures, clickable

*(Run once locally to see `results/reports/report.html` â€” that's your live sample.)*

## ðŸ“œ npm Scripts

| Script | What it does |
|---|---|
| `npm run monitor` | Audit all pages + generate the HTML report |
| `npm run report` | Re-render the report from existing `results.json` |
| `npm run monitor:strict` | Same as monitor, but exits 1 on serious violations |

## âš ï¸ Notes & Limitations

- **FID** requires real user interaction â€” in an automated run there are no clicks,
  so it's often `not measured`. (The industry has moved to **INP** for the same reason;
  both need field data. LCP + CLS + TTFB are fully lab-measurable.)
- Metrics are **lab data** (simulated, consistent network) â€” for real-user data use
  [PageSpeed Insights](https://pagespeed.web.dev) or Chrome UX Report.
- Screenshots use `fullPage: true`; disable in `monitor.js` if you only want above-the-fold.

## ðŸ“„ License

MIT
