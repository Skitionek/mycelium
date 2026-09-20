import { CommonModule } from '@angular/common';

import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ProjectImpl } from 'app/file-browser/models/filesystem-object';
import { ProjectIconComponent } from 'app/shared/components/project-icon/project-icon.component';

/**
 * The icon tints itself from `project.colorHue`, which the model derives from
 * the project's hashId. Fixed hashIds therefore give fixed colours.
 */
function project(hashId: string): ProjectImpl {
  return Object.assign(new ProjectImpl(), { hashId, name: hashId });
}

const meta: Meta<ProjectIconComponent> = {
  title: 'Shared/Project Icon',
  component: ProjectIconComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<ProjectIconComponent>;

export const Default: Story = {
  args: {
    project: project('kinase-atlas'),
    size: '24px',
  },
};

/** A different project hashes to a different hue. */
export const DifferentProject: Story = {
  args: {
    project: project('metabolic-map'),
    size: '24px',
  },
};

/** `size` drives font-size, so the glyph scales with it. */
export const Large: Story = {
  args: {
    project: project('kinase-atlas'),
    size: '48px',
  },
};
