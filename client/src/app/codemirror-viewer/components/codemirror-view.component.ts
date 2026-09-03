import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { basicSetup } from 'codemirror';
import { EditorView } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { mapBlobToBuffer } from 'app/shared/utils/files';

import { getLanguageExtension } from '../codemirror-language';

@Component({
  selector: 'app-codemirror-viewer',
  templateUrl: './codemirror-view.component.html',
  styleUrls: ['./codemirror-view.component.scss'],
})
export class CodemirrorViewComponent implements AfterViewInit, OnDestroy, ModuleAwareComponent {
  @ViewChild('editorContainer', { static: false }) editorContainer: ElementRef<HTMLDivElement>;

  modulePropertiesChange = new EventEmitter<ModuleProperties>();

  object: FilesystemObject;
  loadTask: BackgroundTask<string, [FilesystemObject, string]>;

  private editorView: EditorView;
  private readonly subscriptions = new Subscription();
  private pendingContent: string | undefined;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
  ) {
    const fileId = this.route.snapshot.params.file_id;

    this.loadTask = new BackgroundTask((id: string) =>
      combineLatest([
        this.filesystemService.get(id),
        this.filesystemService.getContent(id).pipe(
          mapBlobToBuffer(),
          map((buffer) => new TextDecoder('utf-8').decode(buffer)),
        ),
      ])
    );

    this.subscriptions.add(
      this.loadTask.results$.subscribe(({ result: [object, text] }) => {
        this.object = object;
        this.setEditorContent(text);
        this.emitModuleProperties();
      })
    );

    this.loadTask.update(fileId);
  }

  ngAfterViewInit(): void {
    this.initEditor('');
    if (this.pendingContent !== undefined) {
      this.setEditorContent(this.pendingContent);
      this.pendingContent = undefined;
    }
  }

  ngOnDestroy(): void {
    this.editorView?.destroy();
    this.subscriptions.unsubscribe();
    this.loadTask.destroy();
  }

  private buildExtensions(): Extension[] {
    const extensions: Extension[] = [
      basicSetup,
      EditorState.readOnly.of(true),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ];

    const lang = getLanguageExtension(this.object?.mimeType ?? '');
    if (lang) {
      extensions.push(lang);
    }

    return extensions;
  }

  private initEditor(initialContent: string): void {
    this.editorView = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: this.buildExtensions(),
      }) as any,
      parent: this.editorContainer.nativeElement,
    });
  }

  private setEditorContent(text: string): void {
    if (!this.editorView) {
      this.pendingContent = text;
      return;
    }

    this.editorView.setState(
      EditorState.create({ doc: text, extensions: this.buildExtensions() }) as any
    );
  }

  private emitModuleProperties(): void {
    this.modulePropertiesChange.next({
      title: this.object?.filename ?? 'Code Viewer',
      fontAwesomeIcon: 'file-code',
    });
  }
}
