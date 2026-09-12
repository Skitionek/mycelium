import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import { DMPService } from '../services/dmp.service';
import { DMPDocument, DMPRecord } from '../models/dmp.interface';

@Component({
  selector: 'app-dmp-editor',
  templateUrl: './dmp-editor.component.html',
})
export class DMPEditorComponent implements OnInit {
  hashId: string | undefined;
  loading = false;
  saving = false;
  serverErrors: string[] = [];
  fieldErrors: { [key: string]: string[] } = {};

  viewMode: 'form' | 'json' = 'form';
  jsonText = '';
  jsonError: string | undefined;

  form: FormGroup = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    language: ['eng', Validators.required],
    dmpIdIdentifier: ['', Validators.required],
    dmpIdType: ['url', Validators.required],
    ethicalIssuesExist: ['unknown', Validators.required],
    ethicalIssuesDescription: [''],
    contactName: ['', Validators.required],
    contactMbox: ['', [Validators.required, Validators.email]],
    contributors: this.fb.array([]),
    datasets: this.fb.array([this.buildDataset()]),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly dmpService: DMPService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  get contributors(): FormArray {
    return this.form.get('contributors') as FormArray;
  }

  get datasets(): FormArray {
    return this.form.get('datasets') as FormArray;
  }

  ngOnInit(): void {
    const hashId = this.route.snapshot.paramMap.get('hash_id');
    if (hashId && hashId !== 'new') {
      this.hashId = hashId;
      this.loading = true;
      this.dmpService.get(hashId).subscribe({
        next: (record) => {
          this.populateForm(record);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
    }
  }

  buildDataset(): FormGroup {
    return this.fb.group({
      datasetIdIdentifier: ['', Validators.required],
      datasetIdType: ['other', Validators.required],
      title: ['', Validators.required],
      description: [''],
      personalData: ['unknown', Validators.required],
      sensitiveData: ['unknown', Validators.required],
    });
  }

  buildContributor(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      mbox: ['', Validators.email],
      role: [''],
    });
  }

  addDataset(): void {
    this.datasets.push(this.buildDataset());
  }

  removeDataset(index: number): void {
    this.datasets.removeAt(index);
  }

  addContributor(): void {
    this.contributors.push(this.buildContributor());
  }

  removeContributor(index: number): void {
    this.contributors.removeAt(index);
  }

  populateForm(record: DMPRecord): void {
    const dmp = record.jsonData.dmp;
    this.form.patchValue({
      title: dmp.title,
      description: dmp.description,
      language: dmp.language,
      dmpIdIdentifier: dmp.dmp_id?.identifier,
      dmpIdType: dmp.dmp_id?.type,
      ethicalIssuesExist: dmp.ethical_issues_exist,
      ethicalIssuesDescription: dmp.ethical_issues_description,
      contactName: dmp.contact?.name,
      contactMbox: dmp.contact?.mbox,
    });

    this.contributors.clear();
    (dmp.contributor || []).forEach((c) => {
      const group = this.buildContributor();
      group.patchValue({ name: c.name, mbox: c.mbox, role: (c.role || []).join(', ') });
      this.contributors.push(group);
    });

    this.datasets.clear();
    (dmp.dataset || []).forEach((d) => {
      const group = this.buildDataset();
      group.patchValue({
        datasetIdIdentifier: d.dataset_id?.identifier,
        datasetIdType: d.dataset_id?.type,
        title: d.title,
        description: d.description,
        personalData: d.personal_data,
        sensitiveData: d.sensitive_data,
      });
      this.datasets.push(group);
    });
    if (!this.datasets.length) {
      this.datasets.push(this.buildDataset());
    }
  }

  buildDocument(): DMPDocument {
    const v = this.form.value;
    const now = new Date().toISOString();
    return {
      dmp: {
        title: v.title,
        description: v.description || undefined,
        language: v.language,
        created: now,
        modified: now,
        dmp_id: { identifier: v.dmpIdIdentifier, type: v.dmpIdType },
        ethical_issues_exist: v.ethicalIssuesExist,
        ethical_issues_description: v.ethicalIssuesDescription || undefined,
        contact: { name: v.contactName, mbox: v.contactMbox },
        contributor: v.contributors
          .filter((c: any) => c.name)
          .map((c: any) => ({
            name: c.name,
            mbox: c.mbox || undefined,
            role: c.role ? c.role.split(',').map((r: string) => r.trim()).filter(Boolean) : undefined,
          })),
        dataset: v.datasets.map((d: any) => ({
          dataset_id: { identifier: d.datasetIdIdentifier, type: d.datasetIdType },
          title: d.title,
          description: d.description || undefined,
          personal_data: d.personalData,
          sensitive_data: d.sensitiveData,
        })),
      },
    };
  }

  submit(): void {
    if (this.viewMode === 'json') {
      this.submitFromJson();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.serverErrors = [];
    this.fieldErrors = {};
    const document = this.buildDocument();
    this.persist(document);
  }

  private submitFromJson(): void {
    this.jsonError = undefined;
    let document: DMPDocument;
    try {
      document = JSON.parse(this.jsonText);
    } catch (e) {
      this.jsonError = 'Invalid JSON: ' + (e as Error).message;
      return;
    }
    if (!document || typeof document !== 'object' || !('dmp' in document)) {
      this.jsonError = 'Document must be an object with a top-level "dmp" key.';
      return;
    }
    this.saving = true;
    this.serverErrors = [];
    this.fieldErrors = {};
    this.persist(document);
  }

  private persist(document: DMPDocument): void {
    const request$ = this.hashId
      ? this.dmpService.update(this.hashId, document)
      : this.dmpService.create(document);

    request$.subscribe({
      next: (record) => {
        this.saving = false;
        this.router.navigate(['/dmp', record.hashId]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(err);
      },
    });
  }

  switchToJson(): void {
    this.jsonText = JSON.stringify(this.buildDocument(), null, 2);
    this.viewMode = 'json';
  }

  switchToForm(): void {
    try {
      const document: DMPDocument = JSON.parse(this.jsonText);
      this.populateForm({
        hashId: this.hashId || '',
        title: document.dmp?.title || '',
        jsonData: document,
        creationDate: '',
        modifiedDate: '',
      });
      this.jsonError = undefined;
    } catch (e) {
      this.jsonError = 'Invalid JSON: ' + (e as Error).message;
      return;
    }
    this.viewMode = 'form';
  }

  exportJson(): void {
    const document = this.viewMode === 'json' ? this.tryParseJson() : this.buildDocument();
    if (!document) {
      return;
    }
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.dmp?.title || 'dmp'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private tryParseJson(): DMPDocument | undefined {
    try {
      return JSON.parse(this.jsonText);
    } catch (e) {
      this.jsonError = 'Invalid JSON: ' + (e as Error).message;
      return undefined;
    }
  }

  importJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.jsonText = String(reader.result);
      this.viewMode = 'json';
    };
    reader.readAsText(file);
    input.value = '';
  }

  private handleError(err: HttpErrorResponse): void {
    const body = err.error;
    if (body?.fields) {
      this.fieldErrors = body.fields;
      this.serverErrors = Object.entries(body.fields).map(
        ([field, messages]) => `${field}: ${(messages as string[]).join(', ')}`,
      );
    } else if (body?.message) {
      this.serverErrors = [body.message];
    } else {
      this.serverErrors = ['An unexpected error occurred while saving the DMP.'];
    }
  }

  cancel(): void {
    this.router.navigate(['/dmp']);
  }
}
