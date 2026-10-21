""" Redis Cache """
import os
import redis

REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = os.environ.get('REDIS_PORT', '6379')
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', '')
REDIS_SSL = os.environ.get('REDIS_SSL', 'false').lower()


connection_prefix = 'rediss' if REDIS_SSL == 'true' else 'redis'
connection_url = f'{connection_prefix}://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/0'

redis_server = redis.Redis(
    connection_pool=redis.BlockingConnectionPool.from_url(connection_url))

