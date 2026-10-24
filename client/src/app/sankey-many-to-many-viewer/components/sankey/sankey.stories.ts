import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { ClipboardService } from 'app/shared/services/clipboard.service';
import { SankeyLayoutService } from 'app/sankey-viewer/components/sankey/sankey-layout.service';

import { SankeyManyToManyComponent } from './sankey.component';

const meta: Meta<SankeyManyToManyComponent> = {
  title: 'SankeyManyToMany/Sankey',
  component: SankeyManyToManyComponent,
  parameters: {
    imageSnapshot: { skip: true },
  },
  decorators: [
    moduleMetadata({
      imports: [MatSnackBarModule],
      providers: [
        MockProvider(ClipboardService),
        MockProvider(SankeyLayoutService),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<SankeyManyToManyComponent>;

export const Default: Story = {};
