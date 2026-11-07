import pytest
from azure.common import AzureMissingResourceHttpError

from neo4japp.lmdb_manager import AzureStorageProvider


class FakeFileService:
    """Stands in for azure.storage.file.FileService's directory calls."""

    def __init__(self, existing=(), fail_with=None):
        self.directories = set(existing)
        self.fail_with = fail_with
        self.created = []

    def exists(self, storage_name, directory):
        return directory in self.directories

    def create_directory(self, storage_name, directory):
        if self.fail_with is not None:
            raise self.fail_with
        parent = directory.rsplit('/', 1)[0] if '/' in directory else ''
        if parent and parent not in self.directories:
            error = AzureMissingResourceHttpError('The parent does not exist.', 404)
            error.error_code = 'ParentNotFound'
            raise error
        self.directories.add(directory)
        self.created.append(directory)


def provider_with(client):
    # Skip __init__, which builds a real FileService from the environment.
    provider = AzureStorageProvider.__new__(AzureStorageProvider)
    provider.client = client
    return provider


def test_create_remote_dir_leaves_an_existing_directory_alone():
    client = FakeFileService(existing={'lmdb', 'lmdb/genes'})

    assert provider_with(client).create_remote_dir('share', 'lmdb/genes') == 'lmdb/genes'
    assert client.created == []


def test_create_remote_dir_creates_missing_parents_first():
    client = FakeFileService()
    created = provider_with(client).create_remote_dir('share', 'lmdb/genes/human')

    assert created == 'lmdb/genes/human'
    assert client.created == ['lmdb', 'lmdb/genes', 'lmdb/genes/human']


def test_create_remote_dir_raises_errors_other_than_a_missing_parent():
    error = AzureMissingResourceHttpError('The share does not exist.', 404)
    error.error_code = 'ShareNotFound'
    client = FakeFileService(fail_with=error)

    with pytest.raises(AzureMissingResourceHttpError) as raised:
        provider_with(client).create_remote_dir('share', 'lmdb')
    assert raised.value is error
