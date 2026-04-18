import { Injectable } from '@angular/core';

import { environment } from 'environments/environment';

export interface DrivePickerResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  accessToken: string;
  /** True when the selected item is a Google Drive folder. */
  isFolder: boolean;
}

/**
 * Service that wraps the Google Drive Picker API.
 *
 * Prerequisites (handled automatically on first use):
 *  - The Google Identity Services (GIS) library is loaded from
 *    https://accounts.google.com/gsi/client
 *  - The Google API client library is loaded from https://apis.google.com/js/api.js
 *
 * Callers should check {@link isAvailable} before showing any Google Drive UI.
 */
@Injectable({providedIn: 'root'})
export class GoogleDrivePickerService {

  private gapiReady = false;
  private gapiLoadPromise: Promise<void> | null = null;
  private gisReady = false;
  private gisLoadPromise: Promise<void> | null = null;

  /** Returns true when a Google client ID is configured. */
  get isAvailable(): boolean {
    return !!environment.googleDriveClientId;
  }

  /**
   * Open the Google Drive Picker and resolve with the selected file's
   * metadata and a short-lived OAuth access token that can be forwarded
   * to the backend.
   *
   * Rejects when the user cancels the picker or an error occurs.
   */
  pick(): Promise<DrivePickerResult> {
    if (!this.isAvailable) {
      return Promise.reject(new Error('Google Drive is not configured.'));
    }

    return Promise.all([this.loadGis(), this.loadGapi()]).then(() => {
      return new Promise<DrivePickerResult>((resolve, reject) => {
        this.requestAccessToken().then(accessToken => {
          this.openPicker(accessToken, resolve, reject);
        }).catch(reject);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private loadGapi(): Promise<void> {
    if (this.gapiReady) {
      return Promise.resolve();
    }
    if (this.gapiLoadPromise) {
      return this.gapiLoadPromise;
    }
    this.gapiLoadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        (window as any).gapi.load('picker', () => {
          this.gapiReady = true;
          resolve();
        });
      };
      script.onerror = () => reject(new Error('Failed to load Google API library.'));
      document.head.appendChild(script);
    });
    return this.gapiLoadPromise;
  }

  private loadGis(): Promise<void> {
    if (this.gisReady) {
      return Promise.resolve();
    }
    if (this.gisLoadPromise) {
      return this.gisLoadPromise;
    }
    this.gisLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (existing) {
        // Script already added by something else; wait for gsi to be ready
        const poll = setInterval(() => {
          if ((window as any).google?.accounts?.oauth2) {
            clearInterval(poll);
            this.gisReady = true;
            resolve();
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        this.gisReady = true;
        resolve();
      };
      script.onerror = () =>
        reject(new Error('Failed to load Google Identity Services library.'));
      document.head.appendChild(script);
    });
    return this.gisLoadPromise;
  }

  private requestAccessToken(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: environment.googleDriveClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(`OAuth error: ${response.error}`));
          } else {
            resolve(response.access_token as string);
          }
        },
      });
      tokenClient.requestAccessToken({prompt: ''});
    });
  }

  private openPicker(
    accessToken: string,
    resolve: (result: DrivePickerResult) => void,
    reject: (reason: Error) => void,
  ): void {
    const google = (window as any).google;

    // File view — allows selecting any non-folder file
    const filesView = new google.picker.DocsView()
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);

    // Folder view — allows navigating into and selecting folders
    const foldersView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder');

    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .addView(filesView)
      .addView(foldersView)
      .setDeveloperKey('')  // Optional: set an API key for quota purposes
      .setCallback((data: any) => {
        if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
          const doc = data[google.picker.Response.DOCUMENTS][0];
          const pickedMime = doc[google.picker.Document.MIME_TYPE] as string;
          resolve({
            fileId: doc[google.picker.Document.ID] as string,
            fileName: doc[google.picker.Document.NAME] as string,
            mimeType: pickedMime,
            accessToken,
            isFolder: pickedMime === 'application/vnd.google-apps.folder',
          });
        } else if (data[google.picker.Response.ACTION] === google.picker.Action.CANCEL) {
          reject(new Error('Google Drive Picker cancelled.'));
        }
      })
      .build();

    picker.setVisible(true);
  }
}
