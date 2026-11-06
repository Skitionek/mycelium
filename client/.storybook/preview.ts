import { applicationConfig, moduleMetadata, type Preview } from '@storybook/angular';
import {
  ApplicationRef,
  ChangeDetectorRef,
  DestroyRef,
  inject,
  NgZone,
  provideEnvironmentInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

/**
 * Storybook creates the component that hosts a story at run time with `@Component` and no
 * `changeDetection`, which Angular 22 turns into `OnPush`. State that a story's component
 * changes by itself after the first render (for example in a `setTimeout`) is then never
 * painted, because nothing marks the host dirty. The application's own components are `Eager`
 * (see the `changeDetection` of each of them), so the stories mark the host dirty at the start
 * of every zone turn, which makes it checked after each one as it was before Angular 22.
 */
const checkStoryHostEagerly = provideEnvironmentInitializer(() => {
  const applicationRef = inject(ApplicationRef);
  const subscription = inject(NgZone).onUnstable.subscribe(() => {
    for (const {instance} of applicationRef.components) {
      (instance as {changeDetectorRef?: ChangeDetectorRef}).changeDetectorRef?.markForCheck();
    }
  });
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
});

const preview: Preview = {
  decorators: [
    // Angular 21 bootstraps zoneless unless told otherwise. The application keeps zone.js
    // (see src/main.ts), so the stories are rendered the same way.
    applicationConfig({
      providers: [provideZoneChangeDetection(), checkStoryHostEagerly],
    }),
    // Angular animations are non-deterministic under screenshot capture, and
    // no story asserts on them.
    moduleMetadata({
      imports: [NoopAnimationsModule],
    }),
  ],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
