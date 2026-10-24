import { CommonModule } from '@angular/common';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { PathReportComponent } from './path-report.component';

const meta: Meta<PathReportComponent> = {
  title: 'SankeyViewer/Path Report',
  component: PathReportComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
      providers: [MockProvider(NgbActiveModal)],
    }),
  ],
};

export default meta;

type Story = StoryObj<PathReportComponent>;

export const Default: Story = {
  args: {
    pathReport: {
      'Pathway 1': [
        [
          { label: 'BRCA1', row: 1, column: 1 },
          { label: ' → ', row: 1, column: 1 },
          { label: 'TP53', row: 1, column: 2 },
        ],
      ],
    } as any,
  },
};
