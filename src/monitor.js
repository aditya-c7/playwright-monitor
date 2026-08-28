/**
 * ============================================
 *  Core Monitoring Script
 * ============================================
 *
 *  For every target URL this script:
 *    1. Loads the page in headless Chromium.
 *    2. Runs an axe-core accessibility audit (@axe-core/playwright).
 *    3. Captures Core Web Vitals (LCP, CLS, FID) + navigation metrics
 *       using the browser's Performance API.
 *    4. Takes screenshots at 3 viewports (mobile / tablet / desktop).
 *    5. Saves everything to results/results.json for the report generator.
 *
 *  Run it with:   node src/monitor.js
 *  Strict mode:   STRICT=true node src/monitor.js   (exit 1 on serious issues)
 */

const fs = require('fs');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const config = require('./config');

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

/** Make a URL filesystem-safe, e.g. "https://a.dev/about" -> "a-dev-about" */
function slugifyUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Ensure output folders exist */
function ensureDirs() {
  for (const dir of [config.paths.screenshotsDir, config.paths.reportsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/* ------------------------------------------------------------------ */
/*  Core Web Vitals extraction (runs inside the browser)               */
/* ------------------------------------------------------------------ */

/**
 * Injected into the page. Uses PerformanceObserver with `buffered: true`
 * so we get entries recorded BEFORE the observer was created — that's how
 * you capture LCP/CLS/FID reliably after the page has loaded.
 */
async function collectWebVitals(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const vitals = {
        lcp: null, cls: 0, fid: null, ttfb: null, loadTime: null, domContentLoaded: null,
      };
      let settled = 0;
      const TOTAL_OBSERVERS = 3;

      // Read Navigation Timing metrics and resolve
      const addNavMetrics = () => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
          vitals.ttfb = nav.responseStart;    // Time to first byte (ms)
          vitals.loadTime = nav.loadEventEnd; // Full load (ms)
          vitals.domContentLoaded = nav.domContentLoadedEventEnd;
        }
      };
      const finish = () => {
        settled += 1;
        if (settled === TOTAL_OBSERVERS) { addNavMetrics(); resolve(vitals); }
      };

      // Guard against a hung observer — always resolve after 3s max
      const safety = setTimeout(() => { addNavMetrics(); resolve(vitals); }, 3000);

      try {
        // --- LCP: Largest Contentful Paint (take the LAST entry) ---
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) vitals.lcp = entries[entries.length - 1].startTime;
          finish();
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // --- CLS: Cumulative Layout Shift (sum of all shifts) ---
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // Ignore shifts within 500ms of user input (per spec)
            if (!entry.hadRecentInput) vitals.cls += entry.value;
          }
          finish();
        }).observe({ type: 'layout-shift', buffered: true });

        // --- FID: First Input Delay ---
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) {
            vitals.fid = entries[0].processingStart - entries[0].startTime;
          }
          finish();
        }).observe({ type: 'first-input', buffered: true });
      } catch (err) {
        // A very old browser may not support some entry types — don't crash
        console.warn(`  ⚠ PerformanceObserver warning: ${err.message}`);
        clearTimeout(safety);
        addNavMetrics();
        resolve(vitals);
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Accessibility audit                                                */
/* ------------------------------------------------------------------ */

async function runAxeAudit(page) {
  let builder = new AxeBuilder({ page }).withTags(config.axe.tags);
  if (config.axe.disabledRules.length) {
    builder = builder.disableRules(config.axe.disabledRules);
  }
  const results = await builder.analyze();

  // Keep the report lean: only actual violations, with affected nodes
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact || 'minor',
    title: v.help,
    description: v.description,
    helpUrl: v.helpUrl,
    tags: v.tags,
    nodeCount: v.nodes.length,
    nodes: v.nodes.slice(0, 5).map((n) => ({
      target: n.target.join(' '),
      html: n.html.slice(0, 200), // Truncate long snippets
      failureSummary: n.failureSummary,
    })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Main monitor routine                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('🚀 Web Accessibility & Performance Monitor');
  console.log(`   Strict mode: ${config.behavior.strict ? 'ON' : 'off'}\n`);

  ensureDirs();
  const browser = await chromium.launch({ headless: config.behavior.headless });
  const allResults = [];
  let hasSeriousViolations = false;

  try {
    for (const target of config.targets) {
      const { url, name } = target;
      console.log(`\n📄 Auditing: ${name} — ${url}`);
      const pageResult = {
        name,
        url,
        scannedAt: new Date().toISOString(),
        screenshots: {},
        vitals: null,
        violations: [],
        passes: 0,
        error: null,
      };

      // A fresh context per page = clean cache & storage, fair comparison
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // ---------- 1. Navigate ----------
        await page.goto(url, {
          waitUntil: config.behavior.waitUntil,
          timeout: config.behavior.navigationTimeoutMs,
        });
        await page.waitForTimeout(config.behavior.settleDelayMs);

        // ---------- 2. Core Web Vitals ----------
        pageResult.vitals = await collectWebVitals(page);
        const v = pageResult.vitals;
        console.log(
          `   ⚡ LCP: ${v.lcp ? Math.round(v.lcp) + 'ms' : 'n/a'} | ` +
          `CLS: ${v.cls.toFixed(3)} | ` +
          `FID: ${v.fid !== null ? Math.round(v.fid) + 'ms' : 'no input'} | ` +
          `TTFB: ${v.ttfb ? Math.round(v.ttfb) + 'ms' : 'n/a'}`
        );

        // ---------- 3. Accessibility audit ----------
        pageResult.violations = await runAxeAudit(page);
        // Count successful checks too (nice context in the report)
        const full = await new AxeBuilder({ page }).withTags(config.axe.tags).analyze();
        pageResult.passes = full.passes.length;
        const serious = pageResult.violations.filter((x) =>
          ['critical', 'serious'].includes(x.impact)
        );
        if (serious.length) hasSeriousViolations = true;
        console.log(`   ♿ Violations: ${pageResult.violations.length} (${serious.length} serious/critical)`);

        // ---------- 4. Screenshots at all 3 viewports ----------
        const slug = slugifyUrl(url);
        for (const [label, vp] of Object.entries(config.viewports)) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(500); // Let responsive layout re-render
          const file = `${slug}_${label}.png`;
          await page.screenshot({
            path: `${config.paths.screenshotsDir}/${file}`,
            fullPage: true,
          });
          pageResult.screenshots[label] = `screenshots/${file}`;
          console.log(`   📸 ${label} (${vp.width}px) -> ${file}`);
        }
      } catch (err) {
        // One bad URL must never abort the whole run
        pageResult.error = err.message.split('\n')[0];
        console.error(`   ❌ Error: ${pageResult.error}`);
      } finally {
        await context.close().catch(() => {});
      }

      allResults.push(pageResult);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // ---------- 5. Save results ----------
  const output = {
    runAt: new Date().toISOString(),
    strictMode: config.behavior.strict,
    thresholds: config.thresholds,
    summary: buildSummary(allResults),
    pages: allResults,
  };
  fs.writeFileSync(config.paths.dataFile, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${config.paths.dataFile}`);
  console.log('   Next step: node src/report-generator.js\n');

  // ---------- 6. Optional strict exit (used by GitHub Actions) ----------
  if (config.behavior.strict && hasSeriousViolations) {
    console.error('🛑 STRICT mode: serious/critical accessibility violations found — failing.');
    process.exit(1);
  }
}

/** Aggregate numbers for the report's summary cards */
function buildSummary(pages) {
  const scored = pages.filter((p) => !p.error);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const lcpVals = scored.map((p) => p.vitals?.lcp).filter((x) => x !== null && x !== undefined);
  const fidVals = scored.map((p) => p.vitals?.fid).filter((x) => x !== null && x !== undefined);
  return {
    totalPages: pages.length,
    failedPages: pages.filter((p) => p.error).length,
    totalViolations: scored.reduce((sum, p) => sum + p.violations.length, 0),
    criticalOrSerious: scored.reduce(
      (sum, p) => sum + p.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).length,
      0
    ),
    avgLcp: Math.round(avg(lcpVals) || 0),
    avgCls: Number((avg(scored.map((p) => p.vitals?.cls ?? 0)) || 0).toFixed(3)),
    avgFid: Math.round(avg(fidVals) || 0),
  };
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
