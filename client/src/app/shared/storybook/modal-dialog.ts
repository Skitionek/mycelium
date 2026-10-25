import { componentWrapperDecorator } from '@storybook/angular';

import { ModalBodyComponent } from 'app/shared/components/modal/modal-body.component';
import { ModalFooterComponent } from 'app/shared/components/modal/modal-footer.component';
import { ModalHeaderComponent } from 'app/shared/components/modal/modal-header.component';

/**
 * The header/body/footer a dialog template projects into. Without them the
 * `app-modal-*` tags are unknown elements and the dialog collapses to one line.
 */
export const MODAL_DECLARATIONS = [ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent];

/** Frames a dialog the way NgbModal does when it opens one. */
export const modalDialogWrapper = componentWrapperDecorator(
  (story) => `
    <div class="modal d-block position-relative">
      <div class="modal-dialog"><div class="modal-content">${story}</div></div>
    </div>`,
);
