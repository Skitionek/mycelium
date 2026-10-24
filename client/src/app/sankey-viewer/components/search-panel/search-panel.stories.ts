import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { BehaviorSubject } from 'rxjs';

import { SankeySearchService } from 'app/sankey-viewer/services/search.service';

import { SankeySearchPanelComponent } from './search-panel.component';

const searchServiceStub = {
  entitySearchList: new BehaviorSubject([
    { id: 'n1', label: 'BRCA1' },
    { id: 'n2', label: 'TP53' },
  ]),
  entitySearchListIdx: new BehaviorSubject(0),
} as any;

const meta: Meta<SankeySearchPanelComponent> = {
  title: 'SankeyViewer/Search Panel',
  component: SankeySearchPanelComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      providers: [
        { provide: SankeySearchService, useValue: searchServiceStub },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeySearchPanelComponent>;

export const WithResults: Story = {};

export const Empty: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: SankeySearchService,
          useValue: {
            entitySearchList: new BehaviorSubject([]),
            entitySearchListIdx: new BehaviorSubject(-1),
          },
        },
      ],
    }),
  ],
};
