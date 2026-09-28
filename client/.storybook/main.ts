import type { StorybookConfig } from '@storybook/angular';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Storybook 9+ loads this config as ESM, where __dirname is unavailable.
const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/app/**/*.stories.ts'],

  // Storybook 9+ builds essential addons (controls, actions, viewport, etc.)
  // into core, so @storybook/addon-essentials is no longer needed here.

  // CI runs this non-interactively; the telemetry prompt would block it.
  core: {
    disableTelemetry: true,
  },

  framework: {
    name: '@storybook/angular',
    options: {},
  },

  // Components load icons and images from /assets at runtime.
  staticDirs: [{ from: '../src/assets', to: '/assets' }],

  webpackFinal: async (webpackConfig) => {
    // Storybook's Angular builder generates its own webpack config from
    // @angular-devkit/build-angular and does not read ../webpack.config.js,
    // so the pdfjs-dist ESM bundles need this re-applied here.
    webpackConfig.experiments = {
      ...webpackConfig.experiments,
      topLevelAwait: true,
    };

    // tsconfig.json sets baseUrl to src, which is how every component imports
    // via `app/...`. Mirror it so webpack resolves those specifiers too.
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.modules = [
      ...(webpackConfig.resolve.modules ?? []),
      path.resolve(dirname, '../src'),
    ];

    return webpackConfig;
  },
};

export default config;
