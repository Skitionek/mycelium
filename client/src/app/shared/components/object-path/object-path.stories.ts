import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MockComponents, MockDirective, MockProvider } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ObjectPathComponent } from 'app/shared/components/object-path/object-path.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ProjectIconComponent } from 'app/shared/components/project-icon/project-icon.component';
import { LinkWithHrefDirective, LinkWithoutHrefDirective } from 'app/shared/directives/link.directive';
import { FilesystemObjectTargetDirective } from 'app/shared/directives/filesystem-object-target.directive';
import { ContextMenuDirective, ContextMenuBodyDirective } from 'app/shared/directives/context-menu.directive';

function makeObject(filename: string, parent?: FilesystemObject): FilesystemObject {
  const obj = new FilesystemObject();
  obj.filename = filename;
  obj.hashId = Math.random().toString(36).slice(2);
  obj.parent = parent ?? null;
  return obj;
}

const project = makeObject('My Project');
const folder = makeObject('Sub Folder', project);
const file = makeObject('Document.pdf', folder);

const meta: Meta<ObjectPathComponent> = {
  title: 'Shared/Object Path',
  component: ObjectPathComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, RouterModule.forRoot([])],
      declarations: [
        MockComponents(ProjectIconComponent),
        MockDirective(LinkWithHrefDirective),
        MockDirective(LinkWithoutHrefDirective),
        MockDirective(FilesystemObjectTargetDirective),
        MockDirective(ContextMenuDirective),
        MockDirective(ContextMenuBodyDirective),
      ],
      providers: [MockProvider(WorkspaceManager)],
    }),
  ],
};

export default meta;

type Story = StoryObj<ObjectPathComponent>;

export const NestedPath: Story = {
  args: {
    object: file,
    forEditing: false,
    newTab: false,
  },
};

export const RootOnly: Story = {
  args: {
    object: project,
    forEditing: false,
    newTab: false,
  },
};

export const WithRootName: Story = {
  args: {
    object: file,
    rootName: 'My Workspace',
    forEditing: false,
    newTab: false,
  },
};
