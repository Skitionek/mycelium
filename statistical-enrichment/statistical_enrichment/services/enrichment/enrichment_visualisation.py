import os
from typing import List

import pandas as pd

from . import mozg_go
from ..rcache import redis_cached, redis_server
from .enrich_methods import fisher


class EnrichmentVisualisationService:
    def __init__(self, graph=None):
        self.graph = graph

    def _use_mozg(self) -> bool:
        """Whether GO data comes from Mozg rather than the Neo4j graph.

        Read per call so this can never disagree with the choice
        :func:`get_enrichment_visualisation_service` made about ``graph``.
        """
        return bool(os.getenv("MOZG_URL"))

    def enrich_go(self, gene_names: List[str], analysis, organism):
        if analysis == "fisher":
            GO_terms = redis_server.get(f"GO_for_{organism.id}")
            if GO_terms:
                df = pd.read_json(GO_terms)
                go_count = len(df)
                mask = ~df.geneNames.map(set(gene_names).isdisjoint)
                go = df[mask]
            else:
                go = self.get_go_terms(organism, gene_names)
                go_count = self.get_go_term_count(organism)
            return fisher(gene_names, go, go_count)
        raise NotImplementedError

    def query_go_term(self, organism_id, gene_names):
        if self._use_mozg():
            return self._query_go_term_mozg(organism_id, gene_names)
        return self._query_go_term_neo4j(organism_id, gene_names)

    def _query_go_term_mozg(self, organism_id, gene_names):
        """Fetch GO terms from EBI QuickGO via Mozg.

        The term and gene-list caps this path works under, and what they do to
        the statistics computed from them, are described in
        :mod:`statistical_enrichment.services.enrichment.mozg_go`.
        """
        terms = mozg_go.fetch_go_terms(organism_id, gene_names)

        # raise if empty - should never happen so fail fast
        if not terms:
            raise Exception(
                f"Could not find related GO terms for organism id: {organism_id}"
            )
        return terms

    def _query_go_term_neo4j(self, organism_id, gene_names):
        r = self.graph.execute_read(
            lambda tx: list(
                tx.run(
                    """
                    UNWIND $gene_names AS geneName
                    MATCH (g:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId})
                    WHERE g.name=geneName
                    WITH g MATCH (g)-[:GO_LINK]-(go)
                    WITH DISTINCT go MATCH (go)-[:GO_LINK {tax_id:$taxId}]-(g2:Gene)
                    WITH go, collect(DISTINCT g2) AS genes
                    RETURN
                        go.eid AS goId,
                        go.name AS goTerm,
                        [lbl IN labels(go) WHERE lbl <> 'db_GO'] AS goLabel,
                        [g IN genes |g.name] AS geneNames
                    """,
                    taxId=organism_id,
                    gene_names=gene_names,
                ).data()
            )
        )

        # raise if empty - should never happen so fail fast
        if not r:
            raise Exception(
                f"Could not find related GO terms for organism id: {organism_id}"
            )

        return r

    def get_go_terms(self, organism, gene_names):
        return redis_cached(
            f"get_go_terms_{organism}_{','.join(gene_names)}",
            lambda: self.query_go_term(organism.id, gene_names),
        )

    def query_go_term_count(self, organism_id):
        if self._use_mozg():
            return self._query_go_term_count_mozg(organism_id)
        return self._query_go_term_count_neo4j(organism_id)

    def _query_go_term_count_mozg(self, organism_id):
        """Get the total number of distinct GO terms for an organism via Mozg."""
        go_term_count = mozg_go.fetch_go_term_count(organism_id)

        # raise if empty - should never happen so fail fast
        if not go_term_count:
            raise Exception(
                f"Could not find GO term count for organism id: {organism_id}"
            )
        return go_term_count

    def _query_go_term_count_neo4j(self, organism_id):
        r = self.graph.execute_read(
            lambda tx: list(
                tx.run(
                    """
                    MATCH (n:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {eid:$taxId})
                    WITH n MATCH (n)-[:GO_LINK]-(go)
                    WITH DISTINCT go
                    RETURN count(go) AS go_count
                    """,
                    taxId=organism_id,
                )
            )
        )

        # raise if empty - should never happen so fail fast
        if not r:
            raise Exception(
                f"Could not find related GO terms for organism id: {organism_id}"
            )
        return r[0]["go_count"]

    def get_go_term_count(self, organism):
        return redis_cached(
            f"go_term_count_{organism}", lambda: self.query_go_term_count(organism.id)
        )
