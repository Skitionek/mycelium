import {Component, Input} from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { AppUser, UserUpdateRequest } from 'app/interfaces';

@Component({
  selector: 'app-user-update-dialog',
  templateUrl: './user-update-dialog.component.html',
})
export class UserUpdateDialogComponent extends CommonFormDialogComponent {
  @Input() isSelf: boolean;
  user: AppUser;
  roles = ['admin', 'user'];

  readonly form: FormGroup = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
    username: new FormControl('', Validators.required),
    roles: new FormControl('')

  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): UserUpdateRequest {
    // The value has no roles when their control is disabled, as for one's own account
    const {roles, ...value} = this.form.value;
    return {
      ...value,
      // The form picks one role, the API takes a list of them
      ...(roles != null ? {roles: [roles]} : {}),
      hashId: this.user.hashId,
    };
  }

  setUser(user: AppUser) {
    this.user = user;
    this.form.reset({
      username: this.user.username,
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      roles: this.user.roles.includes('admin') ? 'admin' : 'user'
    });
    if (this.isSelf) {
          this.form.controls.roles.disable();
    }
  }
}


