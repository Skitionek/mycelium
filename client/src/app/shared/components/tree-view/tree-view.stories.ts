import { CommonModule } from '@angular/common';
import { CdkTreeModule } from '@angular/cdk/tree';

import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { TreeViewComponent } from 'app/shared/components/tree-view/tree-view.component';

interface SampleNode {
  label: string;
  children?: SampleNode[];
}

const dataSource: SampleNode[] = [
  {
    label: 'Metabolism',
    children: [
      { label: 'Glycolysis' },
      {
        label: 'Citrate cycle',
        children: [{ label: 'Aconitase' }, { label: 'Citrate synthase' }],
      },
    ],
  },
  { label: 'Signal transduction' },
];

const meta: Meta<TreeViewComponent> = {
  title: 'Shared/Tree View',
  component: TreeViewComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, CdkTreeModule],
    }),
    componentWrapperDecorator((story) => `<div style="width: 360px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<TreeViewComponent>;

/**
 * The caller supplies both node templates; nodes start collapsed, so this shows
 * only the roots and their expand carets.
 */
export const Collapsed: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-tree-view [dataSource]="dataSource" [getChildren]="getChildren" [hasChild]="hasChild"
                     [treeNode]="treeNode" [nestedTreeNode]="nestedTreeNode">
        <ng-template #treeNode let-node>{{ node.label }}</ng-template>
        <ng-template #nestedTreeNode let-node>{{ node.label }}</ng-template>
      </app-tree-view>`,
  }),
  args: {
    dataSource,
    getChildren: (node: SampleNode) => node.children,
    hasChild: (_index: number, node: SampleNode) => (node.children ?? []).length > 0,
  },
};

export const Empty: Story = {
  ...Collapsed,
  args: {
    ...Collapsed.args,
    dataSource: [],
  },
};
