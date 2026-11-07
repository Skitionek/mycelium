import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { AppUser } from 'app/interfaces';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

import { UserUpdateDialogComponent } from './user-update-dialog.component';

describe('UserUpdateDialogComponent', () => {
  const user = {
    hashId: 'user-hash',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    roles: ['user'],
  } as AppUser;

  function dialogFor(isSelf: boolean) {
    const dialog = new UserUpdateDialogComponent({} as NgbActiveModal, {} as MessageDialog);
    dialog.isSelf = isSelf;
    dialog.setUser(user);
    return dialog;
  }

  it('asks for the picked role as a list of roles', () => {
    const dialog = dialogFor(false);
    dialog.form.patchValue({roles: 'admin'});

    expect(dialog.getValue()).toEqual({
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      roles: ['admin'],
      hashId: 'user-hash',
    });
  });

  it('asks for no roles when editing one\'s own account', () => {
    expect(dialogFor(true).getValue()).toEqual({
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
      hashId: 'user-hash',
    });
  });
});
