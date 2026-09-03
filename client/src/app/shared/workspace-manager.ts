import { Injectable } from '@angular/core';
import {
  ActivationEnd,
  NavigationExtras,
  Router,
  UrlTree,
} from '@angular/router';
import { moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

import { filter } from 'rxjs/operators';
import { BehaviorSubject, Subscription } from 'rxjs';
import { cloneDeep } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties } from './modules';
import {
  TabData,
  WorkspaceSessionLoader,
  WorkspaceSessionService,
} from './services/workspace-session.service';

export interface TabDefaults {
  title: string;
  fontAwesomeIcon: string;
}

/**
 * Represents a tab with a title. Content is rendered by the Angular router
 * outlet identified by {@link outletName}.
 */
export class Tab {
  /** Named outlet used by the Angular router to render this tab's content. */
  outletName: string;
  url: string;
  defaultsSet = false;
  title = 'New Tab';
  fontAwesomeIcon: string = null;
  badge: string = null;
  loading = false;

  pendingProperties: ModuleProperties | undefined;

  get absoluteUrl(): string {
    return new URL(this.url.replace(/^\/+/, '/'), new URL(window.location.href)).href;
  }

  queuePropertyChange(properties: ModuleProperties) {
    this.pendingProperties = cloneDeep(properties);
  }

  /**
   * Apply any queued property changes. Returns true when there were pending
   * changes so callers can decide whether to persist state.
   */
  applyPendingChanges(): boolean {
    if (this.pendingProperties) {
      this.title = this.pendingProperties.title;
      this.fontAwesomeIcon = this.pendingProperties.fontAwesomeIcon;
      this.badge = this.pendingProperties.badge;
      this.loading = !!this.pendingProperties.loading;
      this.pendingProperties = null;
      return true;
    }
    return false;
  }
}

/**
 * Represents a pane that has a collection of tabs. A pane might
 * be part of a split view or a pane might be a sidebar window.
 */
export class Pane {
  /**
   * Percentage width of the pane.
   */
  size: number | undefined;

  /**
   * The tabs that are a part of this pane.
   */
  readonly tabs: Tab[] = [];

  /**
   * A list of active tabs in the past, where last entry is the current
   * active tab. Sets are kept in insertion order and we keep a list of
   * active tabs so that when a tab is closed, we know what the previous
   * tab was so we can switch to it.
   */
  readonly activeTabHistory: Set<Tab> = new Set();

  /** Monotonically increasing counter used to generate unique outlet names. */
  private outletCounter = 0;

  constructor(readonly id: string) {
  }

  applyPendingChanges(): boolean {
    let changed = false;
    for (const tab of this.tabs) {
      if (tab.applyPendingChanges()) {
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Get the current active tab, if any.
   */
  get activeTab(): Tab | undefined {
    let active: Tab = null;
    for (const tab of this.activeTabHistory.values()) {
      active = tab;
    }
    return active;
  }

  /**
   * Set the given tab to be the active tab.
   * @param tab the tab to make active
   */
  set activeTab(tab: Tab) {
    if (tab != null) {
      this.activeTabHistory.delete(tab);
      this.activeTabHistory.add(tab);
    }
  }

  /**
   * Get the active tab or created an empty tab if there is none.
   */
  getActiveTabOrCreate(): Tab {
    const tab = this.activeTab;
    if (tab) {
      return tab;
    }
    if (this.tabs.length) {
      this.activeTab = this.tabs[0];
      return this.activeTab;
    }
    return this.createTab();
  }

  /**
   * Create a new tab and add it to this pane.
   */
  createTab(): Tab {
    const tab = new Tab();
    tab.outletName = `${this.id}-${this.outletCounter++}`;
    this.tabs.push(tab);
    this.activeTab = tab;
    return tab;
  }

  /**
   * Remove the given tab from this pane.
   * @param tab the tab
   */
  deleteTab(tab: Tab): boolean {
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i] === tab) {
        this.tabs.splice(i, 1);
        this.activeTabHistory.delete(tab);
        return true;
      }
    }
    return false;
  }

  /**
   * Remove the currently active tab.
   */
  deleteActiveTab(): boolean {
    const activeTab = this.activeTab;
    if (this.activeTab) {
      return this.deleteTab(activeTab);
    }
    return false;
  }

  /**
   * Called for the previous pane when a tab is moved from one pane to another.
   * @param tab the tab that was moved
   */
  handleTabMoveFrom(tab: Tab) {
    this.activeTabHistory.delete(tab);
  }

  /**
   * Called for the new pane when a tab is moved from one pane to another.
   * @param tab the tab that was moved
   */
  handleTabMoveTo(tab: Tab) {
    this.activeTabHistory.add(tab);
  }

