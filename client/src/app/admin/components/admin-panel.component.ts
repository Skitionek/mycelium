import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * The administration panel.
 */
@Component({
  selector: 'app-admin-panel',
  templateUrl: 'admin-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdminPanelComponent {
  /**
   * The currently active tab.
   */
  activeTab: 'users';

  constructor() {
  }
}
