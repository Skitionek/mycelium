import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';

import { SankeySearchService } from 'app/sankey-viewer/services/search.service';

import { SankeySearchControlComponent } from './search-control.component';

const searchServiceStub = {
  query: new BehaviorSubject(''),
  entitySearchList: new BehaviorSubject([]),
  entitySearchListIdx: new BehaviorSubject(-1),
} as any;

const meta: Meta<SankeySearchControlComponent> = {
  title: 'SankeyViewer/Search Control',
  component: SankeySearchControlComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule, ReactiveFormsModule],
      providers: [
        { provide: SankeySearchService, useValue: searchServiceStub },
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeySearchControlComponent>;

export const Default: Story = {};
