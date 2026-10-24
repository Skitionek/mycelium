import * as path from 'path';

// Defaults match the admin user in appserver/fixtures/seed.json.
export const USER_EMAIL = process.env.E2E_USER_EMAIL || 'admin@example.com';
export const USER_PASSWORD = process.env.E2E_USER_PASSWORD || 'password';

export const STORAGE_STATE = path.join(__dirname, '..', '.auth', 'user.json');

// Projects created by fixtures/seed.json; `flask seed` resets them.
export const SEEDED_PROJECTS = ['COVID-19', 'Example', 'Waterways'];
export const EXAMPLE_PROJECT_FILES = [
  'All To All Example',
  'COVID-19 Vaccine Blueprint',
  'Intersect Metal Ions Reactions',
  'Microbiome affect on weight',
  'Sample Enrichment Table',
];

/** A name that will not collide with earlier runs against the same database. */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
