import { CommonModule } from '@angular/common';
import { CdkTreeModule } from '@angular/cdk/tree';

import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ObjectExplorerComponent } from 'app/shared/components/object-explorer/object-explorer.component';
import { TreeViewComponent } from 'app/shared/components/tree-view/tree-view.component';

const meta: Meta<ObjectExplorerComponent> = {
  title: 'Shared/Object Explorer',
  component: ObjectExplorerComponent,
  decorators: [
    moduleMetadata({
      declarations: [TreeViewComponent],
      imports: [CommonModule, CdkTreeModule],
    }),
    componentWrapperDecorator((story) => `<div style="width: 420px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<ObjectExplorerComponent>;

/** A plain object is turned into label/value nodes, collapsed by default. */
export const PlainObject: Story = {
  args: {
    dataSource: {
      name: 'Glycolysis',
      organism: 'Escherichia coli',
      nodeCount: 42,
      published: true,
      detail: {
        source: 'KEGG',
        pathway: 'eco00010',
      },
    },
  },
};

/** Values can be falsy without the node disappearing. */
export const FalsyValues: Story = {
  args: {
    dataSource: {
      label: '',
      count: 0,
      enabled: false,
    },
  },
};

export const Empty: Story = {
  args: {
    dataSource: {},
  },
};
