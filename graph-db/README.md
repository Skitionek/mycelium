# graph-db (deprecated)

> ⚠️ **Deprecated** — This component has been superseded by
> [Mozg](../mozg/README.md) and will be removed in a future release.

`graph-db` contained the infrastructure to extract biological-database data
(BioCyc, ChEBI, GO, KEGG, STRING, UniProt, …) and load it into a local Neo4j
knowledge graph.

## Migration to Mozg

[Mozg](https://github.com/Skitionek/Mozg) is the replacement.  Instead of
pre-loading data into Neo4j, Mozg queries the canonical upstream sources
directly at request time through a single GraphQL endpoint (`/graphql`).

Services that previously read from the local Neo4j knowledge graph now set the
`MOZG_URL` environment variable to point at the Mozg container.  When
`MOZG_URL` is present the application routes NCBI gene matching and the
UniProt, STRING, KEGG and GO enrichment domains through Mozg instead of Neo4j.

### What still uses Neo4j

The following continue to require a Neo4j instance:

* **Graph visualiser** – complex graph-traversal queries
* **Full-text synonym search** – Lucene index on the `Synonym` nodes
* **BioCyc and RegulonDB enrichment** – neither upstream is reachable through
  Mozg; see [mozg/README.md](../mozg/README.md)
* **Sound GO enrichment statistics** – the Mozg path can only supply truncated
  gene lists, so Fisher p-values computed from them rank terms rather than
  quantify significance

The first two are pending migration. The last two are blocked on the upstream
sources rather than on this pipeline.

## Sub-directories

| Directory    | Purpose |
|--------------|---------|
| `extractor/` | Python pipeline that downloads and parses biological databases |
| `migrator/`  | Java/Liquibase tool that applies the parsed data to Neo4j |

No further development should happen in this directory.
