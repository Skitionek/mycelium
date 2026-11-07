import { HttpErrorResponse } from '@angular/common/http';

import { of, throwError } from 'rxjs';

import { FAClass } from './constants';
import { getSupportedFileCodes, hexToRGBA, ignore404Errors } from './utils';

describe('shared utils', () => {
  describe('getSupportedFileCodes', () => {
    it('picks the icon of a known extension', () => {
      expect(getSupportedFileCodes('report.docx').FAClass).toBe(FAClass.Word);
      expect(getSupportedFileCodes('data.xls').FAClass).toBe(FAClass.Excel);
      expect(getSupportedFileCodes('talk.pptx').FAClass).toBe(FAClass.PowerPoint);
      expect(getSupportedFileCodes('network.cys').FAClass).toBe(FAClass.Cytoscape);
    });

    it('picks the icon whatever the case of the extension', () => {
      expect(getSupportedFileCodes('REPORT.DOCX')?.FAClass).toBe(FAClass.Word);
      expect(getSupportedFileCodes('Data.Xlsx')?.FAClass).toBe(FAClass.Excel);
    });

    it('has no icon for other files', () => {
      expect(getSupportedFileCodes('notes.txt')).toBeUndefined();
      expect(getSupportedFileCodes('docx')).toBeUndefined();
    });
  });

  describe('hexToRGBA', () => {
    it('reads long and short hex colours', () => {
      expect(hexToRGBA('#ff8000', 0.3)).toBe('rgba(255,128,0,0.3)');
      expect(hexToRGBA('#F80', 1)).toBe('rgba(255,136,0,1)');
    });

    it('rejects anything else', () => {
      expect(() => hexToRGBA('ff8000', 1)).toThrowError('Bad Hex');
      expect(() => hexToRGBA('#ff80', 1)).toThrowError('Bad Hex');
    });
  });

  describe('ignore404Errors', () => {
    it('turns a 404 into null', done => {
      throwError(() => new HttpErrorResponse({status: 404})).pipe(ignore404Errors()).subscribe(value => {
        expect(value).toBeNull();
        done();
      });
    });

    it('passes on other errors and values', done => {
      of(1).pipe(ignore404Errors()).subscribe(value => expect(value).toBe(1));
      throwError(() => new HttpErrorResponse({status: 500})).pipe(ignore404Errors()).subscribe({
        error: error => {
          expect(error.status).toBe(500);
          done();
        },
      });
    });
  });
});
