from flask import (
    Blueprint,
    g,
    jsonify,
    make_response,
    request
)
from flask.globals import current_app
from flask.views import MethodView
from neo4japp.exceptions import ServerException, NotAuthorized
from neo4japp.blueprints.auth import auth
from libcloud.storage.providers import get_driver
from libcloud.storage.types import Provider


bp = Blueprint('storage', __name__, url_prefix='/storage')

CONTAINER_NAME = 'lifelike-manual'


class UserManualAPI(MethodView):
    """
    Uploads a user manual for how to use Lifelike.
    Uses apache-libcloud Object Storage API so that alternative storage
    backends can be substituted by changing the provider.
    """

    decorators = [auth.login_required]

    USER_MANUAL_FILENAME = 'lifelike-user-manual'

    def get_storage_driver(self):
        cls = get_driver(Provider.AZURE_BLOBS)
        return cls(
            key=current_app.config.get('AZURE_ACCOUNT_STORAGE_NAME'),
            secret=current_app.config.get('AZURE_ACCOUNT_STORAGE_KEY'),
        )

    def get(self):
        driver = self.get_storage_driver()
        obj = driver.get_object(CONTAINER_NAME, f'{self.USER_MANUAL_FILENAME}.pdf')
        stream = driver.download_object_as_stream(obj)
        data = b''.join(stream)
        resp = make_response(data)
        resp.headers['Content-Disposition'] = f'attachment;filename={self.USER_MANUAL_FILENAME}.pdf'
        resp.headers['Content-Type'] = 'application/pdf'
        return resp

    def post(self):
        if g.current_user.has_role('admin'):
            try:
                file = request.files['file']
            except KeyError:
                raise ServerException(
                    title='Unable to Upload File', message='No file specified.')
            driver = self.get_storage_driver()
            container = driver.get_container(CONTAINER_NAME)
            driver.upload_object_via_stream(
                iterator=iter([file.read()]),
                container=container,
                object_name=f'{self.USER_MANUAL_FILENAME}.pdf',
                extra={'content_type': 'application/pdf'},
            )
            return jsonify(dict(results='Manual successfully uploaded.'))
        raise NotAuthorized('You do not have sufficient privileges')


bp.add_url_rule('manual', view_func=UserManualAPI.as_view('admin_manual'))
