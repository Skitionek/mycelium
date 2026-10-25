from unittest.mock import patch

import pytest
from redis.connection import Encoder

from statistical_enrichment import create_app
from statistical_enrichment.services import rcache
from statistical_enrichment.services.enrichment import enrichment_visualisation

GO_TERMS = [
    {
        "goId": "GO:0006915",
        "goTerm": "apoptotic process",
        "goLabel": ["BiologicalProcess"],
        "geneNames": ["BRCA1", "TP53", "EGFR"],
    },
    {
        "goId": "GO:0007049",
        "goTerm": "cell cycle",
        "goLabel": ["BiologicalProcess"],
        "geneNames": ["CDK2", "TP53", "CCND1"],
    },
]


class FakeRedis:
    """Stores values the way Redis does: encoded on write, bytes on read.

    Uses redis-py's own encoder, so a value Redis would refuse (a list, a dict)
    is refused here too, and whatever comes back is bytes, as from a real
    server.
    """

    def __init__(self):
        self.store = {}
        self.encoder = Encoder("utf-8", "strict", False)

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, **kwargs):
        self.store[key] = self.encoder.encode(value)
        return True

    def delete(self, key):
        self.store.pop(key, None)


@pytest.fixture
def fake_redis():
    server = FakeRedis()
    with patch.object(rcache, "redis_server", server), patch.object(
        enrichment_visualisation, "redis_server", server
    ):
        yield server


@pytest.fixture
def client(fake_redis, monkeypatch):
    monkeypatch.setenv("MOZG_URL", "http://mozg.test/graphql")
    app = create_app({"TESTING": True})
    return app.test_client()


@pytest.fixture
def mozg_go():
    with patch.object(enrichment_visualisation, "mozg_go") as mozg_go:
        mozg_go.fetch_go_terms.return_value = GO_TERMS
        mozg_go.fetch_go_term_count.return_value = 100
        yield mozg_go


def enrich(client, **overrides):
    body = {
        "geneNames": ["BRCA1", "TP53"],
        "organism": "9606/Homo sapiens",
        "analysis": "fisher",
        **overrides,
    }
    return client.post("/enrich-with-go-terms", json=body)


def test_healthz(client):
    assert client.get("/healthz").data == b"Ok"


def test_enrich_answers_a_json_array(client, mozg_go):
    """The client maps over the response, so it must be an array of rows."""
    response = enrich(client)

    assert response.status_code == 200
    assert response.mimetype == "application/json"
    rows = response.get_json()
    assert isinstance(rows, list)
    assert {row["goId"] for row in rows} == {"GO:0006915", "GO:0007049"}


def test_enrich_answers_the_same_from_cache(client, mozg_go):
    """A repeated request is served from Redis, which hands back bytes."""
    first = enrich(client)
    second = enrich(client)

    assert second.status_code == 200
    assert second.get_json() == first.get_json()
    assert mozg_go.fetch_go_terms.call_count == 1


def test_enrich_reuses_cached_go_terms_for_a_new_analysis_key(
    client, fake_redis, mozg_go
):
    """GO terms and their count are cached separately from the final result.

    Dropping the result cache makes the next request recompute the statistics
    from the cached terms and count, which come back from Redis as bytes.
    """
    first = enrich(client)
    for key in [key for key in fake_redis.store if key.startswith("enrich_go_")]:
        fake_redis.delete(key)

    second = enrich(client)

    assert second.status_code == 200
    assert second.get_json() == first.get_json()
    assert mozg_go.fetch_go_terms.call_count == 1
    assert mozg_go.fetch_go_term_count.call_count == 1


def test_enrich_reports_q_values(client, mozg_go):
    rows = enrich(client).get_json()

    for row in rows:
        assert 0 <= row["p-value"] <= 1
        assert 0 <= row["q-value"] <= 1


@pytest.mark.parametrize(
    "organism", ["abc", "9606", "/Homo sapiens", "9606/", "human/Homo sapiens"]
)
def test_enrich_rejects_malformed_organism(client, mozg_go, organism):
    response = enrich(client, organism=organism)

    assert response.status_code == 422
    mozg_go.fetch_go_terms.assert_not_called()


def test_enrich_accepts_organism_name_containing_a_slash(client, mozg_go):
    """Strain names such as influenza's carry slashes of their own."""
    response = enrich(client, organism="211044/Influenza A virus (A/Puerto Rico/8/1934(H1N1))")

    assert response.status_code == 200
    organism_id = mozg_go.fetch_go_terms.call_args.args[0]
    assert organism_id == "211044"


def test_enrich_rejects_unknown_analysis(client, mozg_go):
    assert enrich(client, analysis="binomial").status_code == 422


def test_enrich_requires_gene_names(client, mozg_go):
    body = {"organism": "9606/Homo sapiens", "analysis": "fisher"}
    response = client.post("/enrich-with-go-terms", json=body)

    assert response.status_code == 422
