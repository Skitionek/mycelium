import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { SessionStorageService } from 'app/shared/services/session-storage.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ViewService } from 'app/file-browser/services/view.service';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyViewComponent } from './sankey-view.component';

const meta: Meta<SankeyViewComponent> = {
  title: 'SankeyViewer/Sankey View',
  component: SankeyViewComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [MatSnackBarModule, RouterTestingModule],
      providers: [
        MockProvider(FilesystemService),
        MockProvider(FilesystemObjectActions),
        MockProvider(WorkspaceManager),
        MockProvider(SessionStorageService),
        MockProvider(ErrorHandler),
        MockProvider(ViewService),
        MockProvider(WarningControllerService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyViewComponent>;

export const Default: Story = {};
