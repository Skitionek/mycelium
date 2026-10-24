import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MockProvider, MockDirective } from 'ng-mocks';
import { componentWrapperDecorator, moduleMetadata, Meta, StoryObj } from '@storybook/angular';

import { ProjectMenuComponent } from 'app/shared/components/project-menu/project-menu.component';
import { ProjectImpl } from 'app/file-browser/models/filesystem-object';
import { ProjectActions } from 'app/file-browser/services/project-actions';
import { LinkWithHrefDirective, LinkWithoutHrefDirective } from 'app/shared/directives/link.directive';

function makeProject(administrable = false): ProjectImpl {
  const project = new ProjectImpl();
  project.name = 'my-project';
  project.hashId = 'proj123';
  project.privileges = { readable: true, writable: true, administrable };
  return project;
}

const meta: Meta<ProjectMenuComponent> = {
  title: 'Shared/Project Menu',
  component: ProjectMenuComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, NgbModule, RouterModule.forRoot([])],
      declarations: [MockDirective(LinkWithHrefDirective), MockDirective(LinkWithoutHrefDirective)],
      providers: [MockProvider(ProjectActions)],
    }),
    // The menu is the body of a dropdown; render it inside one.
    componentWrapperDecorator((story) => `<div class="dropdown-menu show position-static">${story}</div>`),
  ],
};

export default meta;

type Story = StoryObj<ProjectMenuComponent>;

export const ReadOnly: Story = {
  args: {
    project: makeProject(false),
    showTools: true,
  },
};

export const Administrable: Story = {
  args: {
    project: makeProject(true),
    showTools: true,
  },
};
