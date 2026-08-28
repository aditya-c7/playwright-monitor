const fs = require('fs');
const config = require('./config');

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function badge(pass) {
  return pass
    ? '<span class="badge pass">PASS</span>'
    : '<span class="badge fail">FAIL</span>';
}

function impactChip(impact) {
  const cls = { critical: 'critical', serious: 'serious', moderate: 'moderate', minor: 'minor' }[impact] || 'minor';
  return `<span class="chip ${cls}">${esc(impact)}</span>`;
}

function summaryCards(summary) {
  const cards = [
    ['Pages Scanned', summary.totalPages, `${summary.failedPages} failed`],
    ['A11y Violations', summary.totalViolations, `${summary.criticalOrSerious} serious/critical`],
    ['Avg LCP', summary.avgLcp ? `${summary.avgLcp} ms` : '-', summary.avgLcp <= config.thresholds.lcp ? 'good' : 'needs work'],
    ['Avg CLS', summary.avgCls, summary.avgCls <= config.thresholds.cls ? 'good' : 'needs work'],
    ['Avg FID', summary.avgFid ? `${summary.avgFid} ms` : '-', summary.avgFid <= config.thresholds.fid ? 'good' : 'needs work'],
  ];
  return cards
    .map(
      ([label, value, sub]) => `
      <div class="card">
        <div class="card-label">${esc(label)}</div>
        <div class="card-value">${esc(value)}</div>
        <div class="card-sub">${esc(sub)}</div>
      </div>`
    )
    .join('');
}

