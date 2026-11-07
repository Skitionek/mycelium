import { CdkTreeModule } from '@angular/cdk/tree';
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeViewComponent } from 'app/shared/components/tree-view/tree-view.component';

import { ObjectExplorerComponent } from './object-explorer.component';

describe('ObjectExplorerComponent', () => {
  let fixture: ComponentFixture<ObjectExplorerComponent>;

  const nodes = () => Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('cdk-nested-tree-node'));
  const toggle = (label: string) => fixture.nativeElement.querySelector(`button[aria-label="Toggle ${label}"]`) as HTMLElement;

  function show(dataSource: {}) {
    fixture = TestBed.createComponent(ObjectExplorerComponent);
    fixture.componentInstance.dataSource = dataSource;
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ObjectExplorerComponent, TreeViewComponent],
      imports: [CommonModule, CdkTreeModule],
    });
  });

  it('shows the properties of an object as collapsed nodes', () => {
    show({name: 'Glycolysis', detail: {source: 'KEGG'}});

    expect(nodes().length).toBe(2);
    expect(nodes()[0].textContent).toContain('name');
    expect(nodes()[0].textContent).toContain('Glycolysis');
    // Only the object-valued property is expandable
    expect(toggle('detail')).toBeTruthy();
    expect(toggle('name')).toBeNull();
  });

  it('shows the contents of a node when it is expanded', () => {
    show({detail: {source: 'KEGG'}});
    expect(nodes().length).toBe(1);

    toggle('detail').click();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(nodes().length).toBe(2);
  });

  // The tree is rendered lazily so that objects that refer back to themselves (the graph
  // data of the Sankey viewers does) can be shown. Deciding whether a node is expandable
  // must therefore not walk its descendants.
  it('shows an object that contains itself', () => {
    const circular: any = {name: 'loop'};
    circular.self = circular;

    show(circular);
    fixture.detectChanges();

    expect(nodes().length).toBe(2);
    expect(toggle('self')).toBeTruthy();
  });

  it('does not ask for the children of collapsed nodes again on every change detection', () => {
    const getChildren = spyOn(ObjectExplorerComponent.prototype, 'getChildren').and.callThrough();
    show({a: {b: {c: {d: 1}}}, e: {f: 2}});
    const callsAfterRender = getChildren.calls.count();

    fixture.detectChanges();
    fixture.detectChanges();

    expect(getChildren.calls.count()).toBe(callsAfterRender);
  });
});
