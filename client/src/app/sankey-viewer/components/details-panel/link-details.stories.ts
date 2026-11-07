import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockComponents } from 'ng-mocks';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { ButtonWithSelectableTextComponent } from './button-with-selectable-text.component';
import { SankeyLinkDetailsComponent } from './link-details.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<SankeyLinkDetailsComponent> = {
  title: 'SankeyViewer/Link Details',
  component: SankeyLinkDetailsComponent,
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

type Story = StoryObj<SankeyLinkDetailsComponent>;

export const Default: Story = {
  args: {
    entity: {
      id: 'link1',
      description: 'A regulatory link between two genes.',
      _value: 0.75,
    } as any,
  },
};
