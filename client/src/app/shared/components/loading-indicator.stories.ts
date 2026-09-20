import { Meta, StoryObj } from '@storybook/angular';

import { LoadingIndicatorComponent } from 'app/shared/components/loading-indicator.component';

const meta: Meta<LoadingIndicatorComponent> = {
  title: 'Shared/Loading Indicator',
  component: LoadingIndicatorComponent,
};

export default meta;

type Story = StoryObj<LoadingIndicatorComponent>;

/**
 * The dots animate via CSS. Animations are frozen globally in
 * `.storybook/preview-head.html`, so this captures a stable first frame.
 */
export const Default: Story = {};
