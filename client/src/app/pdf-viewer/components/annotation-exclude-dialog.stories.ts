import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { NgbActiveModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MockProvider } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { AnnotationExcludeDialogComponent } from 'app/pdf-viewer/components/annotation-exclude-dialog.component';
import { FormInputFeedbackComponent } from 'app/shared/components/form/form-input-feedback.component';
import { FormRowComponent } from 'app/shared/components/form/form-row.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { AnnotationType } from 'app/shared/constants';
import { MODAL_DECLARATIONS, modalDialogWrapper } from 'app/shared/storybook/modal-dialog';

const meta: Meta<AnnotationExcludeDialogComponent> = {
  title: 'PDF Viewer/Annotation Exclude Dialog',
  component: AnnotationExcludeDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, NgbModule],
      declarations: [...MODAL_DECLARATIONS, FormRowComponent, FormInputFeedbackComponent],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
      ],
    }),
    modalDialogWrapper,
  ],
};

export default meta;

type Story = StoryObj<AnnotationExcludeDialogComponent>;

export const Default: Story = {
  args: {
    text: 'MAPK1',
    type: AnnotationType.Chemical,
  },
};

export const GeneType: Story = {
  args: {
    text: 'BRCA1',
    type: AnnotationType.Gene,
  },
};
