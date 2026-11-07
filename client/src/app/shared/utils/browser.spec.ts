import { WorkspaceManager } from '../workspace-manager';

import { openPotentialInternalLink, parseURLToDomainName, toValidLink } from './browser';

describe('browser utils', () => {
  describe('toValidLink', () => {
    it('keeps web, internal and mailto links', () => {
      expect(toValidLink(' https://example.org/a ')).toBe('https://example.org/a');
      expect(toValidLink('/projects/p')).toBe('/projects/p');
      expect(toValidLink('mailto:someone@example.org')).toBe('mailto:someone@example.org');
    });

    it('turns anything else into a web link', () => {
      expect(toValidLink('example.org')).toBe('http://example.org');
      expect(toValidLink('//example.org')).toBe('http://example.org');
      expect(toValidLink('javascript:alert(1)')).toBe('http://javascript:alert(1)');
    });
  });

  describe('parseURLToDomainName', () => {
    it('names known databases and falls back otherwise', () => {
      expect(parseURLToDomainName('https://www.uniprot.org/uniprot/P04637')).toBe('UniProt');
      expect(parseURLToDomainName('https://example.org/x')).toBe('Link');
      expect(parseURLToDomainName('https://example.org/x', 'Other')).toBe('Other');
    });
  });

  describe('openPotentialInternalLink', () => {
    let workspaceManager: jasmine.SpyObj<WorkspaceManager>;

    beforeEach(() => {
      workspaceManager = jasmine.createSpyObj<WorkspaceManager>('WorkspaceManager', ['isWithinWorkspace', 'navigateByUrl']);
      workspaceManager.isWithinWorkspace.and.returnValue(true);
    });

    /** Open a link to this app and answer the pattern the workspace looks for an open tab with. */
    function existingTabPattern(path: string): RegExp {
      expect(openPotentialInternalLink(workspaceManager, window.location.origin + path)).toBeTrue();
      expect(workspaceManager.navigateByUrl).toHaveBeenCalledTimes(1);
      const {url, extras} = workspaceManager.navigateByUrl.calls.mostRecent().args[0];
      expect(url).toBe(path);
      return new RegExp(extras.matchExistingTab);
    }

    it('reuses the tab of the linked folder, not that of another one', () => {
      const pattern = existingTabPattern('/projects/p/folders/folderB');

      expect(pattern.test('/folders/folderB')).toBeTrue();
      expect(pattern.test('/projects/p/folders/folderB')).toBeTrue();
      expect(pattern.test('/folders/folderA')).toBeFalse();
      expect(pattern.test('/projects/p/folders/folderA')).toBeFalse();
    });

    it('reuses the tab of the linked project, not that of a folder in it', () => {
      const pattern = existingTabPattern('/projects/p');

      expect(pattern.test('/projects/p')).toBeTrue();
      expect(pattern.test('/projects/p/folders/folderA')).toBeFalse();
      expect(pattern.test('/projects/other')).toBeFalse();
    });

    it('reuses the tab of the linked file', () => {
      const pattern = existingTabPattern('/projects/p/files/fileA');

      expect(pattern.test('/projects/p/files/fileA')).toBeTrue();
      expect(pattern.test('/projects/p/files/fileB')).toBeFalse();
    });
  });
});
