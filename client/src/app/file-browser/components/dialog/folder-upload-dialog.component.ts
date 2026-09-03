import { Component, ElementRef, Input, ViewChild } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { FilesystemObject } from '../../models/filesystem-object';

@Component({
  selector: 'app-folder-upload-dialog',
  templateUrl: './folder-upload-dialog.component.html',
})
export class FolderUploadDialogComponent extends CommonFormDialogComponent<FolderUploadDialogValue> {
  @ViewChild('folderInput', {static: false})
  protected readonly folderInputElement: ElementRef;

  @Input() title = 'Upload Folder';

  private _parent: FilesystemObject;
  selectedFiles: File[] = [];
  folderName = '';
  fileCount = 0;

  readonly form: FormGroup = new FormGroup({
    files: new FormControl(null, [Validators.required]),
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  get parent() {
    return this._parent;
  }

  @Input()
  set parent(value: FilesystemObject) {
    this._parent = value;
  }

  getValue(): FolderUploadDialogValue {
    return {
      parent: this._parent,
      files: this.selectedFiles,
      folderName: this.folderName,
    };
  }

  applyValue(value: FolderUploadDialogValue) {
    // Nothing to apply back
  }

  showFolderDialog() {
    this.folderInputElement.nativeElement.click();
  }

  folderChanged(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFiles = Array.from(input.files);
      this.fileCount = this.selectedFiles.length;

      // Extract the top-level folder name from the first file's webkitRelativePath
      const firstPath = this.selectedFiles[0].webkitRelativePath;
      if (firstPath) {
        this.folderName = firstPath.split('/')[0];
      }

      this.form.get('files').setValue(this.selectedFiles);
    } else {
      this.selectedFiles = [];
      this.fileCount = 0;
      this.folderName = '';
      this.form.get('files').setValue(null);
    }
  }

  /**
   * Returns a summary of the folder structure for display.
   */
  getStructureSummary(): string {
    if (!this.selectedFiles.length) {
      return '';
    }

    const dirs = new Set<string>();
    for (const file of this.selectedFiles) {
      const parts = file.webkitRelativePath.split('/');
      // Collect all directory paths (excluding the file itself)
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    }

    const dirCount = dirs.size;
    return `${this.fileCount} file${this.fileCount !== 1 ? 's' : ''} in ${dirCount} folder${dirCount !== 1 ? 's' : ''}`;
  }
}

export interface FolderUploadDialogValue {
  parent: FilesystemObject;
  files: File[];
  folderName: string;
}
