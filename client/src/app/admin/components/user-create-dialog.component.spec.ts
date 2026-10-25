import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';

import { UserCreateDialogComponent } from './user-create-dialog.component';

describe('UserCreateDialogComponent', () => {
  it('asks for the picked role as a list of roles', () => {
    const dialog = new UserCreateDialogComponent({} as NgbActiveModal, {} as MessageDialog);
    dialog.form.setValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      password: 'analytical engine',
      email: 'ada@example.org',
      roles: 'admin',
    });

    expect(dialog.getValue()).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      password: 'analytical engine',
      email: 'ada@example.org',
      roles: ['admin'],
      createdByAdmin: true,
    });
  });
});
