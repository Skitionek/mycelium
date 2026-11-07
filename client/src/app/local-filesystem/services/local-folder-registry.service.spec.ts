import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { readManifest } from '../index-shard';
import { LocalFolderError } from '../local-folder-errors';
import { MemoryLocalRootStore } from '../local-root-store';
import { MemoryDirectoryHandle } from '../testing/memory-filesystem.spec';
import { configureLocalFolderTestBed } from '../testing/local-folder-test-utils.spec';
import { LocalFolderRegistry } from './local-folder-registry.service';

describe('LocalFolderRegistry', () => {
  let store: MemoryLocalRootStore;
  let registry: LocalFolderRegistry;

  beforeEach(() => {
    store = configureLocalFolderTestBed() as MemoryLocalRootStore;
    registry = TestBed.inject(LocalFolderRegistry);
  });

  it('connects a folder, remembers it and writes its identity into the folder', async () => {
    const folder = new MemoryDirectoryHandle('papers');
    const root = await registry.connect(folder);

    expect(root.access).toBe('granted');
    expect(root.writable).toBe(true);
    expect(root.annotate).toBe(true);
    expect(registry.roots.map(r => r.id)).toEqual([root.id]);
    expect(store.roots.get(root.id).handle).toBe(folder);
    expect((await readManifest(folder)).rootId).toBe(root.id);
  });

  it('gives a folder its old ID back when it is connected again', async () => {
    const folder = new MemoryDirectoryHandle('papers');
    const first = await registry.connect(folder);
    await registry.disconnect(first.id);
    expect(registry.roots.length).toBe(0);

    // Even with the browser's memory of it gone, the manifest in the folder brings the ID back
    const fresh = new LocalFolderRegistry(new MemoryLocalRootStore(), TestBed.inject(NgZone));
    const second = await fresh.connect(folder);
    expect(second.id).toBe(first.id);
  });

  it('does not connect the same folder twice', async () => {
    const folder = new MemoryDirectoryHandle('papers');
    const first = await registry.connect(folder);
    const second = await registry.connect(folder);
    expect(second.id).toBe(first.id);
    expect(registry.roots.length).toBe(1);
  });

  it('gives a copy of a connected folder its own ID', async () => {
    const original = new MemoryDirectoryHandle('papers');
    const first = await registry.connect(original);

    const copy = new MemoryDirectoryHandle('papers copy');
    const manifest = await original.readText('.mycelium/manifest.json');
    copy.dir('.mycelium').file('manifest.json', manifest);

    const second = await registry.connect(copy);
    expect(second.id).not.toBe(first.id);
    expect((await readManifest(copy)).rootId).toBe(second.id);
  });

  it('connects read-only folders without writing to them', async () => {
    const folder = new MemoryDirectoryHandle('readonly');
    folder.permission = 'denied';
    const root = await registry.connect(folder);
    expect(root.access).toBe('granted');
    expect(root.writable).toBe(false);
    expect(folder.children.size).toBe(0);
    await expectAsync(registry.ensureAccess(root.id, true)).toBeRejectedWith(jasmine.any(LocalFolderError));
  });

  it('restores folders after a reload and waits for access to be granted again', async () => {
    const folder = new MemoryDirectoryHandle('papers');
    const root = await registry.connect(folder);

    folder.permission = 'prompt';
    folder.readPermission = 'prompt';
    const reloaded = new LocalFolderRegistry(store, TestBed.inject(NgZone));
    await reloaded.ready;
    expect(reloaded.getRoot(root.id).access).toBe('prompt');

    folder.permission = 'granted';
    folder.readPermission = 'granted';
    const reconnected = await reloaded.reconnect(root.id);
    expect(reconnected.access).toBe('granted');
  });

  it('remembers the annotation setting in the folder', async () => {
    const folder = new MemoryDirectoryHandle('papers');
    const root = await registry.connect(folder);
    await registry.setAnnotate(root.id, false);
    expect(registry.getRoot(root.id).annotate).toBe(false);
    expect((await readManifest(folder)).annotate).toBe(false);

    await registry.disconnect(root.id);
    expect((await registry.connect(folder)).annotate).toBe(false);
  });

  it('refuses access to folders it does not know', async () => {
    await expectAsync(registry.ensureAccess('unknown0000')).toBeRejectedWith(jasmine.any(LocalFolderError));
  });
});
