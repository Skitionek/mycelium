import { CommonModule } from '@angular/common';

import { Subject } from 'rxjs';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { GenericFileUploadComponent } from 'app/shared/components/generic-file-upload/generic-file-upload.component';

const meta: Meta<GenericFileUploadComponent> = {
  title: 'Shared/Generic File Upload',
  component: GenericFileUploadComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
    componentWrapperDecorator((story) => `<div style="width: 560px">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<GenericFileUploadComponent>;

/**
 * No file chosen yet. The component requires `resetFileInputSubject`; without
 * one it throws in ngOnInit, so every story supplies a real subject.
 */
export const Empty: Story = {
  args: {
    accept: '.xlsx',
    resetFileInputSubject: new Subject<boolean>(),
  },
};

/**
 * A chosen filename appears beside the button. The name is set directly
 * because a real file cannot be put into a file input from a story.
 */
export const WithSelectedFile: Story = {
  render: (args) => ({
    props: {
      ...args,
      fileName: 'enrichment-results.xlsx',
    },
  }),
  args: {
    accept: '.xlsx',
    resetFileInputSubject: new Subject<boolean>(),
  },
};
