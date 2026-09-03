# Mycelium TODO

Persistent task list for sequential cleanup/fix work. Forked conversations should add subtasks here rather than letting work disappear in chat history.

## Workflow

- Treat each forked conversation as a subtask.
- Add or update tasks in this file before/while working.
- Finish one task at a time.
- Make a local git commit between tasks.
- Prefer correct framework usage over compatibility shims.
- For styling cleanup, prefer default Bootstrap 5 / Angular Material / ng-bootstrap markup and classes over copied Bootstrap 4-era custom SCSS.

## Backlog

### Styling cleanup

- [x] Audit remaining `client/src/scss/*.scss` files as copied Bootstrap 4-era source; delete entire files/rules where Bootstrap 5 already provides equivalent styling.
- [x] Replace invalid logical-direction CSS introduced during migration (`border-start`, `border-end` as properties) with Bootstrap utilities or valid CSS logical properties only where truly needed.
- [x] Keep genuine app-specific components (`.module-*`, `.tile-*`, graph/visualization layout, split panes) unless they duplicate framework defaults.
- [ ] Prefer Bootstrap 5 utilities/components in templates over project-specific utility classes (partially done: `.list-condensed`, `.window-btn` replaced; `.cursor-*`, `.input-border`, `.form-padding` still project-specific).
- [ ] Revisit `client/src/scss/_dropdown.scss` ng-bootstrap/CDK workarounds once ng-bootstrap positioning behaviour is confirmed; several `!important` rules may be removable.
- [ ] Review `client/src/scss/_tabs.scss` (99 lines) against Bootstrap 5 `nav-tabs` — the custom divider/hover styling may be reducible.

### CI

- [ ] Don't publish images in PR checks. `.github/workflows/docker.yml` triggers on
      `pull_request` and passes `push: true` unconditionally, so every PR pushes tags to
      GHCR. Build on PRs for validation but only push on `main`/tags, e.g.
      `push: ${{ github.event_name != 'pull_request' }}`, and drop `packages: write`
      from the PR path.

### Branch maintenance

- [ ] Rebase `chore/angular16-bootstrap5-migration` onto current `main`. The remote has moved
      on (dependabot bumps, and `feat/kg-shortest-path-queries` was force-rebased upstream),
      so the migration branch and everything stacked on top of it — `feat/file-browser-folder-upload`,
      `chore/scss-bootstrap4-cleanup` — are built on a stale base. Rebase the stack bottom-up and
      re-run the frontend build plus a UI smoke test afterwards.

### Verification

- [ ] After each styling cleanup task, rebuild frontend with Docker Compose.
- [ ] Smoke-test login, workspace tabs, file browser list, file action dropdowns, and representative forms.
- [ ] Record any newly discovered subtask in this TODO before moving on.

## Branch stack

Work is stacked as separate branches off `main` (not pushed unless explicitly requested):

1. `fix/marshmallow-sqlalchemy-compat` — appserver dependency/SQLAlchemy 2 fixes
2. `chore/docker-compose-modernization` — compose v2 + local Elasticsearch build
3. `chore/angular16-bootstrap5-migration` — Angular 14→16, Material legacy, Bootstrap 4→5
4. `feat/file-browser-folder-upload` — folder upload support
5. `feat/kg-shortest-path-queries` — KG demo queries
6. `chore/scss-bootstrap4-cleanup` — this TODO + Bootstrap 4-era SCSS removal
