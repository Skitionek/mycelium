import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { DMPService } from '../services/dmp.service';
import { DMPRecord } from '../models/dmp.interface';

@Component({
  selector: 'app-dmp-list',
  templateUrl: './dmp-list.component.html',
})
export class DMPListComponent implements OnInit {
  records: DMPRecord[] = [];
  loading = false;
  error: string | undefined;

  constructor(private readonly dmpService: DMPService, private readonly router: Router) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = undefined;
    this.dmpService.list().subscribe({
      next: (data) => {
        this.records = data.results;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load DMP documents.';
        this.loading = false;
      },
    });
  }

  create(): void {
    this.router.navigate(['/dmp', 'new']);
  }

  open(record: DMPRecord): void {
    this.router.navigate(['/dmp', record.hashId]);
  }

  remove(record: DMPRecord, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Delete DMP "${record.title}"?`)) {
      return;
    }
    this.dmpService.delete(record.hashId).subscribe(() => this.refresh());
  }
}
