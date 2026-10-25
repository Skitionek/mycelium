import { CollectionChange, CollectionModel } from './collection-model';

function record<T>(model: CollectionModel<T>) {
  const items: CollectionChange<T>[] = [];
  const selection: CollectionChange<T>[] = [];
  model.itemChanges$.subscribe(change => items.push(change));
  model.selectionChanges$.subscribe(change => selection.push(change));
  return {items, selection};
}

function members<T>(set: Set<T>): T[] {
  return [...set];
}

describe('CollectionModel', () => {
  describe('items', () => {
    it('ignores duplicates', () => {
      const model = new CollectionModel(['a', 'b', 'a']);
      model.push('b');

      expect(model.items).toEqual(['a', 'b']);
      expect(model.length).toBe(2);
    });

    it('reports what replace added and removed', () => {
      const model = new CollectionModel(['a', 'b']);
      const changes = record(model);

      model.replace(['b', 'c']);

      expect(changes.items.length).toBe(1);
      expect(members(changes.items[0].added)).toEqual(['c']);
      expect(members(changes.items[0].removed)).toEqual(['a']);
    });

    it('reports nothing when replace changes nothing', () => {
      const model = new CollectionModel(['a', 'b']);
      const changes = record(model);

      model.replace(['b', 'a']);

      expect(changes.items).toEqual([]);
    });

    it('drops removed items from the selection', () => {
      const model = new CollectionModel(['a', 'b'], {multipleSelection: true});
      model.select('a', 'b');
      const changes = record(model);

      model.replace(['b']);
      model.delete('b');

      expect(model.selection).toEqual([]);
      expect(changes.selection.map(change => members(change.removed))).toEqual([['a'], ['b']]);
    });
  });

  describe('view', () => {
    it('filters and sorts', () => {
      const model = new CollectionModel([3, 1, 4, 1, 5, 9, 2, 6], {
        filter: n => n % 2 === 1,
        sort: (a, b) => a - b,
      });

      expect(model.view).toEqual([1, 3, 5, 9]);
      expect(model.viewLength).toBe(4);
    });

    it('follows changes to the items, filter and sort', () => {
      const model = new CollectionModel([2, 1]);
      expect(model.view).toEqual([2, 1]);

      model.push(3);
      expect(model.view).toEqual([2, 1, 3]);

      model.sort = (a, b) => a - b;
      expect(model.view).toEqual([1, 2, 3]);

      model.filter = n => n > 1;
      expect(model.view).toEqual([2, 3]);

      model.delete(3);
      expect(model.view).toEqual([2]);
    });
  });

  describe('single selection', () => {
    it('keeps only the latest selected item', () => {
      const model = new CollectionModel(['a', 'b']);
      model.select('a');
      const changes = record(model);

      model.select('b');

      expect(model.selection).toEqual(['b']);
      expect(members(changes.selection[0].added)).toEqual(['b']);
      expect(members(changes.selection[0].removed)).toEqual(['a']);
    });

    it('selects the last of several items, reporting only real changes', () => {
      const model = new CollectionModel(['a', 'b', 'c']);
      const changes = record(model);

      model.select('a', 'b');

      expect(model.selection).toEqual(['b']);
      expect(changes.selection.length).toBe(1);
      expect(members(changes.selection[0].added)).toEqual(['b']);
      expect(members(changes.selection[0].removed)).toEqual([]);
    });

    it('reports nothing when the item is already selected', () => {
      const model = new CollectionModel(['a']);
      model.select('a');
      const changes = record(model);

      model.select('a');

      expect(changes.selection).toEqual([]);
    });
  });

  describe('multiple selection', () => {
    let model: CollectionModel<string>;

    beforeEach(() => {
      model = new CollectionModel(['a', 'b', 'c'], {multipleSelection: true});
    });

    it('adds to the selection', () => {
      model.select('a');
      model.select('c');

      expect(model.selection).toEqual(['a', 'c']);
      expect(model.lastSelection).toBe('c');
    });

    it('toggles single items', () => {
      model.toggle('a');
      model.toggle('b');
      model.toggle('a');

      expect(model.selection).toEqual(['b']);
      expect(model.isSelected('a')).toBeFalse();
      expect(model.isSelected('b')).toBeTrue();
    });

    it('selects only one item', () => {
      model.select('a', 'b');
      const changes = record(model);

      model.selectOnly('c');

      expect(model.selection).toEqual(['c']);
      expect(changes.selection.map(change => [members(change.added), members(change.removed)]))
        .toEqual([[[], ['a', 'b']], [['c'], []]]);
    });

    it('toggles all items', () => {
      model.select('a');
      expect(model.isAllSelected()).toBeFalse();

      model.toggleAll();
      expect(model.isAllSelected()).toBeTrue();
      expect(model.selection.length).toBe(3);

      model.toggleAll();
      expect(model.selection).toEqual([]);
    });

    it('clears the selection', () => {
      model.selectAll();
      model.clear();

      expect(model.selection).toEqual([]);
      expect(model.lastSelection).toBeNull();
    });
  });

  it('does not count an empty collection as all selected', () => {
    // The select-all checkbox of an empty folder would otherwise show ticked.
    const model = new CollectionModel<string>([], {multipleSelection: true});

    expect(model.isAllSelected()).toBeFalse();
  });
});
