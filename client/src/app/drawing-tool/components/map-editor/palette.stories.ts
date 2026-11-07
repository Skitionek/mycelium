import { CommonModule } from '@angular/common';

import { MatSnackBarModule } from '@angular/material/snack-bar';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { PaletteComponent } from './palette.component';

const meta: Meta<PaletteComponent> = {
  title: 'DrawingTool/Palette',
  component: PaletteComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, MatSnackBarModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<PaletteComponent>;

export const Collapsed: Story = {};

export const Expanded: Story = {
  args: { expanded: true },
};
