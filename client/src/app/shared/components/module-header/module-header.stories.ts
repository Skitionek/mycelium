import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MockComponents, MockDirective, MockProvider } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ModuleHeaderComponent } from 'app/shared/components/module-header/module-header.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ObjectPathComponent } from 'app/shared/components/object-path/object-path.component';
import { ProjectIconComponent } from 'app/shared/components/project-icon/project-icon.component';
import { LinkWithHrefDirective, LinkWithoutHrefDirective } from 'app/shared/directives/link.directive';
import { FilesystemObjectTargetDirective } from 'app/shared/directives/filesystem-object-target.directive';
import { ContextMenuDirective, ContextMenuBodyDirective } from 'app/shared/directives/context-menu.directive';
import { MimeTypes } from 'app/shared/constants';
import { WorkspaceManager } from 'app/shared/workspace-manager';

function makeObject(filename: string, parent: FilesystemObject = null, mimeType?: string): FilesystemObject {
  const obj = new FilesystemObject();
  obj.filename = filename;
  obj.hashId = filename;
  obj.parent = parent;
  obj.mimeType = mimeType;
  return obj;
}

const project = makeObject('My Project', null, MimeTypes.Directory);
const folder = makeObject('Sub Folder', project, MimeTypes.Directory);

const meta: Meta<ModuleHeaderComponent> = {
  title: 'Shared/Module Header',
  component: ModuleHeaderComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, RouterModule.forRoot([])],
      declarations: [
        ObjectPathComponent,
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
    object: makeObject('My Document.pdf', folder, MimeTypes.Pdf),
    showObjectMenu: false,
    showBreadCrumbs: true,
    showNewWindowButton: false,
  },
};
