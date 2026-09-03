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

- [ ] Audit remaining `client/src/scss/*.scss` files as copied Bootstrap 4-era source; delete entire files/rules where Bootstrap 5 already provides equivalent styling.
- [ ] Prefer Bootstrap 5 utilities/components in templates over project-specific utility classes.
- [ ] Remove redundant custom button/table/form/breadcrumb/modal/dropdown styles only after verifying the affected UI still renders correctly.
- [ ] Replace invalid logical-direction CSS introduced during migration (`border-start`, `border-end` as properties) with Bootstrap utilities or valid CSS logical properties only where truly needed.
- [ ] Keep genuine app-specific components (`.module-*`, `.tile-*`, graph/visualization layout, split panes) unless they duplicate framework defaults.

### Verification

- [ ] After each styling cleanup task, rebuild frontend with Docker Compose.
- [ ] Smoke-test login, workspace tabs, file browser list, file action dropdowns, and representative forms.
- [ ] Record any newly discovered subtask in this TODO before moving on.
