from flask import Blueprint, jsonify, request
from flask.views import MethodView
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFound
from neo4japp.models import DMP
from neo4japp.schemas.dmp import DMPResponseSchema, DMPListResponseSchema
from neo4japp.services.dmp_validation import validate_dmp_document, DMPValidationError, \
    get_dmp_title

bp = Blueprint('dmp', __name__, url_prefix='/dmp')


def _validation_error_to_marshmallow(exc: DMPValidationError) -> ValidationError:
    messages: dict = {}
    for err in exc.errors:
        messages.setdefault(err['field'], []).append(err['message'])
    return ValidationError(messages)


def _get_or_404(hash_id: str) -> DMP:
    dmp = DMP.query.filter_by(hash_id=hash_id).one_or_none()
    if dmp is None:
        raise RecordNotFound(
            title='DMP not found',
            message=f'No DMP document exists with ID {hash_id}.',
        )
    return dmp


class DMPListView(MethodView):
    decorators = [auth.login_required]

    def get(self):
        """List all DMP documents (summary only)."""
        dmps = DMP.query.order_by(DMP.creation_date.desc()).all()
        return jsonify(DMPListResponseSchema().dump({
            'results': dmps,
            'total': len(dmps),
        }))

    def post(self):
        """Create a new DMP document. Body must be the maDMP payload
        itself, i.e. {"dmp": {...}} per the RDA-DMP-Common standard."""
        payload = request.get_json(force=True, silent=False) or {}

        try:
            validate_dmp_document(payload)
        except DMPValidationError as e:
            raise _validation_error_to_marshmallow(e)

        dmp = DMP(
            title=get_dmp_title(payload),
            json_data=payload,
        )
        try:
            db.session.add(dmp)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise

        return jsonify(DMPResponseSchema().dump(dmp)), 201


class DMPDetailView(MethodView):
    decorators = [auth.login_required]

    def get(self, hash_id):
        """Retrieve a single DMP document, unchanged from what was stored."""
        dmp = _get_or_404(hash_id)
        return jsonify(DMPResponseSchema().dump(dmp))

    def put(self, hash_id):
        return self._update(hash_id, partial=False)

    def patch(self, hash_id):
        return self._update(hash_id, partial=True)

    def _update(self, hash_id, partial: bool):
        dmp = _get_or_404(hash_id)
        payload = request.get_json(force=True, silent=False) or {}

        if partial:
            # Shallow-merge onto the existing stored document's dmp key, then
            # validate the merged result so PATCH still yields a fully valid
            # maDMP document.
            merged = dict(dmp.json_data)
            merged_dmp = dict(merged.get('dmp', {}))
            merged_dmp.update(payload.get('dmp', {}))
            merged['dmp'] = merged_dmp
            payload = merged

        try:
            validate_dmp_document(payload)
        except DMPValidationError as e:
            raise _validation_error_to_marshmallow(e)

        dmp.json_data = payload
        dmp.title = get_dmp_title(payload)

        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise

        return jsonify(DMPResponseSchema().dump(dmp))

    def delete(self, hash_id):
        dmp = _get_or_404(hash_id)
        try:
            db.session.delete(dmp)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise
        return '', 204


bp.add_url_rule('', view_func=DMPListView.as_view('dmp_list'))
bp.add_url_rule('/<string:hash_id>', view_func=DMPDetailView.as_view('dmp_detail'))
