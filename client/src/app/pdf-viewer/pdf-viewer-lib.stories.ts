import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { PdfViewerLibComponent } from 'app/pdf-viewer/pdf-viewer-lib.component';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { InternalSearchService } from 'app/shared/services/internal-search.service';

const meta: Meta<PdfViewerLibComponent> = {
  title: 'PDF Viewer/PDF Viewer Lib',
  component: PdfViewerLibComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [MatSnackBarModule, NgbModule],
      providers: [
        MockProvider(ErrorHandler),
        MockProvider(InternalSearchService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<PdfViewerLibComponent>;

export const Default: Story = {};
