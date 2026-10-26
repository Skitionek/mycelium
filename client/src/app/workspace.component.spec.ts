import { Component, EventEmitter, NgModule, OnInit } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AppModule } from 'app/app.module';
import { ModuleProperties } from 'app/shared/modules';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { WorkspaceComponent } from 'app/workspace.component';

describe('WorkspaceComponent', () => {
    // Pure, so it is exercised without standing up the whole workspace.
    const calculateFontAwesomeIcon = WorkspaceComponent.prototype.calculateFontAwesomeIcon;

    it('should give tabs without an icon the window icon', () => {
        expect(calculateFontAwesomeIcon(null)).toBe('fa fa-window-maximize');
        expect(calculateFontAwesomeIcon(undefined)).toBe('fa fa-window-maximize');
    });

    it('should prefix a bare icon name', () => {
        expect(calculateFontAwesomeIcon('file-pdf')).toBe('fa fa-file-pdf');
    });

    it('should pass full icon classes through', () => {
        expect(calculateFontAwesomeIcon('fas fa-chart-network')).toBe('fas fa-chart-network');
    });
});

@Component({template: 'Stub file view'})
class StubFileViewComponent implements OnInit {
    modulePropertiesChange = new EventEmitter<ModuleProperties>();

    ngOnInit() {
        // Like the file viewers, report the file name once it has loaded
        setTimeout(() => this.modulePropertiesChange.emit({
            title: 'stub-file.txt',
            fontAwesomeIcon: 'file',
        }));
    }
}

@NgModule({
    declarations: [StubFileViewComponent],
    imports: [RouterModule.forChild([{path: '', component: StubFileViewComponent}])],
})
class StubFileViewRouteModule {
}

const SESSION_STORAGE_KEY = 'mycelium_workspace_session';

describe('WorkspaceComponent tabs', () => {
    afterEach(() => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    });

    it('should name a tab after the file shown by its lazily loaded view', async () => {
        // Given a workspace with one tab whose route is loaded lazily, like the file viewers
        TestBed.configureTestingModule({imports: [AppModule]});
        TestBed.inject(Router).resetConfig([{
            path: 'workspaces/:space_id',
            component: WorkspaceComponent,
            children: [{
                path: 'stub-file',
                outlet: 'left-0',
                loadChildren: () => StubFileViewRouteModule,
            }],
        }]);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
            panes: [{
                id: 'left',
                activeTabHistory: [0],
                tabs: [{url: '/stub-file', title: 'Tab', fontAwesomeIcon: null}],
            }],
        }));

        // When the workspace opens and the view reports the file it shows
        const harness = await RouterTestingHarness.create('/workspaces/local');
        await harness.fixture.whenStable();
        harness.detectChanges();
        await new Promise(resolve => setTimeout(resolve));
        harness.detectChanges();

        // Then the tab is named after the file
        const workspaceManager = TestBed.inject(WorkspaceManager);
        const [{tab}] = [...workspaceManager.panes.allTabs()];
        expect(tab.title).toBe('stub-file.txt');
    });
});
