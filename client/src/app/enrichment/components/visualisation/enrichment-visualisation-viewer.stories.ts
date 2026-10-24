import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { RouterTestingModule } from '@angular/router/testing';

import { EnrichmentVisualisationService } from 'app/enrichment/services/enrichment-visualisation.service';
import { EnrichmentService } from 'app/enrichment/services/enrichment.service';

import { EnrichmentVisualisationViewerComponent } from './enrichment-visualisation-viewer.component';

const meta: Meta<EnrichmentVisualisationViewerComponent> = {
  title: 'Enrichment/Visualisation Viewer',
  component: EnrichmentVisualisationViewerComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule],
      providers: [
        MockProvider(EnrichmentVisualisationService),
        MockProvider(EnrichmentService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<EnrichmentVisualisationViewerComponent>;

export const Default: Story = {};
