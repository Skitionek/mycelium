import {
  baseName,
  decodeLocalHashId,
  encodeLocalHashId,
  generateRootId,
  isLocalHashId,
  isValidRootId,
  joinPath,
  normalizePath,
  parentPath,
} from './local-ids';

describe('local hash IDs', () => {
  it('round-trips paths, including unicode and spaces', () => {
    for (const path of ['', 'a.pdf', 'Papers/2024 review/Über α-β.pdf', 'deep/er/still/x.txt']) {
      const hashId = encodeLocalHashId('abcdef0123456789', path);
      expect(isLocalHashId(hashId)).toBe(true);
      expect(decodeLocalHashId(hashId)).toEqual({rootId: 'abcdef0123456789', path});
    }
  });

  it('produces a single URL segment', () => {
    const hashId = encodeLocalHashId('abcdef0123456789', 'a/b/c?d#e.pdf');
    expect(hashId).not.toMatch(/[\/?#%+=]/);
    expect(encodeURIComponent(hashId)).toBe(hashId);
  });

  it('does not claim server hash IDs', () => {
    expect(isLocalHashId('Xyz123abc')).toBe(false);
    expect(isLocalHashId(null)).toBe(false);
    expect(decodeLocalHashId('Xyz123abc')).toBeNull();
  });

  it('rejects malformed local hash IDs', () => {
    expect(decodeLocalHashId('fs~')).toBeNull();
    expect(decodeLocalHashId('fs~~abc')).toBeNull();
    expect(decodeLocalHashId('fs~root~!!!')).toBeNull();
  });

  it('refuses paths that climb out of the folder', () => {
    expect(() => normalizePath('a/../../etc')).toThrow();
    expect(decodeLocalHashId(encodeLocalHashId('abcdef0123456789', 'x').replace(/~[^~]*$/, '~' + btoa('../x')))).toBeNull();
  });

  it('generates valid root IDs', () => {
    const id = generateRootId();
    expect(isValidRootId(id)).toBe(true);
    expect(generateRootId()).not.toBe(id);
  });

  it('manipulates paths', () => {
    expect(joinPath('', 'a')).toBe('a');
    expect(joinPath('a', 'b')).toBe('a/b');
    expect(parentPath('a/b/c')).toBe('a/b');
    expect(parentPath('a')).toBe('');
    expect(baseName('a/b/c.pdf')).toBe('c.pdf');
    expect(normalizePath('/a//b/./c/')).toBe('a/b/c');
  });
});
