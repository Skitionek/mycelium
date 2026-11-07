import { CommonModule, DecimalPipe } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { DataService } from 'app/shared/services/table.service';
import { SortableTableHeaderDirective } from 'app/shared/directives/table-sortable-header.directive';

import { TableCompleteComponent } from './table-complete.component';

const sampleData = [
  {
    goId: 'GO:0006915',
    goTerm: 'apoptotic process',
    'q-value': 0.001,
    gene: 'BRCA1',
    geneNames: ['BRCA1', 'TP53', 'BAX'],
  },
  {
    goId: 'GO:0007049',
    goTerm: 'cell cycle',
    'q-value': 0.01,
    gene: 'CCND1',
    geneNames: ['CCND1', 'CDK2'],
  },
  {
    goId: 'GO:0016310',
    goTerm: 'phosphorylation',
    'q-value': 0.05,
    gene: 'MAPK1',
    geneNames: ['MAPK1'],
  },
] as any[];

const meta: Meta<TableCompleteComponent> = {
  title: 'Enrichment/Table Complete',
  component: TableCompleteComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
      declarations: [SortableTableHeaderDirective],
      providers: [DataService, DecimalPipe],
    }),
  ],
};

export default meta;

type Story = StoryObj<TableCompleteComponent>;

export const Default: Story = {
  args: {
    data: sampleData,
    show: true,
    showMore: false,
    itemsPerPage: 5,
  },
};

export const ShowMore: Story = {
  args: {
    data: sampleData,
    show: true,
    showMore: true,
    itemsPerPage: 15,
  },
};
