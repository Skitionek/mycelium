import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { NgbActiveModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MockComponents, MockProvider } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { AnnotationEditDialogComponent } from 'app/pdf-viewer/components/annotation-edit-dialog.component';
import { ModalHeaderComponent } from 'app/shared/components/modal/modal-header.component';
import { ModalBodyComponent } from 'app/shared/components/modal/modal-body.component';
import { ModalFooterComponent } from 'app/shared/components/modal/modal-footer.component';
import { FormRowComponent } from 'app/shared/components/form/form-row.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

const meta: Meta<AnnotationEditDialogComponent> = {
  title: 'PDF Viewer/Annotation Edit Dialog',
  component: AnnotationEditDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ReactiveFormsModule, NgbModule],
      declarations: [
        MockComponents(ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent, FormRowComponent),
      ],
      providers: [
        MockProvider(NgbActiveModal),
        MockProvider(MessageDialog),
      ],
    }),
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
