import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MockComponents, MockProvider } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ModuleHeaderComponent } from 'app/shared/components/module-header/module-header.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ObjectPathComponent } from 'app/shared/components/object-path/object-path.component';
import { WorkspaceManager } from 'app/shared/workspace-manager';

function makeObject(filename: string): FilesystemObject {
  const obj = new FilesystemObject();
  obj.filename = filename;
  obj.hashId = 'abc123';
  return obj;
}

const meta: Meta<ModuleHeaderComponent> = {
  title: 'Shared/Module Header',
  component: ModuleHeaderComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, RouterModule.forRoot([])],
      declarations: [MockComponents(ObjectPathComponent)],
      providers: [MockProvider(WorkspaceManager)],
    }),
  ],
};

export default meta;

type Story = StoryObj<ModuleHeaderComponent>;

export const Default: Story = {
  args: {
    object: makeObject('My Document.pdf'),
    showObjectMenu: false,
    showBreadCrumbs: false,
    showNewWindowButton: false,
  },
};

export const WithBreadcrumbs: Story = {
  args: {
    object: makeObject('My Document.pdf'),
    showObjectMenu: false,
    showBreadCrumbs: true,
    showNewWindowButton: false,
  },
};
