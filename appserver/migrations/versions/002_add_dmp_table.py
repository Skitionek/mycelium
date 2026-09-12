"""Add dmp table for RDA-DMP-Common maDMP documents

Revision ID: 002_add_dmp_table
Revises: 001_add_folder_annotation_config
Create Date: 2026-09-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_dmp_table'
down_revision = '001_add_folder_annotation_config'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dmp',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('hash_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=2048), nullable=False),
        sa.Column('json_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('creation_date', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(),
                   nullable=False),
        sa.Column('modified_date', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(),
                   nullable=False),
        sa.Column('deletion_date', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('creator_id', sa.Integer(), nullable=True),
        sa.Column('modifier_id', sa.Integer(), nullable=True),
        sa.Column('deleter_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['creator_id'], ['appuser.id'], name=op.f('fk_dmp_creator_id_appuser')),
        sa.ForeignKeyConstraint(['modifier_id'], ['appuser.id'], name=op.f('fk_dmp_modifier_id_appuser')),
        sa.ForeignKeyConstraint(['deleter_id'], ['appuser.id'], name=op.f('fk_dmp_deleter_id_appuser')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_dmp')),
    )
    op.create_index(op.f('ix_dmp_hash_id'), 'dmp', ['hash_id'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_dmp_hash_id'), table_name='dmp')
    op.drop_table('dmp')
