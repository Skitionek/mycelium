import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgbActiveModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MockProvider } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { AnnotationEditDialogComponent } from 'app/pdf-viewer/components/annotation-edit-dialog.component';
import { LinksPanelComponent } from 'app/drawing-tool/components/links-panel.component';
import { FormInputFeedbackComponent } from 'app/shared/components/form/form-input-feedback.component';
import { FormRowComponent } from 'app/shared/components/form/form-row.component';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { MODAL_DECLARATIONS, modalDialogWrapper } from 'app/shared/storybook/modal-dialog';
import { WorkspaceManager } from 'app/shared/workspace-manager';

const meta: Meta<AnnotationEditDialogComponent> = {
  title: 'PDF Viewer/Annotation Edit Dialog',
  component: AnnotationEditDialogComponent,
  decorators: [
    moduleMetadata({
      // FormsModule: the links panel is bound with [(ngModel)] inside the reactive form.
      imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
      declarations: [...MODAL_DECLARATIONS, FormRowComponent, FormInputFeedbackComponent, LinksPanelComponent],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
        MockProvider(DataTransferDataService),
        MockProvider(WorkspaceManager),
      ],
    }),
    modalDialogWrapper,
  ],
};

export default meta;

type Story = StoryObj<AnnotationEditDialogComponent>;

export const Default: Story = {
  args: {
    pageNumber: 1,
    keywords: ['MAPK1'],
    coords: [[100, 200, 200, 220]],
    allText: 'MAPK1',
  },
};
