import json

from flask.json.provider import DefaultJSONProvider
from sqlalchemy.sql.sqltypes import TIMESTAMP
from neo4japp.models import GraphNode, GraphRelationship

from numbers import Number


class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        try:
            if isinstance(obj, (GraphNode, GraphRelationship)):
                return obj.to_dict()
            elif isinstance(obj, (TIMESTAMP, Number)):
                return str(obj)
        except TypeError:
            pass
        # Then whatever Flask serializes, such as dates, which json.JSONEncoder rejects
        return DefaultJSONProvider.default(obj)


class CustomJSONProvider(DefaultJSONProvider):
    def dumps(self, obj, **kwargs):
        return json.dumps(obj, cls=CustomJSONEncoder, **kwargs)
