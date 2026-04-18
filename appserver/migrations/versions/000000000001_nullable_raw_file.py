"""Make files_content.raw_file nullable for object-storage migration

Revision ID: 000000000001
Revises: 000000000000
Create Date: 2026-04-18 15:00:00.000000

File content is now stored in object storage (via apache-libcloud) rather
than directly in the PostgreSQL ``files_content.raw_file`` column.  The
column is kept nullable so that existing rows remain readable via the DB
fallback while the data is progressively migrated to object storage.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '000000000001'
down_revision = '000000000000'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('files_content', 'raw_file',
                    existing_type=sa.LargeBinary(),
                    nullable=True)


def downgrade():
    # Revert nullability — note: rows with NULL raw_file will violate the
    # NOT NULL constraint; ensure all rows have been back-filled before
    # running the downgrade.
    op.alter_column('files_content', 'raw_file',
                    existing_type=sa.LargeBinary(),
                    nullable=False)
