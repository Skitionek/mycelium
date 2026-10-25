import { CommonModule } from '@angular/common';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { modalDialogWrapper } from 'app/shared/storybook/modal-dialog';

import { PathReportComponent } from './path-report.component';

const meta: Meta<PathReportComponent> = {
  title: 'SankeyViewer/Path Report',
  component: PathReportComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
      providers: [MockProvider(NgbActiveModal)],
    }),
    modalDialogWrapper,
  ],
};

export default meta;

type Story = StoryObj<PathReportComponent>;

export const Default: Story = {
  args: {
    pathReport: {
      'Pathway 1': [
        // Laid out the way SankeyControllerService builds a report: every
        // node, link and spacer takes its own grid column.
        [
          { label: 'BRCA1', row: 1, column: 1, type: 'node' },
          { label: ' | ', row: 1, column: 2, type: 'spacer' },
          { label: 'activates', row: 1, column: 3, type: 'link' },
          { label: ' | ', row: 1, column: 4, type: 'spacer' },
          { label: 'TP53', row: 1, column: 5, type: 'node' },
        ],
      ],
    } as any,
  },
};
