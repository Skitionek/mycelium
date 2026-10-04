# Mycelium Contribution Guide

`Mycelium` community welcomes your contribution. To make the process as seamless as possible, we recommend you read this contribution guide.

## Development Workflow

Start by forking the Mycelium GitHub repository, make changes in a branch and then send a pull request. We encourage pull requests to discuss code changes.

### Create a Pull Request

Pull requests can be created via GitHub. Refer to [this document](https://help.github.com/articles/creating-a-pull-request/) for detailed steps on how to create a pull request. After a Pull Request gets peer reviewed and approved, it will be merged.

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
