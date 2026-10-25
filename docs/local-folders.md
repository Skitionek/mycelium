# Local folders

Mycelium can open folders on your own computer next to its projects. The files stay
where they are; Mycelium reads them through the browser's
[File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API),
indexes them in the background, and opens them in the same viewers as uploaded files.

This needs a Chromium-based browser (Chrome, Edge, Opera, Brave). Other browsers still
work with projects; the **Local Folders** section of the file browser says when the
browser cannot connect folders.

## Using it

1. Open the **File Browser** and click **Connect Folder** under **Local Folders**, or drag a
   folder from your file manager onto that section. The browser asks whether Mycelium may
   view and edit the folder.
2. Click the folder to browse it. Files open in the same built-in viewer they would open
   in after uploading them to a project:

   | Files | Viewer |
   |---|---|
   | PDF | PDF viewer, with entity annotations once annotated |
   | Office documents (`.docx`, `.xlsx`, `.pptx`, `.odt`, ...) | PDF viewer, converted to PDF in the browser (on the server where the browser cannot) |
   | Text, code, CSV, Markdown, JSON, XML | Code viewer |
   | `.pdb`, `.cif`, `.mmcif` | Protein structure viewer |
   | `.bioc` | BioC viewer |
   | `.llmap` | Map viewer and editor |
   | `.graph` | Sankey viewer |
   | `.enrichment` | Enrichment table, with entity annotations once annotated, and its statistical enrichment |
   | JSON data management plans | DMP editor |
   | `.sdrf.tsv` | SDRF editor |

   **Open in** in a file's menu offers the other viewers that can show it.
3. Use **Search the contents of this folder** above the file list to search the text of
   everything indexed so far.

You can create folders and files, upload into the folder, move items by dragging them
onto another folder in it, and delete them; the changes are made on disk. Edits made in
viewers that save, such as the map, DMP, SDRF and enrichment table editors, are written
straight to the file.

### Status indicators

| Where | What it shows |
|---|---|
| Navigation bar | A drive icon while folders are connected. It spins while indexing and gets a dot when a folder needs reconnecting. The tooltip summarises progress. |
| File browser tile | Progress bar and a line such as *Indexing 40 of 120* or *Up to date: 120 files indexed*. |
| Folder header | The same status, plus **Reconnect** and an **Index** menu (look for changes, rebuild, annotation on/off). |
| **Index** column | Per file: queued, indexing, indexed, annotated, name only (not a text format), or failed. Hover for details such as the number of terms or annotations. |

### After a reload

Browsers ask again before a site may keep reading a folder, so after reloading the page
a folder shows **Reconnect**. One click restores access, unless you chose to allow access
on every visit. Indexing continues where it stopped.

## The index

Each indexed folder gets a hidden `.mycelium` directory next to the files it describes:

```text
Papers/
  review.pdf
  notes.txt
  .mycelium/
    manifest.json          only in the connected folder: its ID and settings
    index.json             one entry per file in Papers/
    annotations/
      1f2e3d4c-....json    entity annotations of review.pdf (for an enrichment
                           table: the table with its cells annotated)
  2024/
    trial.pdf
    .mycelium/
      index.json
```

- An entry records the file's size and modification time, its type, its search terms,
  and, for PDFs, where its annotations are. A file is processed again only when its size
  or modification time changes.
- Each file's result is written about a second after it is done, so disconnecting a
  folder, closing the tab, or losing the connection loses at most the file being worked
  on. Connecting the folder again picks up from there.
- The folder's ID lives in `manifest.json`, so a disconnected folder comes back with the
  same ID: links to its files, recent files and map links keep working, even after
  clearing the browser's data or on another computer. A copy of a connected folder gets
  a new ID the first time it is connected alongside the original.
- Shards are per directory, so connecting a parent or a subfolder of an indexed folder
  reuses the existing index too.
