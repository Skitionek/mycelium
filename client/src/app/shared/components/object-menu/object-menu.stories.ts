import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ObjectMenuComponent } from 'app/shared/components/object-menu/object-menu.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

function makeObject(): FilesystemObject {
  const obj = new FilesystemObject();
  obj.filename = 'my-document.pdf';
  obj.hashId = 'abc123';
  obj.privileges = { readable: true, writable: true, commentable: true };
  return obj;
}

const meta: Meta<ObjectMenuComponent> = {
  title: 'Shared/Object Menu',
  component: ObjectMenuComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule, MatSnackBarModule, RouterModule.forRoot([])],
      providers: [
        MockProvider(WorkspaceManager),
        MockProvider(FilesystemObjectActions),
        MockProvider(ObjectTypeService, { get: () => of({} as any), getDefault: () => of({} as any) }),
        MockProvider(ErrorHandler),
      ],
    }),
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
