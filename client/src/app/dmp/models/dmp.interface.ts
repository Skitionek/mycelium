export interface DMPIdentifier {
  identifier: string;
  type: string;
}

export interface DMPAffiliation {
  name: string;
  affiliation_id?: DMPIdentifier;
}

export interface DMPContact {
  name: string;
  mbox: string;
  contact_id?: DMPIdentifier;
  affiliation?: DMPAffiliation[];
}

export interface DMPContributor extends DMPContact {
  role?: string[];
}

export interface DMPLicense {
  license_ref: string;
  license_name?: string;
  start_date?: string;
}

export interface DMPDistribution {
  title: string;
  description?: string;
  access_url?: string;
  download_url?: string;
  available_until?: string;
  byte_size?: number;
  data_access: 'open' | 'shared' | 'closed';
  format?: string[];
  license?: DMPLicense[];
}

export interface DMPDataset {
  dataset_id: DMPIdentifier;
  title: string;
  description?: string;
  type?: string;
  personal_data: 'yes' | 'no' | 'unknown';
  sensitive_data: 'yes' | 'no' | 'unknown';
  language?: string;
  keyword?: string[];
  issued?: string;
  preservation_statement?: string;
  data_quality_assurance?: string;
  distribution?: DMPDistribution[];
}

export interface DMPFunding {
  funder_id?: DMPIdentifier;
  funding_status?: string;
  grant_id?: DMPIdentifier;
}

export interface DMPProject {
  title: string;
  description?: string;
  start?: string;
  end?: string;
  project_id?: DMPIdentifier[];
  funding?: DMPFunding[];
}

export interface DMPCost {
  title: string;
  description?: string;
  currency_code?: string;
  value?: number;
  value_type?: string;
}

export interface DMPData {
  title: string;
  description?: string;
  language: string;
  created: string;
  modified: string;
  dmp_id: DMPIdentifier;
  ethical_issues_exist: 'yes' | 'no' | 'unknown';
  ethical_issues_description?: string;
  ethical_issues_report?: string;
  contact: DMPContact;
  contributor?: DMPContributor[];
  cost?: DMPCost[];
  dataset: DMPDataset[];
  project?: DMPProject[];
}

export interface DMPDocument {
  dmp: DMPData;
}

export interface DMPRecord {
  hashId: string;
  title: string;
  jsonData: DMPDocument;
  creationDate: string;
  modifiedDate: string;
}
