import { uuidv4 } from 'app/shared/utils/identifiers';

import { DMPDocument } from './dmp.interface';

/**
 * A minimal maDMP 1.2 document used as the starting content for a newly
 * created DMP file.
 *
 * Every property the schema marks as required is present and schema-valid, so
 * the file passes server-side validation at creation time; the placeholder
 * contact is meant to be replaced by the user in the editor.
 */
export function blankDMPDocument(title: string): DMPDocument {
  const now = new Date().toISOString();
  return {
    dmp: {
      title,
      language: 'eng',
      created: now,
      modified: now,
      dmp_id: { identifier: `urn:uuid:${uuidv4()}`, type: 'other' },
      ethical_issues_exist: 'unknown',
      contact: {
        name: 'Unknown',
        mbox: 'unknown@example.org',
        contact_id: { identifier: `urn:uuid:${uuidv4()}`, type: 'other' },
      },
      dataset: [
        {
          dataset_id: { identifier: `urn:uuid:${uuidv4()}`, type: 'other' },
          title: 'Untitled dataset',
          personal_data: 'unknown',
          sensitive_data: 'unknown',
        },
      ],
    },
  };
}
