import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';

import { SankeySearchService } from 'app/sankey-viewer/services/search.service';
import { BaseControlComponent } from 'app/shared/components/base-control.component';
import { SearchControlComponent } from 'app/shared/components/search-control.component';

import { SankeySearchControlComponent } from './search-control.component';

const searchServiceStub = {
  entitySearchTerm: new BehaviorSubject('MAPK'),
  entitySearchList: new BehaviorSubject([{}, {}, {}]),
  entitySearchListIdx: new BehaviorSubject(0),
  done: true,
  search: () => undefined,
  previous: () => undefined,
  next: () => undefined,
} as any;

const meta: Meta<SankeySearchControlComponent> = {
  title: 'SankeyViewer/Search Control',
  component: SankeySearchControlComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
      declarations: [SearchControlComponent, BaseControlComponent],
      providers: [
        { provide: SankeySearchService, useValue: searchServiceStub },
      ],
    }),
    componentWrapperDecorator((story) => `<div style="width: 420px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<SankeySearchControlComponent>;

export const Default: Story = {};
