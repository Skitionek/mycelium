import { Meta, StoryObj } from '@storybook/angular';

import { LoadingIndicatorComponent } from 'app/shared/components/loading-indicator.component';

const meta: Meta<LoadingIndicatorComponent> = {
  title: 'Shared/Loading Indicator',
  component: LoadingIndicatorComponent,

  // A spinner and a single icon; a PNG would assert nothing the template does
  // not already say, so these are browsable in Storybook but not snapshotted.
  parameters: {
    imageSnapshot: { skip: true },
  },
};

export default meta;

type Story = StoryObj<LoadingIndicatorComponent>;

/**
 * The dots animate via CSS. Animations are frozen globally in
 * `.storybook/preview-head.html`, so this captures a stable first frame.
 */
export const Default: Story = {};
