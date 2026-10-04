# Running the linters locally

CI runs MegaLinter in its own workflow (`.github/workflows/lint.yml`), separate
from the test workflow. This page covers reproducing that locally so a push is
not the first time a formatting problem surfaces.

Configuration lives in [`.mega-linter.yml`](../.mega-linter.yml). Only a subset
of linters is enabled — see `ENABLE_LINTERS` there for the current list.

## Full run in Docker

```bash
npx mega-linter-runner
```

## Narrow run on the files you changed

Faster, and closer to what CI does on a pull request, since
`VALIDATE_ALL_CODEBASE: false` means CI only inspects changed files:

```bash
docker run --rm -v "$(pwd)":/tmp/lint:rw -w /tmp/lint \
  -e DEFAULT_WORKSPACE=/tmp/lint -e VALIDATE_ALL_CODEBASE=false \
  -e ENABLE_LINTERS=PYTHON_RUFF,JSON_PRETTIER,YAML_PRETTIER,MARKDOWN_MARKDOWNLINT \
  oxsecurity/megalinter:v8 2>&1 | tail -20
```

### Things that will waste your time otherwise

- **`git add` your changes first.** Diff mode ignores unstaged files and
  silently reports "0 matching files", which looks like a clean run.
- **It writes a root-owned `megalinter-reports/`.** Remove it with
  `sudo rm -rf megalinter-reports`.
- **`APPLY_FIXES: all` edits the working tree in place.** Check what it touched
  before committing; `git checkout --` anything that does not belong to the
  change you are making. It has a habit of reformatting
  `docker/docker-compose.yml`.

## Per-language linters without Docker

Often quicker when you only need one language. These are the same tools and
configuration MegaLinter invokes:

```bash
# Python — all services
ruff check --config ruff.toml appserver cache-invalidator statistical-enrichment

# Markdown
npx markdownlint-cli README.md

# JSON and YAML
npx prettier --check '**/*.{json,yml,yaml}'
```

Note that `client/`'s TypeScript is **not** currently covered by either
MegaLinter or the test workflow. See the open issue on replacing tslint with
`angular-eslint`.
