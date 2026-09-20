import { CommonModule } from '@angular/common';

import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ContentProgressComponent } from 'app/shared/components/content-progress.component';
import { LoadingIndicatorComponent } from 'app/shared/components/loading-indicator.component';
import { TaskState, TaskStatus } from 'app/shared/rxjs/background-task';

function taskStatus(overrides: Partial<TaskStatus>): TaskStatus {
  return {
    state: TaskState.Idle,
    running: false,
    delayedRunning: false,
    loaded: false,
    placeholdersShown: false,
    progressShown: false,
    emptyResultsShown: false,
    retryInProgressShown: false,
    failedErrorShown: false,
    resultsShown: false,
    error: null,
    ...overrides,
  };
}

const meta: Meta<ContentProgressComponent> = {
  title: 'Shared/Content Progress',
  component: ContentProgressComponent,
  decorators: [
    moduleMetadata({
      declarations: [LoadingIndicatorComponent],
      imports: [CommonModule],
    }),
    componentWrapperDecorator((story) => `<div style="height: 220px; width: 520px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<ContentProgressComponent>;

export const Loading: Story = {
  args: {
    status: taskStatus({ state: TaskState.Running, running: true }),
    loadingText: 'Loading results',
    errorText: 'Could not load results',
  },
};

export const Failed: Story = {
  args: {
    status: taskStatus({
      state: TaskState.RetryLimitExceeded,
      failedErrorShown: true,
      error: new Error('nope'),
    }),
    loadingText: 'Loading results',
    errorText: 'Could not load results',
  },
};

/** Idle renders nothing at all, which is why the capture is empty. */
export const Idle: Story = {
  args: {
    status: taskStatus({ loaded: true, resultsShown: true }),
    loadingText: 'Loading results',
    errorText: 'Could not load results',
  },
};
