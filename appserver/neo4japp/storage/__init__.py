"""
Storage abstraction layer for Lifelike.

Public API::

    from neo4japp.storage import (
        IStorageProvider,
        StorageCapabilities,
        FileStat,
        Revision,
        NotSupportedError,
    )
    from neo4japp.storage.adapters import (
        PostgresAdapter,
        AzureDataLakeAdapter,
        GoogleDriveAdapter,
    )
"""

from neo4japp.storage.interface import (
    FileStat,
    IStorageProvider,
    NotSupportedError,
    Revision,
    StorageCapabilities,
)

__all__ = [
    "FileStat",
    "IStorageProvider",
    "NotSupportedError",
    "Revision",
    "StorageCapabilities",
]
