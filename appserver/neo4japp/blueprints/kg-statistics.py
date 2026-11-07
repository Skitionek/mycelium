from flask import Blueprint
from neo4japp.services.rcache import redis_server
from neo4japp.exceptions import ServerException


bp = Blueprint('kg-statistics-api', __name__, url_prefix='/kg-statistics')


@bp.route('', methods=['GET'])
def get_knowledge_graph_statistics():
    statistics = redis_server.get('kg_statistics')
    if statistics:
        return statistics, 200

    # The key is written by the cache-invalidator service, which recomputes it
    # on a timer. A missing key means that service has not completed a pass
    # yet -- a transient dependency state, not a failure of this request.
    raise ServerException(
        title='Knowledge graph statistics are not ready',
        message=(
            'Statistics are computed in the background and are not available '
            'yet. If this persists, check that the cache-invalidator service '
            'is running and can reach Neo4j and Redis.'
        ),
        code=503)
