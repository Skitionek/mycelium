import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockComponents } from 'ng-mocks';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { ButtonWithSelectableTextComponent } from './button-with-selectable-text.component';
import { SankeyNodeDetailsComponent } from './node-details.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<SankeyNodeDetailsComponent> = {
  title: 'SankeyViewer/Node Details',
  component: SankeyNodeDetailsComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule, RouterTestingModule],
      declarations: [MockComponents(ButtonWithSelectableTextComponent)],
      providers: [
        { provide: SankeyControllerService, useValue: sankeyControllerStub },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyNodeDetailsComponent>;

export const Default: Story = {
  args: {
    entity: {
      id: 'node1',
      label: 'BRCA1',
      description: 'Breast cancer gene 1',
      _value: 1.0,
    } as any,
  },
};
