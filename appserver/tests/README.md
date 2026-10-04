# Appserver tests

Three tiers, distinguished by what they need to run:

- **`unit`** — no external services. Run anywhere.
- **`database`** — needs PostgreSQL, Neo4j and Solr. Uses a `session` fixture
  that is supposed to roll back after each test.
- **`api`** — adds an `httpclient` fixture on top of `session`.

## What CI runs

| Tier | Job in `tests.yml` | Coverage |
|---|---|---|
| `unit` | `Appserver Tests` | all tests |
| `database` | `Appserver Database Tests` | 180 tests; three files excluded, see below |
| `api` | — | not run, see below |

## Running them locally

`unit` needs nothing but the dependencies:

```bash
cd appserver
pytest tests/unit -v
```

`database` needs three services and a migrated, **empty** database. Do not
point it at the dev stack's database — the fixtures use fixed primary keys
(`id=100`, `200`, `300`) and will collide with real rows.

Bring up scratch services:

```bash
docker network create mycelium-test

docker run -d --rm --name t-postgres --network mycelium-test \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_HOST_AUTH_METHOD=trust postgres:13

docker run -d --rm --name t-neo4j --network mycelium-test \
  -e NEO4J_AUTH=neo4j/password neo4j:4.4-community

docker run -d --rm --name t-solr --network mycelium-test \
  solr:9 solr-precreate file
```

Solr needs the `file` core, which is what `solr-precreate file` creates.
Without it the suite fails immediately with connection errors against
`/solr/file/update`.

Then create the schema and run the suite. Nothing in the fixtures creates
tables, so migrations have to run first:

```bash
export POSTGRES_HOST=t-postgres POSTGRES_USER=postgres \
       POSTGRES_PASSWORD=postgres POSTGRES_DB=postgres \
       NEO4J_HOST=t-neo4j NEO4J_AUTH=neo4j/password \
       SOLR_URL=http://t-solr:8983/solr FLASK_APP=app.py

flask db upgrade
pytest tests/database -v
```

Recreate the database between runs. Because of the rollback bug below, a run
leaves rows behind and the next one starts dirty.

## Known problems

### Rollback does not hold (#619)

The `session` fixture binds to a transaction and rolls it back on teardown,
but rows written through code paths that call `session.commit()` survive. One
test is enough to show it:

```console
$ pytest tests/database/services/projects_test.py::test_can_add_project_collaborator -q
1 passed
$ psql -tAc "SELECT count(*) FROM appuser;"
1
```

Because the fixtures use fixed primary keys, that leak makes every later test
in the same file fail with a duplicate-key error. Three files are therefore
excluded from CI:

- `tests/database/services/annotations/manual_annotations/`
- `tests/database/services/auth_test.py`
- `tests/database/services/projects_test.py`

They are excluded as whole files rather than test by test, because which
individual tests fail depends on collection order.

### The api tier hangs (#620)

`pytest tests/api` collects its 348 tests in under a second and then never
finishes — over ten minutes with no progress, against the same services that
make `tests/database` work. Probably a client with no timeout waiting on a
service that is not running; Elasticsearch and Redis are the candidates. Not
run in CI until that is understood.
