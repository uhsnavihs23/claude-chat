// assets/files.js — structured file parsing (CSV, XLSX, XLS)
// Loaded before app.js. Exposes window.AppFiles

(function () {
  const FILES = {
    // ── Config ────────────────────────────────────────────
    MAX_PREVIEW_ROWS:  25,
    MAX_PREVIEW_COLS:  12,
    MAX_CELL_LEN:      120,
    MAX_TEXT_SNIPPET:  12000,

    // ── Dependency loader ─────────────────────────────────
    async ensureDeps() {
      if (!window.Papa) {
        await this.loadScript(
          'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js'
        );
      }
      if (!window.XLSX) {
        await this.loadScript(
          'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
        );
      }
    },

    loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-dep-src="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === 'true') return resolve();
          existing.addEventListener('load',  resolve, { once: true });
          existing.addEventListener('error', reject,  { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src            = src;
        s.async          = true;
        s.dataset.depSrc = src;
        s.onload  = () => { s.dataset.loaded = 'true'; resolve(); };
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });
    },

    // ── Cell utilities ────────────────────────────────────
    truncate(val, max) {
      max = max ?? this.MAX_CELL_LEN;
      const s = String(val ?? '').trim();
      return s.length > max ? s.slice(0, max) + '…' : s;
    },

    // Detect whether a value looks numeric or date-like
    inferCellType(val) {
      const s = String(val ?? '').trim();
      if (s === '') return 'empty';
      if (!isNaN(Number(s)) && s !== '') return 'number';
      if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(s)) return 'date';
      return 'text';
    },

    // ── Row normalisation ─────────────────────────────────
    normalizeRows(rows) {
      if (!Array.isArray(rows)) return [];
      return rows.map(row => {
        if (Array.isArray(row))                  return row;
        if (row && typeof row === 'object')       return Object.values(row);
        return [row];
      });
    },

    inferHeaders(rows) {
      const first = rows[0] || [];
      return first.map((v, i) => {
        const txt = String(v ?? '').trim();
        return txt || `Column ${i + 1}`;
      });
    },

    rowsToObjects(rows, headers) {
      return rows.map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
        return obj;
      });
    },

    // Detect if first row looks like a real header
    // (at least one non-numeric non-empty cell)
    isHeaderRow(row) {
      return row.some(v => {
        const s = String(v ?? '').trim();
        return s !== '' && isNaN(Number(s));
      });
    },

    // ── Markdown table builder ────────────────────────────
    buildMarkdownTable(headers, rows) {
      const safeHeaders = headers
        .slice(0, this.MAX_PREVIEW_COLS)
        .map(h => this.truncate(h, 60).replace(/\|/g, '\\|'));

      const clippedRows = rows
        .slice(0, this.MAX_PREVIEW_ROWS)
        .map(r =>
          r.slice(0, this.MAX_PREVIEW_COLS)
           .map(v => this.truncate(v).replace(/\n/g, ' ').replace(/\|/g, '\\|'))
        );

      const head = `| ${safeHeaders.join(' | ')} |`;
      const sep  = `| ${safeHeaders.map(() => '---').join(' | ')} |`;
      const body = clippedRows
        .map(r => `| ${r.map(v => String(v ?? '')).join(' | ')} |`)
        .join('\n');

      return [head, sep, body].filter(Boolean).join('\n');
    },

    // ── Summary builder ───────────────────────────────────
    buildSummary({ name, type, sheetNames = [], activeSheet = '', headers = [], rowCount = 0, colCount = 0 }) {
      const parts = [
        `**File:** ${name}`,
        `**Type:** ${type}`,
        rowCount   ? `**Rows:** ${rowCount.toLocaleString()}`  : null,
        colCount   ? `**Columns:** ${colCount}`                : null,
        sheetNames.length > 1
          ? `**Sheets (${sheetNames.length}):** ${sheetNames.slice(0, 8).join(', ')}${sheetNames.length > 8 ? '…' : ''}`
          : null,
        activeSheet && sheetNames.length > 1
          ? `**Active sheet:** ${activeSheet}`                 : null,
        headers.length
          ? `**Headers:** ${headers.slice(0, this.MAX_PREVIEW_COLS).join(', ')}`
          : null
      ].filter(Boolean);

      return parts.join('\n');
    },

    // ── CSV export helper (used by CSV download button) ───
    toCSVBlob(headers, rows) {
      const escape = v => {
        const s = String(v ?? '');
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        headers.map(escape).join(','),
        ...rows.map(r => headers.map((_, i) => escape(r[i] ?? '')).join(','))
      ];
      return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    },

    downloadCSV(filename, headers, rows) {
      const blob = this.toCSVBlob(headers, rows);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename.replace(/\.[^.]+$/, '') + '_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    },

    // ── CSV parser ────────────────────────────────────────
    async parseCSV(file) {
      await this.ensureDeps();

      const text   = await file.text();
      const parsed = window.Papa.parse(text, {
        skipEmptyLines: true,
        dynamicTyping:  false,
        trimHeaders:    true
      });

      const rawRows = parsed.data || [];

      if (!rawRows.length) {
        return {
          kind: 'table', ext: '.csv', name: file.name,
          summary:         `**File:** ${file.name}\n**Type:** CSV\n**Rows:** 0`,
          previewMarkdown: '_Empty CSV file_',
          rowCount: 0, colCount: 0, headers: [], previewRows: [], rawTextSnippet: ''
        };
      }

      // Auto-detect header row
      let headers, bodyRows;
      if (this.isHeaderRow(rawRows[0])) {
        headers  = this.inferHeaders([rawRows[0]]);
        bodyRows = rawRows.slice(1);
      } else {
        headers  = rawRows[0].map((_, i) => `Column ${i + 1}`);
        bodyRows = rawRows;
      }

      const previewRows = bodyRows.slice(0, this.MAX_PREVIEW_ROWS);
      const rowCount    = bodyRows.length;
      const colCount    = headers.length;

      return {
        kind: 'table', ext: '.csv', name: file.name,
        summary: this.buildSummary({
          name: file.name, type: 'CSV', headers, rowCount, colCount
        }),
        previewMarkdown: this.buildMarkdownTable(headers, previewRows),
        rowCount,
        colCount,
        headers,
        previewRows,
        allRows:         bodyRows,
        rawTextSnippet:  text.slice(0, this.MAX_TEXT_SNIPPET)
      };
    },

    // ── Excel parser ──────────────────────────────────────
    async parseExcel(file) {
      await this.ensureDeps();

      const ext    = file.name.toLowerCase().endsWith('.xls') ? '.xls' : '.xlsx';
      const buffer = await file.arrayBuffer();
      const wb     = window.XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetNames = wb.SheetNames || [];

      if (!sheetNames.length) {
        return {
          kind: 'table', ext, name: file.name,
          summary:         `**File:** ${file.name}\n**Type:** Excel workbook\n**Sheets:** 0`,
          previewMarkdown: '_Workbook contains no sheets_',
          rowCount: 0, colCount: 0, headers: [], previewRows: [], sheetNames: [], rawTextSnippet: ''
        };
      }

      // Parse the first (active) sheet
      const activeSheet = sheetNames[0];
      const ws  = wb.Sheets[activeSheet];
      const aoa = ws
        ? window.XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
        : [];

      if (!aoa.length) {
        return {
          kind: 'table', ext, name: file.name,
          summary: this.buildSummary({
            name: file.name, type: 'Excel workbook',
            sheetNames, activeSheet, rowCount: 0, colCount: 0
          }),
          previewMarkdown: '_Selected sheet is empty_',
          rowCount: 0, colCount: 0, headers: [], previewRows: [],
          sheetNames, rawTextSnippet: ''
        };
      }

      // Auto-detect header row
      let headers, bodyRows;
      if (this.isHeaderRow(aoa[0])) {
        headers  = this.inferHeaders([aoa[0]]);
        bodyRows = aoa.slice(1);
      } else {
        headers  = aoa[0].map((_, i) => `Column ${i + 1}`);
        bodyRows = aoa;
      }

      const previewRows      = bodyRows.slice(0, this.MAX_PREVIEW_ROWS);
      const rowCount         = bodyRows.length;
      const colCount         = headers.length;
      const objectPreview    = this.rowsToObjects(previewRows, headers);
      const rawTextSnippet   = JSON.stringify(objectPreview, null, 2).slice(0, this.MAX_TEXT_SNIPPET);

      // Build per-sheet summaries for multi-sheet workbooks
      const sheetSummaries = sheetNames.length > 1
        ? sheetNames.map(name => {
            const s   = wb.Sheets[name];
            const aoa = s
              ? window.XLSX.utils.sheet_to_json(s, { header: 1, blankrows: false, defval: '' })
              : [];
            return `  • ${name}: ${Math.max(0, aoa.length - 1)} rows`;
          }).join('\n')
        : null;

      const summary = this.buildSummary({
        name: file.name, type: 'Excel workbook',
        sheetNames, activeSheet, headers, rowCount, colCount
      }) + (sheetSummaries ? `\n**Sheet breakdown:**\n${sheetSummaries}` : '');

      return {
        kind: 'table', ext, name: file.name,
        summary,
        previewMarkdown: this.buildMarkdownTable(headers, previewRows),
        rowCount,
        colCount,
        headers,
        previewRows,
        allRows:   bodyRows,
        sheetNames,
        activeSheet,
        rawTextSnippet,
        // Allow app to access other sheets if needed
        workbook: wb
      };
    },

    // ── Public entry point ────────────────────────────────
    async parseStructuredFile(file) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.csv'))                          return this.parseCSV(file);
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return this.parseExcel(file);
      return null;
    },

    // Parse a specific sheet by name from an already-read workbook result
    async parseSheet(excelResult, sheetName) {
      if (!excelResult?.workbook) throw new Error('No workbook available');
      const wb = excelResult.workbook;
      const ws = wb.Sheets[sheetName];
      if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

      const aoa = window.XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
      if (!aoa.length) return { headers: [], previewRows: [], rowCount: 0, colCount: 0, previewMarkdown: '_Empty sheet_' };

      let headers, bodyRows;
      if (this.isHeaderRow(aoa[0])) {
        headers  = this.inferHeaders([aoa[0]]);
        bodyRows = aoa.slice(1);
      } else {
        headers  = aoa[0].map((_, i) => `Column ${i + 1}`);
        bodyRows = aoa;
      }

      const previewRows = bodyRows.slice(0, this.MAX_PREVIEW_ROWS);
      return {
        sheetName,
        headers,
        previewRows,
        allRows:         bodyRows,
        rowCount:        bodyRows.length,
        colCount:        headers.length,
        previewMarkdown: this.buildMarkdownTable(headers, previewRows)
      };
    }
  };

  window.AppFiles = FILES;
})();
