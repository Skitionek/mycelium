import { firstValueFrom } from 'rxjs';

import { TableCSVExporter } from './table-csv-exporter';

async function csv(headers, cells): Promise<string> {
  const blob = await firstValueFrom(new TableCSVExporter().generate(headers, cells));
  return blob.text();
}

describe('TableCSVExporter', () => {
  it('writes header and body rows separated by CRLF', async () => {
    expect(await csv(
      [[{name: 'Gene', span: '1'}, {name: 'Name', span: '1'}]],
      [[{text: 'TP53'}, {text: 'tumor protein p53'}]],
    )).toEqual('Gene,Name\r\nTP53,tumor protein p53\r\n');
  });

  it('pads a header spanning several columns', async () => {
    expect(await csv(
      [[{name: 'Gene', span: '1'}, {name: 'Domains', span: '3'}], [{name: 'x', span: '1'}]],
      [],
    )).toEqual('Gene,Domains,,\r\nx\r\n');
  });

  it('quotes cells holding a separator, a quote or a line break', async () => {
    expect(await csv([], [[
      {text: 'a,b'},
      {text: 'say "hi"'},
      {text: 'two\nlines'},
      {text: 'carriage\rreturn'},
    ]])).toEqual('"a,b","say ""hi""","two\nlines","carriage\rreturn"\r\n');
  });

  it('leaves missing cell text empty', async () => {
    expect(await csv([], [[
      {text: undefined},
      {text: null},
      {text: ''},
      {text: 'x'},
    ]])).toEqual(',,,x\r\n');
  });

  it('writes numbers as they are', async () => {
    expect(await csv([], [[{text: 0 as any}, {text: 12.5 as any}]])).toEqual('0,12.5\r\n');
  });

  it('keeps text a spreadsheet would run as a formula as text', async () => {
    expect(await csv([], [[
      {text: '=HYPERLINK("http://example.com","TP53")'},
      {text: '+1+1'},
      {text: '-1+1'},
      {text: '@SUM(A1)'},
      {text: '\t=1+1'},
    ]])).toEqual(`"'=HYPERLINK(""http://example.com"",""TP53"")",'+1+1,'-1+1,'@SUM(A1),'\t=1+1\r\n`);
  });

  it('leaves signed numbers as numbers', async () => {
    expect(await csv([], [[{text: '-1.5'}, {text: '+2'}, {text: -3 as any}, {text: '-2e-5'}]]))
      .toEqual('-1.5,+2,-3,-2e-5\r\n');
  });
});
