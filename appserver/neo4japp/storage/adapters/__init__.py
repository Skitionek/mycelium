"""Storage adapters for Lifelike's IStorageProvider interface."""

__all__ = [
    "PostgresAdapter",
    "AzureDataLakeAdapter",
    "GoogleDriveAdapter",
]


def __getattr__(name: str):
    if name == "PostgresAdapter":
        from neo4japp.storage.adapters.postgres import PostgresAdapter
        return PostgresAdapter
    if name == "AzureDataLakeAdapter":
        from neo4japp.storage.adapters.azure_adls import AzureDataLakeAdapter
        return AzureDataLakeAdapter
    if name == "GoogleDriveAdapter":
        from neo4japp.storage.adapters.google_drive import GoogleDriveAdapter
        return GoogleDriveAdapter
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
