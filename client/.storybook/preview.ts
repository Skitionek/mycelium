import { applicationConfig, moduleMetadata, type Preview } from '@storybook/angular';
import { provideZoneChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const preview: Preview = {
  decorators: [
    // Angular 21 bootstraps zoneless unless told otherwise. The application keeps zone.js
    // (see src/main.ts), so the stories are rendered the same way.
    applicationConfig({
      providers: [provideZoneChangeDetection()],
    }),
    // Angular animations are non-deterministic under screenshot capture, and
    // no story asserts on them.
    moduleMetadata({
      imports: [NoopAnimationsModule],
    }),
  ],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
