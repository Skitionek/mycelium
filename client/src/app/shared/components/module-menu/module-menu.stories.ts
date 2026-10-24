import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ModuleMenuComponent } from 'app/shared/components/module-menu/module-menu.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ViewService } from 'app/file-browser/services/view.service';

function makeObject(): FilesystemObject {
  const obj = new FilesystemObject();
  obj.filename = 'my-document.pdf';
  obj.hashId = 'abc123';
  obj.privileges = { readable: true, writable: true, commentable: true };
  return obj;
}

const meta: Meta<ModuleMenuComponent> = {
  title: 'Shared/Module Menu',
  component: ModuleMenuComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule, MatSnackBarModule, RouterModule.forRoot([])],
      providers: [
        MockProvider(WorkspaceManager, { focusedPane: null }),
        MockProvider(FilesystemObjectActions),
        MockProvider(ObjectTypeService, { get: () => of({} as any), getDefault: () => of({} as any) }),
        MockProvider(ErrorHandler),
        MockProvider(ViewService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<ModuleMenuComponent>;

export const Default: Story = {
  args: {
    object: makeObject(),
    forEditing: true,
    showOpen: true,
  },
};
