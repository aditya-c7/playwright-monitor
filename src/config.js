const path = require('path');

const config = {
  targets: [
    {
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

  viewports: {
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1440, height: 900 },
  },

  thresholds: {
    lcp: 2500,
    cls: 0.1,
    fid: 100,
    ttfb: 800,
  },

  axe: {
    tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    disabledRules: [],
  },

  behavior: {
    headless: true,
    navigationTimeoutMs: 30000,
    settleDelayMs: 2500,
    waitUntil: 'load',
    strict: process.env.STRICT === 'true',
  },

  paths: {
    resultsDir: path.resolve(__dirname, '..', 'results'),
    screenshotsDir: path.resolve(__dirname, '..', 'results', 'screenshots'),
    reportsDir: path.resolve(__dirname, '..', 'results', 'reports'),
    dataFile: path.resolve(__dirname, '..', 'results', 'results.json'),
    reportFile: path.resolve(__dirname, '..', 'results', 'reports', 'report.html'),
  },
};

module.exports = config;
