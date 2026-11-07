"""Schemas that decide what to show from the request's context.

marshmallow 4 dropped Schema(context=...): passing it raised TypeError, and
every filesystem and project endpoint answered 500. The context now comes from
marshmallow.experimental.context.Context, and nested schemas must see it too.
"""
from types import SimpleNamespace

import pytest
from marshmallow.experimental.context import Context

from neo4japp.models.projects import ProjectPrivileges
from neo4japp.schemas.filesystem import FileLockListResponse, ProjectListSchema, ProjectSchema

USER_ID = 7


def project():
    return SimpleNamespace(
        hash_id='project-hash-id',
        name='project',
        description='',
        creation_date=None,
        modified_date=None,
        root=None,
        calculated_privileges={
            USER_ID: ProjectPrivileges(readable=True, writable=False, administrable=False),
        },
    )


def test_project_privileges_come_from_the_context():
    with Context({'user_privilege_filter': USER_ID}):
        dumped = ProjectSchema().dump(project())

    assert dumped['privileges'] == {'readable': True, 'writable': False, 'administrable': False}


def test_nested_schemas_see_the_context():
    with Context({'user_privilege_filter': USER_ID}):
        dumped = ProjectListSchema().dump({'total': 1, 'results': [project()]})

    assert dumped['results'][0]['privileges']['readable'] is True


def test_a_privilege_filter_of_none_shows_no_privileges():
    with Context({'user_privilege_filter': None}):
        dumped = ProjectSchema().dump(project())

    assert dumped['privileges'] is None


def test_dumping_without_the_privilege_filter_is_an_error():
    with pytest.raises(RuntimeError, match='user_privilege_filter'):
        ProjectSchema().dump(project())


@pytest.mark.parametrize('lock_owner_id, own', [(USER_ID, True), (USER_ID + 1, False)])
def test_locks_say_whether_the_current_user_holds_them(lock_owner_id, own):
    lock = SimpleNamespace(
        user=SimpleNamespace(id=lock_owner_id, hash_id='h', username='u',
                             first_name='F', last_name='L'),
        acquire_date=None,
    )

    with Context({'current_user': SimpleNamespace(id=USER_ID)}):
        dumped = FileLockListResponse().dump({'results': [lock]})

    assert dumped['results'][0]['own'] is own
