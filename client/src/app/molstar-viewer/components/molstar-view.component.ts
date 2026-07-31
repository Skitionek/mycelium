import {
  AfterViewInit,
  Component,
  Inject,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
declare const molstar: any;

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { MimeTypes } from 'app/shared/constants';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { mapBlobToBuffer } from 'app/shared/utils/files';

type ProteinStructureFormat = 'pdb' | 'mmcif';

@Component({
  selector: 'app-molstar-viewer',
  templateUrl: './molstar-view.component.html',
  styleUrls: ['./molstar-view.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class MolstarViewComponent implements AfterViewInit, OnDestroy, ModuleAwareComponent {
  @Input() embedded = false;
  @ViewChild('molstarContainer', { static: false }) molstarContainer: ElementRef<HTMLDivElement>;

  modulePropertiesChange = new EventEmitter<ModuleProperties>();

  object: FilesystemObject;
  loadTask: BackgroundTask<string, [FilesystemObject, string]>;
  renderError: string | null = null;

  private viewer: any;
  private viewInitialized = false;
  private structureData: string | undefined;
  private structureFormat: ProteinStructureFormat | undefined;
  private readonly subscriptions = new Subscription();
  private static scriptLoadPromise: Promise<void> | null = null;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {
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
        this.emitModuleProperties();
        this.setStructureData(text, this.getFormatForObject(object));
      })
    );

    const fileId = this.route.snapshot.params.file_id;
    if (fileId) {
      this.loadTask.update(fileId);
    }
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    void this.renderStructure();
  }

  ngOnDestroy(): void {
    this.disposeViewer();
    this.subscriptions.unsubscribe();
    this.loadTask.destroy();
  }

  setStructureData(data: string, format: ProteinStructureFormat | undefined): void {
    this.structureData = data;
    this.structureFormat = format;
    void this.renderStructure();
  }

  getFormatForObject(object: FilesystemObject): ProteinStructureFormat | undefined {
    const filename = (object?.filename || '').toLowerCase();

    if (filename.endsWith('.pdb') || object?.mimeType === MimeTypes.Pdb) {
      return 'pdb';
    }

    if (
      filename.endsWith('.cif') ||
      filename.endsWith('.mmcif') ||
      object?.mimeType === MimeTypes.Cif ||
      object?.mimeType === 'chemical/x-mmcif'
    ) {
      return 'mmcif';
    }

    return undefined;
  }

  private async renderStructure(): Promise<void> {
    if (!this.viewInitialized || !this.molstarContainer || !this.structureData || !this.structureFormat) {
      return;
    }

    this.renderError = null;

    try {
      this.disposeViewer();
      await this.ensureMolstarLoaded();
      const container = this.molstarContainer.nativeElement;
      container.innerHTML = '';
      if (!molstar?.Viewer?.create) {
        throw new Error('Mol* viewer script not loaded');
      }
      this.viewer = await molstar.Viewer.create(container, {
        layoutShowControls: false,
        layoutShowRemoteState: false,
        layoutShowSequence: false,
        layoutShowLog: false,
        layoutShowLeftPanel: false,
        collapseLeftPanel: true,
        viewportShowExpand: false,
        viewportShowControls: true,
      });
      await this.viewer.loadStructureFromData(this.structureData, this.structureFormat, {
        dataLabel: this.object?.filename,
      });
    } catch (error) {
      this.renderError = 'Unable to render this protein structure.';
    }
  }

  private ensureMolstarLoaded(): Promise<void> {
    if (molstar?.Viewer?.create) {
      return Promise.resolve();
    }

    if (MolstarViewComponent.scriptLoadPromise) {
      return MolstarViewComponent.scriptLoadPromise;
    }

    MolstarViewComponent.scriptLoadPromise = new Promise<void>((resolve, reject) => {
      const existingScript = this.document.querySelector<HTMLScriptElement>('script[data-molstar="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Mol* viewer script.')), {
          once: true,
        });
        return;
      }

      const script = this.document.createElement('script');
      script.src = new URL('assets/vendor/molstar/molstar.js', this.document.baseURI).toString();
      script.async = true;
      script.dataset.molstar = 'true';
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('Failed to load Mol* viewer script.')), {
        once: true,
      });
      this.document.body.appendChild(script);
    }).catch((error) => {
      MolstarViewComponent.scriptLoadPromise = null;
      throw error;
    });

    return MolstarViewComponent.scriptLoadPromise;
  }

  private emitModuleProperties(): void {
    this.modulePropertiesChange.next({
      title: this.object?.filename ?? 'Protein Structure Viewer',
      fontAwesomeIcon: 'dna',
    });
  }

  private disposeViewer(): void {
    this.viewer?.dispose();
    this.viewer = undefined;
  }
}
