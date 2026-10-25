import importlib

from statistical_enrichment.services import rcache


def test_redis_connection_keeps_a_password_with_url_characters(monkeypatch):
    """Azure's access keys contain characters that mean something in a URL."""
    password = "p@ss/w#r?d%41+="
    monkeypatch.setenv("REDIS_PASSWORD", password)
    monkeypatch.setenv("REDIS_HOST", "cache.example")
    try:
        settings = importlib.reload(rcache).redis_server.connection_pool.connection_kwargs
    finally:
        # rcache reads the environment on import
        monkeypatch.undo()
        importlib.reload(rcache)

    assert (settings["host"], settings["password"]) == ("cache.example", password)
