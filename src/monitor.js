const fs = require('fs');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const config = require('./config');

function slugifyUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function ensureDirs() {
  for (const dir of [config.paths.screenshotsDir, config.paths.reportsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function collectWebVitals(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const vitals = {
        lcp: null,
        cls: 0,
        fid: null,
        ttfb: null,
        loadTime: null,
        domContentLoaded: null,
      };
      let settled = 0;
      const TOTAL_OBSERVERS = 3;

      const addNavMetrics = () => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
          vitals.ttfb = nav.responseStart;
          vitals.loadTime = nav.loadEventEnd;
          vitals.domContentLoaded = nav.domContentLoadedEventEnd;
        }
      };
      const finish = () => {
        settled += 1;
        if (settled === TOTAL_OBSERVERS) {
          addNavMetrics();
          resolve(vitals);
        }
      };

      const safety = setTimeout(() => {
        addNavMetrics();
        resolve(vitals);
      }, 3000);

      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) vitals.lcp = entries[entries.length - 1].startTime;
          finish();
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) vitals.cls += entry.value;
          }
          finish();
        }).observe({ type: 'layout-shift', buffered: true });

        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) {
            vitals.fid = entries[0].processingStart - entries[0].startTime;
          }
          finish();
        }).observe({ type: 'first-input', buffered: true });
      } catch (err) {
        console.warn(`  Warning: ${err.message}`);
        clearTimeout(safety);
        addNavMetrics();
        resolve(vitals);
      }
    });
  });
}

async function runAxeAudit(page) {
  let builder = new AxeBuilder({ page }).withTags(config.axe.tags);
  if (config.axe.disabledRules.length) {
    builder = builder.disableRules(config.axe.disabledRules);
  }
  const results = await builder.analyze();

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
      html: n.html.slice(0, 200),
      failureSummary: n.failureSummary,
    })),
  }));
}

async function main() {
  console.log('Web Accessibility & Performance Monitor');
  console.log(`Strict mode: ${config.behavior.strict ? 'ON' : 'off'}\n`);

  ensureDirs();
  const browser = await chromium.launch({ headless: config.behavior.headless });
  const allResults = [];
  let hasSeriousViolations = false;

  try {
    for (const target of config.targets) {
      const { url, name } = target;
      console.log(`\nAuditing: ${name} - ${url}`);
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

      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(url, {
          waitUntil: config.behavior.waitUntil,
          timeout: config.behavior.navigationTimeoutMs,
        });
        await page.waitForTimeout(config.behavior.settleDelayMs);

        pageResult.vitals = await collectWebVitals(page);
        const v = pageResult.vitals;
        console.log(
          `LCP: ${v.lcp ? Math.round(v.lcp) + 'ms' : 'n/a'} | ` +
            `CLS: ${v.cls.toFixed(3)} | ` +
            `FID: ${v.fid !== null ? Math.round(v.fid) + 'ms' : 'no input'} | ` +
            `TTFB: ${v.ttfb ? Math.round(v.ttfb) + 'ms' : 'n/a'}`
        );

        pageResult.violations = await runAxeAudit(page);
        const full = await new AxeBuilder({ page }).withTags(config.axe.tags).analyze();
        pageResult.passes = full.passes.length;
        const serious = pageResult.violations.filter((x) =>
          ['critical', 'serious'].includes(x.impact)
        );
        if (serious.length) hasSeriousViolations = true;
        console.log(
          `Violations: ${pageResult.violations.length} (${serious.length} serious/critical)`
        );

        const slug = slugifyUrl(url);
        for (const [label, vp] of Object.entries(config.viewports)) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(500);
          const file = `${slug}_${label}.png`;
          await page.screenshot({
            path: `${config.paths.screenshotsDir}/${file}`,
            fullPage: true,
          });
          pageResult.screenshots[label] = `screenshots/${file}`;
          console.log(`Screenshot ${label} (${vp.width}px) -> ${file}`);
        }
      } catch (err) {
        pageResult.error = err.message.split('\n')[0];
        console.error(`Error: ${pageResult.error}`);
      } finally {
        await context.close().catch(() => {});
      }

      allResults.push(pageResult);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const output = {
    runAt: new Date().toISOString(),
    strictMode: config.behavior.strict,
    thresholds: config.thresholds,
    summary: buildSummary(allResults),
    pages: allResults,
  };
  fs.writeFileSync(config.paths.dataFile, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to ${config.paths.dataFile}`);
  console.log('Next step: node src/report-generator.js\n');

  if (config.behavior.strict && hasSeriousViolations) {
    console.error('STRICT mode: serious/critical accessibility violations found. Failing.');
    process.exit(1);
  }
}

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
      (sum, p) =>
        sum + p.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).length,
      0
    ),
    avgLcp: Math.round(avg(lcpVals) || 0),
    avgCls: Number((avg(scored.map((p) => p.vitals?.cls ?? 0)) || 0).toFixed(3)),
    avgFid: Math.round(avg(fidVals) || 0),
  };
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
