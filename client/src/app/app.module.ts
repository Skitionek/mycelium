import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule, Title } from '@angular/platform-browser';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { RootStoreModule } from 'app/root-store';
import { AdminModule } from 'app/admin/admin.module';
import { AuthModule } from 'app/auth/auth.module';
import { UserModule } from 'app/users/users.module';
import { AppRoutingModule } from 'app/app-routing.module';
import { AppComponent } from 'app/app.component';
import { SharedModule } from 'app/shared/shared.module';
import { httpInterceptorProviders } from 'app/shared/http-interceptors';
import { DrawingToolModule } from 'app/drawing-tool/drawing-tool.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { WorkspaceComponent } from 'app/workspace.component';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { UnloadConfirmationGuard } from 'app/shared/guards/UnloadConfirmation.guard';
import { DashboardComponent } from 'app/dashboard.component';
import { AppVersionDialogComponent } from 'app/app-version-dialog.component';
import { FileNavigatorModule } from 'app/file-navigator/file-navigator.module';
import { GlobalErrorHandler } from 'app/global-error-handler';
import { EnrichmentTablesModule } from 'app/enrichment/enrichment-tables.module';
import { EnrichmentVisualisationsModule } from 'app/enrichment/enrichment-visualisation.module';
import { FileTypesModule } from 'app/file-types/file-types.module';

@NgModule({
  declarations: [
    AppComponent,
    WorkspaceComponent,
    AppVersionDialogComponent,
    DashboardComponent,
  ],
  imports: [
    BrowserModule,
    AdminModule,
    AuthModule,
    SharedModule,
    AppRoutingModule,
    FileTypesModule,
    FileBrowserModule,
    UserModule,
    // ngrx
    RootStoreModule,
    DrawingToolModule,
    NgbModule,
    FileNavigatorModule,
    EnrichmentVisualisationsModule,
    EnrichmentTablesModule,
  ],
  providers: [
    httpInterceptorProviders,
    Title,
    WorkspaceManager,
    UnloadConfirmationGuard,
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    }
  ],
  exports: [],
  bootstrap: [AppComponent],
})
export class AppModule {
}
