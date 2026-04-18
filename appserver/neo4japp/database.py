import hashlib
import os

from flask import current_app, g
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from neo4j import GraphDatabase, basic_auth
from sqlalchemy import MetaData, Table, UniqueConstraint
from sqlalchemy import __version__ as sqlalchemy_version

from neo4japp.utils.flask import scope_flask_app_ctx

# Compatibility patch: flask-marshmallow 1.x expects app.extensions["sqlalchemy"].session
# but flask-sqlalchemy 2.x stores a _SQLAlchemyState(connectors, db) instead of the
# SQLAlchemy instance itself. Add a session property so init_app works correctly.
try:
    from flask_sqlalchemy import _SQLAlchemyState as _FsqlaState
    if not hasattr(_FsqlaState, 'session'):
        _FsqlaState.session = property(lambda self: self.db.session)
except (ImportError, AttributeError):
    pass


def trunc_long_constraint_name(name: str) -> str:
    if (len(name) > 59):
        truncated_name = name[:55] + '_' + \
                         hashlib.md5(name[55:].encode('utf-8')).hexdigest()[:4]
        return truncated_name
    return name


def uq_trunc(unique_constraint: UniqueConstraint, table: Table):
    tokens = [table.name] + [
        column.name
        for column in unique_constraint.columns
    ]
    return trunc_long_constraint_name('_'.join(tokens))


convention = {
    'uq_trunc': uq_trunc,
    'ix': 'ix_%(column_0_label)s',
    'uq': "uq_%(uq_trunc)s",
    'ck': "ck_%(table_name)s_%(constraint_name)s",
    'fk': "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",  # noqa
    'pk': "pk_%(table_name)s"
}

ma = Marshmallow()
migrate = Migrate(compare_type=True)
metadata = MetaData(naming_convention=convention)

# SQLAlchemy 2.x accepts "values_plus_batch" while 1.x expects "values_only".
sqlalchemy_major = int(sqlalchemy_version.split('.', 1)[0])
executemany_mode = 'values_plus_batch' if sqlalchemy_major >= 2 else 'values_only'

db = SQLAlchemy(
    metadata=metadata,
    engine_options={
        'executemany_mode': executemany_mode,
        'insertmanyvalues_page_size': 10000
    }
)

host = os.getenv('NEO4J_HOST', 'localhost')
scheme = os.getenv('NEO4J_SCHEME', 'bolt')
port = os.getenv('NEO4J_PORT', '7687')
url = f'{scheme}://{host}:{port}'
username, password = os.getenv('NEO4J_AUTH', 'neo4j/password').split('/')
graph = GraphDatabase.driver(url, auth=basic_auth(username, password))


# TODO: with the DatabaseConnection class
# these functions that save to `g` are no longer needed
# remove them when possible
def get_neo4j_db():
    if not hasattr(g, 'neo4j_db'):
        g.neo4j_db = graph.session()
    return g.neo4j_db


def close_neo4j_db(e=None):
    neo4j_db = g.pop('neo4j_db', None)
    if neo4j_db:
        neo4j_db.close()


class DBConnection:
    def __init__(self):
        super().__init__()
        self.session = db.session


class GraphConnection:
    def __init__(self):
        super().__init__()
        self.graph = get_neo4j_db()


class SearchIndexConnection:
    def __init__(self):
        super().__init__()
        self.search_index_client = {
            'base_url': current_app.config['SOLR_URL'].rstrip('/'),
            'request_timeout': 180,
        }


"""
TODO: Update all of these functions to use
DBConnection or GraphConnection above.

Separation of concerns/Single responsibility.

Better to selectively inherit the connection needed,
through different services. Separating graph service
from the postgres service.

It also helps avoid circular dependencies if these
get_*() functions are moved elsewhere. This problem does
not apply to the AnnotationServices (except manual and sorted).
"""


def get_kg_service():
    if 'kg_service' not in g:
        from neo4japp.services import KgService
        graph = get_neo4j_db()
        g.kg_service = KgService(
            graph=graph,
            session=db.session,
        )
    return g.kg_service


def get_visualizer_service():
    if 'visualizer_service' not in g:
        from neo4japp.services import VisualizerService
        graph = get_neo4j_db()
        g.visualizer_service = VisualizerService(
            graph=graph,
            session=db.session,
        )
    return g.visualizer_service


