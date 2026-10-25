import importlib
import json
import sys
from collections import defaultdict
from unittest.mock import MagicMock, patch

import neo4j
import pytest


@pytest.fixture
def main_module():
    """
    Import main.py with Redis and Neo4j connections fully mocked.

    Because main.py establishes connections at module level, we must patch
    the underlying connection constructors *before* the module is imported.
    This fixture handles module-level teardown so each test gets a clean state.
    """
    mock_redis = MagicMock()
    mock_redis.get.return_value = None

    mock_neo4j_driver = MagicMock()

    with (
        patch("redis.BlockingConnectionPool.from_url", return_value=MagicMock()),
        patch("redis.Redis", return_value=mock_redis),
        patch("neo4j.GraphDatabase.driver", return_value=mock_neo4j_driver),
        patch("neo4j.basic_auth", return_value=("neo4j", "password")),
    ):
        # Remove any previously cached version of the module so that the
        # patched constructors are used during import.
        sys.modules.pop("main", None)
        module = importlib.import_module("main")

        # Replace module-level singletons with our mock instances so that
        # functions referencing them at call time use the mocks too.
        module.redis_server = mock_redis
        module.neo4j_driver = mock_neo4j_driver

        yield module, mock_redis, mock_neo4j_driver

    sys.modules.pop("main", None)


@pytest.fixture
def neo4j_session(main_module):
    """
    A session mock bound to the installed driver's Session API.

    The `spec` matters: a bare MagicMock answers to any attribute, so these
    tests kept passing after the driver dropped `read_transaction` while
    main.py still called it — the service was broken in production and green
    in CI. Binding the mock to the real class makes that failure show up here.
    """
    _, _, mock_neo4j_driver = main_module

    session = MagicMock(spec=neo4j.Session)
    mock_neo4j_driver.session.return_value = session

    return session


# ---------------------------------------------------------------------------
# cache_data
# ---------------------------------------------------------------------------

def test_cache_data_sets_key(main_module):
    """cache_data should call redis SET with the JSON-serialised value."""
    module, mock_redis, _ = main_module

    module.cache_data("test_key", {"count": 42})

    args, _ = mock_redis.set.call_args
    assert args[0] == "test_key"
    assert json.loads(args[1]) == {"count": 42}


def test_cache_data_sets_expiry(main_module):
    """cache_data should call redis EXPIRE with the configured TTL."""
    module, mock_redis, _ = main_module

    module.cache_data("test_key", {"count": 42})

    mock_redis.expire.assert_called_once_with("test_key", module.CACHE_TTL)


def test_cache_data_disconnects_pool(main_module):
    """cache_data should disconnect the connection pool in the finally block."""
    module, mock_redis, _ = main_module

    module.cache_data("test_key", {})

    mock_redis.connection_pool.disconnect.assert_called_once()


# ---------------------------------------------------------------------------
# get_kg_statistics – label filtering logic
# ---------------------------------------------------------------------------

def test_get_kg_statistics_separates_domain_and_entity_labels(
    main_module, neo4j_session
):
    """
    Labels prefixed with 'db_' must be treated as domain labels; all other
    labels (except 'Synonym') must be treated as entity labels.
    """
    module, _, _ = main_module

    # Simulate db.labels() returning a mix of domain, entity and Synonym labels.
    label_rows = [
        {"label": "db_Human"},
        {"label": "db_Mouse"},
        {"label": "Gene"},
        {"label": "Disease"},
        {"label": "Synonym"},  # should be excluded from entity labels
    ]

    # First execute_read → db.labels(); subsequent ones → entity counts
    count_result = [{"count": 0}]
    neo4j_session.execute_read.side_effect = [
        label_rows,
        *([count_result] * 4),  # 2 domains × 2 entities = 4 count queries
    ]

    module.get_kg_statistics()

    # execute_read is called once for db.labels() + once per domain/entity pair
    assert neo4j_session.execute_read.call_count == 1 + 2 * 2


def test_get_kg_statistics_excludes_synonym_label(main_module, neo4j_session):
    """'Synonym' should never appear as an entity label in the statistics."""
    module, _, _ = main_module

    label_rows = [
        {"label": "db_Human"},
        {"label": "Gene"},
        {"label": "Synonym"},
    ]

    # db.labels() + 1 domain × 1 entity = 2 execute_read calls
    neo4j_session.execute_read.side_effect = [
        label_rows,
        [{"count": 5}],
    ]

    result = module.get_kg_statistics()

    statistics = defaultdict(dict, result)
    for domain_stats in statistics.values():
        assert "Synonym" not in domain_stats


def test_get_kg_statistics_omits_zero_counts(main_module, neo4j_session):
    """Entities with a count of zero should not appear in the statistics."""
    module, _, _ = main_module

    label_rows = [
        {"label": "db_Human"},
        {"label": "Gene"},
        {"label": "Disease"},
    ]

    neo4j_session.execute_read.side_effect = [
        label_rows,
        [{"count": 10}],   # Human/Gene → should be included
        [{"count": 0}],    # Human/Disease → should be excluded
    ]

    result = module.get_kg_statistics()

    assert result["Human"]["Gene"] == 10
    assert "Disease" not in result.get("Human", {})


# ---------------------------------------------------------------------------
# session lifetime
# ---------------------------------------------------------------------------

def test_get_kg_statistics_closes_the_session_when_a_query_fails(
    main_module, neo4j_session
):
    """A failed run must not leak its session; the loop retries forever."""
    module, _, _ = main_module
    neo4j_session.execute_read.side_effect = RuntimeError("database unavailable")

    with pytest.raises(RuntimeError):
        module.get_kg_statistics()

    neo4j_session.close.assert_called_once()


