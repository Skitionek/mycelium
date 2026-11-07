import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { UserSelectComponent } from 'app/shared/components/form/user-select.component';
import { SelectInputComponent } from 'app/shared/components/form/select-input.component';
import { MouseNavigableDirective } from 'app/shared/directives/mouse-navigable.directive';
import { AccountsService } from 'app/shared/services/accounts.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

const meta: Meta<UserSelectComponent> = {
  title: 'Shared/Form/User Select',
  component: UserSelectComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule],
      // The select input is everything this wrapper renders, so it stays real.
      declarations: [SelectInputComponent, MouseNavigableDirective],
      providers: [
        MockProvider(AccountsService, {
          search: () => of({ results: { items: [], total: 0 } } as any),
        }),
        MockProvider(ErrorHandler, { create: () => (source) => source }),
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
