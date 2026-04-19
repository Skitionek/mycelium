# Mozg – knowledge-graph query layer

[Mozg](https://github.com/Skitionek/Mozg) is the replacement for the previous
`graph-db` Neo4j knowledge graph.  Instead of pre-loading biological databases
(BioCyc, ChEBI, GO, KEGG, STRING, UniProt, …) into a local Neo4j instance,
Mozg queries the **canonical upstream sources directly** at request time
through a single GraphQL endpoint (`/graphql`).

## Quick start

```bash
docker compose -f docker/docker-compose.yml \
               -f docker/docker-compose.services.yml up mozg
```

The GraphQL playground is available at <http://localhost:4000/graphql>.

## Supported databases / drivers

| Driver      | Description |
|-------------|-------------|
| `rest`      | Plain REST API (UniProt, STRING, NCBI E-utils, EBI QuickGO, …) |
| `kegg`      | KEGG REST API (`rest.kegg.jp`) |
| `biocyc`    | BioCyc biological databases |
| `neo4j`     | Neo4j (used for visualiser / graph-traversal features) |
| `postgres`  | PostgreSQL |
| `openapi`   | OpenAPI / Swagger-backed REST |

See the [Mozg README](https://github.com/Skitionek/Mozg#readme) for the full
list and example queries.

## Environment variables

| Variable   | Default                    | Description |
|------------|----------------------------|-------------|
| `PORT`     | `4000`                     | HTTP port Mozg listens on |

## Relationship to `graph-db` (deprecated)

The `graph-db/` directory contains the old Neo4j extractor + migrator that
populated the local knowledge-graph.  It is **deprecated** and will be removed
once all query paths have been migrated to Mozg.  No new biological-database
pipelines should be added there.
