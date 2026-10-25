"""What the annotation history reports as added and removed between two versions."""
import pytest

from neo4japp.blueprints.filesystem import FileAnnotationHistoryView


def inclusion(id, text, page=1):
    return {'meta': {'id': id, 'allText': text, 'type': 'Gene'}, 'pageNumber': page}


def exclusion(id, text, reason='Other'):
    return {'id': id, 'text': text, 'allText': text, 'reason': reason}


def changes(older, newer, type='inclusion'):
    result = FileAnnotationHistoryView()._get_annotation_changes(older, newer, type)
    return sorted(
        ((change['action'], change['meta']['allText'], len(change['instances']))
         for change in result),
    )


def test_nothing_changes_between_equal_lists_in_another_order():
    a, b = inclusion('1', 'gene a'), inclusion('2', 'gene b')

    assert changes([a, b], [b, a]) == []


def test_reports_added_and_removed_inclusions():
    kept, gone, new = inclusion('1', 'kept'), inclusion('2', 'gone'), inclusion('3', 'new')

    assert changes([kept, gone], [kept, new]) == [('added', 'new', 1), ('removed', 'gone', 1)]


def test_compares_annotations_by_content_not_key_order():
    older = [{'pageNumber': 1, 'meta': {'type': 'Gene', 'allText': 'a', 'id': '1'}}]
    newer = [{'meta': {'id': '1', 'allText': 'a', 'type': 'Gene'}, 'pageNumber': 1}]

    assert changes(older, newer) == []


def test_groups_instances_of_one_annotation():
    older = [inclusion('1', 'gene', page=1)]
    newer = [inclusion('1', 'gene', page=1), inclusion('1', 'gene', page=2),
             inclusion('1', 'gene', page=3)]

    assert changes(older, newer) == [('added', 'gene', 2)]


def test_groups_annotations_without_an_id_by_their_text():
    newer = [inclusion('', 'custom', page=1), inclusion('', 'custom', page=2)]

    assert changes([], newer) == [('added', 'custom', 2)]


def test_reports_exclusion_changes():
    assert changes([exclusion('1', 'gone')], [exclusion('2', 'new')], 'exclusion') == [
        ('added', 'new', 1), ('removed', 'gone', 1),
    ]


@pytest.mark.parametrize('older, newer, expected', [
    (None, [inclusion('1', 'a')], [('added', 'a', 1)]),
    ([inclusion('1', 'a')], None, [('removed', 'a', 1)]),
    (None, None, []),
], ids=['first version', 'all cleared', 'never annotated'])
def test_a_missing_list_counts_as_empty(older, newer, expected):
    assert changes(older, newer) == expected
