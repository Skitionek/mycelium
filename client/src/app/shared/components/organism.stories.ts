import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MockComponents } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { OrganismComponent } from 'app/shared/components/organism.component';
import { TermHighlightComponent } from 'app/shared/components/term-highlight.component';
import { OrganismAutocomplete } from 'app/interfaces';

const organism: OrganismAutocomplete = {
  organism_name: 'Escherichia coli',
  synonym: 'E. coli',
  tax_id: '562',
};

const meta: Meta<OrganismComponent> = {
  title: 'Shared/Organism',
  component: OrganismComponent,
  decorators: [
    moduleMetadata({
      declarations: [MockComponents(TermHighlightComponent)],
      imports: [CommonModule, NgbModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<OrganismComponent>;

export const Default: Story = {
  args: {
    organism,
    highlightTerms: [],
  },
};

/** No organism resolves to an italic placeholder. */
export const None: Story = {
  args: {
    organism: undefined,
    highlightTerms: [],
  },
};
