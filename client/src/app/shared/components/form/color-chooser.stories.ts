import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ColorChooserComponent } from 'app/shared/components/form/color-chooser.component';

const palette = [
  '#d32f2f', '#c2185b', '#7b1fa2', '#512da8',
  '#1976d2', '#0097a7', '#388e3c', '#fbc02d',
];

const meta: Meta<ColorChooserComponent> = {
  title: 'Shared/Form/Color Chooser',
  component: ColorChooserComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
    }),
    componentWrapperDecorator((story) => `<div style="width: 220px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<ColorChooserComponent>;

/** Collapsed; the swatch shows the currently chosen colour. */
export const WithColor: Story = {
  args: {
    color: '#1976d2',
    palette,
    emptyLabel: 'No Color',
  },
};

/** No colour renders a dotted placeholder swatch instead of a filled one. */
export const NoColor: Story = {
  args: {
    color: null,
    palette,
    emptyLabel: 'No Color',
  },
};
