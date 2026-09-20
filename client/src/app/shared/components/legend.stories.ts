import { CommonModule } from '@angular/common';

import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { CollapsibleWindowComponent } from 'app/shared/components/collapsible-window.component';
import { LegendComponent } from 'app/shared/components/legend.component';
import { TabSelectableDirective } from 'app/shared/directives/tab-selectable.directive';

const meta: Meta<LegendComponent> = {
  title: 'Shared/Legend',
  component: LegendComponent,
  decorators: [
    moduleMetadata({
      declarations: [CollapsibleWindowComponent, TabSelectableDirective],
      imports: [CommonModule],
    }),
    componentWrapperDecorator((story) => `<div style="height: 260px; width: 280px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<LegendComponent>;

/** Each entry's first colour is the swatch; the second is the border colour. */
export const Default: Story = {
  args: {
    legend: new Map<string, string[]>([
      ['Gene', ['#673ab7', '#4527a0']],
      ['Chemical', ['#4caf50', '#2e7d32']],
      ['Disease', ['#ff9800', '#ef6c00']],
      ['Protein', ['#03a9f4', '#0277bd']],
    ]),
  },
};

export const Empty: Story = {
  args: {
    legend: new Map<string, string[]>(),
  },
};
