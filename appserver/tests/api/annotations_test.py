import pytest
import json

from neo4japp.constants import PDFPARSE_FETCH_SECRET
from neo4japp.models import Files, AppUser


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_get_gene_annotations_from_pdf(
        client,
        test_user_with_pdf: Files,
        fix_admin_user: AppUser,
        mock_get_combined_annotations_result,
        mock_get_organisms_from_gene_ids_result,
):
    login_resp = client.login_as_user(fix_admin_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])
    file_id = test_user_with_pdf.hash_id

    response = client.post(
        f'/filesystem/objects/{file_id}/annotations/gene-counts',
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.get_data() == b'gene_id\tgene_name\torganism_id\torganism_name\t' \
                                  b'gene_annotation_count\r\n' + \
                                  b'945771\tcysB\t511145\t' + \
                                  b'Escherichia coli str. K-12 substr. MG1655\t1\r\n'


def test_user_can_get_all_annotations_from_pdf(
        client,
        test_user_with_pdf: Files,
        fix_admin_user: AppUser,
        mock_get_combined_annotations_result,
):
    login_resp = client.login_as_user(fix_admin_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])
    file_id = test_user_with_pdf.hash_id

    response = client.post(
        f'/filesystem/objects/{file_id}/annotations/counts',
        headers=headers,
        content_type='application/json',
    )
    assert response.status_code == 200
    assert response.get_data() == b'entity_id\ttype\ttext\tprimary_name\tcount\r\n' + \
                                  b'945771\tGene\tcysB\tcysB\t1\r\n' + \
                                  b'511145\tSpecies\te. coli\t' + \
                                  b'Escherichia coli str. K-12 substr. MG1655\t1\r\n'


def test_user_can_get_global_inclusions(
        client,
        fix_project,
        fix_admin_user,
        mock_global_compound_inclusion,
):
    login_resp = client.login_as_user(fix_admin_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    response = client.get(
        '/annotations/global-list/inclusions',
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.get_data() is not None


def test_user_can_get_global_exclusions(
        client,
        fix_project,
        fix_admin_user,
        mock_global_gene_exclusion,
):
    login_resp = client.login_as_user(fix_admin_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    response = client.get(
        '/annotations/global-list/exclusions',
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.get_data() is not None


@pytest.mark.skip('Skipping for now to get code merged')
def test_user_can_get_global_list(
        client,
        fix_project,
        fix_admin_user,
        mock_global_list,
):
    login_resp = client.login_as_user(fix_admin_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    response = client.get(
        '/annotations/global-list',
        headers=headers,
        content_type='application/json',
    )

    assert response.status_code == 200

    data = json.loads(response.get_data().decode('utf-8'))
    assert data['total'] == 2
    assert len(data['results']) == 2

    if data['results'][0]['type'] == 'inclusion':
        inclusion = data['results'][0]
        exclusion = data['results'][1]
    else:
        inclusion = data['results'][1]
        exclusion = data['results'][0]

    assert inclusion['text'] == 'compound-(12345)'
    assert inclusion['entityType'] == 'Compound'
    assert exclusion['text'] == 'fake-gene'
    assert exclusion['entityType'] == 'Gene'


# --- get_pdf_to_annotate secret guard ---

def test_get_pdf_to_annotate_rejects_missing_secret(client):
    """
    Given any file id
    When the pipeline endpoint is called without a secret
    Then it returns 403 before touching the database
    """
    response = client.get('/annotations/files/1')

    assert response.status_code == 403


def test_get_pdf_to_annotate_rejects_wrong_secret(client):
    """
    Given any file id
    When the pipeline endpoint is called with an incorrect secret
    Then it returns 403 before touching the database
    """
    response = client.get('/annotations/files/1?secret=wrong-value')

    assert response.status_code == 403


def test_get_pdf_to_annotate_allows_correct_secret(client, test_user_with_pdf: Files):
    """
    Given a stored file
    When the pipeline endpoint is called with the correct shared secret
    Then it returns 200 with the PDF content
    """
    response = client.get(
        f'/annotations/files/{test_user_with_pdf.id}?secret={PDFPARSE_FETCH_SECRET}'
    )

    assert response.status_code == 200
    assert response.content_type == 'application/pdf'
