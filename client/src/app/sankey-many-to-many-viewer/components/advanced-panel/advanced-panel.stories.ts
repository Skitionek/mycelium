import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { SankeyManyToManyAdvancedPanelComponent } from './advanced-panel.component';

const sankeyControllerStub = {
  options: {
    predefinedValueAccessors: new Map(),
    networkTraces: [],
  },
  state: {
    predefinedValueAccessorId: 'default',
  },
  applyState: () => {},
} as any;

const meta: Meta<SankeyManyToManyAdvancedPanelComponent> = {
  title: 'SankeyManyToMany/Advanced Panel',
  component: SankeyManyToManyAdvancedPanelComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
      providers: [
        { provide: SankeyControllerService, useValue: sankeyControllerStub },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyManyToManyAdvancedPanelComponent>;

export const Default: Story = {};
