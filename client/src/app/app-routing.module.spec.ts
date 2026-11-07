import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router } from '@angular/router';

import { routes } from 'app/app-routing.module';

function flatten(config: Route[]): Route[] {
  return config.flatMap(route => [route, ...flatten(route.children ?? [])]);
}

describe('AppRoutingModule routes', () => {
  const allRoutes = flatten(routes);

  it('should be a configuration the router accepts', () => {
    TestBed.configureTestingModule({providers: [provideRouter([])]});
    const router = TestBed.inject(Router);

    expect(() => router.resetConfig(routes)).not.toThrow();
  });

  it('should not guard redirects', () => {
    // The router never activates a redirect, so a guard on one is rejected
    // as an invalid configuration.
    const guardedRedirects = allRoutes
      .filter(route => route.redirectTo != null && route.canActivate?.length)
      .map(route => route.path);

    expect(guardedRedirects).toEqual([]);
  });

  it('should give every tab icon with a style prefix a fa- icon class', () => {
    // WorkspaceComponent.calculateFontAwesomeIcon() passes icons containing a
    // space through untouched, so 'fas chart-bar' renders no glyph.
    const brokenIcons = allRoutes
      .map(route => route.data?.fontAwesomeIcon as string | undefined)
      .filter(icon => icon?.includes(' ') && !icon.split(' ').some(cls => cls.startsWith('fa-')));

    expect(brokenIcons).toEqual([]);
  });
});