  /**
   * Destroy all tabs and unload their components.
   */
  destroy() {
    for (const tab of this.tabs) {
      this.deleteTab(tab);
    }
  }
}

/**
 * Manages a set of panes.
 */
export class PaneManager {
  panes: Pane[] = [];

  /**
   * Create a new pane.
   * @param id the pane ID that must be unique
   */
  create(id: string): Pane {
    for (const existingPane of this.panes) {
      if (existingPane.id === id) {
        throw new Error(`pane ${existingPane.id} already created`);
      }
    }
    const pane = new Pane(id);
    this.panes.push(pane);
    return pane;
  }

  /**
   * Get the pane by the given ID.
   * @param id the ID
   */
  get(id: string): Pane | undefined {
    for (const pane of this.panes) {
      if (pane.id === id) {
        return pane;
      }
    }
    return null;
  }

  /**
   * Get the pane by the given ID or create the pane if it doesn't exist.
   * @param id the ID
   */
  getOrCreate(id: string): Pane {
    const pane = this.get(id);
    if (pane) {
      return pane;
    }
    return this.create(id);
  }

  /**
   * Get the first pane or created one if one doesn't exist.
   */
  getFirstOrCreate() {
    const it = this.panes.values().next();
    return !it.done ? it.value : this.create('left');
  }

  /**
   * Remove the given pane.
   * @param pane the pane
   */
  delete(pane: Pane): boolean {
    for (let i = 0; i < this.panes.length; i++) {
      if (this.panes[i] === pane) {
        this.panes.splice(i, 1);
        pane.destroy();
        return true;
      }
    }
    return false;
  }

  /**
   * Delete all panes.
   */
  clear() {
    for (const pane of this.panes) {
      this.delete(pane);
    }
  }

  /**
   * Get all the tabs within all the panes.
   */
  * allTabs(): IterableIterator<{ pane: Pane, tab: Tab }> {
    for (const pane of this.panes) {
      for (const tab of pane.tabs) {
        yield {
          pane,
          tab,
        };
      }
    }
  }

  applyPendingChanges(): boolean {
    let changed = false;
    for (const pane of this.panes) {
      if (pane.applyPendingChanges()) {
        changed = true;
      }
    }
    return changed;
  }
}

@Injectable({
  providedIn: 'root',
})
export class WorkspaceManager {
  panes: PaneManager;
  readonly workspaceUrl = '/workspaces/local';
  focusedPane: Pane | undefined;
  panes$ = new BehaviorSubject<Pane[]>([]);
  private loaded = false;

  /** Maps outlet name → active component instance (set via router outlet activate events). */
  private readonly activeComponents = new Map<string, any>();
  /** Maps outlet name → subscription for modulePropertiesChange. */
  private readonly componentSubscriptions = new Map<string, Subscription>();

  constructor(readonly router: Router,
              private readonly sessionService: WorkspaceSessionService) {
    this.panes = new PaneManager();
    this.subscribeToActivationEnd();
    this.emitEvents();
  }

  isWithinWorkspace() {
    return this.router.url.startsWith(this.workspaceUrl);
  }

  /**
   * Listen for route ActivationEnd events to populate tab titles from route
   * data when no explicit defaults have been provided.
   */
  private subscribeToActivationEnd() {
    this.router.events
      .pipe(filter(event => event instanceof ActivationEnd))
      .subscribe((event: ActivationEnd) => {
        const outletName = event.snapshot.outlet;
        const tab = this.findTabByOutletName(outletName);
        if (tab && event.snapshot.component) {
          if (!tab.defaultsSet) {
            tab.title = event.snapshot.data.title || tab.title;
            tab.fontAwesomeIcon = event.snapshot.data.fontAwesomeIcon || tab.fontAwesomeIcon;
          } else {
            tab.defaultsSet = false;
          }
          this.emitEvents();
        }
      });
  }

  /**
   * Build the full workspace URL encoding all open tabs as named outlets.
   * Produces something like `/workspaces/local(left-0:projects/foo//left-1:search/graph)`.
   */
  buildWorkspaceUrl(): string {
    const outletParts: string[] = [];
    for (const {tab} of this.panes.allTabs()) {
      if (tab.url) {
        // Strip query string and fragment – Angular named outlets carry path only
        const path = tab.url.split('?')[0].split('#')[0].replace(/^\/+/, '');
        if (path) {
          outletParts.push(`${tab.outletName}:${path}`);
        }
      }
    }
    if (outletParts.length === 0) {
      return this.workspaceUrl;
    }
    return `${this.workspaceUrl}/(${outletParts.join('//')})`;
  }

  /**
   * Find the tab whose outlet name matches the given value.
   */
  findTabByOutletName(outletName: string): Tab | undefined {
    for (const {tab} of this.panes.allTabs()) {
      if (tab.outletName === outletName) {
        return tab;
      }
    }
    return undefined;
  }

