import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// TODO: Should consolidate this with the existing shared method at the root of the app
/**
 * universally unique identitifer generator
 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {

    /* eslint-disable */
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    /* eslint-enable */
    return v.toString(16);
  });
}

/**
 * random short sequence generator
 */
function makeid(length = 3) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * MD5 hex digest of a string (used for stable, non-security identifiers)
 */
function md5Hex(value: string): string {
  return bytesToHex(md5(utf8ToBytes(value)));
}

export {
  uuidv4,
  makeid,
  md5Hex,
};