function vitalsTable(page, thresholds) {
  const v = page.vitals || {};
  const rows = [
    ['LCP - Largest Contentful Paint', v.lcp, thresholds.lcp, 'ms', 'Rendering speed of the biggest visible element'],
    ['CLS - Cumulative Layout Shift', v.cls !== undefined && v.cls !== null ? Number(v.cls.toFixed(3)) : null, thresholds.cls, '', 'Visual stability (0 is perfect)'],
    ['FID - First Input Delay', v.fid, thresholds.fid, 'ms', 'Responsiveness to first interaction'],
    ['TTFB - Time to First Byte', v.ttfb, thresholds.ttfb, 'ms', 'Server response speed'],
    ['Load Time', v.loadTime, null, 'ms', 'Full page load (informational)'],
  ];

  const body = rows
    .map(([label, value, limit, unit, note]) => {
      const measured = value !== null && value !== undefined;
      const pass = measured && limit !== null ? value <= limit : measured;
      const limitText = limit !== null ? `<= ${limit}${unit ? ` ${unit}` : ''}` : 'informational';
      return `
      <tr>
        <td><strong>${esc(label)}</strong><br><small class="muted">${esc(note)}</small></td>
        <td>${measured ? `${esc(value)}${unit ? ` ${unit}` : ''}` : '-'}</td>
        <td>${esc(limitText)}</td>
        <td>${measured ? badge(pass) : '<span class="muted">not measured</span>'}</td>
      </tr>`;
    })
    .join('');

  return `<table><thead><tr><th>Metric</th><th>Value</th><th>Target</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}

function a11yTable(page) {
  if (page.error) {
    return `<p class="error">This page could not be audited: ${esc(page.error)}</p>`;
  }
  if (!page.violations.length) {
    return `<p class="ok">No accessibility violations detected. ${page.passes} checks passed.</p>`;
  }

  const rows = page.violations
    .map(
      (v) => `
      <tr>
        <td>
          <strong>${esc(v.title)}</strong><br>
          <code class="rule">${esc(v.id)}</code><br>
          <small class="muted">${esc(v.description)}</small><br>
          <a href="${esc(v.helpUrl)}" target="_blank" rel="noopener">How to fix</a>
        </td>
        <td>${impactChip(v.impact)}</td>
        <td>${v.nodeCount}</td>
        <td>
          <ul class="nodes">
            ${v.nodes
              .map(
                (n) => `
              <li>
                <code>${esc(n.target)}</code>
                <pre>${esc(n.html)}</pre>
              </li>`
              )
              .join('')}
            ${v.nodeCount > v.nodes.length ? `<li class="muted">and ${v.nodeCount - v.nodes.length} more</li>` : ''}
          </ul>
        </td>
      </tr>`
    )
    .join('');

  return `<table class="a11y"><thead><tr><th>Rule</th><th>Impact</th><th>Nodes</th><th>Affected Elements</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function gallery(page) {
  const entries = Object.entries(page.screenshots || {});
  if (!entries.length) return '<p class="muted">No screenshots captured.</p>';
  return `
    <div class="gallery">
      ${entries
        .map(
          ([label, relPath]) => `
        <figure>
          <figcaption>${esc(label.toUpperCase())} ${esc(config.viewports[label]?.width ?? '')}px</figcaption>
          <a href="../${esc(relPath)}" target="_blank" rel="noopener">
            <img src="../${esc(relPath)}" alt="${esc(page.name)} ${esc(label)} viewport" loading="lazy">
          </a>
        </figure>`
        )
        .join('')}
    </div>`;
}

const REPORT_CSS = `
  :root {
    --bg: #f6f8fa; --card: #fff; --ink: #1f2328; --muted: #656d76;
    --green: #1a7f37; --red: #cf222e; --border: #d0d7de;
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         margin: 0; background: var(--bg); color: var(--ink); line-height: 1.55; }
  header { background: #0d1117; color: #fff; padding: 2rem 1.5rem; }
  header h1 { margin: 0 0 .25rem; font-size: 1.5rem; }
  header p { margin: 0; color: #8b949e; }
  main { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }

  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
           gap: 1rem; margin: 1.5rem 0; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
          padding: 1rem 1.25rem; }
  .card-label { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
  .card-value { font-size: 1.9rem; font-weight: 700; margin: .2rem 0; }
  .card-sub { font-size: .8rem; color: var(--muted); }

  section { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
            padding: 1.5rem; margin: 1.5rem 0; }
  h2 { margin-top: 0; } h3 { border-bottom: 1px solid var(--border); padding-bottom: .35rem; }
  hr { border: none; border-top: 1px dashed var(--border); margin: 2rem 0; }

  table { width: 100%; border-collapse: collapse; font-size: .92rem; }
  th, td { text-align: left; padding: .6rem .75rem; border-bottom: 1px solid var(--border);
           vertical-align: top; }
  th { background: #f6f8fa; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }

  .badge { display: inline-block; padding: .15rem .6rem; border-radius: 999px;
           font-size: .78rem; font-weight: 700; white-space: nowrap; }
  .badge.pass { background: #dafbe1; color: var(--green); }
  .badge.fail { background: #ffebe9; color: var(--red); }

  .chip { display: inline-block; padding: .12rem .55rem; border-radius: 6px;
          font-size: .75rem; font-weight: 700; text-transform: capitalize; }
  .chip.critical { background: #82071e; color: #fff; }
  .chip.serious  { background: #cf222e; color: #fff; }
  .chip.moderate { background: #bf8700; color: #fff; }
  .chip.minor    { background: #d0d7de; color: #1f2328; }

  .rule { background: #eff1f3; border-radius: 4px; padding: .05rem .35rem; font-size: .8rem; }
  .nodes { margin: 0; padding-left: 1rem; }
  .nodes li { margin-bottom: .5rem; }
  pre { background: #f6f8fa; border: 1px solid var(--border); border-radius: 6px;
        padding: .5rem; font-size: .75rem; overflow-x: auto; white-space: pre-wrap; }
  .muted { color: var(--muted); }
  .ok { color: var(--green); font-weight: 600; }
  .error { color: var(--red); font-weight: 600; }

  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
  figure { margin: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  figcaption { background: #f6f8fa; padding: .45rem .75rem; font-size: .78rem;
               font-weight: 700; letter-spacing: .05em; }
  img { width: 100%; height: 260px; object-fit: cover; object-position: top; display: block; }

  footer { text-align: center; color: var(--muted); font-size: .85rem; padding: 2rem 0 3rem; }
`;

function buildHtml(data) {
  const sections = data.pages
    .map(
      (page, i) => `
    <section id="page-${i}">
      <h2>${esc(page.name)}</h2>
      <p>
        <a href="${esc(page.url)}" target="_blank" rel="noopener">${esc(page.url)}</a>
        - scanned ${esc(new Date(page.scannedAt).toLocaleString())}
      </p>

      <h3>Core Web Vitals</h3>
      ${vitalsTable(page, data.thresholds)}

      <h3>Accessibility Violations</h3>
      ${a11yTable(page)}

      <h3>Screenshots</h3>
      ${gallery(page)}
    </section>`
    )
    .join('<hr>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Accessibility &amp; Performance Report - ${esc(new Date(data.runAt).toLocaleDateString())}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<header>
  <h1>Web Accessibility &amp; Performance Report</h1>
  <p>Generated ${esc(new Date(data.runAt).toLocaleString())} | axe-core + Playwright | Core Web Vitals</p>
</header>
<main>
  <div class="cards">${summaryCards(data.summary)}</div>
  ${sections}
</main>
<footer>
  Report by portfolio-monitor - thresholds: LCP &lt;= ${esc(data.thresholds.lcp)}ms, CLS &lt;= ${esc(data.thresholds.cls)}, FID &lt;= ${esc(data.thresholds.fid)}ms
</footer>
</body>
</html>`;
}

function generateReport() {
  if (!fs.existsSync(config.paths.dataFile)) {
    console.error('results/results.json not found. Run `node src/monitor.js` first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(config.paths.dataFile, 'utf-8'));
  fs.mkdirSync(config.paths.reportsDir, { recursive: true });
  fs.writeFileSync(config.paths.reportFile, buildHtml(data));

  console.log(`Report generated: ${config.paths.reportFile}`);
  console.log('Open it with VS Code Live Server, or double-click the file.');
}

if (require.main === module) generateReport();
module.exports = { generateReport, buildHtml };
