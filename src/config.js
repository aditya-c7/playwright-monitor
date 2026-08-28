/**
 * ============================================
 *  Web Accessibility & Performance Monitor
 *  Central configuration file
 * ============================================
 *
 *  Edit this file to monitor YOUR websites.
 *  Everything the monitor does is driven from here.
 */


const path = require('path');


const config = {
  // ------------------------------------------------------------------
  // 1. TARGET PAGES
  //    Add or remove URLs here. Each entry is audited fully.
  // ------------------------------------------------------------------
  targets: [
    {
      // ✅ YOUR PORTFOLIO SITE
      url: 'https://adityahq.me',
      name: 'Aditya Home',
    },
    {
      url: 'https://github.com',
      name: 'GitHub',
    },
    {
      url: 'https://google.com',
      name: 'Google',
    },
  ],


  // ------------------------------------------------------------------
  // 2. VIEWPORTS (width x height) for responsive screenshots
  // ------------------------------------------------------------------
  viewports: {
    mobile: { width: 375, height: 812 }, // iPhone X class
    tablet: { width: 768, height: 1024 }, // iPad portrait
    desktop: { width: 1440, height: 900 }, // Common laptop/desktop
  },


  // ------------------------------------------------------------------
  // 3. CORE WEB VITALS THRESHOLDS (Google's published "good" scores)
  //    Values in milliseconds; CLS is unitless.
  //    Anything <= threshold = PASS, anything above = FAIL.
  // ------------------------------------------------------------------
  thresholds: {
    lcp: 2500, // Largest Contentful Paint  < 2.5s
    cls: 0.1,  // Cumulative Layout Shift   < 0.1
    fid: 100,  // First Input Delay         < 100ms
    ttfb: 800, // Time To First Byte        < 800ms (supporting metric)
  },


  // ------------------------------------------------------------------
  // 4. ACCESSIBILITY (axe-core) SETTINGS
  // ------------------------------------------------------------------
  axe: {
    // WCAG 2.x A/AA + AAA-level best practices. Trim tags to relax the audit.
    tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    // Rules to disable globally (add rule IDs here if you get false positives)
    disabledRules: [],
  },


  // ------------------------------------------------------------------
  // 5. BEHAVIOUR
  // ------------------------------------------------------------------
  behavior: {
    headless: true,           // false = watch the browser run (great for debugging)
    navigationTimeoutMs: 30000, // Page load timeout
    settleDelayMs: 2500,      // Wait after load so LCP/CLS observers settle
    waitUntil: 'load',        // Playwright navigation event ('load' | 'networkidle')
    // Fail the process (exit code 1) when critical/serious violations exist.
    // GitHub Actions sets this via the STRICT env var.
    strict: process.env.STRICT === 'true',
  },


  // ------------------------------------------------------------------
  // 6. OUTPUT LOCATIONS (relative to project root)
  // ------------------------------------------------------------------
  paths: {
    resultsDir: path.resolve(__dirname, '..', 'results'),
    screenshotsDir: path.resolve(__dirname, '..', 'results', 'screenshots'),
    reportsDir: path.resolve(__dirname, '..', 'results', 'reports'),
    dataFile: path.resolve(__dirname, '..', 'results', 'results.json'),
    reportFile: path.resolve(__dirname, '..', 'results', 'reports', 'report.html'),
  },
};


module.exports = config;