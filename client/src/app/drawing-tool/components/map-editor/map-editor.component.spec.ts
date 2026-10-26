import { MapEditorComponent } from './map-editor.component';

describe('MapEditorComponent lock checking', () => {
  function createEditorStandIn(locator: string | undefined) {
    const filesystemService = jasmine.createSpyObj('FilesystemService', ['getLocks', 'acquireLock']);
    const standIn = {
      locator,
      filesystemService,
      lockAcquired: null,
      lastActivityTime: window.performance.now(),
      lastLockCheckTime: window.performance.now(),
      veryInactiveDuration: 1000 * 60 * 30,
      inactiveDuration: 1000 * 60 * 5,
      slowLockCheckTimeInterval: 1000 * 60 * 2,
      clearLockInterval: () => {},
    };
    return {standIn, filesystemService};
  }

  it('should not ask for the locks of a map that has no locator yet', () => {
    // Given an editor whose locator has not been assigned yet
    const {standIn, filesystemService} = createEditorStandIn(undefined);

    // When the editor checks the lock, as it does right after it is initialised
    MapEditorComponent.prototype.acquireLock.call(standIn);

    // Then no request is made for the file "undefined"
    expect(filesystemService.acquireLock).not.toHaveBeenCalled();
    expect(filesystemService.getLocks).not.toHaveBeenCalled();
  });
});
