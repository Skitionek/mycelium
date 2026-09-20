import type { TestRunnerConfig } from '@storybook/test-runner';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import * as path from 'path';

const imageSnapshotsDir = path.join(__dirname, '..', '__image_snapshots__');

/**
 * Stories that cannot be captured byte-identically declare
 * `parameters: { imageSnapshot: { mask: ['.selector'] } }` to blank out the
 * offending region. Masking keeps the snapshot; it never opts out of one.
 */
interface ImageSnapshotParameters {
  mask?: string[];
}

/**
 * index.html and styles.scss pull fonts, icons and plotly from CDNs. Pinned
 * local copies are loaded instead (see the `styles` of the storybook target in
 * angular.json), so any request that still escapes to one of these is blocked:
 * letting it through would make a snapshot depend on the network and on
 * whatever those hosts serve that day.
 */
const BLOCKED_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'kit.fontawesome.com',
  'ka-p.fontawesome.com',
  'cdn.plot.ly',
];

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },

  async preVisit(page) {
    await page.route('**/*', (route) => {
      const { hostname } = new URL(route.request().url());
      return BLOCKED_HOSTS.includes(hostname) ? route.abort() : route.continue();
    });
  },

  async postVisit(page, context) {
    // Webfonts are vendored but still load asynchronously; capturing before
    // they resolve produces a fallback-font screenshot on the first run only.
    await page.evaluate(() => document.fonts.ready);

    const storyParameters = await page.evaluate(
      () =>
        (window as unknown as {
          __STORYBOOK_PREVIEW__?: {
            currentRender?: { story?: { parameters?: Record<string, unknown> } };
          };
        }).__STORYBOOK_PREVIEW__?.currentRender?.story?.parameters ?? {},
    );
    const imageSnapshot = (storyParameters.imageSnapshot ?? {}) as ImageSnapshotParameters;
    const maskedLocators = (imageSnapshot.mask ?? []).map((selector) => page.locator(selector));

    // Capture the story root rather than the viewport. A full-page shot pads
    // every small component with ~900k identical white pixels, which both
    // bloats the PNGs and lets a real change hide under the diff threshold.
    const storyRoot = page.locator('#storybook-root');
    const bounds = await storyRoot.boundingBox();
    const target = bounds && bounds.width > 0 && bounds.height > 0 ? storyRoot : page;

    const screenshot = await target.screenshot({
      animations: 'disabled',
      caret: 'hide',
      mask: maskedLocators,
    });

    expect(screenshot).toMatchImageSnapshot({
      customSnapshotsDir: imageSnapshotsDir,
      customSnapshotIdentifier: context.id,
      // Rendering is pinned to one browser build in one container image, so
      // any differing pixel is a real change rather than platform noise.
      failureThreshold: 0,
      failureThresholdType: 'pixel',
    });
  },
};

export default config;
