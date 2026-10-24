import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { RouterTestingModule } from '@angular/router/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { SdrfViewComponent } from 'app/sdrf-viewer/components/sdrf-view.component';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';

const meta: Meta<SdrfViewComponent> = {
  title: 'SDRF Viewer/View',
  component: SdrfViewComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule, MatSnackBarModule],
      providers: [
        MockProvider(FilesystemService),
        MockProvider(ErrorHandler),
        MockProvider(ProgressDialog),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SdrfViewComponent>;

export const Default: Story = {};
