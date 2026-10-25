import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ObjectMenuComponent } from 'app/shared/components/object-menu/object-menu.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { AddStatusPipe } from 'app/shared/pipes/add-status.pipe';
import { LinkWithHrefDirective, LinkWithoutHrefDirective } from 'app/shared/directives/link.directive';
import { MimeTypes } from 'app/shared/constants';

function makeObject(): FilesystemObject {
  const obj = new FilesystemObject();
  obj.filename = 'my-document.pdf';
  obj.hashId = 'abc123';
  obj.mimeType = MimeTypes.Pdf;
  obj.project = { name: 'my-project' } as FilesystemObject['project'];
  obj.privileges = { readable: true, writable: true, commentable: true };
  return obj;
}

const typeProvider = { getExporters: () => of([{ name: 'PDF' }]) };

const meta: Meta<ObjectMenuComponent> = {
  title: 'Shared/Object Menu',
  component: ObjectMenuComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule, MatSnackBarModule, RouterModule.forRoot([])],
      declarations: [AddStatusPipe, LinkWithHrefDirective, LinkWithoutHrefDirective],
      providers: [
        MockProvider(WorkspaceManager, { focusedPane: null }),
        MockProvider(FilesystemObjectActions, {
          getOpenInOptions: () => [
            { label: 'PDF Viewer', commands: [] },
            { label: 'Text Editor', commands: [] },
          ],
        }),
        MockProvider(ObjectTypeService, { get: () => of(typeProvider as any), getDefault: () => of(typeProvider as any) }),
        MockProvider(ErrorHandler, { create: () => (source) => source }),
      ],
    }),
    // The menu is the body of a dropdown; render it inside one.
    componentWrapperDecorator((story) => `<div class="dropdown-menu show position-static">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<ObjectMenuComponent>;

export const Default: Story = {
  args: {
    object: makeObject(),
    forEditing: true,
    showOpen: true,
    showDelete: false,
    showTools: true,
  },
};
