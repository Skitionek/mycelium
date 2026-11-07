import { Component, Input, TemplateRef, OnChanges, SimpleChanges, ViewEncapsulation, ChangeDetectionStrategy, } from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';

interface TreeNode {
  label?: string;
  value?: string | number | boolean;
  children?: Array<any>;
}

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class TreeViewComponent implements OnChanges {
  /**
   * @params:
   * - dataSource - list of nodes to show
   * - getChildren - node children accessor
   * - hasChild - fast check for node children (without parsing them)
   * - treeNode - template to render leaf node
   * - nestTreeNode - template to render node with nested values
   * Usage example:
   *   <app-tree-view [dataSource]="dataSource"
   *                 [getChildren]="getChildren"
   *                 [hasChild]="hasChild"
   *                 [treeNode]="treeNode"
   *                 [nestedTreeNode]="nestTreeNode"
   *  >
   *      <!-- This is the tree node template for leaf nodes -->
   *      <ng-template #treeNode let-node>
   *          {{ node.label }}
   *      </ng-template>
   *      <!-- This is the tree node template for expandable nodes -->
   *      <ng-template #nestTreeNode let-node>
   *          {{ node.label }}
   *          <!-- Optionally inject counter in desired part of templates -->
   *          <span [attr.data-counter]="true"></span>
   *      </ng-template>
   *  </app-tree-view>
   */
  @Input() dataSource;
  @Input() treeNode: TemplateRef<any>;
  @Input() nestedTreeNode: TemplateRef<any>;
  @Input() getChildren: (node: any) => Array<any> | undefined;
  @Input() hasChild: (index: number, node: any) => boolean;
  treeControl;

  ngOnChanges({getChildren, hasChild}: SimpleChanges) {
    if (getChildren) {
      this.treeControl = new NestedTreeControl<TreeNode>(
        // The CDK asks the tree control for children while it renders and throws when there
        // is no accessor, so a missing one means that no node has children.
        getChildren.currentValue ?? (() => undefined),
        {
          // Without this the CDK decides whether a node is a leaf (for aria-expanded, on every
          // change detection) by walking all of its descendants. That never ends for objects
          // that refer back to themselves, which this view is meant to show, and is slow for
          // large ones. hasChild answers the same question without parsing the children, so
          // it must not depend on the index.
          isExpandable: node => !!this.hasChild?.(0, node),
        },
      );
    }
    if (hasChild) {
      this.hasChild = hasChild.currentValue;
    }
  }
}
