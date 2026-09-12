import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import * as XLSX from 'xlsx';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { openDownloadForBlob } from 'app/shared/utils/files';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';

import { FilesystemService } from '../services/filesystem.service';
import { FilesystemObject } from '../models/filesystem-object';
import { getObjectLabel } from '../utils/objects';

type DocViewerType = 'pdf' | 'mammoth' | 'xlsx';

/**
 * Generic fallback viewer for filesystem objects that do not have a dedicated
 * module route. Files whose content can be rendered in the browser are shown
 * inline via ngx-doc-viewer; everything else keeps the download-only fallback.
 *
 * Because Mycelium authenticates API requests with a bearer JWT, we cannot hand
 * the raw `/api/.../content` URL to the viewer (its XHR carries no auth header).
 * Instead we fetch the blob through the authenticated FilesystemService and pass
 * an in-memory object URL, which the viewer can read without further auth.
 */
@Component({
  selector: 'app-object-viewer',
  templateUrl: 'object-viewer.component.html',
})
export class ObjectViewerComponent implements OnDestroy {

  private static readonly MAMMOTH_EXTENSIONS: ReadonlySet<string> = new Set(['.docx']);
  private static readonly XLSX_EXTENSIONS: ReadonlySet<string> = new Set(['.xlsx', '.xls', '.ods']);

  protected readonly subscriptions = new Subscription();
  object$: Observable<FilesystemObject>;

  /** MIME/extension → viewer type; null means "no inline viewer". */
  viewerType: DocViewerType | null = null;
  /** Blob object URL for the currently loaded object (revoked on change/destroy). */
  objectUrl: string | null = null;
  contentError: Error | null = null;

  /** Parsed workbook state, populated only when viewerType === 'xlsx'. */
  sheetNames: string[] = [];
  activeSheetIndex = 0;
  activeSheetHtml: SafeHtml | null = null;
  private workbook: XLSX.WorkBook | null = null;

  constructor(protected readonly route: ActivatedRoute,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog,
              protected readonly sanitizer: DomSanitizer) {
    this.object$ = this.route.params.pipe(
      tap(() => this.resetContent()),
      switchMap(params => this.filesystemService.get(params.hash_id)),
      tap(object => this.prepareInlineViewer(object)),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.revokeObjectUrl();
  }

  /**
   * Decide whether the object can be shown inline and, if so, fetch its content
   * (through the authenticated service) into a blob object URL for the viewer.
   */
  protected prepareInlineViewer(object: FilesystemObject): void {
    const viewerType = this.resolveViewerType(object);
    this.viewerType = viewerType;
    if (viewerType == null) {
      return;
    }

    this.subscriptions.add(
      this.filesystemService.getContent(object.hashId).pipe(
        tap(blob => {
          if (viewerType === 'xlsx') {
            this.loadWorkbook(blob);
          } else {
            this.revokeObjectUrl();
            this.objectUrl = URL.createObjectURL(
              // ngx-doc-viewer's pdf viewer needs a correct content type on the blob.
              viewerType === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob,
            );
          }
        }),
        this.errorHandler.create({ label: 'Load file preview' }),
      ).subscribe({
        error: (error: Error) => {
          // Fall back to download-only view when the preview cannot be produced.
          this.contentError = error;
          this.viewerType = null;
        },
      }),
    );
  }

  /** Parse an XLSX/XLS/ODS blob client-side (via SheetJS) and render the first sheet. */
  protected loadWorkbook(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.workbook = XLSX.read(reader.result as ArrayBuffer, { type: 'array' });
      this.sheetNames = this.workbook.SheetNames;
      this.activeSheetIndex = 0;
      this.renderActiveSheet();
    };
    reader.onerror = () => {
      this.contentError = new Error('Failed to read spreadsheet file');
      this.viewerType = null;
    };
    reader.readAsArrayBuffer(blob);
  }

  selectSheet(index: number): void {
    if (index === this.activeSheetIndex) {
      return;
    }
    this.activeSheetIndex = index;
    this.renderActiveSheet();
  }

  private renderActiveSheet(): void {
    if (this.workbook == null) {
      return;
    }
    const sheet = this.workbook.Sheets[this.sheetNames[this.activeSheetIndex]];
    this.activeSheetHtml = sheet != null
      ? this.sanitizer.bypassSecurityTrustHtml(XLSX.utils.sheet_to_html(sheet, { editable: false }))
      : null;
  }

  protected resolveViewerType(object: FilesystemObject): DocViewerType | null {
    if (object.mimeType === 'application/pdf') {
      return 'pdf';
    }
    const filename = (object.filename || '').toLowerCase();
    for (const ext of ObjectViewerComponent.MAMMOTH_EXTENSIONS) {
      if (filename.endsWith(ext)) {
        return 'mammoth';
      }
    }
    for (const ext of ObjectViewerComponent.XLSX_EXTENSIONS) {
      if (filename.endsWith(ext)) {
        return 'xlsx';
      }
    }
    return null;
  }

  protected resetContent(): void {
    this.viewerType = null;
    this.contentError = null;
    this.workbook = null;
    this.sheetNames = [];
    this.activeSheetIndex = 0;
    this.activeSheetHtml = null;
    this.revokeObjectUrl();
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl != null) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  downloadObject(target: FilesystemObject) {
    const progressDialogRef = this.progressDialog.display({
      title: `Download ${getObjectLabel(target)}`,
      progressObservable: new BehaviorSubject<Progress>(new Progress({
        status: 'Generating download...',
      })),
    });
    this.filesystemService.getContent(target.hashId).pipe(
      map(blob => {
        return new File([blob], target.filename);
      }),
      tap(file => {
        openDownloadForBlob(file, file.name);
      }),
      finalize(() => progressDialogRef.close()),
      this.errorHandler.create({label: 'Download file'}),
    ).subscribe();
  }

}