@scope_flask_app_ctx('file_type_service')
def get_file_type_service():
    """
    Return a service to figure out how to handle a certain type of file in our
    filesystem. When we add new file types to the system, we need to register
    its associated provider here.

    :return: the service
    """
    from neo4japp.services.file_types.service import FileTypeService, GenericFileTypeProvider
    from neo4japp.services.file_types.providers import EnrichmentTableTypeProvider, \
        PDFTypeProvider, BiocTypeProvider, \
        DirectoryTypeProvider, MapTypeProvider, GraphTypeProvider, AnnotationsFileTypeProvider
    service = FileTypeService()
    service.register(GenericFileTypeProvider())
    service.register(DirectoryTypeProvider())
    service.register(PDFTypeProvider())
    service.register(BiocTypeProvider())
    service.register(MapTypeProvider())
    service.register(EnrichmentTableTypeProvider())
    service.register(GraphTypeProvider())
    service.register(AnnotationsFileTypeProvider())
    return service


def get_enrichment_table_service():
    if 'enrichment_table_service' not in g:
        from neo4japp.services import EnrichmentTableService
        graph = get_neo4j_db()
        g.enrichment_table_service = EnrichmentTableService(
            graph=graph,
            session=db.session,
        )
    return g.enrichment_table_service


def get_search_service_dao():
    if 'search_dao' not in g:
        from neo4japp.services import SearchService
        graph = get_neo4j_db()
        g.search_service_dao = SearchService(graph=graph)
    return g.search_service_dao


def get_authorization_service():
    if 'authorization_service' not in g:
        from neo4japp.services import AuthService
        g.authorization_service = AuthService(session=db.session)
    return g.authorization_service


def get_account_service():
    if 'account_service' not in g:
        from neo4japp.services import AccountService
        g.account_service = AccountService(session=db.session)
    return g.account_service


def get_projects_service():
    if 'projects_service' not in g:
        from neo4japp.services import ProjectsService
        g.projects_service = ProjectsService(session=db.session)
    return g.projects_service


def get_search_index_service():
    if 'search_index_service' not in g:
        from neo4japp.services.elastic import SearchIndexService
        g.search_index_service = SearchIndexService()
    return g.search_index_service


def get_excel_export_service():
    from neo4japp.services.export import ExcelExportService
    return ExcelExportService()


@scope_flask_app_ctx('file_storage_service')
def get_file_storage_service():
    """Return a :class:`~neo4japp.services.file_storage.FileStorageService`
    backed by the configured libcloud storage driver.

    The driver is controlled by the ``FILE_STORAGE_PROVIDER`` app-config key:

    * ``"POSTGRESQL"`` (default) — uses
      :class:`~neo4japp.services.storage_drivers.postgresql.PostgreSQLStorageDriver`,
      which stores file bytes in the ``files_content.raw_file`` PostgreSQL
      column via SQLAlchemy.  No external storage service is required.
    * Any other value is treated as a libcloud ``Provider`` attribute name
      (e.g. ``"AZURE_BLOBS"``, ``"S3"``, ``"GOOGLE_STORAGE"``), and the
      matching libcloud driver is instantiated using ``FILE_STORAGE_KEY`` /
      ``FILE_STORAGE_SECRET``.

    The service is memoised to the current Flask app/request context so
    the driver is not re-initialised on every call.
    """
    from neo4japp.services.file_storage import FileStorageService

    config = current_app.config
    provider_name = config.get('FILE_STORAGE_PROVIDER', 'POSTGRESQL')
    container_name = config.get('FILE_STORAGE_CONTAINER', 'files_content')

    if provider_name == 'POSTGRESQL':
        from neo4japp.services.storage_drivers.postgresql import PostgreSQLStorageDriver
        driver = PostgreSQLStorageDriver()
    else:
        import os
        from libcloud.storage.providers import get_driver
        from libcloud.storage.types import Provider

        try:
            provider = getattr(Provider, provider_name)
        except AttributeError:
            raise ValueError(f"Unknown libcloud storage provider: {provider_name!r}")

        driver_cls = get_driver(provider)
        key = config.get('FILE_STORAGE_KEY', '')
        secret = config.get('FILE_STORAGE_SECRET', '')

        if provider_name == 'LOCAL':
            os.makedirs(key, exist_ok=True)
            driver = driver_cls(key)
        else:
            driver = driver_cls(key=key, secret=secret)

    return FileStorageService(driver, container_name)


def reset_dao():
    """ Cleans up DAO bound to flask request context

    Used in functional test fixture, but may come in
    handy for production later.
    """
    for dao in [
        'kg_service',
        'user_file_import_service',
        'search_dao',
        'authorization_service',
        'account_service',
        'projects_service',
        'visualizer_service',
        'neo4j',
    ]:
        if dao in g:
            g.pop(dao)
