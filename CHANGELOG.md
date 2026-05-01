# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

> This changelog tracks changes made in the [Lifelike Afterhours fork](https://github.com/Skitionek/lifelike)
> since it was created from the upstream [SBRG/lifelike](https://github.com/SBRG/lifelike) repository.

---

## [Unreleased]

### Added
- `neo4japp/services/storage_drivers/postgresql.py` — `PostgreSQLStorageDriver`, a libcloud `StorageDriver` implementation that stores objects in the `files_content` PostgreSQL table via SQLAlchemy.
- `neo4japp/services/file_storage.py` — `FileStorageService` wrapping the libcloud `StorageDriver` API with `store`, `retrieve`, and `delete` methods.
- `get_file_storage_service()` factory in `neo4japp/database.py` — builds the libcloud driver from app config and memoises it to the request context.
- **Folder-level `.annotations` JSON config files**: directories can now contain a `.annotations` file (MIME type `vnd.lifelike.filesystem/annotations`) that defines annotation scope — analogous to `.gitignore`. Content is a **JSON object** validated against `annotations_v1.json` (JSON Schema draft-07). Supports `inherit`, `fallback_organism`, `annotation_configs`, `include`, and `exclude` fields. Managed through the standard file API; nested folders can extend or override parent scope; `inherit: false` resets the accumulated config from outer scopes.
- **`neo4japp/schemas/formats/annotations_v1.json`**: JSON Schema (draft-07) for `.annotations` config files, compiled at import time via `fastjsonschema`.
- **`AnnotationsFileTypeProvider`**: registered file-type provider for `.annotations` MIME type. Validates uploaded JSON against the schema; triggers a synchronous refresh of the `file_effective_annotation_config` table via an `after_commit` hook that executes a SQL function.
- **`FolderAnnotationService`** (`neo4japp/services/annotations/folder_annotation_service.py`): queries the `file_effective_annotation_config` table (O(1) lookup); falls back to walking the ancestor chain and reading file content via `FileContent.get_bytes()` (routed through the storage abstraction) when the table is unavailable.
- **`GET /filesystem/objects/<hash_id>/effective-annotations-config`** — return the merged effective config for any file or folder.
- **`FILE_MIME_TYPE_ANNOTATIONS`** constant (`vnd.lifelike.filesystem/annotations`) added to `constants.py`.
- **Database migration** `001_add_folder_annotation_config`: adds the `file_effective_annotation_config` table precomputing the fully-merged annotation config for every file (recursive CTE over the ancestor folder chain, reads `files_content.raw_file::jsonb` directly) and the `jsonb_merge_annotation_configs` PostgreSQL function/aggregate for deep-merging `annotation_configs` objects. No new column is added to the `files` table.
- Unit tests for `FolderAnnotationService` covering: no config files, single folder config, nested config merging, `inherit: false` reset, per-file overrides, partial configs.
- API test for the `effective-annotations-config` endpoint.

### Security
- **`cryptography`** bumped from 46.0.6 → 46.0.7 to fix CVE-2026-39892 (buffer overflow via non-contiguous buffer, MEDIUM severity).
- **CodeMirror 6 viewer** (`codemirror-viewer`): read-only code/text viewer powered by CodeMirror 6 with syntax highlighting for JSON, Python, JavaScript/TypeScript, XML/HTML, and Markdown; plain-text display for YAML, CSV, and other text types; accessible at `projects/:project_name/code/:file_id`.
- **LibreOffice PDF conversion service** (`neo4japp/services/libreoffice.py`): server-side conversion of Office/document files (`.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt`, `.odt`, `.ods`, `.odp`, `.rtf`, `.txt`, `.html`, `.csv`) to PDF using LibreOffice headless mode.
- **`GET /api/filesystem/objects/<hash_id>/content/pdf`** endpoint: serves any file's content as PDF — passes through existing PDFs unchanged, converts supported document formats on-the-fly.
- **Client-side transparent rendering**: files with convertible MIME types now open directly in the PDF viewer; conversion is invisible to the user.
- `LIBREOFFICE_CONVERTIBLE_MIME_TYPES` constant (Python `constants.py` and Angular `shared/constants.ts`) listing all MIME types eligible for conversion.
- `FilesystemService.getContentAsPdf()` Angular method that calls the new `/content/pdf` endpoint.
- **MegaLinter** (`oxsecurity/megalinter@v8`) added as a comprehensive lint step in CI (`lint.yml`); runs after fast linters pass and applies auto-fixes on PRs
- **`graph-db/Makefile`** — single entry point for all graph-db operations: `make extract`, `make changelog`, `make full-load`, `make dev-up`, `make migrate`
- **`generate-changelog` subcommand** in `extractor/src/app.py` — generates a Liquibase changelog XML for a domain and auto-places it as the next `changelog-NNNN.xml` in `graph-db/changelog/<dir>/changelogs/`
- **`full-load` subcommand** in `extractor/src/app.py` — combines extract + changelog generation in one step
- **`generate(args, output_dir)` function** added to every `*_liquibase.py` module so changelogs can be driven entirely from the CLI
- **`get_next_changelog_filename()`** helper in `liquibase_utils.py` for automatic sequential changelog file naming
- **`.github/workflows/graphdb-extract.yml`** — new `workflow_dispatch` workflow that extracts data, generates a changelog, and opens a PR for review before migration
- **`properties.ini.example`** template files for `common/` and `cloudstorage/` so new contributors know which values to set locally

### Changed
- **Storage backend**: migrated from Azure-specific SDKs to [apache-libcloud](https://libcloud.apache.org/) Object Storage API (`apache-libcloud==3.9.0`), making it easy to swap in alternative backends (GCS, S3, Azure Blobs) by supplying a different libcloud driver.
- Replaced `azure-storage-file` (`FileService`) in `lmdb_manager` with a new `LibcloudStorageProvider`; `AzureStorageProvider` is now a thin libcloud-Azure subclass. Removed Azure-File-specific `create_remote_dir`.
- Replaced `azure-storage-blob` (`BlobServiceClient`) in `blueprints/storage.py` with libcloud `get_object` / `download_object_as_stream` / `upload_object_via_stream`.
- Removed unused `AZURE_BLOB_STORAGE_URL` config entry (libcloud derives the endpoint from the account name).
- **User file content** reads and writes now go through the `FileStorageService` libcloud abstraction. The default `PostgreSQLStorageDriver` stores bytes in `files_content.raw_file` (no schema change, no external service required). Switching to Azure Blobs, S3, or GCS only requires setting `FILE_STORAGE_PROVIDER` / `FILE_STORAGE_KEY` / `FILE_STORAGE_SECRET` env vars — no code changes. Objects are addressed by **path** — the `hash_id` of the owning `Files` row for current content, or the `hash_id` of a `FileVersion` row for a historical snapshot (libcloud "snapshot"). `PostgreSQLStorageDriver._find_row` resolves paths in order: `Files.hash_id` → `FileVersion.hash_id` → legacy hex checksum (backward compat).
- `FileContent.get_bytes(path=None)` accepts an optional `path` parameter (the owning entity's `hash_id`); all call sites now pass the appropriate path so the storage driver can look up bytes by path rather than checksum.
- `FileContent.get_or_create(buffer, file_path=None)` accepts an optional `file_path` (the owning `Files.hash_id`) that is passed as the libcloud object name to the storage service.
- `FileVersionSchema.revision` now returns `FileVersion.hash_id` (the snapshot path) instead of the hex-encoded SHA-256 checksum.
- New `FILE_STORAGE_PROVIDER` / `FILE_STORAGE_CONTAINER` / `FILE_STORAGE_KEY` / `FILE_STORAGE_SECRET` app-config keys control the libcloud backend (default: `POSTGRESQL`).
- **GitHub Actions cleanup**: removed the duplicate default CodeQL workflow, kept the advanced scan workflow, and updated stale graph DB workflow action references.
- **CI linting**: MegaLinter fixes are opened as a separate PR (`APPLY_FIXES_MODE: pull_request`) and auto-approved via `megalinter-auto-approve.yml`; `fast-lint` runs in check-only mode.
- **Credentials now read from environment variables first** (`NEO4J_URI`, `NEO4J_DATABASE`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `AZURE_ACCOUNT_STORAGE_NAME`, `AZURE_ACCOUNT_STORAGE_KEY`) with `properties.ini` as local-dev fallback — no more manual file editing in CI/CD
- **`generate_liquibase_changelog_file()`** signature updated to accept a `Path` output directory and an optional filename; auto-numbers the file when no name is given
- **`graphdb-migrate.yml`**: `changelog` input changed from a free-text field to a dropdown of known master files, preventing path-typo mistakes
- **`--prefix` argument** is now optional (default `''`) and accepts any string — no longer restricted to JIRA `LL-NNNN` format
- **`app.py` subparser** destination renamed from `domain` to `command` to allow `generate-changelog` and `full-load` as first-class subcommands alongside the existing domain extract commands

### Removed
- **JIRA prefix validation** removed from `ChangeLog.__init__`, `BaseParser.__init__`, and `app.py` — the `LL-NNNN` format constraint is gone
- **`jira-` literal prefix** removed from output file names in `liquibase_utils.py`, `base_parser.py`, and `chebi_parser.py`
- **ruff** (`0.15.10`) added as a dev dependency to all Python projects (appserver, statistical-enrichment, cache-invalidator) with a shared root `ruff.toml` config (E/F rules, line-length 100, migrations excluded)
- **`lint.yml`** GitHub Actions workflow: fast-lint job (ruff + tslint) gates MegaLinter; SARIF report uploaded on every PR/push so findings appear as Security-tab annotations and PR review comments
- **`.cspell.json`** project dictionary with 418 domain/project-specific words to suppress cspell false-positive warnings

### Fixed
- Devcontainer Docker Compose startup now resolves app bind mounts against the Docker host workspace path, fixing empty source mounts that hid service startup scripts and broke container launch
- Devcontainer Elasticsearch now uses a smaller JVM heap and safer single-node settings, preventing restart loops and unhealthy startup during local stack initialization
- MegaLinter: exclude `graph-db/` from ruff scanning (legacy extractor scripts use wildcard imports by design)
- MegaLinter: fix three spurious F541 f-strings (no placeholders) in `tests/locust/locustfile.py`
- MegaLinter: disable `TYPESCRIPT_ES` and `JAVASCRIPT_ES` linters — project uses tslint (via fast-lint); the eslint linters were misconfigured with a `tslint.json` (invalid eslint config), causing a config-parse error
- MegaLinter: disable `PYTHON_MYPY` linter — cross-package duplicate-module-name (`tests`) conflict when scanning multiple Python packages together; type-checking still runs via `appserver/setup.cfg`
- Added missing `from copy import copy` import in `annotation_interval_tree.py` (F821)
- Replaced `type(x) == list` with `isinstance(x, list)` in `migrations/utils.py` (E721)
- Removed/prefixed all unused local variables across appserver and test files (F841)
- Removed unused `from .rcache import *` wildcard re-export false-positives; added explicit `per-file-ignores` in `ruff.toml` for legacy wildcard-import files (F403/F405)

### Removed
- Dropped `jquery`, `jquery-ui`, `jquery-ui-dist`, `qtip2`, `jqueryui`, `@types/jquery`, and `@types/jqueryui` dependencies from the client

### Changed
- Replaced jQuery DOM manipulation in `bioc-view.component.ts` with native DOM APIs and CSS transitions
- Replaced jQuery + qtip2 annotation tooltips in `pdf-viewer-lib.component.ts` with Bootstrap 5 Popover
- Replaced jQuery UI `.resizable()` in `resizable.directive.ts` with native CSS `resize` property

### Security
- Upgrade `pdfjs-dist` 2.9.359 → 4.2.67 to fix arbitrary JavaScript execution on malicious PDF open (CVE-2024-4367, affects ≤ 4.1.392)

### Changed
- Migrated PDF viewer to pdfjs-dist v4 API: removed `TextLayerBuilder.disableTextLayer`/`enhanceTextSelection` (controlled via `textLayerMode` option), moved `LinkTarget` import from core lib to viewer bundle, updated `EventBus` constructor (no argument), updated all type-import paths to `pdfjs-dist/types/src/`
- Added `@angular-builders/custom-webpack` with `experiments.topLevelAwait: true` to handle pdfjs-dist v4 ES module bundles that use top-level await

## [2026-04-12]

### Added
- **Zero-configuration dev environment** via VS Code Dev Container (`.devcontainer/`) — start developing with a single click in GitHub Codespaces or VS Code ([#154])
- **Alternative tab/panel implementation** using [`route-with-dynamic-outlets`](https://github.com/Skitionek/route-with-dynamic-outlets): each workspace tab now maps to a named Angular router outlet; open tabs are encoded in the URL ([#153])
- **Automated UI tests** — added Angular unit specs for `sort-legend`, `results-summary`, `collapsible-window`, `pagination`, `dashboard`, `kg-statistics`, `percent-input`, and `warning-pill` components ([#154])
- **Automated CI/CD** with GitHub Actions workflows for tests, Docker image builds, CodeQL security scans, and Dependabot auto-merge ([#149])
- **Copilot coding agent** instructions and auto-fix workflow for AI-assisted development ([#149])

### Changed
- **Angular v9 → v14** (BREAKING): upgraded all Angular, NgRx, RxJS, ng-bootstrap, chart.js, and related packages; removed `entryComponents`, migrated `throwError`/`toPromise` to RxJS 7 API, switched to ES2020 target ([#150])
- **pdfjs-dist** 2.9.359 → 4.2.67 ([#155])

## [2026-04-11]

### Changed
- **Alembic migrations squashed**: replaced 100 incremental migration files with a single clean baseline schema migration (`000000000000_squashed.py`) covering all 21 tables ([#152])
- Dependabot auto-merge CI pipeline added: automerge patch/minor Dependabot PRs when all CI checks pass ([#149])
- Various dependency bumps: `bioc` 1.3.7→2.1, `marshmallow-dataclass` 8.5.3→8.7.1, `google-cloud-storage` 1.43→3.10, `requests` 2.33.0→2.33.1, `marshmallow-sqlalchemy` 1.4.2→1.5.0, `pytest` 9.0.2→9.0.3 (appserver, statistical-enrichment, cache-invalidator) ([#136]–[#141])
- Security: `cryptography` 46.0.6→46.0.7 ([#134])
- `actions/github-script` 7→9 ([#147])
- Maven dependencies bump ([#148])

## [2026-04-02]

### Fixed
- **Flask 3.x compatibility**: upgraded `flask-sqlalchemy` 2.5.1→3.0.5 to fix `ImportError` on `flask._app_ctx_stack` removed in Flask 2+ ([#132])
- **TypeScript 3.8 compatibility**: pinned `@types/jqueryui` to 1.12.21 to avoid template literal types introduced in 1.12.22+ that TypeScript 3.8 cannot parse ([#132])

### Changed
- Various dependency bumps: `sendgrid` 6.9.3→6.12.5, `sentry-sdk` 1.45→2.57, `intervaltree` 3.1→3.2.1, `types-redis`, `types-requests`, `mypy` 1.19→1.20, `gunicorn` 25.2→25.3, `codelyzer` 5.2→6.0, `jasmine-spec-reporter` 4.2→7.0, `@types/node` 12→25 ([#117]–[#128])
- `lodash` / `lodash-es` 4.17.23→4.18.1 ([#130], [#133])

## [2026-03-31]

### Changed
- **Flask** 2.3.3→3.1.3 ([#116])

### Security
- `cryptography` 46.0.5→46.0.6 ([#115])

## [2026-03-27]

### Added
- **Fork branding**: renamed project to *Lifelike Afterhours*, updated logos, README, and project identity to reflect the fork purpose ([#114])
- **GitHub Actions CI workflows**: Docker build/publish, BrowserStack integration tests, SonarQube analysis, CodeQL code scanning, Dependabot configuration ([#109])
- **Git hooks** for linting and code formatting ([#109])
- **VS Code workspace configuration** (`.vscode/`) ([#109])

### Fixed
- **Bootstrap 5 SCSS architecture**: removed duplicate Bootstrap import from `styles.scss`; fixed `angular.json` build order (`scss/bootstrap.scss` before `styles.scss`); cleaned `_variables.scss`, `_buttons.scss`, `_window.scss` for Bootstrap 5 compatibility ([#109])
- **d3 v5→v7 migration**: replaced removed `d3.event` global with event parameter; replaced `d3.mouse()` with `d3.pointer()`; migrated `sankey.component.ts` to d3 v7 event API ([#109])
- **SQLAlchemy 1.4 compatibility**: replaced deprecated `db.Binary` with `db.LargeBinary` in `models/files.py` and `models/views.py` ([#109])
- Removed non-existent Bootstrap 5 import path `bootstrap/js/dist/index` from `main.ts` ([#109])
- Fixed `Dockerfile` client build: added `--ignore-engines` yarn flag for Node 20 compatibility ([#109])

---

[#109]: https://github.com/Skitionek/lifelike/pull/109
[#114]: https://github.com/Skitionek/lifelike/pull/114
[#115]: https://github.com/Skitionek/lifelike/pull/115
[#116]: https://github.com/Skitionek/lifelike/pull/116
[#117]: https://github.com/Skitionek/lifelike/pull/117
[#128]: https://github.com/Skitionek/lifelike/pull/128
[#130]: https://github.com/Skitionek/lifelike/pull/130
[#132]: https://github.com/Skitionek/lifelike/pull/132
[#133]: https://github.com/Skitionek/lifelike/pull/133
[#134]: https://github.com/Skitionek/lifelike/pull/134
[#136]: https://github.com/Skitionek/lifelike/pull/136
[#141]: https://github.com/Skitionek/lifelike/pull/141
[#147]: https://github.com/Skitionek/lifelike/pull/147
[#148]: https://github.com/Skitionek/lifelike/pull/148
[#149]: https://github.com/Skitionek/lifelike/pull/149
[#150]: https://github.com/Skitionek/lifelike/pull/150
[#152]: https://github.com/Skitionek/lifelike/pull/152
[#153]: https://github.com/Skitionek/lifelike/pull/153
[#154]: https://github.com/Skitionek/lifelike/pull/154
[#155]: https://github.com/Skitionek/lifelike/pull/155
