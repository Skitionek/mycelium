import type { TestRunnerConfig } from '@storybook/test-runner';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import * as path from 'path';

const imageSnapshotsDir = path.join(__dirname, '..', '__image_snapshots__');

/**
 * Per-story image-snapshot options, set as
 * `parameters: { imageSnapshot: { ... } }`.
 *
 * `mask` blanks out a region that cannot be captured byte-identically while
 * still snapshotting the rest.
 *
 * `skip` drops the snapshot entirely. It is for primitives whose rendering is
 * a single icon or a spinner, where a PNG asserts nothing a reader could not
 * see from the template and only adds a file to re-approve.
 */
interface ImageSnapshotParameters {
  mask?: string[];
  skip?: boolean;
  /**
   * A selector that must be present before capturing. Components that lay
   * themselves out asynchronously - a d3 layout driven by
   * requestAnimationFrame, say - are otherwise photographed mid-render.
   */
  waitFor?: string;
  /**
   * Milliseconds of DOM quiet required before capturing. Some components keep
   * re-laying-out after their first paint (a resize observer reacting to its
   * own resize, for one), so waiting for an element to appear is not enough -
   * the capture has to wait for the mutations to stop.
   */
  settle?: number;
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
    if (imageSnapshot.skip) {
      return;
    }

    if (imageSnapshot.waitFor) {
      await page.waitForSelector(imageSnapshot.waitFor, { state: 'attached' });
    }

    if (imageSnapshot.settle) {
      await page.evaluate(
        (quietMs) =>
          new Promise<void>((resolve) => {
            const root = document.querySelector('#storybook-root') ?? document.body;
            let timer = setTimeout(done, quietMs);
            const observer = new MutationObserver(() => {
              clearTimeout(timer);
              timer = setTimeout(done, quietMs);
            });
            observer.observe(root, {
              attributes: true,
              childList: true,
              subtree: true,
              characterData: true,
            });

            function done() {
              observer.disconnect();
              resolve();
            }
          }),
        imageSnapshot.settle,
      );
    }

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
