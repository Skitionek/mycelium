import { UnloadConfirmationGuard } from './UnloadConfirmation.guard';

describe('UnloadConfirmationGuard', () => {
  let guard: UnloadConfirmationGuard;

  beforeEach(() => {
    guard = new UnloadConfirmationGuard();
  });

  it('should allow leaving a route that has no active component', () => {
    // Given a route whose outlet holds no component, which Angular reports as null
    const component = null;
    spyOn(window, 'confirm');

    // When the router asks whether the route can be left
    const canLeave = guard.canDeactivate(component);

    // Then leaving is allowed without asking the user
    expect(canLeave).toBeTrue();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('should ask the user before leaving a component with unsaved changes', () => {
    // Given a component with unsaved changes and a user who declines to leave
    const component = {shouldConfirmUnload: () => true};
    spyOn(window, 'confirm').and.returnValue(false);

    // When the router asks whether the route can be left
    const canLeave = guard.canDeactivate(component);

    // Then leaving is blocked
    expect(window.confirm).toHaveBeenCalled();
    expect(canLeave).toBeFalse();
  });
});
