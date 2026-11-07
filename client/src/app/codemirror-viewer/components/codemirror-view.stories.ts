import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { RouterTestingModule } from '@angular/router/testing';

import { CodemirrorViewComponent } from 'app/codemirror-viewer/components/codemirror-view.component';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';

const meta: Meta<CodemirrorViewComponent> = {
  title: 'CodeMirror Viewer/View',
  component: CodemirrorViewComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule],
      providers: [MockProvider(FilesystemService)],
    }),
  ],
};

export default meta;

type Story = StoryObj<CodemirrorViewComponent>;

export const Default: Story = {};
