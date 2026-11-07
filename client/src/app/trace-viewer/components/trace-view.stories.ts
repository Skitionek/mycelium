import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { RouterTestingModule } from '@angular/router/testing';

import { TraceViewComponent } from 'app/trace-viewer/components/trace-view.component';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { TruncatePipe } from 'app/shared/pipes';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

const meta: Meta<TraceViewComponent> = {
  title: 'Trace Viewer/View',
  component: TraceViewComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule],
      providers: [
        MockProvider(FilesystemService),
        MockProvider(TruncatePipe),
        MockProvider(WarningControllerService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<TraceViewComponent>;

export const Default: Story = {};
