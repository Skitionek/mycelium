# Mozg – knowledge-graph query layer

[Mozg](https://github.com/Skitionek/Mozg) replaces the `graph-db` Neo4j
knowledge graph for enrichment lookups. Instead of pre-loading biological
databases into a local Neo4j instance, Mozg queries the canonical upstream
sources at request time through a single GraphQL endpoint (`/graphql`).

## Quick start

```bash
docker compose -f docker/docker-compose.yml \
               -f docker/docker-compose.services.yml up mozg
```

The GraphQL playground is available at <http://localhost:4000/graphql>, and
Mozg's own visual query builder at <http://localhost:4000/>. Both are useful
for reproducing a query a service made before changing it.

## Which service queries what

Mycelium talks to Mozg from two services, and every query carries its own
connection — see `appserver/neo4japp/services/mozg_client.py` for the
descriptors, which mirror the matching entries in Mozg's own catalog
(`{ catalog(name: "uniprot") { … } }`).

| Enrichment domain | Upstream | Driver | Entity |
|---|---|---|---|
| Gene matching | NCBI E-utilities | `rest` | `/esearch.fcgi`, `/esummary.fcgi` |
| UniProt | UniProt REST | `rest` | `/uniprotkb/search` |
| STRING | STRING | `rest` | `/get_string_ids` |
| KEGG | KEGG REST | `kegg` | `/conv/genes`, `/link/pathway`, `/list/pathway` |
| GO | EBI QuickGO | `rest` | `/annotation/stats`, `/annotation/search` |

QuickGO has no Mozg catalog entry and is reached as a plain REST source. Mozg
does catalogue `api.geneontology.org` as `geneontology`, but that API has no
organism-wide annotation search and exposes no gene symbols, both of which the
enrichment table and the statistical-enrichment background need. QuickGO is
also where `graph-db` sourced its GO data.

## Domains Mozg cannot serve

Two of the six enrichment domains have no reachable upstream, and
`MozgKgService` returns nothing for them rather than failing the request. The
enrichment table renders a missing domain as blank, so a table that also asks
for reachable domains still gets those.

| Domain | Why |
|---|---|
| BioCyc | `websvc.biocyc.org` answers programmatic requests with a captcha page unless the caller holds a subscription. Mycelium has no credentials, and `graph-db` used downloaded flat files rather than the web service. |
| RegulonDB | `regulondb.ccg.unam.mx` serves an incomplete TLS certificate chain. Mozg's HTTP client rejects it, so no request reaches the host. |

Restoring either one means supplying BioCyc credentials, or an upstream TLS
fix — not a change on this side.

## GO statistics are approximate under Mozg

`statistical-enrichment`'s Fisher test reads both a term's gene count and the
whole background gene universe out of the gene list it is handed. The Neo4j
query returned every organism gene annotated to a term in one hop; QuickGO
answers a page at a time, and a gene list costs one request per term. So with
`MOZG_URL` set:

- each term's gene list is truncated to one QuickGO page, and
- only the 200 terms shared by the most submitted genes are reported.

Both caps shrink the numbers the test is computed from, so **p-values and
q-values are indicative of ranking, not of significance**, and are not
comparable to the Neo4j-backed ones. A deployment that needs sound enrichment
statistics should leave `MOZG_URL` unset and keep reading GO from Neo4j. See
`statistical_enrichment/services/enrichment/mozg_go.py`.

`cache-invalidator` has no Mozg equivalent for `precalculateGO` for the same
reason, and skips it when `MOZG_URL` is set.

## Pinned revision

The image clones a pinned Mozg commit (`MOZG_REVISION` in the `Dockerfile`)
rather than tracking `main`. The queries above depend on specific driver
behaviour — how the `rest` driver maps `where` to query parameters, how the
`kegg` driver reads `_pathSuffix` — so an unpinned clone would silently change
what these services talk to. Bump it deliberately and re-run the Mozg-backed
tests:

```bash
cd appserver && pytest tests/unit/services/mozg_kg_service_test.py
cd statistical-enrichment && pytest tests/test_mozg_go.py
```

## Gotchas when adding a query

Three properties of Mozg's drivers have already caused wrong results here:

- The `rest` driver sends `limit` as a `_limit` query parameter, a
  JSONPlaceholder convention that none of the APIs above understand. Paging
  belongs in `where` under the upstream's own name: `retmax` for NCBI, `size`
  for UniProt, `limit` for QuickGO.
- A response body holding a `data`, `results`, `items`, `records`, `list` or
  `entries` array is unwrapped one level. UniProt's `{"results": [...]}`
  arrives as the entry list; NCBI's `{"esearchresult": {...}}` arrives as a
  single row.
- The `kegg` driver has no query string at all. Its one argument goes in
  `where['_pathSuffix']` and becomes a path segment, and its `limit` really
  does slice rows.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port Mozg listens on |

Services reach Mozg through `MOZG_URL` (set in
`docker/docker-compose.services.yml`). Leaving it unset is what selects the
Neo4j-backed implementations, in `appserver/neo4japp/database.py` and
`statistical_enrichment/services/enrichment/__init__.py`.

## Relationship to `graph-db` (deprecated)

`graph-db/` holds the old Neo4j extractor and migrator that populated the
local knowledge graph. It is deprecated and will be removed once the remaining
query paths move off it. No new biological-database pipelines should be added
there.

Neo4j itself is still deployed, and still required for:

- the graph visualiser's traversals,
- full-text synonym search (Lucene index),
- BioCyc and RegulonDB enrichment, and sound GO statistics, per above.
