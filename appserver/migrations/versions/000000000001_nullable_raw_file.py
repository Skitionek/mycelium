"""PostgreSQL storage driver for user file content

Revision ID: 000000000001
Revises: 000000000000
Create Date: 2026-04-18 15:00:00.000000

File bytes continue to be stored in ``files_content.raw_file`` (NOT NULL),
now written via the
:class:`~neo4japp.services.storage_drivers.postgresql.PostgreSQLStorageDriver`
libcloud driver so that the storage backend is swappable.  No schema change
is required for the default PostgreSQL backend.
"""
from alembic import op  # noqa: F401 — keep the import for future migrations

# revision identifiers, used by Alembic.
revision = '000000000001'
down_revision = '000000000000'
branch_labels = None
depends_on = None


def upgrade():
    # No schema changes needed: raw_file remains NOT NULL.
    # File bytes are now routed through the libcloud PostgreSQLStorageDriver
    # but continue to land in the same column.
    pass


def downgrade():
    pass
