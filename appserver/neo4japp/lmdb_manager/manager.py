import logging
import hashlib
import json
import os
import sqlalchemy

from dataclasses import dataclass
from datetime import datetime
from libcloud.storage.providers import get_driver
from libcloud.storage.types import Provider, ObjectDoesNotExistError
from typing import List, Dict, Optional
from neo4japp.exceptions import RecordNotFound
from sqlalchemy import Column, String
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base, DeclarativeMeta


logging.basicConfig()
log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)


class BaseCloudStorageProvider:
    """ Used to provide methods for interacting with cloud
    storages. (e.g. Azure, GCP, AWS) """

    def upload(self, container_name: str, object_name: str, source_path: str):
        """Uploads from local destination to remote object store.

        :param container_name: top-level storage container (bucket/share).
        :type container_name: str
        :param object_name: path of the object within the container.
        :type object_name: str
        :param source_path: path string where local files are located.
        :type source_path: str
        :raises NotImplementedError:
        """
        raise NotImplementedError()

    def download(self, container_name: str, object_name: str, dest_path: str):
        """Downloads a remote object to a local destination. Directories
        will be created if they do not exist in the local path.

        :param container_name: top-level storage container (bucket/share).
        :type container_name: str
        :param object_name: path of the object within the container.
        :type object_name: str
        :param dest_path: path string to save the file on local.
        :type dest_path: str
        :raises NotImplementedError:
        """
        raise NotImplementedError()

    def get_file_date(self, container_name: str, object_name: str) -> str:
        """ Returns the last-modified date of a remote object. """
        raise NotImplementedError()

    def get_remote_hash(self, container_name: str, object_name: str) -> str:
        """ Returns the file hash of the remote object. """
        raise NotImplementedError()

    def get_hash(self, local_path: str, hashlib_fn) -> str:
        """Gets a file hash using the specified algorithm and encoding.

        :param local_path: path to the local file.
        :type local_path: str
        :param hashlib_fn: the callback used to determine the file's checksum.
        :type hashlib_fn: bool
        :return: the hashed value
        :rtype: str
        """
        log.debug(f'Generating checksum for {local_path}...')

        hash_ = hashlib_fn()
        with open(local_path, 'rb') as fi:
            for chunk in iter(lambda: fi.read(8192), b''):
                hash_.update(chunk)
        return hash_.hexdigest()


class LibcloudStorageProvider(BaseCloudStorageProvider):
    """ Cloud storage provider backed by the apache-libcloud Object Storage API.
    Supports any libcloud-compatible backend (Azure Blobs, GCS, S3, etc.). """

    def __init__(self, driver):
        self.driver = driver
        super().__init__()

    def get_remote_hash(self, container_name: str, object_name: str) -> str:
        try:
            obj = self.driver.get_object(container_name, object_name)
        except ObjectDoesNotExistError:
            raise RecordNotFound('Missing Resource', 'File not found.')
        return obj.hash

    def upload(self, container_name: str, object_name: str, source_path: str):
        local_src_hash = self.get_hash(source_path, hashlib.md5)
        container = self.driver.get_container(container_name)
        self.driver.upload_object(
            source_path,
            container,
            object_name,
            extra={'content_md5': local_src_hash},
        )
        log.debug(f'Uploaded "{source_path}" to "{container_name}/{object_name}"')

    def download(self, container_name: str, object_name: str, dest_path: str):
        existing_checksum = None
        # Calculate file checksum if it exists
        if os.path.exists(dest_path):
            existing_checksum = self.get_hash(dest_path, hashlib.md5)
        else:
            base_dir = os.path.dirname(dest_path)
            # Checks to see if there's an existing directory
            if not os.path.exists(base_dir) and base_dir != '':
                os.makedirs(base_dir)
        remote_md5 = self.get_remote_hash(container_name, object_name)
        if remote_md5 != existing_checksum:
            obj = self.driver.get_object(container_name, object_name)
            self.driver.download_object(obj, dest_path, overwrite_existing=True)
            log.debug(f'Saving file "{object_name}" to "{dest_path}"')

    def get_file_date(self, container_name: str, object_name: str):
        obj = self.driver.get_object(container_name, object_name)
        return obj.extra.get('last_modified')


class AzureStorageProvider(LibcloudStorageProvider):
    """ LibcloudStorageProvider pre-configured for Azure Blob Storage. """

    def __init__(self):
        account_name = os.environ.get('AZURE_ACCOUNT_STORAGE_NAME')
        account_key = os.environ.get('AZURE_ACCOUNT_STORAGE_KEY')
        cls = get_driver(Provider.AZURE_BLOBS)
        driver = cls(key=account_name, secret=account_key)
        super().__init__(driver)


@dataclass
class LMDBFile:
    """ Represents a LMDB file on a cloud storage """
    category: str
    version: str
    data_mdb_path: str


Base: DeclarativeMeta = declarative_base()


class LMDB(Base):
    __tablename__ = 'lmdb'
    name = Column(String, primary_key=True)
    checksum_md5 = Column(String, nullable=False)
    modified_date = Column(TIMESTAMP(timezone=True), nullable=False)

    def __repr__(self):
        return f'<LMDBsDates(name={self.name}:updated={self.modified_date})>'


