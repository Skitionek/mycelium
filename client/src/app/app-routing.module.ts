import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/components/admin-panel.component';
import { ObjectBrowserComponent } from 'app/file-browser/components/object-browser.component';
import { LoginComponent } from 'app/auth/components/login.component';
import { DashboardComponent } from 'app/dashboard.component';
import { AdminGuard } from 'app/admin/services/admin-guard.service';
import { AuthGuard } from 'app/auth/guards/auth-guard.service';
import { LoginGuard } from 'app/auth/guards/login-guard.service';
import { UserSettingsComponent } from 'app/users/components/user-settings.component';
import { TermsOfServiceComponent } from 'app/users/components/terms-of-service.component';
import { WorkspaceComponent } from 'app/workspace.component';
import { UnloadConfirmationGuard } from 'app/shared/guards/UnloadConfirmation.guard';
import { CommunityBrowserComponent } from 'app/file-browser/components/community-browser.component';
import { BrowserComponent } from 'app/file-browser/components/browser/browser.component';
import { ObjectNavigatorComponent } from 'app/file-navigator/components/object-navigator.component';
import { ObjectViewerComponent } from 'app/file-browser/components/object-viewer.component';

/**
 * Routes that can appear as tab content within the workspace. These are also
 * registered at the application root so they remain accessible via direct URL.
 */
const WORKSPACE_CONTENT_ROUTES: Routes = [
  {
    path: 'admin',
    component: AdminPanelComponent,
    canActivate: [AdminGuard],
    data: {
      title: 'Administration',
      fontAwesomeIcon: 'cog',
    },
  },
  {
    path: 'users/:user',
    component: UserSettingsComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Profile',
      fontAwesomeIcon: 'user-circle',
    },
  },
  {
    path: 'search',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/search/search-route.module').then((m) => m.SearchRouteModule),
    data: {
      title: 'Search',
      fontAwesomeIcon: 'search',
    },
  },
  {
    path: 'pathway-browser-prototype',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/shortest-path/shortest-path-route.module').then((m) => m.ShortestPathRouteModule),
  },
  {
    path: 'projects/:project_name/enrichment-table/:file_id',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/enrichment/enrichment-table-route.module').then((m) => m.EnrichmentTableRouteModule),
  },
  {
    path: 'projects/:project_name/enrichment-visualisation/:file_id',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/enrichment/enrichment-visualisation-route.module')
        .then((m) => m.EnrichmentVisualisationRouteModule),
  },
  {
    path: 'projects/:project_name/sankey/:file_id',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/sankey-viewer/sankey-viewer-route.module').then((m) => m.SankeyViewerRouteModule),
    data: {
      title: 'Sankey',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'projects/:project_name/sankey-many-to-many/:file_id',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/sankey-many-to-many-viewer/sankey-many-to-many-viewer-route.module')
        .then((m) => m.SankeyManyToManyViewerRouteModule),
    data: {
      title: 'Sankey',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'projects/:project_name/trace/:file_id/:trace_hash',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/trace-viewer/trace-viewer-route.module').then((m) => m.TraceViewerRouteModule),
    data: {
      title: 'Trace details',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'kg-visualizer',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/visualization/visualization-route.module').then((m) => m.VisualizationRouteModule),
    data: {
      title: 'Knowledge Graph',
      fontAwesomeIcon: 'fas fa-chart-network',
    },
  },
  {
    path: 'community',
    component: CommunityBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Community Content',
      fontAwesomeIcon: 'globe',
    },
  },
  {
    path: 'projects',
    component: BrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File Browser',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'projects/:project_name',
    component: ObjectBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Projects',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'projects/:project_name/folders',
    redirectTo: 'projects/:project_name',
    pathMatch: 'full',
  },
  {
    path: 'projects/:project_name/folders/:dir_id',
    redirectTo: 'folders/:dir_id',
    pathMatch: 'full',
  },
  {
    path: 'folders/:dir_id',
    component: ObjectBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Projects',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'files/:hash_id',
    component: ObjectViewerComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File',
      fontAwesomeIcon: 'file',
    },
  },
  {
    path: 'projects/:project_name/files/:file_id',
    loadChildren: () =>
      import('app/pdf-viewer/pdf-viewer-route.module').then((m) => m.PdfViewerRouteModule),
    canActivate: [AuthGuard],
    data: {
      title: 'PDF Viewer',
      fontAwesomeIcon: 'file-pdf',
    },
  },
  {
    path: 'projects/:project_name/bioc/:file_id',
    loadChildren: () =>
      import('app/bioc-viewer/bioc-viewer-route.module').then((m) => m.BiocViewerRouteModule),
    canActivate: [AuthGuard],
    data: {
      title: 'BioC Viewer',
      fontAwesomeIcon: 'file-alt',
    },
  },
  {
    path: 'projects/:project_name/code/:file_id',
    loadChildren: () =>
      import('app/codemirror-viewer/codemirror-viewer-route.module').then((m) => m.CodemirrorViewerRouteModule),
    canActivate: [AuthGuard],
    data: {
      title: 'Code Viewer',
      fontAwesomeIcon: 'file-code',
    },
  },
  {
    path: 'projects/:project_name/structure/:file_id',
    loadChildren: () =>
      import('app/molstar-viewer/molstar-viewer-route.module').then((m) => m.MolstarViewerRouteModule),
    canActivate: [AuthGuard],
    data: {
      title: 'Protein Structure Viewer',
      fontAwesomeIcon: 'dna',
    },
  },
  {
    path: 'projects/:project_name/sdrf/:file_id',
    loadChildren: () =>
      import('app/sdrf-viewer/sdrf-viewer-route.module').then((m) => m.SdrfViewerRouteModule),
    canActivate: [AuthGuard],
    data: {
      title: 'SDRF Viewer',
      fontAwesomeIcon: 'table',
    },
  },
  {
    path: 'projects/:project_name/maps/:hash_id',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/drawing-tool/map-route.module').then((m) => m.MapRouteModule),
    data: {
      title: 'Map',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'kg-statistics',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/kg-statistics-route.module').then((m) => m.KgStatisticsRouteModule),
    data: {
      fontAwesomeIcon: 'fas fa-chart-bar',
    },
  },
  {
    path: 'file-navigator/:project_name/:file_id',
    component: ObjectNavigatorComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File Navigator',
      fontAwesomeIcon: 'fas fa-compass',
    },
  },
  {
    path: 'enrichment-visualisation/:project_name/:file_id',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('app/enrichment/enrichment-visualisation-route.module')
        .then((m) => m.EnrichmentVisualisationRouteModule),
    data: {
      title: 'Enrichment Visualisation',
      fontAwesomeIcon: 'fas chart-bar',
    },
  },
];

