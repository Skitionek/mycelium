import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatLegacySnackBar } from '@angular/material/legacy-snack-bar';

import { BehaviorSubject, from, Observable, Subject, Subscription } from 'rxjs';
import { finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ModuleProperties } from 'app/shared/modules';
import { Progress } from 'app/interfaces/common-dialog.interface';

import { SdrfDocument } from '../models/sdrf-document';

@Component({
  selector: 'app-sdrf-view',
  templateUrl: './sdrf-view.component.html',
  styleUrls: ['./sdrf-view.component.scss'],
})
export class SdrfViewComponent implements OnInit, OnDestroy {

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  fileId: string;
  object$: Observable<FilesystemObject>;
  document: SdrfDocument | null = null;
  loading = false;
  dirty = false;

  private readonly subscriptions = new Subscription();

  constructor(
    protected readonly route: ActivatedRoute,
    protected readonly filesystemService: FilesystemService,
    protected readonly snackBar: MatLegacySnackBar,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly changeDetectorRef: ChangeDetectorRef,
  ) {
    this.fileId = this.route.snapshot.params.file_id || '';
  }

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  load() {
    this.loading = true;
    this.dirty = false;
    this.object$ = this.filesystemService.get(this.fileId).pipe(
      tap(obj => this.emitModuleProperties(obj)),
      shareReplay(1),
    );
    const content$ = this.filesystemService.getContent(this.fileId).pipe(
      switchMap(blob => from(SdrfDocument.fromBlob(blob))),
      shareReplay(1),
    );
    this.subscriptions.add(
      content$.pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetectorRef.markForCheck();
        }),
        this.errorHandler.create({label: 'Load SDRF file'}),
      ).subscribe(doc => {
        this.document = doc;
        this.loading = false;
        this.changeDetectorRef.markForCheck();
      }),
    );
  }

  save(object: FilesystemObject) {
    if (!this.document) {
      return;
    }
    const progressDialogRef = this.progressDialog.display({
      title: 'Saving SDRF File',
      progressObservable: new BehaviorSubject<Progress>(new Progress({
        status: 'Saving...',
      })),
    });
    this.subscriptions.add(
      this.filesystemService.save([this.fileId], {
        contentValue: this.document.toBlob(),
      }).pipe(
        finalize(() => progressDialogRef.close()),
        this.errorHandler.create({label: 'Save SDRF file'}),
      ).subscribe(() => {
        this.dirty = false;
        this.snackBar.open('SDRF file saved.', 'Close', {duration: 4000});
        this.changeDetectorRef.markForCheck();
      }),
    );
  }

  addRow() {
    if (!this.document) {
      return;
    }
    this.document.addRow();
    this.dirty = true;
    this.changeDetectorRef.markForCheck();
  }

  removeRow(index: number) {
    if (!this.document) {
      return;
    }
    this.document.removeRow(index);
    this.dirty = true;
    this.changeDetectorRef.markForCheck();
  }

  onCellEdit(rowIndex: number, colIndex: number, value: string) {
    if (!this.document) {
      return;
    }
    this.document.rows[rowIndex][colIndex] = value;
    this.dirty = true;
  }

  downloadTsv(object: FilesystemObject) {
    if (!this.document) {
      return;
    }
    const blob = this.document.toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = object.filename || 'file.sdrf.tsv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  dragStarted(event: DragEvent, object: FilesystemObject) {
    object.addDataTransferData(event.dataTransfer);
  }

  objectUpdate() {
    this.subscriptions.add(
      this.object$.subscribe(obj => this.emitModuleProperties(obj)),
    );
    this.load();
  }

  private emitModuleProperties(obj: FilesystemObject) {
    this.modulePropertiesChange.emit({
      title: obj ? obj.filename : 'SDRF Viewer',
      fontAwesomeIcon: 'table',
    });
  }
}