  /**
   * Register the component that has just been activated in a named router
   * outlet. Subscribes to the component's modulePropertiesChange if present.
   */
  registerComponent(outletName: string, component: any) {
    this.activeComponents.set(outletName, component);
    if (this.componentSubscriptions.has(outletName)) {
      this.componentSubscriptions.get(outletName).unsubscribe();
      this.componentSubscriptions.delete(outletName);
    }
    if (component && (component as ModuleAwareComponent).modulePropertiesChange) {
      const tab = this.findTabByOutletName(outletName);
      if (tab) {
        const sub = (component as ModuleAwareComponent).modulePropertiesChange.subscribe(
          (props: ModuleProperties) => tab.queuePropertyChange(props)
        );
        this.componentSubscriptions.set(outletName, sub);
      }
    }
  }

  /**
   * Unregister the component that has been deactivated in a named router outlet.
   */
  unregisterComponent(outletName: string) {
    this.activeComponents.delete(outletName);
    if (this.componentSubscriptions.has(outletName)) {
      this.componentSubscriptions.get(outletName).unsubscribe();
      this.componentSubscriptions.delete(outletName);
    }
  }

  /**
   * Return the component currently active in the given tab's router outlet.
   */
  getComponentForTab(tab: Tab): any {
    return this.activeComponents.get(tab.outletName);
  }

  moveTab(from: Pane, fromIndex: number, to: Pane, toIndex: number) {
    if (from === to) {
      moveItemInArray(from.tabs, fromIndex, toIndex);
    } else {
      const tab = from.tabs[fromIndex];
      transferArrayItem(from.tabs, to.tabs, fromIndex, toIndex);
      from.handleTabMoveFrom(tab);
      to.handleTabMoveTo(tab);
    }
    this.save();
    this.emitEvents();
  }

  openTabByUrl(pane: Pane | string,
               url: string | UrlTree,
               extras?: NavigationExtras & WorkspaceNavigationExtras,
               tabDefaults?: TabDefaults): Promise<boolean> {
    if (typeof pane === 'string') {
      pane = this.panes.getOrCreate(pane);
    }
    this.focusedPane = pane;
    const tab = pane.createTab();
    if (tabDefaults) {
      tab.title = tabDefaults.title;
      tab.fontAwesomeIcon = tabDefaults.fontAwesomeIcon;
      tab.defaultsSet = true;
    }
    const urlStr = typeof url === 'string' ? url : this.router.serializeUrl(url);
    tab.url = urlStr;
    return this.router.navigateByUrl(this.buildWorkspaceUrl());
  }

  navigateByUrl(navigationData: NavigationData): Promise<boolean> {
    const extras = navigationData.extras || {};
    const urlStr = typeof navigationData.url === 'string'
      ? navigationData.url
      : this.router.serializeUrl(navigationData.url as UrlTree);

    const withinWorkspace = this.isWithinWorkspace();

    if (withinWorkspace || extras.forceWorkbench) {
      let targetPane = this.focusedPane || this.panes.getFirstOrCreate();

      // Handle forceWorkbench + openParentFirst: open parent in left, child in right
      if (!withinWorkspace && extras.forceWorkbench && extras.openParentFirst && extras.parentAddress) {
        const leftPane = this.panes.getOrCreate('left');
        const rightPane = this.panes.getOrCreate('right');

        // Check for existing parent tab in left pane
        const parentUrlStr = typeof extras.parentAddress === 'string'
          ? extras.parentAddress
          : this.router.serializeUrl(extras.parentAddress);
        let parentTab: Tab | undefined;
        for (const t of leftPane.tabs) {
          if (t.url && t.url === parentUrlStr) {
            leftPane.activeTab = t;
            parentTab = t;
            break;
          }
        }
        if (!parentTab) {
          parentTab = leftPane.createTab();
          parentTab.url = parentUrlStr;
        }

        const childTab = rightPane.createTab();
        childTab.url = urlStr;
        this.focusedPane = rightPane;
        this.save();
        this.emitEvents();
        return this.router.navigateByUrl(this.buildWorkspaceUrl());
      }

      if (extras.newTab) {
        if (extras.sideBySide) {
          let sideBySidePane = null;
          for (const otherPane of this.panes.panes) {
            if (targetPane.id !== otherPane.id) {
              sideBySidePane = otherPane;
              break;
            }
          }

          if (sideBySidePane == null) {
            if (targetPane.id === 'left') {
              targetPane = this.panes.create('right');
            } else {
              targetPane = this.panes.create('left');
            }
          } else {
            targetPane = sideBySidePane;
          }
        }

        if (extras.preferPane) {
          const preferredPane = this.panes.get(extras.preferPane);
          if (preferredPane) {
            targetPane = preferredPane;
          }
        }

        if (extras.matchExistingTab != null) {
          let foundTab = false;

          for (const tab of targetPane.tabs) {
            if (tab.url && tab.url.match(extras.matchExistingTab)) {
              targetPane.activeTab = tab;
              foundTab = true;

              // This mechanism allows us to update an existing tab in a one-way data coupling
              if (extras.shouldReplaceTab != null) {
                const component = this.getComponentForTab(tab);
                if (component != null) {
                  if (!extras.shouldReplaceTab(component)) {
                    this.emitEvents();
                    return Promise.resolve(true);
                  }
                }
              }

              break;
            }
          }

          if (!foundTab) {
            const newTab = targetPane.createTab();
            newTab.url = urlStr;
          }
        } else {
          const newTab = targetPane.createTab();
          newTab.url = urlStr;
        }

        this.focusedPane = targetPane;
      } else {
        // Navigate in the current active tab
        const tab = targetPane.getActiveTabOrCreate();
        tab.url = urlStr;
      }

      this.save();
      this.emitEvents();
      return this.router.navigateByUrl(this.buildWorkspaceUrl());
    } else {
      return this.router.navigateByUrl(navigationData.url, extras);
    }
  }