- If Mycelium only gets read access, nothing is written; the index is kept in the
  browser tab and rebuilt next time.
- Deleting the `.mycelium` directories removes the index. **Rebuild index** re-extracts
  all text but keeps annotations of unchanged files.

### What is indexed

| Files | Indexed as |
|---|---|
| PDF | Text of every page (extracted in the browser with PDF.js), and entity annotations |
| Enrichment tables | Their text, and entity annotations of their cells |
| Text, code, CSV, Markdown, JSON, XML, BioC, enrichment tables, plans, SDRF, structures | Their text |
| Maps (`.llmap`) and graphs (`.graph`) | The text in their nodes, edges and details |
| Anything else (images, office documents, archives) | Only the file name is searchable |

Hidden files (names starting with `.`) are neither shown nor indexed, except the
folder-level `.annotations` configuration file.

### Annotation and privacy

Text extraction and search run entirely in the browser. Identifying entities in PDFs
and enrichment tables uses the same pipeline as uploaded documents, so each of them is
sent to the Mycelium server once. The server keeps a PDF in Redis for at most ten minutes
while the PDF parser reads it and deletes it as soon as parsing is done; enrichment tables
are annotated in memory. Neither the files nor their annotations are stored. PDFs over
100 MB and enrichment tables over 32 MB are not sent.

The result is saved in the folder's index, so the viewers show annotations without
asking the server again. A file opened while it is waiting to be annotated is moved to
the front of the queue.

Turn this off per folder with **Annotate PDFs and enrichment tables on the server** in
the folder's menu; the setting is saved in the folder's manifest. If the annotation service is unavailable,
annotation pauses for the session and is retried the next time the folder is scanned,
without affecting the text index.

### Picking up changes made elsewhere

Changes made through Mycelium are indexed immediately. Changes made in other programs
are picked up:

- as they happen, in browsers with `FileSystemObserver`;
- when a folder is opened in the file browser (its listing is compared with the index);
- when the Mycelium tab comes back to the foreground, at most once a minute;
- on **Look for changes**.

## Limitations

- Custom annotations, annotation exclusions, the word cloud and the file navigator rely
  on server-side records and are not available for local files. Upload a file to a
  project to curate its annotations.
- Map exports other than downloading the file need the map to be in a project.
- Moving items between a local folder and a project is not supported; upload instead.
- The `.annotations` folder configuration is listed, but not yet applied to local
  annotation, which uses the default configuration.

## For developers

The client code lives in `client/src/app/local-filesystem/`:

| File | Role |
|---|---|
| `local-ids.ts` | Local hash IDs: `fs~<rootId>~<base64url path>`. Server hash IDs never contain `~`. |
| `services/local-folder-registry.service.ts` | Connected folders, permissions, IndexedDB persistence, folder identity via the manifest. |
| `services/local-filesystem.service.ts` | Local files as `FilesystemObject`s; reading, writing, creating, moving, deleting. |
| `services/local-indexer.service.ts` | Scanning, the index and annotation queues, shard persistence, status, search. |
| `index-shard.ts` | The on-disk format. Bump `INDEXER_VERSION` when extraction changes so files are re-indexed. |
| `text-extraction.ts`, `mime.ts` | Text extraction and tokenizing; type detection mirroring the appserver. |

`FilesystemService` and `AnnotationsService` hand any local hash ID to these services,
which is why viewers need no changes to open local files; `EnrichmentTableService` does
the same for annotated enrichment tables. The appserver adds three stateless endpoints:
`POST /filesystem/annotations/transient` (annotate a PDF without storing it),
`POST /filesystem/annotations/transient/enrichment-table` (the same for an enrichment
table) and `POST /filesystem/convert/pdf` (convert an office document without storing it,
used only where the browser cannot convert it itself, see `OfficeConverterService`).

`real-filesystem.spec.ts` runs the main flows against the browser's own implementation of
the API, using the origin private file system.
