from marshmallow import fields, validate

from neo4japp.database import ma
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema
from neo4japp.schemas.fields import SearchQuery
from neo4japp.schemas.filesystem import RankedFileSchema

# ========================================
# Content Search
# ========================================

# Requests
# ----------------------------------------


class ContentSearchSchema(CamelCaseSchema):
    q = SearchQuery(
        required=True,
    )
    types = ma.String(dump_default='', required=False)
    folders = ma.String(dump_default='', required=False)


class SynonymSearchSchema(CamelCaseSchema):
    term = fields.String()
    organisms = fields.String(dump_default='', required=False)
    types = fields.String(dump_default='', required=False)

# Response
# ----------------------------------------


class ContentSearchResponseSchema(ResultListSchema):
    results = fields.List(fields.Nested(RankedFileSchema))
    dropped_folders = fields.List(fields.String())


class SynonymData(CamelCaseSchema):
    type = fields.String()
    name = fields.String()
    organism = fields.String()
    synonyms = fields.List(fields.String())


class SynonymSearchResponseSchema(CamelCaseSchema):
    data = fields.List(fields.Nested(SynonymData))
    count = fields.Integer()


# ========================================
# Text Annotation API
# ========================================


class AnnotateRequestSchema(ma.Schema):
    texts = fields.List(fields.String(validate=validate.Length(min=1, max=1500)),
                        validate=validate.Length(min=1, max=40))


# ========================================
# Organisms
# ========================================

class OrganismSearchSchema(ma.Schema):
    query = ma.String(required=True)
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))


# ========================================
# Visualizer
# ========================================

class VizSearchSchema(ma.Schema):
    query = ma.String(required=True)
    page = ma.Integer(required=True, validate=validate.Range(min=1))
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))
    # Optional filters. The search DAO reads an empty list as "no filter,
    # search every domain/entity" (see SearchService.sanitize_filter), so the
    # default has to be an empty list rather than absent: @use_kwargs passes
    # one keyword argument per key the schema returns, and visualizer_search()
    # declares both of these as required parameters.
    domains = ma.List(ma.String(), load_default=lambda: [])
    entities = ma.List(ma.String(), load_default=lambda: [])
    organism = ma.String(required=True)
