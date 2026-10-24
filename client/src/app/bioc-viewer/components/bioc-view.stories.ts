import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { RouterTestingModule } from '@angular/router/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { BiocViewComponent } from 'app/bioc-viewer/components/bioc-view.component';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';

const meta: Meta<BiocViewComponent> = {
  title: 'BioC Viewer/View',
  component: BiocViewComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule, MatSnackBarModule, NgbModule],
      providers: [
        MockProvider(FilesystemService),
        MockProvider(FilesystemObjectActions),
        MockProvider(ErrorHandler),
        MockProvider(ProgressDialog),
        MockProvider(WorkspaceManager),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<BiocViewComponent>;

export const Default: Story = {};
