import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { MockProvider } from 'ng-mocks';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { ClipboardService } from 'app/shared/services/clipboard.service';

import { SankeyLayoutService } from './sankey-layout.service';
import { SankeyComponent } from './sankey.component';

const meta: Meta<SankeyComponent> = {
  title: 'SankeyViewer/Sankey',
  component: SankeyComponent,
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

type Story = StoryObj<SankeyComponent>;

export const Default: Story = {};
