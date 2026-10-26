import {
  AfterContentChecked,
  AfterViewChecked,
  Component,
  ElementRef,
  HostListener,
  OnChanges,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChildrenOutletContexts, PRIMARY_OUTLET } from '@angular/router';

import { Observable, Subscription } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { SplitComponent } from 'angular-split';
import { Pane, Tab, WorkspaceManager } from 'app/shared/workspace-manager';
import { CopyLinkDialogComponent } from 'app/shared/components/dialog/copy-link-dialog.component';
import { ViewService } from 'app/file-browser/services/view.service';


@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class WorkspaceComponent implements OnInit, OnChanges, AfterContentChecked, AfterViewChecked {
  @ViewChild('container', {static: true, read: ElementRef}) container: ElementRef;
  @ViewChild('splitComponent', {static: false}) splitComponent: SplitComponent;
  panes$: Observable<Pane[]>;

  // A lazily loaded route in a named outlet is rendered inside a placeholder
  // component, and the routed view sits in the placeholder's own outlet. These
  // track the tab outlets whose inner outlet is still to be found, and the
  // subscriptions that follow the views it activates.
  private readonly outletsAwaitingInnerOutlet = new Set<string>();
  private readonly innerOutletSubscriptions = new Map<string, Subscription>();

  constructor(protected readonly workspaceManager: WorkspaceManager,
              protected readonly modalService: NgbModal,
              protected readonly viewService: ViewService,
              protected readonly tabOutletContexts: ChildrenOutletContexts) {
    this.panes$ = this.workspaceManager.panes$;
  }

  ngOnInit() {
    // The session creates the panes, so it is loaded before the first check;
    // creating them once the view was checked fails the dev-mode check (NG0100)
    this.workspaceManager.initialLoad();
  }

  ngOnChanges() {
    this.workspaceManager.save();
  }

  ngAfterContentChecked() {
    this.workspaceManager.applyPendingChanges();
  }

  ngAfterViewChecked() {
    this.followInnerOutlets();
  }

  /**
   * Called by the router outlet (activate) event. Registers the component with
   * the workspace manager so titles, badges and unload guards work correctly.
   */
  onComponentActivate(outletName: string, component: any) {
    this.workspaceManager.registerComponent(outletName, component);
    if (!component?.modulePropertiesChange) {
      this.outletsAwaitingInnerOutlet.add(outletName);
    }
  }

  /**
   * Called by the router outlet (deactivate) event.
   */
  onComponentDeactivate(outletName: string) {
    this.outletsAwaitingInnerOutlet.delete(outletName);
    this.innerOutletSubscriptions.get(outletName)?.unsubscribe();
    this.innerOutletSubscriptions.delete(outletName);
    this.workspaceManager.unregisterComponent(outletName);
  }

  /**
   * Register the routed view instead of the placeholder that holds it, and every
   * view its outlet activates later, such as a map switching to its editor.
   * The inner outlet only exists once the placeholder has been rendered.
   */
  private followInnerOutlets() {
    for (const outletName of this.outletsAwaitingInnerOutlet) {
      const tabContext = this.tabOutletContexts.getContext(outletName);
      const innerOutlet = tabContext?.children.getContext(PRIMARY_OUTLET)?.outlet;
      if (!innerOutlet) {
        continue;
      }

      this.outletsAwaitingInnerOutlet.delete(outletName);
      if (innerOutlet.isActivated) {
        this.workspaceManager.registerComponent(outletName, innerOutlet.component);
      }
      const subscription = innerOutlet.activateEvents.subscribe(component => {
        this.workspaceManager.registerComponent(outletName, component);
      });
      this.innerOutletSubscriptions.set(outletName, subscription);
    }
  }

  tabDropped(event: CdkDragDrop<Pane>) {
    const to = event.container.data;
    const from = event.previousContainer.data;
    this.workspaceManager.moveTab(from, event.previousIndex, to, event.currentIndex);
  }

  addTab(pane: Pane, url: string) {
    this.workspaceManager.openTabByUrl(pane, url);
  }

  duplicateTab(pane: Pane, tab: Tab) {
    this.workspaceManager.navigateByUrl({
      url: tab.url,
      extras: {newTab: true}
    });
  }

  copyLinkToTab(pane: Pane, tab: Tab) {
    const component = this.workspaceManager.getComponentForTab(tab);
    const modalRef = this.modalService.open(CopyLinkDialogComponent);
    modalRef.componentInstance.url = 'Generating link...';
    const urlSubscription = this.viewService.getShareableLink(component, tab.url).subscribe(({href}) => {
      modalRef.componentInstance.url = href;
    });
    // todo: use hidden after update of ng-bootstrap >= 8.0.0
    // https://ng-bootstrap.github.io/#/components/modal/api#NgbModalRef
    modalRef.result.then(
      () => urlSubscription.unsubscribe(),
      () => urlSubscription.unsubscribe()
    );
    return modalRef.result;
  }

  closeTab(pane: Pane, tab: Tab) {
    const performClose = () => {
      pane.deleteTab(tab);
      this.workspaceManager.save();
      this.workspaceManager.router.navigateByUrl(this.workspaceManager.buildWorkspaceUrl()).then(() => {
        this.workspaceManager.emitEvents();
      });
    };
    if (this.workspaceManager.shouldConfirmTabUnload(tab)) {
      if (confirm('Close tab? Changes you made may not be saved.')) {
        performClose();
      }
    } else {
      performClose();
    }
  }

  closeOtherTabs(pane: Pane, tab: Tab) {
    this.closeTabs(pane, pane.tabs.filter(o => o !== tab));
  }

  closeAllTabs(pane: Pane) {
    this.closeTabs(pane, pane.tabs.slice());
  }

  closeTabs(pane: Pane, targetTabs: Tab[]) {
    let canClose = true;
    for (const targetTab of targetTabs) {
      if (this.workspaceManager.shouldConfirmTabUnload(targetTab)) {
        canClose = !!confirm('Close tabs? Changes you made may not be saved.');
        break;
      }
    }
    if (canClose) {
      for (const targetTab of targetTabs) {
        pane.deleteTab(targetTab);
      }
      this.workspaceManager.save();
      this.workspaceManager.router.navigateByUrl(this.workspaceManager.buildWorkspaceUrl()).then(() => {
        this.workspaceManager.emitEvents();
      });
    }
  }

  clearWorkbench() {
    for (const pane of this.workspaceManager.panes.panes) {
      this.closeAllTabs(pane);
    }
  }

  handleTabClick(e, pane: Pane, tab: Tab) {
    if (e && (e.which === 2 || e.button === 4)) {
      this.closeTab(pane, tab);
    } else {
      this.setActiveTab(pane, tab);
    }
    e.preventDefault();
  }

  splitterDragEnded(result) {
    result.sizes.forEach((size, index) => {
      this.workspaceManager.panes.panes[index].size = size;
    });
    this.workspaceManager.save();
  }

  setActiveTab(pane: Pane, tab: Tab) {
    pane.activeTab = tab;
    this.workspaceManager.save();
  }

  setFocus(pane: Pane) {
    this.workspaceManager.focusedPane = pane;
  }

  canAddPane() {
    return this.workspaceManager.panes.panes.length === 1;
  }

  addPane() {
    this.workspaceManager.panes.getOrCreate('right');
    this.workspaceManager.save();
  }

  closeRightPane() {
    this.workspaceManager.panes.delete(this.workspaceManager.panes.get('right'));
    this.workspaceManager.save();
  }

  shouldConfirmUnload(): boolean {
    const result = this.workspaceManager.shouldConfirmUnload();
    if (result) {
      result.pane.activeTab = result.tab;
      return true;
    } else {
      return false;
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    if (this.shouldConfirmUnload()) {
      event.returnValue = 'Leave page? Changes you made may not be saved';
    }
  }

  calculateFontAwesomeIcon(s: string) {
    if (s == null) {
      return 'fa fa-window-maximize';
    } else if (s.includes(' ')) {
      return s;
    } else {
      return 'fa fa-' + s;
    }
  }
}

class PlacedPane {
  constructor(readonly pane: Pane, readonly width: number) {
  }
}
