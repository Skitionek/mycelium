import json
import logging
import os
import time
from collections import defaultdict

import redis
from neo4j import GraphDatabase, basic_auth

LOG_LEVEL = os.getenv('LOG_LEVEL', 'WARNING')

NEO4J_HOST = os.getenv('NEO4J_HOST', 'localhost')
NEO4J_PORT = os.getenv('NEO4J_PORT', '7687')
NEO4J_AUTH = os.getenv('NEO4J_AUTH', 'neo4j/password')
NEO4J_SCHEME = os.getenv('NEO4J_SCHEME', 'bolt')
NEO4J_DATABASE = os.getenv('NEO4J_DATABASE', 'neo4j')

MOZG_URL = os.getenv('MOZG_URL', '')

REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = os.getenv('REDIS_PORT', '6379')
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')
REDIS_DB = os.getenv('REDIS_DB', '0')
REDIS_SSL = os.getenv('REDIS_SSL', '').lower()

CACHE_TTL = int(os.getenv('CACHE_TTL', '3600'))  # expire cached data
SUCCESSFUL_SLEEP_TIME = CACHE_TTL / 6  # refresh cached data this often
ERROR_INITIAL_SLEEP_TIME = 60  # if error occurs, try again sooner
ERROR_SLEEP_TIME_MULTIPLIER = 2  # on subsequent errors, sleep longer
ERROR_MAX_SLEEP_TIME = 3600 * 6  # but not longer than this


logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger('cache-invalidator')

# Redis connection
redis_schema = 'rediss' if REDIS_SSL in ['true', '1'] else 'redis'
redis_url = f'{redis_schema}://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}'
redis_server = redis.Redis(
    connection_pool=redis.BlockingConnectionPool.from_url(redis_url)
)

# Neo4j connection (used when MOZG_URL is not set)
neo4j_url = f'{NEO4J_SCHEME}://{NEO4J_HOST}:{NEO4J_PORT}/{NEO4J_DATABASE}'
neo4j_auth = basic_auth(*NEO4J_AUTH.split('/', 1))
neo4j_driver = GraphDatabase.driver(neo4j_url, auth=neo4j_auth)


def main():
    logger.info('Starting cache-invalitation loop...')
    next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
    while True:
        try:
            if not MOZG_URL:
                # KG statistics come from Neo4j; skip when Mozg is the knowledge-graph layer
                cache_data('kg_statistics', get_kg_statistics())
            next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
            logger.debug(f'Going to sleep for {SUCCESSFUL_SLEEP_TIME} seconds...')
        except Exception as err:
            logger.error(
                f'Error occured, will try again in {next_error_sleep_time} seconds: {err}'
            )
            time.sleep(next_error_sleep_time)
            next_error_sleep_time = min(
                ERROR_MAX_SLEEP_TIME,
                next_error_sleep_time * ERROR_SLEEP_TIME_MULTIPLIER,
            )
        finally:
            try:
                if MOZG_URL:
                    precalculateGO_mozg()
                else:
                    precalculateGO()
                next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
                logger.info(f'Going to sleep for {SUCCESSFUL_SLEEP_TIME} seconds...')
            except Exception as err:
                logger.error(
                    f'Error occured, will try again in {next_error_sleep_time} seconds: {err}'
                )
                time.sleep(next_error_sleep_time)
                next_error_sleep_time = min(
                    ERROR_MAX_SLEEP_TIME,
                    next_error_sleep_time * ERROR_SLEEP_TIME_MULTIPLIER,
                )
            else:
                time.sleep(SUCCESSFUL_SLEEP_TIME)


def get_kg_statistics():
    logger.info('Getting Kg Statistics')
    graph = neo4j_driver.session()

    logger.debug('Kg Statistics Query start...')
    results = graph.read_transaction(lambda tx: tx.run('CALL db.labels()').data())
    logger.debug('Kg Statistics Query finished')

    domain_labels = []
    entity_labels = []
    for row in results:
        label = row['label']
        if label.startswith('db_'):
            domain_labels.append(label)
        elif label != 'Synonym':
            entity_labels.append(label)

    statistics = defaultdict(lambda: defaultdict())
    for domain in domain_labels:
        for entity in entity_labels:
            query = f'MATCH (:`{domain}`:`{entity}`) RETURN count(*) AS count'
            logger.debug(f'Neo4j query: {query}')
            result = graph.read_transaction(lambda tx: tx.run(query).data())
            count = result[0]['count']
            if count != 0:
                statistics[domain.replace('db_', '', 1)][entity] = count
    graph.close()
    return statistics


