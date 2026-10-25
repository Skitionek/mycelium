import { firstValueFrom, of } from 'rxjs';

import { mapBufferToJson, mapBufferToJsons } from './files';

function buffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe('mapBufferToJson', () => {
  it('parses the buffer', async () => {
    expect(await firstValueFrom(of(buffer('{"a": 1}')).pipe(mapBufferToJson()))).toEqual({a: 1});
  });

  it('passes a missing buffer through as null', async () => {
    expect(await firstValueFrom(of(undefined).pipe(mapBufferToJson()))).toBeNull();
  });
});

describe('mapBufferToJsons', () => {
  it('parses one document per line', async () => {
    expect(await firstValueFrom(of(buffer('{"a": 1}\n{"b": 2}\n')).pipe(mapBufferToJsons())))
      .toEqual([{a: 1}, {b: 2}]);
  });

  it('skips blank lines, including those of CRLF files', async () => {
    expect(await firstValueFrom(of(buffer('{"a": 1}\r\n\r\n  \r\n{"b": 2}\r\n')).pipe(mapBufferToJsons())))
      .toEqual([{a: 1}, {b: 2}]);
  });
});
