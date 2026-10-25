import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { RouterTestingModule } from '@angular/router/testing';

import { MolstarViewComponent } from 'app/molstar-viewer/components/molstar-view.component';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';

const meta: Meta<MolstarViewComponent> = {
  title: 'Molstar Viewer/View',
  component: MolstarViewComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, RouterTestingModule],
      providers: [MockProvider(FilesystemService)],
    }),
  ],
};

export default meta;

type Story = StoryObj<MolstarViewComponent>;

export const Default: Story = {
  args: { embedded: false },
};

export const Embedded: Story = {
  args: { embedded: true },
};