class LMDBManager:
    """ LMDB manager is used to help manage the LMDB versions/lifecycle amongst other
    (1) Allows us to download from cloud to local
    (2) Allows us to update our RDBMS database with the correct upload timestamp
    (3) Allows us to change the LMDB file versions for different app versions

    Attributes:
        cloud_provider (obj): A cloud provider handler
        storage_object_name (str): represents what cloud providers call
            the top level directory (e.g. all files will reside in a particular bucket).
        config (dict): contains the list of lmdb categories and their version
            key: categories, value: version
            e.g. {'anatomy': 'v1', 'chemicals': 'v2'}
    """

    def __init__(
            self,
            cloud_provider: BaseCloudStorageProvider,
            storage_object_name: str,
            config: Optional[Dict] = None):
        self.cloud_provider = cloud_provider
        self.storage_object = storage_object_name
        self.db = self.init_db_connection()

        if config is not None:
            self.lmdb_versions = config
        else:
            base_path = os.path.dirname(os.path.realpath(__file__))
            default_config = os.path.join(base_path, 'lmdb_config.json')
            with open(default_config, 'r') as fi:
                config_fi = json.load(fi)
                self.lmdb_versions = config_fi

    def init_db_connection(self):
        POSTGRES_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
        POSTGRES_PORT = os.environ.get('POSTGRES_PORT', '5432')
        POSTGRES_USER = os.environ.get('POSTGRES_USER', 'postgres')
        POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'postgres')
        POSTGRES_DB = os.environ.get('POSTGRES_DB', 'postgres')
        engine = sqlalchemy.create_engine(
            sqlalchemy.engine.url.URL(
                        drivername='postgres+psycopg2',
                        username=POSTGRES_USER,
                        password=POSTGRES_PASSWORD,
                        host=POSTGRES_HOST,
                        port=POSTGRES_PORT,
                        database=POSTGRES_DB,
                    )
        )
        Session = sessionmaker(bind=engine)
        session = Session()
        return session

    def path_generator(self, category, version, filename) -> str:
        return f'{version}/{category}/{filename}'

    def generate_path(self, lmdb_category: str, path_fn=None) -> LMDBFile:
        """ Generates a representation of a LMDB file within a cloud storage """
        if path_fn is None:
            path_fn = self.path_generator
        version = self.lmdb_versions[lmdb_category]
        return LMDBFile(
            lmdb_category,
            version,
            path_fn(lmdb_category, version, 'data.mdb'))

    def generate_paths(self) -> List[LMDBFile]:
        """ Generates paths for all categories from the config """
        return [self.generate_path(category) for category in self.lmdb_versions.keys()]

    def upload_all(self, source_dir):
        paths = self.generate_paths()
        for lmdb_file in paths:
            upload_file = True
            data_mdb_path = os.path.join(source_dir, lmdb_file.category, 'data.mdb')
            data_mdb_md5 = self.cloud_provider.get_hash(data_mdb_path, hashlib.md5)
            try:
                remote_data_mdb_md5 = self.cloud_provider.get_remote_hash(
                    'lmdb', lmdb_file.data_mdb_path)
            except RecordNotFound:
                log.debug(
                    f'No hash found. Uploading new file to {lmdb_file.data_mdb_path}')
            else:
                if data_mdb_md5 == remote_data_mdb_md5:
                    upload_file = False
            finally:
                if upload_file:
                    log.debug(f'Uploading {lmdb_file.category}...')
                    src_data_mdb = os.path.join(source_dir, lmdb_file.category, 'data.mdb')
                    self.cloud_provider.upload(
                        self.storage_object, lmdb_file.data_mdb_path, src_data_mdb)
                else:
                    log.debug(f'{lmdb_file.category} already up to date. Skipping upload...')

    def download_all(self, save_dir):
        paths = self.generate_paths()
        for lmdb_file in paths:
            self.cloud_provider.download(
                self.storage_object,
                lmdb_file.data_mdb_path,
                f'{save_dir}/{lmdb_file.category}/data.mdb'
            )

    def download(self, remote_path, save_path):
        """ Downloads lmdb files from a remote path to a specified local path """
        self.cloud_provider.download(self.storage_object, remote_path, save_path)

    def update_all_dates(self, file_dir):
        for category in self.lmdb_versions.keys():
            self.update_date(category, file_dir)

    def update_date(self, lmdb_category, file_dir):
        """ Updates RDBMS database to contain the file upload date from the cloud storage """
        lmdb_metadata = self.generate_path(lmdb_category)
        data_mdb_path = lmdb_metadata.data_mdb_path

        with open(f'{file_dir}/{lmdb_category}/data.mdb', 'rb') as mdb_file:
            hash_fn = hashlib.md5()
            while chunk := mdb_file.read(8192):
                hash_fn.update(chunk)
            checksum = hash_fn.hexdigest()

        lmdb_db = self.db.query(LMDB) \
                         .filter_by(name=lmdb_category) \
                         .one_or_none()
        if lmdb_db is None:
            lmdb_db = LMDB(
                name=lmdb_category,
                modified_date=datetime.utcnow(),
                checksum_md5=checksum
            )
            self.db.add(lmdb_db)
            self.db.commit()

        cloud_file_date = self.cloud_provider.get_file_date(self.storage_object, data_mdb_path)

        if lmdb_db.modified_date != cloud_file_date:
            # if date is different, then most likely hash is also different
            # don't need to check hash because we're using
            # files that were just downloaded
            self.db.query(LMDB) \
                   .filter_by(name=lmdb_category) \
                   .update({LMDB.modified_date: cloud_file_date, LMDB.checksum_md5: checksum})
            self.db.commit()
            log.debug(f'LMDB Database {lmdb_category} timestamp has been updated.')
        else:
            log.debug(f'LMDB Database {lmdb_category} is already up to date.')
