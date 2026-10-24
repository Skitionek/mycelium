import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { MapImageProviderService } from 'app/drawing-tool/services/map-image-provider.service';

import { MapComponent } from './map.component';

const meta: Meta<MapComponent> = {
  title: 'DrawingTool/Map',
  component: MapComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [MatSnackBarModule, RouterTestingModule],
      providers: [
        MockProvider(FilesystemService),
        MockProvider(FilesystemObjectActions),
        MockProvider(ObjectTypeService),
        MockProvider(MessageDialog),
        MockProvider(ErrorHandler),
        MockProvider(WorkspaceManager),
        MockProvider(DataTransferDataService),
        MockProvider(MapImageProviderService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<MapComponent>;

export const Default: Story = {};
