import { applicationConfig, moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { NEVER } from 'rxjs';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { EnrichmentTableService } from 'app/enrichment/services/enrichment-table.service';
import { LoadingIndicatorComponent } from 'app/shared/components/loading-indicator.component';
import { ModuleProgressComponent } from 'app/shared/components/module-progress.component';
import { AddStatusPipe } from 'app/shared/pipes/add-status.pipe';

import { EnrichmentTableViewerComponent } from './enrichment-table-viewer.component';

const meta: Meta<EnrichmentTableViewerComponent> = {
  title: 'Enrichment/Table Viewer',
  component: EnrichmentTableViewerComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    // The component provides its own services, which shadow any mock in
    // moduleMetadata. Their root-level dependencies are stubbed here instead:
    // file loads never emit and the testing backend holds every request, so
    // the viewer stays in its loading state.
    applicationConfig({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([], withDisabledInitialNavigation()),
        MockProvider(FilesystemService, { get: () => NEVER, getContent: () => NEVER }),
      ],
    }),
    moduleMetadata({
      imports: [MatSnackBarModule],
      declarations: [AddStatusPipe, ModuleProgressComponent, LoadingIndicatorComponent],
      providers: [
        MockProvider(FilesystemObjectActions),
        MockProvider(ErrorHandler, { create: () => (source) => source }),
        MockProvider(ProgressDialog),
        MockProvider(EnrichmentTableService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<EnrichmentTableViewerComponent>;

export const Default: Story = {};
