import { md5Hex } from './identifiers';

describe('md5Hex', () => {
  // Values must stay stable: they are embedded in trace view URLs.
  it('matches reference MD5 digests', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('hashes non-ASCII input as UTF-8', () => {
    expect(md5Hex(JSON.stringify({
      graph: {description: 'Ünïcødé – αβγ 🍄'},
      traces: [],
      source: 12,
      target: 34
    }))).toBe('ddf89c1363303f132dc16e9c9913ada3');
  });
});
