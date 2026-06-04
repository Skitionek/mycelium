// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function findCachedPuppeteerChrome() {
  const chromeCacheRoot = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (!fs.existsSync(chromeCacheRoot)) {
    return null;
  }

  try {
    const platforms = fs
      .readdirSync(chromeCacheRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const platform of platforms) {
      const platformRoot = path.join(chromeCacheRoot, platform);
      const versions = fs
        .readdirSync(platformRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse();

      for (const version of versions) {
        const binaryPath = path.join(platformRoot, version, 'chrome-linux64', 'chrome');
        if (fs.existsSync(binaryPath)) {
          return binaryPath;
        }
      }
    }
  } catch (_err) {
    // Fall through to system browser detection.
  }

  return null;
}

function findBrowserBinary() {
  const binaries = [
    'chromium-browser',
    'chromium',
    'google-chrome-stable',
    'google-chrome',
    'chrome',
  ];

  for (const binary of binaries) {
    try {
      const path = execSync(`command -v ${binary}`, {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();

      if (path) {
        return { binary, path };
      }
    } catch (_err) {
      // Keep searching until we find an installed browser binary.
    }
  }

  return null;
}

let detectedBrowser = null;

if (!process.env.CHROME_BIN) {
  const cachedChrome = findCachedPuppeteerChrome();
  if (cachedChrome) {
    process.env.CHROME_BIN = cachedChrome;
  }
}

detectedBrowser = findBrowserBinary();
if (!process.env.CHROME_BIN && detectedBrowser) {
  process.env.CHROME_BIN = detectedBrowser.path;
}

const isChromiumBinary =
  (detectedBrowser && detectedBrowser.binary.startsWith('chromium')) ||
  (process.env.CHROME_BIN && process.env.CHROME_BIN.toLowerCase().includes('chromium'));

if (!process.env.CHROMIUM_BIN && process.env.CHROME_BIN && isChromiumBinary) {
  process.env.CHROMIUM_BIN = process.env.CHROME_BIN;
}

const chromeLauncherBase = process.env.CHROMIUM_BIN ? 'ChromiumHeadless' : 'ChromeHeadless';

module.exports = function (config) {
  config.set({
    // Adding "files:" to fix errors as explained at:
    // https://github.com/SBRG/kg-prototypes/pull/93#issuecomment-617272392
    files: [
      { pattern: 'https://cdn.plot.ly/plotly-latest.js', watched: false },
    ],
    basePath: '',
    // The threshold for this timeout is likely to increase as we add more code to the
    // app; the time required here is directly proportional to the time it takes to
    // compile the code
    browserNoActivityTimeout: 90000,
    frameworks: ['jasmine', '@angular-devkit/build-angular', 'viewport'],
    plugins: [
      require('karma-jasmine'),
      require('karma-spec-reporter'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma'),
      require('karma-viewport')
    ],
    customLaunchers: {
      ChromeCustom: {
        base: chromeLauncherBase,
        flags: [
          '--headless=old',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--remote-debugging-port=9222',
          '--remote-debugging-address=0.0.0.0',
        ],
      },
    },
    client:{
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
      captureConsole: true,
    },
    coverageIstanbulReporter: {
        dir: require('path').join(__dirname, './coverage/client'),
        reports: ['html', 'lcovonly', 'text-summary'],
        fixWebpackSourcePaths: true
    },
    angularCli: {
      environment: 'dev'
    },
    reporters: ['spec', 'kjhtml'],
    specReporter: {
        maxLogLines: 5,             // limit number of lines logged per test
        suppressErrorSummary: true, // do not print error summary
        suppressFailed: false,      // do not print information about failed tests
        suppressPassed: false,      // do not print information about passed tests
        suppressSkipped: false,     // do not print information about skipped tests
        showSpecTiming: false,      // print the time elapsed for each spec
        failFast: false             // test would finish with error when a first fail occurs.
    },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['ChromeCustom'],
    singleRun: false
  });
};
