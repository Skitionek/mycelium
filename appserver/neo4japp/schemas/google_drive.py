import marshmallow.validate
from marshmallow import fields

from neo4japp.schemas.annotations import AnnotationConfigurations, FallbackOrganismSchema
from neo4japp.schemas.base import CamelCaseSchema


class GoogleDriveImportRequestSchema(CamelCaseSchema):
    """Request schema for importing a file from Google Drive."""

    google_drive_file_id = fields.String(
        required=True,
        validate=marshmallow.validate.Length(min=1, max=200),
    )
    google_drive_access_token = fields.String(
        required=True,
        validate=marshmallow.validate.Length(min=1, max=4096),
    )
    parent_hash_id = fields.String(
        required=True,
        validate=marshmallow.validate.Length(min=1, max=36),
    )
    filename = fields.String(
        required=False,
        allow_none=True,
        validate=marshmallow.validate.Length(min=1, max=200),
    )
    description = fields.String(
        required=False,
        validate=marshmallow.validate.Length(max=500_000),
    )
    public = fields.Boolean(required=False, load_default=False)
    mime_type = fields.String(
        required=False,
        allow_none=True,
        validate=marshmallow.validate.Length(min=1, max=2048),
    )
    fallback_organism = fields.Nested(FallbackOrganismSchema, required=False, allow_none=True)
    annotation_configs = fields.Nested(AnnotationConfigurations, required=False)
