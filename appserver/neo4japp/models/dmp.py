from sqlalchemy.dialects.postgresql import JSONB

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase, FullTimestampMixin, HashIdMixin


class DMP(RDBMSBase, FullTimestampMixin, HashIdMixin):
    """
    A Data Management Plan document conforming to the RDA-DMP-Common
    maDMP JSON Schema 1.2 (https://github.com/RDA-DMP-Common/RDA-DMP-Common-Standard).

    The full document (including the top-level ``{"dmp": {...}}`` wrapper)
    is persisted verbatim in ``json_data`` so that it can be
    serialized/deserialized without any lossy transformation. ``title`` is
    denormalized out of the payload for cheap listing/search.
    """

    __tablename__ = 'dmp'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # Denormalized for listing/search without needing to unpack json_data.
    title = db.Column(db.String(2048), nullable=False)

    # The full maDMP document, e.g. {"dmp": {...}}, stored verbatim.
    json_data = db.Column(JSONB, nullable=False)

    def to_dmp_dict(self):
        """Return the standard-shaped maDMP document ({"dmp": {...}})."""
        return self.json_data
