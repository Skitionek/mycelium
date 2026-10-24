import { CommonModule } from '@angular/common';

import { MockProvider, MockComponents } from 'ng-mocks';
import { of } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { UserSelectComponent } from 'app/shared/components/form/user-select.component';
import { SelectInputComponent } from 'app/shared/components/form/select-input.component';
import { AccountsService } from 'app/shared/services/accounts.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

const meta: Meta<UserSelectComponent> = {
  title: 'Shared/Form/User Select',
  component: UserSelectComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      declarations: [MockComponents(SelectInputComponent)],
      providers: [
        MockProvider(AccountsService, {
          search: () => of({ results: { items: [], total: 0 } } as any),
        }),
        MockProvider(ErrorHandler),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<UserSelectComponent>;

export const Single: Story = {
  args: {
    multiple: false,
    placeholder: 'Select a user',
    excludeSelf: false,
  },
};

export const Multiple: Story = {
  args: {
    multiple: true,
    placeholder: 'Select users',
    excludeSelf: false,
  },
};
