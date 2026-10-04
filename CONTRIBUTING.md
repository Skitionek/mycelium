# Mycelium Contribution Guide

Bug reports and discussion are welcome. **Outside code contributions are not**,
because the license does not permit them — fork-specific modifications in this
repository are proprietary and all rights are reserved, so there are no terms
under which an external pull request could be accepted. See
[Licensing](#licensing) below.

The most useful thing you can do is open an issue:

- Report a bug — include repro steps, what you expected, and what happened.
- Report a documentation error.
- Ask a question about how something works.

<https://github.com/Skitionek/mycelium/issues>

## Development Workflow

For those with commit access.

Branch off `main`, keep each branch to one goal, and open a pull request for
review. Branch names are prefixed with the issue number, then type and a short
description — `621-fix-show-uploaded-files-during-upload`.

Open pull requests as drafts and mark them ready once CI is green and the
description explains the change. Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/).

### Before you push

The lint workflow runs MegaLinter separately from the tests, and on a pull
request it only inspects the files you changed. Reproducing it locally first
avoids a round trip — see [Running the linters locally](docs/local-linting.md).

The test workflow runs the appserver, client, statistical-enrichment and
cache-invalidator suites, plus the Storybook image snapshots. `make test` runs
the appserver suite against the Docker stack; see
[`.github/workflows/tests.yml`](.github/workflows/tests.yml) for exactly what
CI invokes for each service.

## Licensing

This work is based on the Lifelike project. Licensing for this repository, including upstream notice and fork-specific terms, is described in [LICENSE](LICENSE).

If you have questions about licensing, or would like to discuss a potential license change for this fork, feel free to:

- Open an issue at <https://github.com/Skitionek/mycelium/issues>
- Contact Skitionek directly through GitHub
