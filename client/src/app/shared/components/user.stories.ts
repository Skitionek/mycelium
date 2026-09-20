import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MockComponents } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { TermHighlightComponent } from 'app/shared/components/term-highlight.component';
import { UserComponent } from 'app/shared/components/user.component';
import { AppUser } from 'app/interfaces';

const user: AppUser = {
  id: 1,
  hashId: 'abc123',
  email: 'ada@example.org',
  firstName: 'Ada',
  lastName: 'Lovelace',
  username: 'alovelace',
  roles: ['user'],
};

const meta: Meta<UserComponent> = {
  title: 'Shared/User',
  component: UserComponent,
  decorators: [
    moduleMetadata({
      declarations: [MockComponents(TermHighlightComponent)],
      imports: [CommonModule, NgbModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<UserComponent>;

export const Default: Story = {
  args: {
    user,
    highlightTerms: [],
  },
};

/** No user resolves to an italic placeholder rather than an empty cell. */
export const Unknown: Story = {
  args: {
    user: undefined,
    highlightTerms: [],
  },
};
