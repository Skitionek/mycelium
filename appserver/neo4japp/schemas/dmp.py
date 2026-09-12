from marshmallow import fields, Schema

from neo4japp.schemas.base import CamelCaseSchema


class DMPResponseSchema(CamelCaseSchema):
    """
    Response envelope for a persisted DMP record.

    ``json_data`` is the verbatim RDA-DMP-Common maDMP document
    ({"dmp": {...}}) as submitted/stored.
    """

    hash_id = fields.String(dump_only=True)
    title = fields.String(dump_only=True)
    json_data = fields.Raw(required=True)
    creation_date = fields.DateTime(dump_only=True)
    modified_date = fields.DateTime(dump_only=True)


class DMPListResponseSchema(Schema):
    results = fields.List(fields.Nested(DMPResponseSchema))
    total = fields.Integer()


class DMPRequestSchema(Schema):
    """
    Request body for create/update. The entire maDMP document is accepted
    verbatim under ``json_data`` (i.e. clients POST/PATCH the standard's
    native {"dmp": {...}} shape, unwrapped -- see the blueprint for details);
    schema validation against the RDA-DMP-Common JSON Schema happens in the
    service layer via neo4japp.services.dmp_validation, not here, so that
    validation errors report actual standard field paths (e.g.
    "dmp.contact") rather than marshmallow's own field names.
    """

    dmp = fields.Raw(required=True)
