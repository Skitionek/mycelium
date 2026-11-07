import { Observable, of } from 'rxjs';

import { TableCell, TableHeader } from '../../components/table/generic-table.component';

/**
 * Generates a CSV from a generic table.
 */
export class TableCSVExporter {

  lineSeparator = '\r\n';

  generate(headers: TableHeader[][], cells: TableCell[][]): Observable<Blob> {
    let output = '';

    for (const headerRow of headers) {
      for (let j = 0; j < headerRow.length; j++) {
        if (j !== 0) {
          output += ',';
        }
        const header = headerRow[j];
        output += this.escapeCell(header.name);
        for (let k = 0; k < parseInt(header.span, 10) - 1; k++) {
          output += ',';
        }
      }
      output += this.lineSeparator;
    }

    for (const cellRow of cells) {
      for (let j = 0; j < cellRow.length; j++) {
        if (j !== 0) {
          output += ',';
        }
        const header = cellRow[j];
        output += this.escapeCell(header.text);
      }
      output += this.lineSeparator;
    }

    return of(new Blob([output]));
  }

  private escapeCell(value: any) {
    if (value == null) {
      value = '';
    } else if (value instanceof Date) {
      value = value.toLocaleString();
    } else {
      value = String(value);
    }
    // A spreadsheet runs text starting with one of these as a formula, such as a
    // gene name imported as =HYPERLINK(...); a leading ' keeps it text
    if (/^[=+\-@\t\r]/.test(value) && !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(value)) {
      value = '\'' + value;
    }
    value = value.replace(/"/g, '""');
    if (value.search(/[",\r\n]/) >= 0) {
      value = '"' + value + '"';
    }
    return value;
  }

}
