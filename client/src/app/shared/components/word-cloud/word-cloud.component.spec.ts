import { throttled } from './word-cloud.component';

describe('throttled', () => {
  it('should call the wrapped function once per frame with the latest arguments', async () => {
    // Given a throttled spy
    const spy = jasmine.createSpy('resize');
    const throttledSpy = throttled(spy);

    // When it is called several times before the frame runs
    throttledSpy(100, 100);
    throttledSpy(200, 200);
    throttledSpy(300, 300);
    await nextFrame();

    // Then only the last call gets through
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(300, 300);
  });

  it('should not call the wrapped function after cancel drops a pending frame', async () => {
    // Given a throttled spy with a frame already requested
    const spy = jasmine.createSpy('resize');
    const throttledSpy = throttled(spy);
    throttledSpy(100, 100);

    // When the pending frame is cancelled
    throttledSpy.cancel();
    await nextFrame();

    // Then the wrapped function never runs
    expect(spy).not.toHaveBeenCalled();
  });

  it('should schedule again after a cancel', async () => {
    // Given a throttle whose pending frame was cancelled
    const spy = jasmine.createSpy('resize');
    const throttledSpy = throttled(spy);
    throttledSpy(100, 100);
    throttledSpy.cancel();

    // When it is called again
    throttledSpy(400, 400);
    await nextFrame();

    // Then the new call is delivered
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(400, 400);
  });

  it('should tolerate cancel when no frame is pending', () => {
    // Given a throttle that was never called
    const spy = jasmine.createSpy('resize');
    const throttledSpy = throttled(spy);

    // When cancel runs anyway
    const cancelTwice = () => {
      throttledSpy.cancel();
      throttledSpy.cancel();
    };

    // Then it does not throw
    expect(cancelTwice).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

/**
 * Resolves after the frame the throttle requested has had a chance to run.
 * Two frames deep because the callback is queued during the first one.
 */
function nextFrame(): Promise<void> {
  return new Promise(resolve =>
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
  );
}
