import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { BackgroundTaskProgressComponent } from 'app/shared/components/background-task-progress.component';
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

const meta: Meta<BackgroundTaskProgressComponent> = {
  title: 'Shared/Background Task Progress',
  component: BackgroundTaskProgressComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<BackgroundTaskProgressComponent>;

export const Loading: Story = {
  args: {
    status: taskStatus({ state: TaskState.Running, running: true, progressShown: true }),
  },
};

export const RetryInProgress: Story = {
  args: {
    status: taskStatus({ retryInProgressShown: true }),
  },
};

export const Failed: Story = {
  args: {
    status: taskStatus({ failedErrorShown: true, error: new Error('nope') }),
  },
};

export const Idle: Story = {
  args: {
    status: taskStatus({ loaded: true, resultsShown: true }),
  },
};
