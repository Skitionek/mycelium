#!/usr/bin/env node
/**
 * Fails when an in-scope component has no Storybook story beside it.
 *
 * Every story produces a committed image snapshot, so "component has a story"
 * is what guarantees a component is covered by the visual regression gate.
 * Run by the client-storybook CI job before the snapshots themselves.
 */

const fs = require('fs');
const path = require('path');

const clientRoot = path.join(__dirname, '..');

// The shared UI kit plus every feature module registered as a file type in
// src/app/file-types/file-types.module.ts.
const IN_SCOPE_DIRECTORIES = [
  'src/app/shared/components',
  'src/app/bioc-viewer',
  'src/app/codemirror-viewer',
  'src/app/dmp',
  'src/app/drawing-tool',
  'src/app/enrichment',
  'src/app/molstar-viewer',
  'src/app/pdf-viewer',
  'src/app/sankey-many-to-many-viewer',
  'src/app/sankey-viewer',
  'src/app/sdrf-viewer',
  'src/app/shared-sankey',
  'src/app/trace-viewer',
];

function findComponentFiles(directory) {
  const absoluteDirectory = path.join(clientRoot, directory);
  if (!fs.existsSync(absoluteDirectory)) {
    throw new Error(`In-scope directory does not exist: ${directory}`);
  }

  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.name.endsWith('.component.ts')) {
        found.push(path.relative(clientRoot, entryPath));
      }
    }
  };
  walk(absoluteDirectory);

  return found;
}

function loadExemptions() {
  const exemptionsPath = path.join(__dirname, 'story-coverage-exempt.json');
  const { exempt } = JSON.parse(fs.readFileSync(exemptionsPath, 'utf8'));

  const missingReason = exempt.filter((entry) => !entry.reason || !entry.reason.trim());
  if (missingReason.length > 0) {
    throw new Error(
      `Every exemption needs a reason. Missing for: ${missingReason
        .map((entry) => entry.path)
        .join(', ')}`,
    );
  }

  const stale = exempt.filter((entry) => !fs.existsSync(path.join(clientRoot, entry.path)));
  if (stale.length > 0) {
    throw new Error(
      `These exemptions point at files that no longer exist, remove them:\n  ${stale
        .map((entry) => entry.path)
        .join('\n  ')}`,
    );
  }

  return new Set(exempt.map((entry) => entry.path));
}

/**
 * Components still waiting for a story. Unlike an exemption this is temporary:
 * the list may only ever shrink, and the check fails if an entry on it has
 * since gained a story, which forces the entry to be removed.
 */
function loadPending() {
  const pendingPath = path.join(__dirname, 'story-coverage-pending.json');
  const { pending } = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));

  const alreadyCovered = pending.filter((componentPath) =>
    fs.existsSync(path.join(clientRoot, storyPathFor(componentPath))),
  );
  if (alreadyCovered.length > 0) {
    throw new Error(
      'These components now have a story and must be removed from ' +
        `tools/story-coverage-pending.json:\n  ${alreadyCovered.join('\n  ')}`,
    );
  }

  return new Set(pending);
}

function storyPathFor(componentPath) {
  return componentPath.replace(/\.component\.ts$/, '.stories.ts');
}

function main() {
  const exemptions = loadExemptions();
  const pending = loadPending();

  const componentFiles = IN_SCOPE_DIRECTORIES.flatMap(findComponentFiles).sort();
  const required = componentFiles.filter((componentPath) => !exemptions.has(componentPath));
  const missing = required
    .filter((componentPath) => !pending.has(componentPath))
    .filter((componentPath) => !fs.existsSync(path.join(clientRoot, storyPathFor(componentPath))));

  const covered = required.length - pending.size - missing.length;
  console.log(
    `Story coverage: ${covered}/${required.length} in-scope components ` +
      `(${exemptions.size} exempt, ${pending.size} pending).`,
  );

  if (missing.length > 0) {
    console.error(`\n${missing.length} component(s) have no story beside them:\n`);
    for (const componentPath of missing) {
      console.error(`  ${componentPath}\n    expected: ${storyPathFor(componentPath)}`);
    }
    console.error(
      '\nAdd a *.stories.ts next to each. New components are never added to ' +
        'tools/story-coverage-pending.json - that list only shrinks.',
    );
    process.exit(1);
  }
}

main();
