import { CommonModule } from '@angular/common';

import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ModuleErrorComponent } from 'app/shared/components/module-error.component';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { UserError } from 'app/shared/exceptions';

const meta: Meta<ModuleErrorComponent> = {
  title: 'Shared/Module Error',
  component: ModuleErrorComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      providers: [
        MockProvider(ErrorHandler, {
          createUserError: (_error, _opts) =>
            of(new UserError('Not Found', 'The requested resource could not be found.', [])),
        }),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<ModuleErrorComponent>;

export const NotFound: Story = {
  args: {
    error: { status: 404, message: 'Not Found' },
  },
};

export const ServerError: Story = {
  args: {
    error: { status: 500, message: 'Internal Server Error' },
  },
};

export const NoError: Story = {
  args: {
    error: null,
  },
};