// TODO: Add an unprotected home page
const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Dashboard',
      fontAwesomeIcon: 'home',
    },
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Dashboard',
      fontAwesomeIcon: 'home',
    },
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [LoginGuard],
    data: {
      title: 'Login',
      fontAwesomeIcon: 'sign-in-alt',
    },
  },
  {
    path: 'terms-of-service',
    component: TermsOfServiceComponent,
    data: {
      title: 'Terms of Service',
    },
  },
  // Workspace route: each tab is rendered as a named Angular router outlet.
  // Routes are pre-registered for the common outlet names (left-N, right-N).
  {
    path: 'workspaces/:space_id',
    component: WorkspaceComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Workbench',
    },
    canDeactivate: [UnloadConfirmationGuard],
    children: [
      ...['left', 'right'].flatMap(side =>
        Array.from({length: 10}, (_, i) =>
          WORKSPACE_CONTENT_ROUTES.map(route => ({
            ...route,
            outlet: `${side}-${i}`,
          }))
        ).flat()
      ),
    ],
  },
  // Content routes also available at root level for direct (non-workspace) navigation
  ...WORKSPACE_CONTENT_ROUTES,
  // Old links
  {path: 'file-browser', redirectTo: 'projects', pathMatch: 'full'},
  {path: 'pdf-viewer/:file_id', redirectTo: 'projects/beta-project/files/:file_id', pathMatch: 'full'},
  {path: 'dt/map', redirectTo: 'projects', pathMatch: 'full'},
  {path: 'dt/map/:hash_id', redirectTo: 'projects/beta-project/maps/maps/:hash_id', pathMatch: 'full'},
  {path: 'dt/map/edit/:hash_id', redirectTo: 'projects/beta-project/maps/:hash_id/edit', pathMatch: 'full'},
  {path: 'neo4j-upload', redirectTo: 'kg-visualizer/upload', pathMatch: 'full'},
  {path: 'neo4j-visualizer', redirectTo: 'kg-visualizer', pathMatch: 'full'},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {
}
