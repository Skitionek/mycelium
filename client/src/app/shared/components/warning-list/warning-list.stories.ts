import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject } from 'rxjs';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { WarningListComponent } from 'app/shared/components/warning-list/warning-list.component';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

/**
 * The real service ages warnings out on a timer, which would make a screenshot
 * depend on when it was taken. These subjects hold a fixed set instead.
 */
function warningControllerStub(warnings: string[]): Partial<WarningControllerService> {
  return {
    warnings: new BehaviorSubject(warnings),
    currentWarnings: new BehaviorSubject(warnings),
    close: () => undefined,
  } as Partial<WarningControllerService>;
}

const sampleWarnings = [
  'Node "kinase" could not be matched to the graph.',
  'Two edges share the same endpoints; only one is drawn.',
];

const meta: Meta<WarningListComponent> = {
  title: 'Shared/Warning List',
  component: WarningListComponent,
  decorators: [
    componentWrapperDecorator((story) => `<div style="width: 520px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<WarningListComponent>;

function storyWith(warnings: string[], args: Partial<WarningListComponent>): Story {
  return {
    decorators: [
      moduleMetadata({
        imports: [CommonModule, NgbModule],
        providers: [
          { provide: WarningControllerService, useValue: warningControllerStub(warnings) },
        ],
      }),
    ],
    args,
  };
}

export const Dismissible: Story = storyWith(sampleWarnings, {
  showAll: false,
  dismissible: true,
});

/** Inside the warnings modal the alerts are not dismissible. */
export const NotDismissible: Story = storyWith(sampleWarnings, {
  showAll: true,
  dismissible: false,
});

export const NoWarnings: Story = storyWith([], {
  showAll: false,
  dismissible: true,
});
