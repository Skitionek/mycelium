import { CommonModule } from '@angular/common';

import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';

import { MessageDialog } from 'app/shared/services/message-dialog.service';

import { MapRestoreDialogComponent } from './map-restore-dialog.component';

const meta: Meta<MapRestoreDialogComponent> = {
  title: 'DrawingTool/Map Restore Dialog',
  component: MapRestoreDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<MapRestoreDialogComponent>;

export const Default: Story = {
  args: {
    map: {
      id: 'map1',
      label: 'My Knowledge Map',
    } as any,
  },
};
