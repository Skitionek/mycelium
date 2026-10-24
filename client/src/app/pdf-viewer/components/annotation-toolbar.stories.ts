import { CommonModule } from '@angular/common';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { AnnotationToolbarComponent } from 'app/pdf-viewer/components/annotation-toolbar.component';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

const meta: Meta<AnnotationToolbarComponent> = {
  title: 'PDF Viewer/Annotation Toolbar',
  component: AnnotationToolbarComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule, MatSnackBarModule],
      providers: [MockProvider(ErrorHandler)],
    }),
  ],
};

export default meta;

type Story = StoryObj<AnnotationToolbarComponent>;

export const Active: Story = {
  args: {
    active: true,
    position: { top: 0, left: 0 },
  },
};

export const Inactive: Story = {
  args: {
    active: false,
    position: { top: 0, left: 0 },
  },
};
