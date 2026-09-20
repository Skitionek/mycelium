import { moduleMetadata, type Preview } from '@storybook/angular';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const preview: Preview = {
  decorators: [
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