def test_precalculate_go_closes_the_session_when_a_query_fails(
    main_module, neo4j_session
):
    module, _, _ = main_module
    neo4j_session.execute_read.side_effect = RuntimeError("database unavailable")

    with pytest.raises(RuntimeError):
        module.precalculateGO()

    neo4j_session.close.assert_called_once()


def test_precalculate_go_caches_each_organism(main_module, neo4j_session):
    module, mock_redis, _ = main_module
    terms = [{"goId": "GO:1", "goTerm": "t", "goLabel": [], "geneNames": ["A"]}]
    neo4j_session.execute_read.side_effect = [
        [{"id": "9606", "name": "Homo sapiens"}, {"id": "10090", "name": "Mus musculus"}],
        terms,
        terms,
    ]

    module.precalculateGO()

    cached = {call.args[0]: json.loads(call.args[1]) for call in mock_redis.set.call_args_list}
    assert cached == {"GO_for_9606": terms, "GO_for_10090": terms}


# ---------------------------------------------------------------------------
# main loop scheduling
# ---------------------------------------------------------------------------

class StopLoop(Exception):
    pass


def run_main(module, iterations):
    """Run ``main`` until it has slept ``iterations`` times; return the sleeps."""
    sleeps = []

    def sleep(seconds):
        sleeps.append(seconds)
        if len(sleeps) >= iterations:
            raise StopLoop

    with patch.object(module.time, "sleep", side_effect=sleep):
        with pytest.raises(StopLoop):
            module.main()
    return sleeps


def test_main_backs_off_while_statistics_keep_failing(main_module):
    """Each consecutive failure doubles the wait before the next attempt."""
    module, _, _ = main_module
    module.MOZG_URL = "http://mozg.test/graphql"

    with patch.object(module, "get_kg_statistics", side_effect=RuntimeError("down")):
        sleeps = run_main(module, 4)

    initial = module.ERROR_INITIAL_SLEEP_TIME
    factor = module.ERROR_SLEEP_TIME_MULTIPLIER
    assert sleeps == [initial, initial * factor, initial * factor ** 2, initial * factor ** 3]


def test_main_backs_off_while_go_precalculation_keeps_failing(main_module):
    module, _, _ = main_module
    module.MOZG_URL = ""

    with (
        patch.object(module, "get_kg_statistics", return_value={}),
        patch.object(module, "cache_data"),
        patch.object(module, "precalculateGO", side_effect=RuntimeError("down")),
    ):
        sleeps = run_main(module, 3)

    initial = module.ERROR_INITIAL_SLEEP_TIME
    factor = module.ERROR_SLEEP_TIME_MULTIPLIER
    assert sleeps == [initial, initial * factor, initial * factor ** 2]


def test_main_backoff_is_capped(main_module):
    module, _, _ = main_module
    module.MOZG_URL = "http://mozg.test/graphql"
    module.ERROR_MAX_SLEEP_TIME = module.ERROR_INITIAL_SLEEP_TIME * 3

    with patch.object(module, "get_kg_statistics", side_effect=RuntimeError("down")):
        sleeps = run_main(module, 4)

    assert max(sleeps) == module.ERROR_MAX_SLEEP_TIME


def test_main_sleeps_once_per_successful_round(main_module):
    module, _, _ = main_module
    module.MOZG_URL = ""

    with (
        patch.object(module, "get_kg_statistics", return_value={}),
        patch.object(module, "cache_data"),
        patch.object(module, "precalculateGO"),
    ):
        sleeps = run_main(module, 2)

    assert sleeps == [module.SUCCESSFUL_SLEEP_TIME] * 2


def test_main_skips_go_precalculation_with_mozg(main_module):
    module, _, _ = main_module
    module.MOZG_URL = "http://mozg.test/graphql"

    with (
        patch.object(module, "get_kg_statistics", return_value={}),
        patch.object(module, "cache_data") as cache_data,
        patch.object(module, "precalculateGO") as precalculate_go,
    ):
        run_main(module, 1)

    precalculate_go.assert_not_called()
    cache_data.assert_called_once_with("kg_statistics", {})


def test_main_resets_backoff_after_a_successful_round(main_module):
    module, _, _ = main_module
    module.MOZG_URL = "http://mozg.test/graphql"

    with (
        patch.object(
            module,
            "get_kg_statistics",
            side_effect=[RuntimeError("down"), RuntimeError("down"), {}, RuntimeError("down")],
        ),
        patch.object(module, "cache_data"),
    ):
        sleeps = run_main(module, 4)

    initial = module.ERROR_INITIAL_SLEEP_TIME
    assert sleeps == [
        initial,
        initial * module.ERROR_SLEEP_TIME_MULTIPLIER,
        module.SUCCESSFUL_SLEEP_TIME,
        initial,
    ]


# ---------------------------------------------------------------------------
# connection settings
# ---------------------------------------------------------------------------


def test_redis_connection_keeps_a_password_with_url_characters(monkeypatch):
    """Azure's access keys contain characters that mean something in a URL."""
    password = "p@ss/w#r?d%41+="
    monkeypatch.setenv("REDIS_PASSWORD", password)
    monkeypatch.setenv("REDIS_HOST", "cache.example")

    with patch("neo4j.GraphDatabase.driver", return_value=MagicMock()):
        sys.modules.pop("main", None)
        module = importlib.import_module("main")
    sys.modules.pop("main", None)

    settings = module.redis_server.connection_pool.connection_kwargs
    assert (settings["host"], settings["password"]) == ("cache.example", password)
