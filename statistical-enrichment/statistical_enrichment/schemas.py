import re
from dataclasses import dataclass

from flask_marshmallow import Schema
from marshmallow import fields
from marshmallow.validate import OneOf


@dataclass
class Organism:
    id: int
    name: str

    def __str__(self):
        return f"{self.id}/{self.name}"


class OrganismField(fields.Field):
    # Only the first slash separates the taxID: strain names such as
    # "Influenza A virus (A/Puerto Rico/8/1934(H1N1))" carry their own.
    pattern = re.compile(r"(\d+)/(.+)", re.DOTALL)
    default_error_messages = {
        "required": "Missing data for required field.",
        "null": "Field may not be null.",
        "invalid": "Organism must be defined as 'taxID/name'.",
    }

    def _serialize(self, value, attr, obj, **kwargs):
        return str(value)

    def _deserialize(self, value, attr, data, **kwargs):
        match = self.pattern.fullmatch(value) if isinstance(value, str) else None
        if match is None:
            raise self.make_error("invalid")
        return Organism(*match.groups())


class GeneOrganismSchema(Schema):
    geneNames = fields.List(fields.Str, required=True)
    organism = OrganismField(required=True)


class EnrichmentSchema(GeneOrganismSchema):
    analysis = fields.Str(required=True, validate=OneOf(["fisher"]))
