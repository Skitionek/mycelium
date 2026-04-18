"""Add google_drive_id and google_drive_modified_time to files table

Revision ID: 002_add_google_drive_fields
Revises: 001_add_folder_annotation_config
Create Date: 2026-04-18 00:00:00.000000

Adds two columns that track Google Drive–indexed files:
  - google_drive_id  – the Drive item ID (file or folder) used for API calls
  - google_drive_modified_time – the RFC-3339 modifiedTime returned by Drive,
    used to detect whether the index is stale and a sync is needed.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_google_drive_fields'
down_revision = '001_add_folder_annotation_config'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'files',
        sa.Column('google_drive_id', sa.String(200), nullable=True),
    )
    op.add_column(
        'files',
        sa.Column(
            'google_drive_modified_time',
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_files_google_drive_id',
        'files',
        ['google_drive_id'],
        unique=False,
        postgresql_where=sa.text('google_drive_id IS NOT NULL'),
    )


def downgrade():
    op.drop_index('ix_files_google_drive_id', table_name='files')
    op.drop_column('files', 'google_drive_modified_time')
    op.drop_column('files', 'google_drive_id')
