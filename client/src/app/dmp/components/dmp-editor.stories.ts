import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { RouterTestingModule } from '@angular/router/testing';

import { DMPEditorComponent } from 'app/dmp/components/dmp-editor.component';
import { DMPService } from 'app/dmp/services/dmp.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';

const meta: Meta<DMPEditorComponent> = {
  title: 'DMP/Editor',
  component: DMPEditorComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, RouterTestingModule],
      providers: [
        MockProvider(DMPService),
        MockProvider(FilesystemService),
        MockProvider(WorkspaceManager),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<DMPEditorComponent>;

export const Default: Story = {};
