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
});
