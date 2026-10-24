# Mycelium testing tools

This directory contains various types of test for ensuring perfomance and correctness of the Mycelium application.

- End-to-end testing
- Broser performance testing
- Server stress testing
- Smoke testing

## [End-to-end tests](e2e/)

These tests are written in TypeScript using [Playwright Test](https://playwright.dev/)
and drive the real Angular client against the real appserver, PostgreSQL and
Solr, logging in and working through the UI the way a user would. They run in
CI as the *End-to-End Tests* job of the `Tests` workflow.

The specs live in [`e2e/specs`](e2e/specs):

- `auth.setup.ts` logs in once through the login form, accepts the Terms of
  Service and saves the session for the other specs.
- `*.anon.spec.ts` run without a session (login, ToS, redirects).
- every other `*.spec.ts` runs as the logged-in seeded admin.

They expect a migrated database loaded with `flask seed`. Specs that create
data give it a unique name, so the suite can run repeatedly against the same
database; reseed to start clean.

### Running against the development stack

With the stack from `make up-dev` running and the database seeded (see the
[Quick start](../README.md#quick-start)), Playwright reuses the appserver on
port 5000 and the Angular dev server on port 4200:

```bash
cd e2e
yarn install
yarn playwright install chromium
yarn test          # headless
yarn test:ui       # Playwright UI mode, for writing and debugging specs
yarn report        # open the HTML report of the last run
```

If nothing is listening on those ports, Playwright starts `flask run` in
`appserver/` and `yarn dev-start` in `client/` itself. That needs the
appserver's Python dependencies on `PATH`, the client's `node_modules`, and
PostgreSQL and Solr reachable as configured in `appserver/config.py`.

### Running against another deployment

Set `E2E_BASE_URL` to skip starting any servers, and `E2E_USER_EMAIL` /
`E2E_USER_PASSWORD` if the deployment does not have the seeded admin user:

```bash
E2E_BASE_URL=http://localhost:8080 yarn test
```

## [Locust](locust/)

These tests are written in Python using the [Locust framework](https://locust.io/)
and are run against the API server to generate load and determine how it performs
responding to expected HTTP requests done by the client.

### Requirements

- Puyhon
- uv

Install Python dependencies:

```bash
cd locust
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
```

### Run locust interatively

```bash
uv run --python .venv/bin/python locust
```

Then, navigate to <http://localhost:8089> in a browser.

### To run a test in headless mode

```bash
# Set varibles for the environment to run the tests against
export BASE_URL=https://localhost:5000/api
export USER_EMAIL="user@mycelium.bio"
export USER_PASSWORD="[replace]"
export NUM_USERS=10  # Peak number of concurrent Locust users.
export RUN_TIME=60s  # Stop after the specified amount of time, e.g. (300s, 20m, 3h, 1h30m, etc.).

uv run --python .venv/bin/python locust \
  --headless \
  --host $BASE_URL \
  --users $NUM_USERS \
  --run-time $RUN_TIME
```

## Element - Browser load testing

These tests are written in Typescript using the [Element](https://element.flood.io/docs/) tool.
They are run in real browsers and are intended to mimic real use case scenarios.

### Running the tests

Install NPM dependencies:

```bash
cd element
yarn install
```

## Cypress (Browser smoke tests)

Legacy suite, superseded by the [end-to-end tests](#end-to-end-tests) above.
It targets a deployment with a `CAG-Center` project and is not run in CI.
