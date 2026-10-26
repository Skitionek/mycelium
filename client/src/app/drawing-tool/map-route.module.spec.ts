import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';

import { AppModule } from 'app/app.module';

import { MapRouteModule } from './map-route.module';

@Component({template: ''})
class WorkspaceStubComponent {
}

function findRouteByPath(route: ActivatedRouteSnapshot, path: string): ActivatedRouteSnapshot | undefined {
  if (route.routeConfig?.path === path) {
    return route;
  }
  for (const child of route.children) {
    const found = findRouteByPath(child, path);
    if (found) {
      return found;
    }
  }
  return undefined;
}

describe('Map routes', () => {
  it('should tell the map editor which map to load when it is open in a workspace pane', async () => {
    // Given a workspace whose panes are named router outlets, as in the application
    TestBed.configureTestingModule({imports: [AppModule]});
    const router = TestBed.inject(Router);
    router.resetConfig([{
      path: 'workspaces/:space_id',
      component: WorkspaceStubComponent,
      children: [{
        path: 'projects/:project_name/maps/:hash_id',
        outlet: 'left-0',
        loadChildren: () => MapRouteModule,
      }],
    }]);

    // When a map is opened for editing in a pane
    await router.navigateByUrl('/workspaces/local/(left-0:projects/Example/maps/map-hash-id/edit)');

    // Then the editor's route carries the map's hash id
    const editRoute = findRouteByPath(router.routerState.snapshot.root, 'edit');
    expect(editRoute.params.hash_id).toBe('map-hash-id');
  });
});
