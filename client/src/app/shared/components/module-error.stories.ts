import { CommonModule } from '@angular/common';

import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ModuleErrorComponent } from 'app/shared/components/module-error.component';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { UserError } from 'app/shared/exceptions';

const messages: Record<number, string> = {
  404: 'The requested resource could not be found.',
  500: 'The server encountered an error. Please try again later.',
};

const meta: Meta<ModuleErrorComponent> = {
  title: 'Shared/Module Error',
  component: ModuleErrorComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
      providers: [
        MockProvider(ErrorHandler, {
          createUserError: (error) => of(new UserError(error.message, messages[error.status], [])),
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

/** A null error renders the placeholder shown while the error is resolved. */
export const Loading: Story = {
  args: {
    error: null,
  },
};