  navigateByUrls(navigationData: NavigationData[]): Promise<boolean> {
    return new Promise((accept, reject) => {
      navigationData.forEach((navData) => {
        const extras = navData.extras || {};
        // We need a delay because things break if we do it too quickly
        setTimeout(() => {
          this.navigateByUrl({url: navData.url, extras}).then(accept, reject);
        }, 10);
      });
    });
  }

  navigate(commands: any[], extras: NavigationExtras & WorkspaceNavigationExtras = {skipLocationChange: false}): Promise<boolean> {
    return this.navigateByUrl({url: this.router.createUrlTree(commands, extras), extras});
  }

  emitEvents(): void {
    this.panes$.next(this.buildPanesSnapshot());
  }

  initialLoad() {
    if (!this.loaded) {
      this.loaded = true;
      this.load();
    }
  }

  load() {
    const parent = this;

    this.panes.clear();

    const hasSession = this.sessionService.load(new class implements WorkspaceSessionLoader {
      createPane(id: string, options): void {
        const pane = parent.panes.create(id);
        pane.size = options.size;
      }

      loadTab(id: string, data: TabData): void {
        const pane = parent.panes.get(id);
        if (!pane) {
          return;
        }
        const tab = pane.createTab();
        tab.url = data.url;
        tab.title = data.title || 'New Tab';
        tab.fontAwesomeIcon = data.fontAwesomeIcon || null;
        tab.defaultsSet = true;
      }

      setPaneActiveTabHistory(id: string, indices: number[]): void {
        const pane = parent.panes.get(id);
        if (!pane) {
          return;
        }
        pane.activeTabHistory.clear();
        indices.forEach(index => {
          if (pane.tabs[index]) {
            pane.activeTabHistory.add(pane.tabs[index]);
          }
        });
      }
    }());

    if (!hasSession) {
      const leftPane = this.panes.create('left');
      this.panes.create('right');
      const tab = leftPane.createTab();
      tab.url = '/projects';
      tab.title = 'File Browser';
      tab.fontAwesomeIcon = 'layer-group';
      tab.defaultsSet = true;
    }

    this.router.navigateByUrl(this.buildWorkspaceUrl()).then(() => {
      this.emitEvents();
    });
  }

  save() {
    this.sessionService.save(this.panes.panes);
  }

  shouldConfirmUnload(): { pane: Pane, tab: Tab } | undefined {
    for (const {pane, tab} of this.panes.allTabs()) {
      if (this.shouldConfirmTabUnload(tab)) {
        return {pane, tab};
      }
    }
    return null;
  }

  shouldConfirmTabUnload(tab: Tab) {
    const component = this.getComponentForTab(tab);
    return !!(component && component.shouldConfirmUnload && component.shouldConfirmUnload());
  }

  applyPendingChanges() {
    if (this.panes.applyPendingChanges()) {
      this.save();
      this.emitEvents();
    }
  }

  private buildPanesSnapshot(): Pane[] {
    return this.panes.panes;
  }
}

export interface WorkspaceNavigationExtras {
  preferPane?: string;
  preferStartupPane?: string;
  newTab?: boolean;
  sideBySide?: boolean;
  matchExistingTab?: string | RegExp;
  shouldReplaceTab?: (component: any) => boolean;
  forceWorkbench?: boolean;
  openParentFirst?: boolean;
  parentAddress?: UrlTree;
}

// Grouped the arguments required by the navigateByUrl function in order to simplify handling navigateByUrls
// of missing extras in navigateByUrls
export interface NavigationData {
  url: string | UrlTree;
  extras?: NavigationExtras & WorkspaceNavigationExtras;
}
