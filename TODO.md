# Mycelium TODO

Persistent task list for sequential cleanup/fix work. Forked conversations should add subtasks here rather than letting work disappear in chat history.

## Workflow

- Treat each forked conversation as a subtask.
- Add or update tasks in this file before/while working.
- Finish one task at a time.
- Make a local git commit between tasks.
- Run MegaLinter before each commit (see below).
- Prefer correct framework usage over compatibility shims.
- For styling cleanup, prefer default Bootstrap 5 / Angular Material / ng-bootstrap markup and classes over copied Bootstrap 4-era custom SCSS.

### Pull requests

Open a PR for a finished task **only when it stands alone against `main`**. Most styling
work does not: the Bootstrap 4-era rules being removed were themselves introduced by the
unpushed Angular 16 migration, so on `main` they do not exist and the diff is meaningless
(cherry-picking `_dropdown.scss` onto `main` conflicts outright). Those changes stay local
on the stack until the migration itself is pushed.

### MegaLinter (pre-commit)

```bash
docker run --rm -v "$(pwd)":/tmp/lint:rw -w /tmp/lint \
  -e DEFAULT_WORKSPACE=/tmp/lint -e VALIDATE_ALL_CODEBASE=false \
  -e ENABLE_LINTERS=PYTHON_RUFF,JSON_PRETTIER,YAML_PRETTIER,MARKDOWN_MARKDOWNLINT \
  oxsecurity/megalinter:v8 2>&1 | tail -20
```

- `git add` the change first — diff mode ignores unstaged files and silently reports
  "0 matching files".
- It writes root-owned `megalinter-reports/`; remove with `sudo rm -rf megalinter-reports`.
- With `APPLY_FIXES: all` it edits the tree in place; `git checkout --` any auto-fix that
  belongs to a different branch in the stack (it repeatedly reformats
  `docker/docker-compose.yml`).

## Backlog

### Styling cleanup

- [x] Audit remaining `client/src/scss/*.scss` files as copied Bootstrap 4-era source; delete entire files/rules where Bootstrap 5 already provides equivalent styling.
- [x] Replace invalid logical-direction CSS introduced during migration (`border-start`, `border-end` as properties) with Bootstrap utilities or valid CSS logical properties only where truly needed.
- [x] Keep genuine app-specific components (`.module-*`, `.tile-*`, graph/visualization layout, split panes) unless they duplicate framework defaults.
- [ ] Prefer Bootstrap 5 utilities/components in templates over project-specific utility classes (partially done: `.list-condensed`, `.window-btn` replaced; `.cursor-*`, `.input-border`, `.form-padding` still project-specific).
- [x] Revisit `client/src/scss/_dropdown.scss` ng-bootstrap workarounds. Verified against the
      running app: removed `body > .dropdown` (never matches — the ng-bootstrap wrapper is
      `.dropdown` *or* `.dropup`, and Popper sets its position/z-index 1055 inline),
      `.tile, .tile-deck { overflow: visible }` (no-op; nothing sets overflow and `visible`
      is the initial value) and the `.d-inline-block[ngbDropdown]` override (duplicated
      Bootstrap's own `!important` utility). **Kept** `.dropdown-menu.show { position:
      absolute !important }` — disabling it live regresses the menu to `static` and shifts
      it ~156px.
- [ ] Review `client/src/scss/_tabs.scss` (99 lines) against Bootstrap 5 `nav-tabs` — the custom divider/hover styling may be reducible.

### CI

- [x] Don't publish images in PR checks — PR #476. `push: ${{ github.event_name !=
      'pull_request' }}`, registry login skipped on PRs. Verified in CI: `push: false` in
      both build steps and the login step reported `skipped`, while images still built.
      Drive-by: closed an unterminated semver tag pattern (`{{minor` -> `{{minor}}`).

### Branch maintenance

- [ ] **Rebase `chore/angular16-bootstrap5-migration` onto current `main`** — the stack is
      18 commits behind (dependabot bumps; `feat/kg-shortest-path-queries` was also
      force-rebased upstream). Rebase bottom-up, in this order:

      1. `chore/angular16-bootstrap5-migration`  (4 commits ahead)
      2. `feat/file-browser-folder-upload`       (5 ahead — includes the above)
      3. `chore/scss-bootstrap4-cleanup`         (10 ahead — includes both above)

      Use `git rebase --onto origin/main <old-base> <branch>` per branch so the stacked
      commits don't get duplicated. Expect conflicts in `client/package.json` /
      `client/yarn.lock` from dependabot bumps. Afterwards rebuild the frontend and
      smoke-test login, workspace tabs, file browser, and both dropdown hosts.
      Note: `GIT_EDITOR=true git rebase --continue` — the terminal is non-TTY.

### Verification

- [ ] After each styling cleanup task, rebuild frontend with Docker Compose.
- [ ] Smoke-test login, workspace tabs, file browser list, file action dropdowns, and representative forms.
- [ ] Record any newly discovered subtask in this TODO before moving on.

## Branch stack

Stacked branches off `main`. Nothing is pushed unless explicitly requested.

| Branch | Contents | Remote |
| --- | --- | --- |
| `fix/marshmallow-sqlalchemy-compat` | appserver dependency / SQLAlchemy 2 fixes | local |
| `chore/docker-compose-modernization` | compose v2 + local Elasticsearch build | local |
| `chore/angular16-bootstrap5-migration` | Angular 14→16, Material legacy, Bootstrap 4→5 | local |
| `feat/file-browser-folder-upload` | folder upload support | local |
| `chore/scss-bootstrap4-cleanup` | this TODO + Bootstrap 4-era SCSS removal | local |
| `feat/kg-shortest-path-queries` | KG demo queries + ruff fix | pushed, PR #466 |
| `fix/no-image-publish-on-pr` | CI: no image publishing on PRs | pushed, PR #476 |
