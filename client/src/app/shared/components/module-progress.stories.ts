import { CommonModule } from '@angular/common';

import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { LoadingIndicatorComponent } from 'app/shared/components/loading-indicator.component';
import { ModuleProgressComponent } from 'app/shared/components/module-progress.component';

const meta: Meta<ModuleProgressComponent> = {
  title: 'Shared/Module Progress',
  component: ModuleProgressComponent,
  decorators: [
    moduleMetadata({
      declarations: [LoadingIndicatorComponent],
      imports: [CommonModule],
    }),
    // The component positions itself absolutely over its module.
    componentWrapperDecorator(
      (story) => `<div class="position-relative" style="height: 260px; width: 520px">${story}</div>`,
    ),
  ],
};

export default meta;

type Story = StoryObj<ModuleProgressComponent>;

export const Default: Story = {
  render: () => ({
    template: '<app-module-progress>Loading your files&hellip;</app-module-progress>',
  }),
};

export const WithoutMessage: Story = {
  render: () => ({
    template: '<app-module-progress></app-module-progress>',
  }),
};
