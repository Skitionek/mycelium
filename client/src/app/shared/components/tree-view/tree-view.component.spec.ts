import { CdkTreeModule } from '@angular/cdk/tree';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeViewComponent } from './tree-view.component';

interface SampleNode {
  label: string;
  children?: SampleNode[];
}

@Component({
  template: `
    <app-tree-view [dataSource]="dataSource" [getChildren]="getChildren" [hasChild]="hasChild"
                   [treeNode]="leaf" [nestedTreeNode]="nested">
      <ng-template #leaf let-node>{{ node.label }}</ng-template>
      <ng-template #nested let-node>{{ node.label }}</ng-template>
    </app-tree-view>`,
  standalone: false,
})
class HostComponent {
  dataSource: SampleNode[] = [
    {label: 'Metabolism', children: [{label: 'Glycolysis'}]},
    {label: 'Signal transduction'},
  ];
  getChildren?: (node: SampleNode) => SampleNode[] | undefined = node => node.children;
  hasChild?: (index: number, node: SampleNode) => boolean = (_, node) => (node.children ?? []).length > 0;
}

describe('TreeViewComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const nodes = () => Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('cdk-nested-tree-node'));
  const toggles = () => Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('button'));

  function show(configure: (host: HostComponent) => void = () => {}) {
    fixture = TestBed.createComponent(HostComponent);
    configure(fixture.componentInstance);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HostComponent, TreeViewComponent],
      imports: [CommonModule, CdkTreeModule],
    });
  });

  it('renders the root nodes collapsed, with a toggle on the ones that have children', () => {
    show();

    expect(nodes().map(node => node.textContent.trim())).toEqual(['Metabolism', 'Signal transduction']);
    expect(toggles().length).toBe(1);
    expect(toggles()[0].getAttribute('aria-label')).toBe('Toggle Metabolism');
  });

  it('shows the children of a node once it is expanded', () => {
    show();

    toggles()[0].click();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(nodes().map(node => node.textContent.trim())).toContain('Glycolysis');
  });

  // A tree without a children accessor has nothing to expand; it must not take the
  // rest of the page down with it.
  it('renders every node as a leaf when there is no children accessor', () => {
    show(host => {
      host.getChildren = undefined;
      host.hasChild = () => false;
    });

    expect(nodes().map(node => node.textContent.trim())).toEqual(['Metabolism', 'Signal transduction']);
    expect(toggles().length).toBe(0);
  });
});
