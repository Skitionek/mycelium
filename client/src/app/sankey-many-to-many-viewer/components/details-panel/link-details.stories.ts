import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterTestingModule } from '@angular/router/testing';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockComponents } from 'ng-mocks';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';
import { ButtonWithSelectableTextComponent } from 'app/sankey-viewer/components/details-panel/button-with-selectable-text.component';

import { SankeyManyToManyLinkDetailsComponent } from './link-details.component';

const sankeyControllerStub = {
  options: {},
  state: {},
  allData: { value: { nodes: [] } },
  selectedNetworkTrace: {},
} as any;

const meta: Meta<SankeyManyToManyLinkDetailsComponent> = {
  title: 'SankeyManyToMany/Link Details',
  component: SankeyManyToManyLinkDetailsComponent,
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

type Story = StoryObj<SankeyManyToManyLinkDetailsComponent>;

export const Default: Story = {
  args: {
    entity: {
      id: 'link1',
      description: 'A many-to-many regulatory link.',
      _value: 0.5,
    } as any,
  },
};
