import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

import { TaskStatus } from '../rxjs/background-task';

@Component({
  selector: 'app-background-task-progress',
  templateUrl: './background-task-progress.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class BackgroundTaskProgressComponent {
  @Input() childClass = '';
  @Input() status: TaskStatus;
  @Output() refresh = new EventEmitter<void>();
}
