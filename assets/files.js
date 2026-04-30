(function () {
  const FILES = {
    MAX_PREVIEW_ROWS: 25,
    MAX_PREVIEW_COLS: 12,
    MAX_CELL_LEN: 120,
    MAX_TEXT_SNIPPET: 12000,

    async ensureDeps() {
      if (!window.Papa) {
        await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
      }
      if (!window.XLSX) {
        await this.loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
      }
    },

    loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-src="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === 'true') return resolve();
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
          return;
        }

        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.dataset.src = src;
        s.onload = () => {
          s.dataset.loaded = 'true';
          resolve();
        };
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });
    },

    truncate(val, max = FILES.MAX_CELL_LEN) {
      const s = String(val ?? '');
      return s.length > max ? s.slice(0, max) + '…' : s;
    },

    normalizeRows(rows) {
      if (!Array.isArray(rows)) return [];
      return rows.map(row => {
        if (Array.isArray(row)) return row;
        if (row && typeof row === 'object') return Object.values(row);
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
        headers.forEach((h, i) => obj[h] = r[i] ?? '');
        return obj;
      });
    },

    buildMarkdownTable(headers, rows) {
      const safeHeaders = headers.slice(0, this.MAX_PREVIEW_COLS).map(h => this.truncate(h, 60));
      const clippedRows = rows.slice(0, this.MAX_PREVIEW_ROWS).map(r =>
        r.slice(0, this.MAX_PREVIEW_COLS).map(v => this.truncate(v))
      );

      const head = `| ${safeHeaders.join(' | ')} |`;
      const sep = `| ${safeHeaders.map(() => '---').join(' | ')} |`;
      const body = clippedRows.map(r => `| ${r.map(v => String(v ?? '').replace(/\n/g, ' ')).join(' | ')} |`).join('\n');

      return [head, sep, body].filter(Boolean).join('\n');
    },

    buildSummary({ name, type, sheetNames = [], headers = [], rowCount = 0, colCount = 0 }) {
      const parts = [
        `File: ${name}`,
        `Type: ${type}`,
        rowCount ? `Rows: ${rowCount}` : null,
        colCount ? `Columns: ${colCount}` : null,
        sheetNames.length ? `Sheets: ${sheetNames.join(', ')}` : null,
        headers.length ? `Headers: ${headers.slice(0, this.MAX_PREVIEW_COLS).join(', ')}` : null
      ].filter(Boolean);

      return parts.join('\n');
    },

    async parseCSV(file) {
      await this.ensureDeps();

      const text = await file.text();
      const parsed = window.Papa.parse(text, {
        skipEmptyLines: true,
        dynamicTyping: false
      });

      const rawRows = parsed.data || [];
      if (!rawRows.length) {
        return {
          kind: 'table',
          ext: '.csv',
          name: file.name,
          summary: `File: ${file.name}\nType: CSV\nRows: 0`,
          previewMarkdown: '_Empty CSV file_',
          rowCount: 0,
          colCount: 0,
          headers: [],
          previewRows: [],
          rawTextSnippet: ''
        };
      }

      let headers = this.inferHeaders([rawRows[0]]);
      let bodyRows = rawRows.slice(1);

      const looksLikeHeader = headers.some(h => String(h).trim() !== '');
      if (!looksLikeHeader) {
        headers = rawRows[0].map((_, i) => `Column ${i + 1}`);
        bodyRows = rawRows;
      }

      const previewRows = bodyRows.slice(0, this.MAX_PREVIEW_ROWS);
      const rowCount = bodyRows.length;
      const colCount = headers.length;

      return {
        kind: 'table',
        ext: '.csv',
        name: file.name,
        summary: this.buildSummary({
          name: file.name,
          type: 'CSV',
          headers,
          rowCount,
          colCount
        }),
        previewMarkdown: this.buildMarkdownTable(headers, previewRows),
        rowCount,
        colCount,
        headers,
        previewRows,
        rawTextSnippet: text.slice(0, this.MAX_TEXT_SNIPPET)
      };
    },

    async parseExcel(file) {
      await this.ensureDeps();

      const buffer = await file.arrayBuffer();
      const wb = window.XLSX.read(buffer, { type: 'array' });
      const sheetNames = wb.SheetNames || [];
      const firstSheet = sheetNames[0];
      const ws = wb.Sheets[firstSheet];

      if (!ws) {
        return {
          kind: 'table',
          ext: file.name.toLowerCase().endsWith('.xls') ? '.xls' : '.xlsx',
          name: file.name,
          summary: `File: ${file.name}\nType: Excel workbook\nSheets: ${sheetNames.join(', ') || '0'}`,
          previewMarkdown: '_Workbook has no readable sheets_',
          rowCount: 0,
          colCount: 0,
          headers: [],
          previewRows: [],
          sheetNames,
          rawTextSnippet: ''
        };
      }

      const aoa = window.XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
      if (!aoa.length) {
        return {
          kind: 'table',
          ext: file.name.toLowerCase().endsWith('.xls') ? '.xls' : '.xlsx',
          name: file.name,
          summary: this.buildSummary({
            name: file.name,
            type: 'Excel workbook',
            sheetNames,
            rowCount: 0,
            colCount: 0
          }),
          previewMarkdown: '_Selected sheet is empty_',
          rowCount: 0,
          colCount: 0,
          headers: [],
          previewRows: [],
          sheetNames,
          rawTextSnippet: ''
        };
      }

      let headers = this.inferHeaders([aoa[0]]);
      let bodyRows = aoa.slice(1);

      const looksLikeHeader = headers.some(h => String(h).trim() !== '');
      if (!looksLikeHeader) {
        headers = aoa[0].map((_, i) => `Column ${i + 1}`);
        bodyRows = aoa;
      }

      const previewRows = bodyRows.slice(0, this.MAX_PREVIEW_ROWS);
      const rowCount = bodyRows.length;
      const colCount = headers.length;

      const objectPreview = this.rowsToObjects(previewRows, headers);
      const rawTextSnippet = JSON.stringify(objectPreview, null, 2).slice(0, this.MAX_TEXT_SNIPPET);

      return {
        kind: 'table',
        ext: file.name.toLowerCase().endsWith('.xls') ? '.xls' : '.xlsx',
        name: file.name,
        summary: this.buildSummary({
          name: file.name,
          type: 'Excel workbook',
          sheetNames,
          headers,
          rowCount,
          colCount
        }),
        previewMarkdown: this.buildMarkdownTable(headers, previewRows),
        rowCount,
        colCount,
        headers,
        previewRows,
        sheetNames,
        rawTextSnippet
      };
    },

    async parseStructuredFile(file) {
      const lower = file.name.toLowerCase();

      if (lower.endsWith('.csv')) return this.parseCSV(file);
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return this.parseExcel(file);

      return null;
    }
  };

  window.AppFiles = FILES;
})();
