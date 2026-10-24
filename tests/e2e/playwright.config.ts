import { defineConfig, devices } from '@playwright/test';

import { STORAGE_STATE } from './specs/constants';

const CI = !!process.env.CI;

// Point the suite at an already running deployment (e.g. `make up` on
// http://localhost:8080) instead of starting the appserver and the Angular
// dev server from this checkout.
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;
const BASE_URL = EXTERNAL_BASE_URL || 'http://localhost:4200';

export default defineConfig({
  testDir: './specs',
  // The specs share one seeded database and create projects in it; running
  // them one at a time keeps failures readable and the backend unloaded.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [['github'], ['html', { open: 'never' }], ['list']] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      // Specs that exercise the app without a session, e.g. the login form.
      name: 'anonymous',
      testMatch: /.*\.anon\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /.*\.anon\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],

  // Starts the appserver and the Angular dev server, or reuses ones that are
  // already listening (e.g. from `make up-dev`). The appserver needs its
  // Python dependencies installed and PostgreSQL and Solr reachable with a
  // migrated, seeded database; see tests/README.md.
  webServer: EXTERNAL_BASE_URL ? undefined : [
    {
      command: 'flask run --port 5000',
      cwd: '../../appserver',
      env: { FLASK_APP: 'app.py' },
      url: 'http://localhost:5000/meta/',
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: 'ignore',
      // Flask logs every request to stderr; only surface it in CI, where it
      // is the one record of why a spec's request failed.
      stderr: CI ? 'pipe' : 'ignore',
    },
    {
      command: 'yarn dev-start',
      cwd: '../../client',
      env: { NODE_OPTIONS: '--openssl-legacy-provider --max_old_space_size=4096' },
      url: BASE_URL,
      reuseExistingServer: !CI,
      // A cold Angular dev build takes a few minutes.
      timeout: 10 * 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
