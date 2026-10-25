import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { OrganismAutocompleteComponent } from 'app/shared/components/organism-autocomplete.component';
import { SharedSearchService } from 'app/shared/services/shared-search.service';

const meta: Meta<OrganismAutocompleteComponent> = {
  title: 'Shared/Organism Autocomplete',
  component: OrganismAutocompleteComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, FormsModule, NgbModule],
      providers: [
        MockProvider(SharedSearchService, {
          getOrganisms: () => of({ nodes: [] } as any),
          getOrganismFromTaxId: () => of({ organism_name: 'Homo sapiens', tax_id: '9606' } as any),
        }),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<OrganismAutocompleteComponent>;

export const Empty: Story = {
  args: {
    organismTaxId: null,
  },
};

export const WithPreselected: Story = {
  args: {
    organismTaxId: '9606',
  },
};
