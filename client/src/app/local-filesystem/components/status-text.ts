import { LocalRoot } from '../services/local-folder-registry.service';
import { LocalFileIndexStatus, LocalRootIndexStatus } from '../services/local-indexer.service';

/**
 * One line describing where a connected folder's indexing is at.
 */
export function describeRootStatus(root: LocalRoot, status: LocalRootIndexStatus | undefined): string {
  switch (root.access) {
    case 'prompt':
      return 'Needs reconnecting to continue';
    case 'denied':
      return 'Access was denied';
    case 'unavailable':
      return 'Folder not found - it may have been moved or deleted';
  }
  if (status == null) {
    return 'Starting…';
  }
  const done = status.indexed + status.skipped + status.failed;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  switch (status.phase) {
    case 'scanning':
      return `Looking for changes… ${plural(status.files, 'file')} so far`;
    case 'indexing': {
      const parts = [];
      if (status.queued) {
        parts.push(`Indexing ${done} of ${status.files}`);
      }
      if (status.annotationsQueued) {
        parts.push(`annotating ${plural(status.annotationsQueued, 'document')}`);
      }
      return parts.length ? capitalize(parts.join(', ')) : 'Indexing…';
    }
    default: {
      const parts = [`Up to date: ${plural(status.indexed, 'file')} indexed`];
      if (status.annotated) {
        parts.push(`${plural(status.annotated, 'document')} annotated`);
      }
      if (status.failed) {
        parts.push(`${status.failed} failed`);
      }
      return parts.join(', ');
    }
  }
}

export function describeFileStatus(status: LocalFileIndexStatus | undefined): { icon: string, label: string, detail: string } {
  if (status == null) {
    return {icon: 'fa fa-circle-notch text-muted', label: 'Not indexed yet', detail: ''};
  }
  const details: string[] = [];
  if (status.terms != null) {
    details.push(`${status.terms} distinct terms`);
  }
  if (status.pages != null) {
    details.push(`${status.pages} pages`);
  }
  switch (status.annotations) {
    case 'done':
      details.push(`${status.annotationCount || 0} entity annotations`);
      break;
    case 'queued':
      details.push('waiting to be annotated');
      break;
    case 'annotating':
      details.push('being annotated');
      break;
    case 'failed':
      details.push(`annotation failed${status.annotationError ? ': ' + status.annotationError : ''}`);
      break;
    case 'off':
      details.push('annotation turned off for this folder');
      break;
  }
  if (status.error) {
    details.push(status.error);
  }
  const detail = details.join('; ');
  switch (status.state) {
    case 'queued':
      return {icon: 'far fa-clock text-muted', label: 'Queued', detail};
    case 'indexing':
      return {icon: 'fa fa-spinner fa-spin text-primary', label: 'Indexing…', detail};
    case 'failed':
      return {icon: 'fa fa-exclamation-triangle text-danger', label: 'Failed', detail};
    case 'skipped':
      return {icon: 'fa fa-minus text-muted', label: 'Name only', detail: 'Only the name of this type of file is searchable'};
    default:
      if (status.annotations === 'annotating' || status.annotations === 'queued') {
        return {icon: 'fa fa-spinner fa-spin text-primary', label: 'Annotating…', detail};
      }
      if (status.annotations === 'failed') {
        return {icon: 'fa fa-check text-warning', label: 'Indexed', detail};
      }
      return {
        icon: 'fa fa-check text-success',
        label: status.annotations === 'done' ? 'Annotated' : 'Indexed',
        detail,
      };
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
