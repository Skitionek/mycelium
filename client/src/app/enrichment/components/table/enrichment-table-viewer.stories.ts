import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';

import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { EnrichmentTableService } from 'app/enrichment/services/enrichment-table.service';
import { EnrichmentService } from 'app/enrichment/services/enrichment.service';

import { EnrichmentTableViewerComponent } from './enrichment-table-viewer.component';

const meta: Meta<EnrichmentTableViewerComponent> = {
  title: 'Enrichment/Table Viewer',
  component: EnrichmentTableViewerComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [MatSnackBarModule, RouterTestingModule],
      providers: [
        MockProvider(FilesystemObjectActions),
        MockProvider(ErrorHandler),
        MockProvider(ProgressDialog),
        MockProvider(EnrichmentTableService),
        MockProvider(EnrichmentService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<EnrichmentTableViewerComponent>;

export const Default: Story = {};
