# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

> This changelog tracks changes made in the [Mycelium](https://github.com/Skitionek/mycelium)
> fork of the [SBRG/lifelike](https://github.com/SBRG/lifelike) repository.

---

## [Unreleased]

### Added

- **End-to-end tests**: a Playwright suite in [`tests/e2e`](tests/e2e) drives the Angular client against the real appserver, PostgreSQL and Solr - login, Terms of Service, the file browser, creating projects and folders, and uploading and opening a file - and runs in CI as the *End-to-End Tests* job.
- **Local folders**: folders on the user's computer can be connected from the file browser (or dragged onto it) through the browser's File System Access API. Their files open in the same built-in viewers as uploaded files (PDF, office documents, code, protein structures, BioC, maps, Sankey, enrichment tables, DMP and SDRF) without being uploaded, and can be created, uploaded into, moved and deleted on disk. See [`docs/local-folders.md`](docs/local-folders.md) ([#679]).
- **Background indexing of local folders**: files are text-indexed in the browser (PDF text via PDF.js), and PDFs and enrichment tables are annotated with knowledge-graph entities, as they appear and change. Status shows in the navigation bar, on each folder tile and folder header, and per file in a new **Index** column; folder contents can be searched from the folder header ([#679]).
- **Resumable on-disk index**: index shards are saved in hidden `.mycelium` directories inside the folder, a second after each file is done, and the folder's identity in a manifest there. A disconnected folder, a closed tab or a reload loses at most the file in progress; reconnecting the folder - even with the browser's storage cleared - reuses its ID and processes only new or changed files ([#679]).
- **`POST /filesystem/annotations/transient`**: annotate a PDF without storing it or its annotations. The content is held in Redis under an unguessable token, at most ten minutes, for the PDF parser to fetch from `GET /annotations/transient/<token>`, and discarded once parsed ([#679]).
- **`POST /filesystem/annotations/transient/enrichment-table`**: annotate an enrichment table without storing it or its annotations, answering like `GET /filesystem/objects/<id>/enrichment/annotations`. The cell snippets are built by the same code as for stored tables, now in `services/annotations/enrichment_snippets.py` ([#679]).
- **`POST /filesystem/convert/pdf`**: convert an uploaded office document to PDF with LibreOffice without storing it, so office files that are not in Mycelium can open in the PDF viewer ([#679]).

- **Mycelium rebrand**: Renamed project from "Lifelike Afterhours" to "Mycelium" across all user-facing strings, browser title, navigation, login page, version dialog, and Terms of Service.
- **Mycelium SVG logo**: Minimalist mycelium-network icon added to the left navigation bar (`assets/icons/mycelium-logo.svg`) ([#245]).
- **File context menu "Open in" options**: context menus now include an "Open in" section so users can choose a specific viewer (for example Default, PDF, Code, BioC, or Protein Structure) when multiple viewers are applicable ([#257]).
- **SDRF routing**: files of the SDRF type open in the SDRF editor and offer it under **Open in**; nothing routed them there before ([#679]).
- **Codespaces prebuild-friendly devcontainer flow**: `.devcontainer/devcontainer.json` now runs `.devcontainer/post-create.sh` during container creation, allowing GitHub Codespaces prebuilds to pre-run stack build/start work and reduce first-start latency.

### Changed

- **"Bio-Digital Lab" design system**: Global CSS custom properties introduced (`--color-primary: #004B49`, `--color-accent: #D4FF00`, `--color-bg-main: #F1F5F9`, `--color-text-main: #0F172A`). Bootstrap `$primary` updated to Deep Sea Teal `#004B49`; highlight colour updated to Bioluminescent Lime `#D4FF00` ([#245]).
- **Typography**: Primary sans-serif font updated to Inter (with Roboto fallback) ([#245]).
- **Fonts and Plotly bundled**: the Roboto, IBM Plex Sans and Inter fonts and Plotly are bundled from pinned npm packages instead of loaded from Google Fonts and `cdn.plot.ly`. Plotly is pinned to 1.58.5, the build the `plotly-latest` URL served. Font Awesome still loads from its kit: it is Font Awesome 5 Pro with custom icons the app draws by name and code point ([#744]).
- **Border radius**: Global `$border-radius` set to 6px (rounded-md) for all buttons and components ([#245]).
- **Elevation**: Heavy box-shadows replaced with subtle `1px solid #e2e8f0` borders on module headers, toolbars, dropdowns and popovers for a "clinical lab" aesthetic ([#245]).
- **Knowledge Graph nodes**: Default node stroke and edge colour updated from `#2B7CE9` to Deep Sea Teal `#004B49`; default node background updated to `#F1F5F9` ([#245]).
- **Release automation**: each successful push CI run on `main`/`master` now rolls `[Unreleased]` into a dated changelog section, creates a date-based git tag, and publishes a GitHub Release.
- **`get_mycelium_global_inclusions_by_type_query` / `get_mycelium_global_inclusion_exist_query`**: Renamed from `get_lifelike_*` to `get_mycelium_*` to match the `db_Mycelium` label they query; call sites in `annotation_graph_service.py` and `manual_annotation_service.py` updated accordingly ([#254]).
- **DB constraint/index names**: `constraint_lifelike_name` → `constraint_mycelium_name` and `index_lifelike_id` → `index_mycelium_id` in `changelog-0030.xml` to match the `db_Mycelium` node label they target ([#254]).

### Added

- **Protein structure viewer (Mol\*)**: `.pdb`, `.cif`, and `.mmcif` files now open in a dedicated Mol\*-powered 3D viewer route (`projects/:project_name/structure/:file_id`), including in-app preview support and upload-time MIME mapping for protein structure extensions (`([#244])`).
- **Mozg knowledge-graph layer** (`mozg/`): new Docker service based on
  [Mozg](https://github.com/Skitionek/Mozg), a cross-database GraphQL query
  layer. Mozg replaces the local Neo4j knowledge graph (`graph-db/`) for
  enrichment-data queries. When `MOZG_URL` is set, NCBI gene matching and the
  UniProt, STRING, KEGG and GO enrichment domains are answered from the
  canonical upstream REST APIs at request time instead of from a pre-loaded
  Neo4j instance. The image clones a pinned Mozg revision
  (`MOZG_REVISION` in `mozg/Dockerfile`) rather than tracking `main`.
- **`appserver/neo4japp/services/mozg_client.py`**: HTTP client for the Mozg
  `/graphql` endpoint, with connection descriptors for NCBI E-utilities,
  UniProt, STRING, KEGG and EBI QuickGO that mirror Mozg's own catalog
  entries.
- **`appserver/neo4japp/services/mozg_kg_service.py`**: `MozgKgService` and
  `MozgEnrichmentTableService` — drop-in replacements for `KgService` /
  `EnrichmentTableService`. Selected automatically when `MOZG_URL` is
  present; fall back to Neo4j when it is not. Each domain resolves a whole
  gene list in a handful of batched queries rather than one request per gene.
  `geneNeo4jId` and `synonymNeo4jId` now carry the NCBI Gene UID; both are
  integers and are only ever echoed back as lookup keys.
- **`statistical-enrichment/.../services/mozg_client.py`** and
  **`.../services/enrichment/mozg_go.py`**: GO term lookups from EBI QuickGO
  through Mozg, used when `MOZG_URL` is set.
- `requests` added to the `statistical-enrichment` dependencies, which the
  Mozg client needs.
- Unit tests for both Mozg-backed services, driven by a fake Mozg transport
  over response shapes captured from the live upstreams.
- **Folder-level `.annotations` JSON config files**: directories can now contain a `.annotations` file (MIME type `vnd.lifelike.filesystem/annotations`) that defines annotation scope — analogous to `.gitignore`. Content is a **JSON object** validated against `annotations_v1.json` (JSON Schema draft-07). Supports `inherit`, `fallback_organism`, `annotation_configs`, `include`, and `exclude` fields. Managed through the standard file API; nested folders can extend or override parent scope; `inherit: false` resets the accumulated config from outer scopes.
- **`neo4japp/schemas/formats/annotations_v1.json`**: JSON Schema (draft-07) for `.annotations` config files, compiled at import time via `fastjsonschema`.
- **`AnnotationsFileTypeProvider`**: registered file-type provider for `.annotations` MIME type. Validates uploaded JSON against the schema; triggers a synchronous refresh of the `file_effective_annotation_config` table via an `after_commit` hook that executes a SQL function.
- **`FolderAnnotationService`** (`neo4japp/services/annotations/folder_annotation_service.py`): queries the `file_effective_annotation_config` table (O(1) lookup); falls back to walking the ancestor chain and reading `files_content.raw_file` when the table is unavailable.
- **`GET /filesystem/objects/<hash_id>/effective-annotations-config`** — return the merged effective config for any file or folder.
- **`FILE_MIME_TYPE_ANNOTATIONS`** constant (`vnd.lifelike.filesystem/annotations`) added to `constants.py`.
- **Database migration** `001_add_folder_annotation_config`: adds the `file_effective_annotation_config` table precomputing the fully-merged annotation config for every file (recursive CTE over the ancestor folder chain, reads `files_content.raw_file::jsonb` directly) and the `jsonb_merge_annotation_configs` PostgreSQL function/aggregate for deep-merging `annotation_configs` objects. No new column is added to the `files` table.
- Unit tests for `FolderAnnotationService` covering: no config files, single folder config, nested config merging, `inherit: false` reset, per-file overrides, partial configs.
- API test for the `effective-annotations-config` endpoint.

### Changed

- `docker/docker-compose.services.yml`: Mozg service added; `appserver` and
  `statistical-enrichment` gain `MOZG_URL` and `mozg` in their `depends_on`.
  `cache-invalidator` reads `MOZG_URL` but never queries Mozg, so it does not
  depend on it.
- `cache-invalidator` skips `precalculateGO()` when `MOZG_URL` is set. There
  is no Mozg equivalent: the cache holds every GO term of an organism with
  every gene annotated to it, and QuickGO answers at most 2 500 annotations
  per query against the ~1.5 million a single organism has.

### Known limitations

- **BioCyc and RegulonDB return no data under Mozg.** `websvc.biocyc.org`
  answers programmatic requests with a captcha page without a subscription,
  and `regulondb.ccg.unam.mx` serves an incomplete TLS certificate chain that
  Mozg's HTTP client rejects. Both domains are reported as missing rather than
  failing the enrichment table.
- **GO enrichment statistics are approximate under Mozg.** Fisher's exact test
  derives a term's gene count and the background gene universe from the gene
  list it is given; QuickGO can only supply a truncated one, and only for the
  200 most widely shared terms. p-values and q-values are therefore indicative
  of ranking, not of significance, and are not comparable to the Neo4j-backed
  ones. Leave `MOZG_URL` unset to keep reading GO from Neo4j.

### Deprecated

- **`graph-db/`**: the Neo4j extractor + migrator pipeline is deprecated.
  New biological-database pipelines should not be added there; use Mozg
  instead. The Neo4j instance is retained for the graph visualiser, full-text
  synonym search, the BioCyc and RegulonDB domains, and sound GO statistics.

### Security

- **DOI lookups**: exporting a map no longer makes the server request the URL of any node source labelled DOI, which let a map's author have the server fetch internal addresses such as the cloud metadata endpoint. DOIs are only ever looked up on `doi.org`, over HTTPS, without following its redirect to the publisher, and every lookup has a timeout, so a `doi.org` that never answers no longer holds a PDF upload indefinitely ([#756]).
- **Annotation list export**: text users typed into the global inclusion and exclusion lists, such as a comment starting with `=`, is written to the admin's Excel export as text instead of as a live formula ([#759]).
- **`cryptography`** bumped from 46.0.6 → 46.0.7 to fix CVE-2026-39892 (buffer overflow via non-contiguous buffer, MEDIUM severity).
- **CodeMirror 6 viewer** (`codemirror-viewer`): read-only code/text viewer powered by CodeMirror 6 with syntax highlighting for JSON, Python, JavaScript/TypeScript, XML/HTML, and Markdown; plain-text display for YAML, CSV, and other text types; accessible at `projects/:project_name/code/:file_id`.

### Fixed

- **Enrichment visualisation**: the statistical-enrichment request returns its results again. GO terms were written to Redis as a list, which Redis refuses; the result, already JSON, was encoded a second time into a JSON string the client could not map over; and cached answers, which Redis returns as bytes, could not be sent at all. GO terms the cache-invalidator precalculated could not be read back either, so in Neo4j deployments every request for such an organism failed ([#754]).
- **Enrichment statistics**: a submitted gene outside every returned GO term no longer turns every p- and q-value into `null`, a gene list matching no precalculated term answers an empty result instead of an error, and the q-value correction no longer fails when the organism's approximate term count undercounts ([#754]).
- **Enrichment organism validation**: a malformed `taxID/name` organism is answered with 422 instead of 500, and organism names that contain a slash, such as influenza strains, are accepted ([#754]).
- **Cache invalidator backoff**: repeated failures now back off as intended. A successful or skipped GO precalculation (always skipped with Mozg) reset the delay, so a failing Kg statistics query was retried every minute forever, and a failed round slept twice. Neo4j sessions are closed when a query fails instead of leaking on every retry ([#754]).
- **Mozg client**: a query answered with a `null` result and no errors yields no rows instead of an `AttributeError`, in both the appserver and statistical-enrichment ([#754]).
- **URL uploads**: fixing up a URL before fetching it no longer encodes `+` in its query, which turned a space into a literal plus for the server, nor drops the brackets of an IPv6 host ([#754]).
- **File download names**: a `"` or `\` in a filename no longer ends the `Content-Disposition` header's fallback filename early, and not-modified answers carry the file's ETag ([#754]).
- **Executable upload names**: filenames that end in dots or spaces, such as `x.exe.`, which Windows saves as `x.exe`, are rejected like `x.exe` ([#754]).
- **Empty page and limit parameters**: an empty integer field that allows null loads as null, and one that does not is answered with a validation error instead of a 500 ([#754]).
- **Enrichment table CSV export**: empty cells are exported empty instead of as `undefined` or `null`, and cells holding a carriage return are quoted ([#754]).
- **Pagination from the URL**: a hand-edited `page` or `limit` that is not a positive integer falls back to its default instead of sending `NaN`, 0 or a negative number ([#754]).
- **BioC files with CRLF line endings**: blank lines no longer fail to parse ([#754]).
- **PDF annotation popovers**: clicking an annotation in the PDF viewer opens its popover again, with its **Delete Annotation**, **Mark for Exclusion**, **Find Occurrences** and **Unmark Exclusion** buttons and expandable search links. The app loaded Bootstrap without the Popper it needs, so every popover failed to open; Bootstrap 5's sanitizer also stripped the buttons and collapse toggles from its content, and the toggles still used Bootstrap 4's `data-toggle` ([#744]).
- **`flask upload-lmdb` errors**: creating a directory in Azure file storage no longer hides failures. A `finally` block re-ran the creation and returned, which discarded every error other than a missing parent, and retried an error that kept failing until Python ran out of stack ([#744]).
- **Misused session tokens**: a refresh or password reset token sent in place of an access token is refused with 401 instead of failing with 500, so the client renews or ends the session, and an expired session is reported as expired rather than invalid ([#756]).
- **Select-all checkboxes**: the select-all checkbox of an empty folder, or of an empty list of annotations in the admin pages, no longer shows ticked ([#756]).
- **Map export**: a map link node with hyperlinks but no sources no longer fails the export ([#756]).
- **Office documents opened at the same time**: converting several office documents to PDF at once no longer makes some of the conversions fail; each LibreOffice run now has a profile of its own ([#757]).
- **Organism search**: a search ending in a backslash, or with two spaces between words, no longer fails ([#757]).
- **Sankey search**: nodes and links that appear in several traces or trace networks are found in each of them, a trace reached through several links no longer lists its matches repeatedly, and with several search terms a result that merely starts with one of them is no longer ranked as an exact match ([#757]).
- **Phrase search**: a quoted phrase of three or more words matches text with extra spaces between any of its words, not just the first two ([#757]).
- **Login password feedback**: submitting the login form without a password now says "This field is required." under the password field; its row was bound to a `label` control that does not exist, so it never showed any feedback ([#744]).
- **Search-term highlighting**: searching for words such as "amp" or "lt" no longer breaks the text of the results, terms holding `&`, `<` or quotes are highlighted, and a search for `""` no longer litters the results with empty highlights ([#758]).
- **Enrichment tables without sources**: tables that name no domains open with every domain instead of failing to load, and tables in the old slash-separated format keep organism names that contain slashes ([#758]).
- **Damaged office documents**: converting one to PDF reports that the document could not be converted (422) instead of claiming conversion is unavailable (503) and quoting a server path ([#758]).
- **Workspace tab icons**: tabs whose view sets no icon show the window icon again instead of an empty gap; the fallback class was missing its `fa` prefixes, and it was truthy, so the template's own fallback never applied. Enrichment Visualisation tabs get their chart icon back too: their route named it `fas chart-bar` ([#744]).
- **Missing side borders**: column separators in the shared data table, the divider beside the file browser and preview sidebars, the SDRF actions column, the collapsed split-pane tab and clustergram match cells all show again. Their `border-left`/`border-right` had become `border-start`/`border-end`, which are not CSS properties, so browsers dropped them; they are now `border-inline-start`/`border-inline-end` ([#744]).
- **Quick search links**: external search links are labelled "NCBI Gene" and "NCBI Taxonomy" like everywhere else rather than with their `NCBI_Gene` keys, and links saved on a map node are listed in the usual order whatever the case of their domain ([#744]).
- **Unreadable grey badges**: the search term in the PDF and map search control and the **Re-Annotation** badge in a file's annotation history were white on the light grey secondary colour. They now use `text-bg-secondary`, which picks a contrasting text colour ([#744]).
- **Bootstrap 4 leftovers**: full-width buttons are full width again (login, map node and edge **Delete**, annotation filter **Show/Hide All**, the PDF annotation popups and others); `btn-block` no longer exists in Bootstrap 5, so they had shrunk to their label. The Sankey **Delete View** dialog gets a proper close button instead of a bare browser-styled "×", and the remaining `ml-*`, `rounded-left` and `jumbotron` classes use their Bootstrap 5 names ([#744]).
- **Fieldset legends**: section labels such as "Annotation", "Additional Links" and "Enrichment Table Parameters" sit on their divider line again, with the fields starting below them. Bootstrap 5 floats every `legend`, so these labels had left the line and the first field of each section wrapped up beside them, out of line with the rest of the form ([#744]).
- **Release tagging**: the release workflow now sets a tagger identity for its annotated tag. The first run to pass the gate failed at `git tag -a` with "Committer identity unknown", so still no release had been cut ([#744]).
- **Map edge selection**: clicking an edge that rises to the right selects that edge, and clicking empty canvas across from it no longer selects it, nor wins over the edge actually under the pointer ([#759]).
- **Enrichment table cells with `&` or `<`**: annotated cells such as "Na(+) & K(+)" show their text instead of an XML error message ([#759]).
- **Enrichment tables without results**: re-annotating several files no longer fails for all of them when one table holds only its parameters; that file is reported as failed ([#759]).
- **UniProt links from graph search**: a UniProt result dragged onto a map links to its protein page instead of a page that does not exist ([#759]).
- **Links to folders and projects**: following a link to a folder opens or focuses that folder instead of whichever folder was open, and a link to an open project focuses its tab instead of opening another ([#759]).
- **Content search with several words**: a search finds files with all of its words again, and `not` leaves out files with the word after it. Solr reads only upper case `AND`, `OR` and `NOT` as operators, so the lower case `and` joining the words made each word optional, and a lower case `not` was a word to find ([#760]).
- **Content search by file type**: picking file types limits the results to files of those types. The `type:` terms were sent to Solr as text to find in an index with no such field ([#760]).
- **Content search in folders with a `\` in their name**: the folder's files are found, and a folder name ending in `\` no longer makes every search in it fail ([#760]).
- **Office file icons**: files with an upper case extension, such as `REPORT.DOCX`, get the Word, Excel, PowerPoint or Cytoscape icon in the file browser and on maps ([#760]).
- **Long map labels**: a node label with a word too long for the node, such as `TP53` in a narrowed node or a long number, no longer stops the map from drawing. A broken word gets no hyphen after its last piece, and a node sized to such a label is as wide as the label instead of 0 wide ([#760]).
- **Admin user list**: the user browser lists users again. `GET /accounts` built its query with `select([...])`, which SQLAlchemy 2 rejects, so listing users, or getting one, answered 500 ([#763]).
- **Creating and updating users as an admin**: the user browser's dialogs send the picked role as a list, as the accounts API takes, instead of a string it rejected with "Not a valid list". Creating a user no longer answers 500 after saving it: JSON responses serialize dates again ([#763]).
- **Database test isolation**: each database test's writes are rolled back. Its session ran on the app's engine instead of the fixture's connection, so rows leaked into the tests after it; the three test files CI left out for this run again ([#763]).
- **Dialog padding**: dialog headers had half the body's padding and footer buttons sat flush against the dialog edge. The modal overrides in `_variables.scss` are now set before Bootstrap's variables derive from them, and the footer button gap has a unit, which the footer's `calc()` padding needs to be valid ([#743]).
- **Code viewer**: text and code files open again. `@codemirror/state` was bundled twice (6.5.2 pinned by `resolutions`, 6.7.6 required by `@codemirror/view`), so every editor failed with "Unrecognized extension value", and the editor was created before its container was rendered ([#679]).
- **PDF.js worker and `Promise.withResolvers`**: the PDF.js worker is served with the app instead of from cdnjs, which has no `pdf.worker.min.js` for PDF.js 4 and later, and `Promise.withResolvers` is polyfilled because zone.js 0.13 replaces `Promise` without it. Without both, PDF.js 6 could not load any PDF; the PDF viewer also no longer calls the removed `_setScale` ([#679]).
- **Lazy-loaded workspace routes**: moved `search/graph`, `pathway-browser-prototype`, enrichment table/visualisation, map editor/viewer, `kg-statistics`, and `kg-visualizer` behind route-level lazy loading so they no longer inflate the initial client bundle ([#415]).
- **Client production bundle budget failure**: reenabled Angular production optimization and build optimizer in `client/angular.json`, reducing the initial bundle size.
- **VS Code client debug task**: added a background readiness matcher for `client: dev-start` and a full-stack debug compound so the browser can attach once the Angular dev server is ready.
- **Development frontend startup**: the Docker dev override now builds the Angular dev-server stage for `frontend`, publishes port `4200`, and points `FRONTEND_URL` at the live dev server so source edits show up without rebuilding the static bundle.
- **Knowledge Graph visualizer route**: removed the invalid `canActivate` guard from the `kg-visualizer/` redirect route so Angular router configuration validates correctly on startup.
- **Search endpoint request parsing**: `GET /search/content` and `GET /search/synonyms` now parse request arguments from query parameters explicitly, restoring compatibility with newer `webargs` parsing behavior.
- **Search API test compatibility**: updated search API tests to send GET parameters via query strings, avoiding form-body parsing regressions in the test client stack.
- **SQLAlchemy 2 compatibility in search paths**: fixed file hierarchy query defer options and test session setup so authenticated content-search requests and related tests run correctly on current Flask-SQLAlchemy/SQLAlchemy versions.
- **CodeMirror 6 routing for Python files**: files detected with Python MIME variants (for example `text/x-script.python`) now open in the CodeMirror 6 viewer route instead of falling back to generic download/PDF paths.
- **Office document preview fallback**: `.docx` and other LibreOffice-convertible extensions now open in the PDF preview route even when uploaded with a generic MIME type.
- **Multipart filesystem uploads**: `mixed_form_json` requests now merge uploaded files and regular form fields with the `json$` payload, fixing false `Content must be provided` errors on `POST /api/filesystem/objects` file uploads.
- **Folder creation request shape**: the create-object dialog now preserves an existing folder MIME type when building `POST /api/filesystem/objects` requests, preventing false `Content must be provided` validation errors on directory creates.
- **POST search payload parsing**: stacked request parsers for account, project, and filesystem search endpoints now ignore sibling pagination/body fields correctly, fixing 400 `Unknown field` errors when `page` or `limit` are sent in the JSON request body.
- **Backend pagination endpoints**: updated keyword-only `paginate()` call sites for current Flask-SQLAlchemy compatibility, fixing 500 errors when listing projects and other paginated resources on the dev stack.
- **Login JWT generation**: authentication tokens now handle the PyJWT 2.x `str` return type correctly, fixing the 500 error triggered during login on the seeded dev stack.
- **CI linting**: upgraded `peter-evans/create-pull-request` from v6 to v7 to fix "Duplicate header: Authorization" error in the MegaLinter auto-fix PR step.

### Changed

- **GitHub Actions cleanup**: removed the duplicate default CodeQL workflow, kept the advanced scan workflow, and updated stale graph DB workflow action references.
- **CI linting**: MegaLinter fixes are opened as a separate PR (`APPLY_FIXES_MODE: pull_request`) and auto-approved via `megalinter-auto-approve.yml`; `fast-lint` runs in check-only mode.

### Added

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

[#109]: https://github.com/Skitionek/mycelium/pull/109
[#114]: https://github.com/Skitionek/mycelium/pull/114
[#115]: https://github.com/Skitionek/mycelium/pull/115
[#116]: https://github.com/Skitionek/mycelium/pull/116
[#117]: https://github.com/Skitionek/mycelium/pull/117
[#128]: https://github.com/Skitionek/mycelium/pull/128
[#130]: https://github.com/Skitionek/mycelium/pull/130
[#132]: https://github.com/Skitionek/mycelium/pull/132
[#133]: https://github.com/Skitionek/mycelium/pull/133
[#134]: https://github.com/Skitionek/mycelium/pull/134
[#136]: https://github.com/Skitionek/mycelium/pull/136
[#141]: https://github.com/Skitionek/mycelium/pull/141
[#147]: https://github.com/Skitionek/mycelium/pull/147
[#148]: https://github.com/Skitionek/mycelium/pull/148
[#149]: https://github.com/Skitionek/mycelium/pull/149
[#150]: https://github.com/Skitionek/mycelium/pull/150
[#152]: https://github.com/Skitionek/mycelium/pull/152
[#153]: https://github.com/Skitionek/mycelium/pull/153
[#154]: https://github.com/Skitionek/mycelium/pull/154
[#155]: https://github.com/Skitionek/mycelium/pull/155
[#763]: https://github.com/Skitionek/mycelium/pull/763
[#760]: https://github.com/Skitionek/mycelium/pull/760
[#759]: https://github.com/Skitionek/mycelium/pull/759
[#679]: https://github.com/Skitionek/mycelium/pull/679
[#756]: https://github.com/Skitionek/mycelium/pull/756
[#757]: https://github.com/Skitionek/mycelium/pull/757
[#743]: https://github.com/Skitionek/mycelium/pull/743
[#744]: https://github.com/Skitionek/mycelium/pull/744
[#754]: https://github.com/Skitionek/mycelium/pull/754
[#758]: https://github.com/Skitionek/mycelium/pull/758
