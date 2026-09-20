import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MockComponents } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { WarningListComponent } from 'app/shared/components/warning-list/warning-list.component';
import { WarningPillComponent } from 'app/shared/components/warning-pill/warning-pill.component';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

function warningControllerStub(warnings: string[]): Partial<WarningControllerService> {
  return {
    warnings: new BehaviorSubject(warnings),
    currentWarnings: new BehaviorSubject(warnings),
  } as Partial<WarningControllerService>;
}

const meta: Meta<WarningPillComponent> = {
  title: 'Shared/Warning Pill',
  component: WarningPillComponent,
};

export default meta;

type Story = StoryObj<WarningPillComponent>;

function storyWith(warnings: string[]): Story {
  return {
    decorators: [
      moduleMetadata({
        declarations: [MockComponents(WarningListComponent)],
        imports: [CommonModule, NgbModule],
        providers: [
          { provide: WarningControllerService, useValue: warningControllerStub(warnings) },
        ],
      }),
    ],
  };
}

/** The pill only appears once something has warned. */
export const WithWarnings: Story = storyWith(['Node could not be matched to the graph.']);

export const NoWarnings: Story = storyWith([]);
