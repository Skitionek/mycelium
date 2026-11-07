import { CommonModule } from '@angular/common';

import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { CollapsibleWindowComponent } from 'app/shared/components/collapsible-window.component';
import { TabSelectableDirective } from 'app/shared/directives/tab-selectable.directive';

const meta: Meta<CollapsibleWindowComponent> = {
  title: 'Shared/Collapsible Window',
  component: CollapsibleWindowComponent,
  decorators: [
    moduleMetadata({
      declarations: [TabSelectableDirective],
      imports: [CommonModule],
    }),
    // The window fills its container, so it needs one with a height.
    componentWrapperDecorator((story) => `<div style="height: 220px; width: 320px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<CollapsibleWindowComponent>;

export const Expanded: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-collapsible-window [title]="title" [reversed]="reversed"
                              [sideCollapse]="sideCollapse" [borderless]="borderless">
        <div class="window-body">Window contents</div>
      </app-collapsible-window>`,
  }),
  args: {
    title: 'Legend',
    reversed: false,
    sideCollapse: false,
    borderless: false,
  },
};

export const Borderless: Story = {
  ...Expanded,
  args: {
    ...Expanded.args,
    borderless: true,
  },
};

/** `reversed` flips which way the collapse caret points. */
export const Reversed: Story = {
  ...Expanded,
  args: {
    ...Expanded.args,
    reversed: true,
  },
};
