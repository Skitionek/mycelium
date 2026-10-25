import importlib

import pytest
from sqlalchemy.engine import make_url

import config
from neo4japp.services import rcache

# Characters that mean something in a URL; Azure's access keys contain some
PASSWORD = 'p@ss/w#r?d%41+='


@pytest.fixture
def reload_with_env(monkeypatch):
    """Reloads a module that reads the environment on import, as it is again after."""
    reloaded = []

    def reload(module, **env):
        for name, value in env.items():
            monkeypatch.setenv(name, value)
        reloaded.append(module)
        return importlib.reload(module)

    yield reload

    monkeypatch.undo()
    for module in reloaded:
        importlib.reload(module)


def test_postgres_url_keeps_the_password(reload_with_env):
    reloaded = reload_with_env(config, POSTGRES_PASSWORD=PASSWORD, POSTGRES_HOST='db.example')

    url = make_url(reloaded.Config.SQLALCHEMY_DATABASE_URI)

    assert (url.host, url.password) == ('db.example', PASSWORD)


def test_redis_connection_keeps_the_password(reload_with_env):
    reloaded = reload_with_env(rcache, REDIS_PASSWORD=PASSWORD, REDIS_HOST='cache.example')

    settings = reloaded.redis_server.connection_pool.connection_kwargs

    assert (settings['host'], settings['password']) == ('cache.example', PASSWORD)

