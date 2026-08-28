# Web Accessibility & Performance Monitor
## ^ MIT Licence 

Automated daily audits of your website(s) using **Playwright**, **axe-core**, and the
**Performance API** â€” with a beautiful HTML report and GitHub Actions automation.


## Features

- **Accessibility audits** with axe-core: rule, impact severity, affected elements, and "how to fix" links
- **Core Web Vitals** captured via `PerformanceObserver` (buffered entries) + Navigation Timing
- **3-viewport screenshot gallery** (mobile 375px, tablet 768px, desktop 1440px)
- **Zero-dependency HTML report** â€” self-contained, works offline
- **Strict mode** (`STRICT=true`) â€” exits non-zero when critical/serious violations exist
- **Daily GitHub Actions workflow** that commits fresh results back to the repo
- **Error-resilient** â€” one unreachable page never aborts the whole run


## npm Scripts

| Script | What it does |
|---|---|
| `npm run monitor` | Audit all pages + generate the HTML report |
| `npm run report` | Re-render the report from existing `results.json` |
| `npm run monitor:strict` | Same as monitor, but exits 1 on serious violations |

## Notes & Limitations

- **FID** requires real user interaction â€” in an automated run there are no clicks,
  so it's often `not measured`. (The industry has moved to **INP** for the same reason;
  both need field data. LCP + CLS + TTFB are fully lab-measurable.)
- Metrics are **lab data** (simulated, consistent network) â€” for real-user data use
  [PageSpeed Insights](https://pagespeed.web.dev) or Chrome UX Report.
- Screenshots use `fullPage: true`; disable in `monitor.js` if you only want above-the-fold.

