import { CommonModule } from '@angular/common';

import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { ButtonWithSelectableTextComponent } from './button-with-selectable-text.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<ButtonWithSelectableTextComponent> = {
  title: 'SankeyViewer/Button With Selectable Text',
  component: ButtonWithSelectableTextComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, RouterTestingModule],
      providers: [
        { provide: SankeyControllerService, useValue: sankeyControllerStub },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<ButtonWithSelectableTextComponent>;

export const Default: Story = {
  args: {
    entity: { id: '1', label: 'Node A' },
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    entity: { id: '1', label: 'Node A' },
    disabled: true,
  },
};
