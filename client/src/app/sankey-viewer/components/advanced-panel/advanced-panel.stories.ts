import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { SankeyAdvancedPanelComponent } from './advanced-panel.component';

const sankeyControllerStub = {
  options: {
    predefinedValueAccessors: new Map(),
    networkTraces: [],
  },
  state: {
    predefinedValueAccessorId: 'default',
    viewName: null,
    baseViewName: null,
  },
  applyState: () => {},
} as any;

const meta: Meta<SankeyAdvancedPanelComponent> = {
  title: 'SankeyViewer/Advanced Panel',
  component: SankeyAdvancedPanelComponent,
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

type Story = StoryObj<SankeyAdvancedPanelComponent>;

export const Default: Story = {};
