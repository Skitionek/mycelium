import { applicationConfig, moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { NEVER } from 'rxjs';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ApiService } from 'app/shared/services/api.service';

import { EnrichmentVisualisationViewerComponent } from './enrichment-visualisation-viewer.component';

const meta: Meta<EnrichmentVisualisationViewerComponent> = {
  title: 'Enrichment/Visualisation Viewer',
  component: EnrichmentVisualisationViewerComponent,
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
      providers: [
        MockProvider(ApiService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<EnrichmentVisualisationViewerComponent>;

export const Default: Story = {};