def precalculateGO():
    """Pre-compute GO term data from Neo4j and cache in Redis."""
    logger.debug('Precalculating GO from Neo4j...')
    graph = neo4j_driver.session()

    def fetch_organism_go_query(tx, organism):
        logger.debug(f'Precomputing GO for {organism["name"]} ({organism["id"]})')
        return tx.run(
            '''
            MATCH (g:Gene)-[:GO_LINK {tax_id:$id}]-(go:db_GO)
            WITH go, collect(distinct g) AS genes
            RETURN
                go.eid AS goId,
                go.name AS goTerm,
                [lbl IN labels(go) WHERE lbl <> 'db_GO'] AS goLabel,
                [g IN genes |g.name] AS geneNames
            ''',
            id=organism['id'],
        ).data()

    organisms = graph.read_transaction(
        lambda tx: tx.run(
            '''
            MATCH (t:Taxonomy)-[:HAS_TAXONOMY]-(:Gene)-[:GO_LINK]-(go:db_GO)
            WITH t, count(go) AS c
            WHERE c > 0
            RETURN
                t.eid AS id,
                t.name AS name
            '''
        ).data()
    )

    for organism in organisms:
        logger.debug(f'Caching data for organism: {organism}')
        cache_data(
            f'GO_for_{organism["id"]}',
            graph.read_transaction(fetch_organism_go_query, organism),
        )
    graph.close()


def precalculateGO_mozg():
    """Pre-compute GO term data via Mozg (EBI QuickGO) and cache in Redis.

    Replaces :func:`precalculateGO` when ``MOZG_URL`` is set.  Fetches a
    list of model organisms from NCBI via Mozg, then retrieves their GO
    annotations from EBI QuickGO and caches the results for the statistical-
    enrichment service.
    """
    import requests

    logger.debug('Precalculating GO via Mozg...')

    _QUERY_GQL = """
    query MozgQuery($input: QueryInput!) {
        query(input: $input) { data count }
    }
    """

    def mozg_query(connection, from_entity, where=None, limit=None):
        input_obj = {"connection": connection, "from": from_entity}
        if where:
            input_obj["where"] = where
        if limit:
            input_obj["limit"] = limit
        r = requests.post(
            MOZG_URL,
            json={"query": _QUERY_GQL, "variables": {"input": input_obj}},
            timeout=30,
        )
        r.raise_for_status()
        body = r.json()
        if "errors" in body:
            raise RuntimeError(f"Mozg error: {body['errors']}")
        data = body.get("data", {}).get("query", {}).get("data", [])
        return data if isinstance(data, list) else ([data] if data else [])

    # Fetch well-studied model organisms from NCBI taxonomy
    ncbi_connection = {
        "driver": "rest",
        "database": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    }
    go_connection = {
        "driver": "rest",
        "database": "https://www.ebi.ac.uk/QuickGO/services",
    }

    # Use a fixed list of common model organism NCBI taxon IDs
    model_organisms = [
        {"id": "9606", "name": "Homo sapiens"},
        {"id": "10090", "name": "Mus musculus"},
        {"id": "10116", "name": "Rattus norvegicus"},
        {"id": "6239", "name": "Caenorhabditis elegans"},
        {"id": "7227", "name": "Drosophila melanogaster"},
        {"id": "559292", "name": "Saccharomyces cerevisiae"},
        {"id": "83333", "name": "Escherichia coli K-12"},
    ]

    for organism in model_organisms:
        try:
            logger.debug(f'Precomputing GO via Mozg for {organism["name"]} ({organism["id"]})')
            rows = mozg_query(
                connection=go_connection,
                from_entity="annotation",
                where={
                    "taxonId": organism["id"],
                    "geneProductType": "protein",
                    "fields": "goId,goName,symbol",
                    "aspect": "biological_process,molecular_function,cellular_component",
                },
                limit=25000,
            )

            # Aggregate per GO term
            go_map: dict = {}
            raw_results = rows[0].get("results", []) if (rows and isinstance(rows[0], dict)) else []
            for entry in raw_results:
                go_id = entry.get("goId", "")
                go_name = entry.get("goName", go_id)
                symbol = entry.get("symbol", "")
                if go_id not in go_map:
                    go_map[go_id] = {
                        "goId": go_id,
                        "goTerm": go_name,
                        "goLabel": [],
                        "geneNames": [],
                    }
                if symbol and symbol not in go_map[go_id]["geneNames"]:
                    go_map[go_id]["geneNames"].append(symbol)

            if go_map:
                cache_data(f'GO_for_{organism["id"]}', list(go_map.values()))
        except Exception as err:
            logger.warning(f'Could not precompute GO for {organism["name"]}: {err}')


def cache_data(key, value):
    try:
        redis_server.set(key, json.dumps(value))
        redis_server.expire(key, CACHE_TTL)
    finally:
        redis_server.connection_pool.disconnect()


if __name__ == '__main__':
    main()
