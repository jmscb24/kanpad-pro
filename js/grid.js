/* Grid: hoja de cálculo local, sin dependencias ni ejecución de fórmulas como código. */
(function (root) {
  'use strict';
  const MAX_ROWS = 1000, MAX_COLS = 100;
  function columnName(col) {
    let name = '';
    for (col++; col > 0; col = Math.floor((col - 1) / 26)) name = String.fromCharCode(65 + (col - 1) % 26) + name;
    return name;
  }
  const address = (r, c) => columnName(c) + (r + 1);
  function position(ref) {
    const m = /^([A-Z]+)([1-9]\d*)$/i.exec(ref.replace(/\$/g, ''));
    if (!m) throw Error('#REF!');
    let col = 0;
    for (const char of m[1].toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64;
    const row = Number(m[2]) - 1;
    if (col > MAX_COLS || row >= MAX_ROWS) throw Error('#REF!');
    return [row, col - 1];
  }
  function createData() { return { rows: 50, cols: 26, cells: {} }; }
  function numeric(value) {
    if (typeof value === 'number') return value;
    if (value === '') return 0;
    if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(String(value).trim())) throw Error('#VALUE!');
    return Number(String(value).replace(',', '.'));
  }
  function evaluate(data, ref, stack = new Set(), cache = new Map()) {
    ref = ref.replace(/\$/g, '').toUpperCase();
    const [r, c] = position(ref);
    if (r >= data.rows || c >= data.cols) throw Error('#REF!');
    if (cache.has(ref)) return cache.get(ref);
    if (stack.has(ref) || stack.size > 150) throw Error('#CYCLE!');
    const raw = data.cells[ref]?.value || '';
    if (!raw.startsWith('=')) return raw;
    stack.add(ref);
    try {
      const source = raw.slice(1).toUpperCase();
      const tokens = source.match(/\s+|(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?|\$?[A-Z]+\$?\d+|[A-Z_]+|[()+\-*/^,:;]/g) || [];
      if (tokens.join('') !== source) throw Error('#ERROR!');
      const t = tokens.filter(x => !/^\s+$/.test(x));
      let i = 0;
      const requireToken = x => { if (t[i++] !== x) throw Error('#ERROR!'); };
      const cell = key => evaluate(data, key, stack, cache);
      const aliases = { SUMA: 'SUM', PROMEDIO: 'AVERAGE', CONTAR: 'COUNT' };
      function atom() {
        const token = t[i++];
        if (token === '(') { const n = expr(); requireToken(')'); return n; }
        if (/^(?:\d|\.)/.test(token || '')) return Number(token);
        if (/^\$?[A-Z]+\$?\d+$/.test(token || '')) return numeric(cell(token));
        if (/^[A-Z_]+$/.test(token || '')) {
          const name = aliases[token] || token;
          if (!['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT'].includes(name)) throw Error('#NAME?');
          requireToken('(');
          const values = [];
          function collect(v) {
            if (v !== '') { try { values.push(numeric(v)); } catch { /* Texto de rangos omitido. */ } }
          }
          if (t[i] !== ')') {
            do {
              if (/^\$?[A-Z]+\$?\d+$/.test(t[i] || '') && t[i + 1] === ':') {
                const [r1, c1] = position(t[i]); i += 2;
                const [r2, c2] = position(t[i++]);
                for (let row = Math.min(r1, r2); row <= Math.max(r1, r2); row++) {
                  for (let col = Math.min(c1, c2); col <= Math.max(c1, c2); col++) collect(cell(address(row, col)));
                }
              } else if (/^\$?[A-Z]+\$?\d+$/.test(t[i] || '') && [')', ',', ';'].includes(t[i + 1])) {
                collect(cell(t[i++]));
              } else values.push(expr());
              if (![',', ';'].includes(t[i])) break;
              i++;
            } while (true);
          }
          requireToken(')');
          const sum = values.reduce((a, b) => a + b, 0);
          if (name === 'COUNT') return values.length;
          if (name === 'AVERAGE') { if (!values.length) throw Error('#DIV/0!'); return sum / values.length; }
          if (name === 'MIN') return values.length ? Math.min(...values) : 0;
          if (name === 'MAX') return values.length ? Math.max(...values) : 0;
          return sum;
        }
        throw Error('#ERROR!');
      }
      function power() { let n = atom(); if (t[i] === '^') { i++; n **= unary(); } return n; }
      function unary() { if (t[i] === '+') { i++; return unary(); } if (t[i] === '-') { i++; return -unary(); } return power(); }
      function product() {
        let n = unary();
        while (t[i] === '*' || t[i] === '/') {
          const op = t[i++], v = unary();
          if (op === '/' && v === 0) throw Error('#DIV/0!');
          n = op === '*' ? n * v : n / v;
        }
        return n;
      }
      function expr() { let n = product(); while (t[i] === '+' || t[i] === '-') { const op = t[i++], v = product(); n = op === '+' ? n + v : n - v; } return n; }
      const result = expr();
      if (i !== t.length || !Number.isFinite(result)) throw Error('#ERROR!');
      cache.set(ref, result);
      return result;
    } finally { stack.delete(ref); }
  }
  function result(data, ref, cache) { try { return evaluate(data, ref, new Set(), cache); } catch (e) { return e.message.startsWith('#') ? e.message : '#ERROR!'; } }
  function parseDelimited(text, delimiter) {
    text = text.replace(/^\uFEFF/, '');
    if (!delimiter) {
      // Detectar el separador fuera de comillas de la primera fila lógica.
      const counts = { ',': 0, ';': 0, '\t': 0 }; let quoted = false;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
        else if (!quoted) { if (text[i] === '\n' || text[i] === '\r') break; if (text[i] in counts) counts[text[i]]++; }
      }
      delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    }
    const rows = []; let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' && (quoted || field === '')) {
        if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
      } else if (!quoted && ch === delimiter) { row.push(field); field = ''; }
      else if (!quoted && (ch === '\n' || ch === '\r')) { row.push(field); rows.push(row); row = []; field = ''; if (ch === '\r' && text[i + 1] === '\n') i++; }
      else field += ch;
    }
    if (quoted) throw Error('CSV no válido: comillas sin cerrar.');
    if (field || row.length || !rows.length) { row.push(field); rows.push(row); }
    return rows;
  }
  const quote = (v, delimiter) => { v = String(v); return v.includes(delimiter) || /["\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  function toCSV(data) {
    let lastRow = 0, lastCol = 0;
    Object.keys(data.cells).forEach(ref => { if (data.cells[ref].value) { const [r, c] = position(ref); lastRow = Math.max(r, lastRow); lastCol = Math.max(c, lastCol); } });
    const cache = new Map();
    return '\uFEFF' + Array.from({ length: lastRow + 1 }, (_, r) => Array.from({ length: lastCol + 1 }, (_, c) => {
      let value = String(result(data, address(r, c), cache));
      // CSV exporta resultados; evitar interpretar texto como fórmulas al abrirlo.
      if (/^[=+\-@\t\r]/.test(value) && !Number.isFinite(Number(value))) value = "'" + value;
      return quote(value, ',');
    }).join(',')).join('\r\n');
  }

  class Editor {
    constructor(onChange, onStats, toast, confirm) {
      this.confirm = confirm;
      this.onChange = onChange; this.onStats = onStats; this.toast = toast;
      this.table = document.getElementById('gridTable');
      this.formula = document.getElementById('gridFormula');
      this.addressInput = document.getElementById('gridAddress');
      this.viewport = document.getElementById('gridViewport');
      this.data = createData(); this.active = [0, 0]; this.anchor = [0, 0]; this.undoStack = []; this.redoStack = [];
      this.bind();
    }
    load(data) {
      this.data = JSON.parse(JSON.stringify(data || createData()));
      this.active = [0, 0]; this.anchor = [0, 0]; this.undoStack = []; this.redoStack = [];
      this.render(); this.viewport.scrollTop = 0; this.viewport.scrollLeft = 0;
    }
    snapshot() { return JSON.parse(JSON.stringify(this.data)); }
    commit(change) {
      const before = JSON.stringify(this.data);
      change();
      if (before !== JSON.stringify(this.data)) {
        this.undoStack.push(before); if (this.undoStack.length > 40) this.undoStack.shift();
        this.redoStack = []; this.render(); this.onChange();
      }
    }
    history(redo) {
      const from = redo ? this.redoStack : this.undoStack, to = redo ? this.undoStack : this.redoStack;
      if (!from.length) return;
      to.push(JSON.stringify(this.data)); this.data = JSON.parse(from.pop());
      this.active = [Math.min(this.active[0], this.data.rows - 1), Math.min(this.active[1], this.data.cols - 1)];
      this.anchor = [...this.active]; this.render(); this.onChange();
    }
    bounds() { return [Math.min(this.active[0], this.anchor[0]), Math.min(this.active[1], this.anchor[1]), Math.max(this.active[0], this.anchor[0]), Math.max(this.active[1], this.anchor[1])]; }
    eachSelected(fn) { const [r1, c1, r2, c2] = this.bounds(); for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) fn(address(r, c)); }
    setValue(ref, value) {
      const cell = { ...this.data.cells[ref], value };
      if (!value && !cell.bold && !cell.format) delete this.data.cells[ref]; else this.data.cells[ref] = cell;
    }
    render() {
      const header = this.table.createTHead(); header.replaceChildren();
      const tr = header.insertRow(); const corner = document.createElement('th'); corner.className = 'grid-corner'; tr.append(corner);
      for (let c = 0; c < this.data.cols; c++) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = columnName(c); tr.append(th); }
      const body = document.createElement('tbody'), cache = new Map();
      for (let r = 0; r < this.data.rows; r++) {
        const row = body.insertRow(), th = document.createElement('th'); th.scope = 'row'; th.textContent = r + 1; row.append(th);
        for (let c = 0; c < this.data.cols; c++) {
          const td = row.insertCell(), ref = address(r, c), cell = this.data.cells[ref] || {};
          const v = result(this.data, ref, cache); td.dataset.ref = ref; td.tabIndex = -1; td.setAttribute('role', 'gridcell'); td.setAttribute('aria-label', ref);
          td.textContent = String(v); td.title = cell.value || '';
          let n; try { n = v === '' ? NaN : numeric(v); } catch { n = NaN; }
          if (Number.isFinite(n)) {
            td.classList.add('grid-numeric');
            const formats = { number: { minimumFractionDigits: 2, maximumFractionDigits: 2 }, currency: { style: 'currency', currency: 'EUR' }, percent: { style: 'percent', maximumFractionDigits: 2 } };
            td.textContent = new Intl.NumberFormat('es-ES', formats[cell.format] || { maximumFractionDigits: 10 }).format(n);
          }
          if (String(v).startsWith('#')) td.classList.add('grid-error');
          if (cell.bold) td.style.fontWeight = '700';
        }
      }
      if (this.table.tBodies[0]) this.table.tBodies[0].replaceWith(body); else this.table.append(body);
      this.paintSelection();
      document.getElementById('gridUndo').disabled = !this.undoStack.length;
      document.getElementById('gridRedo').disabled = !this.redoStack.length;
      this.onStats();
    }
    paintSelection() {
      const [r1, c1, r2, c2] = this.bounds(), ref = address(...this.active), numbers = [];
      this.table.querySelectorAll('td').forEach(td => {
        const [r, c] = position(td.dataset.ref), selected = r >= r1 && r <= r2 && c >= c1 && c <= c2;
        td.classList.toggle('grid-selected', selected); td.classList.toggle('grid-active', td.dataset.ref === ref);
        td.setAttribute('aria-selected', String(selected)); td.tabIndex = td.dataset.ref === ref ? 0 : -1;
        if (selected) { const v = result(this.data, td.dataset.ref); if (v !== '') { try { numbers.push(numeric(v)); } catch {} } }
      });
      const cell = this.data.cells[ref] || {};
      this.addressInput.value = r1 === r2 && c1 === c2 ? ref : `${address(r1, c1)}:${address(r2, c2)}`;
      this.formula.value = cell.value || '';
      document.getElementById('gridBold').setAttribute('aria-pressed', String(!!cell.bold));
      document.getElementById('gridFormat').value = cell.format || 'auto';
      const count = (r2 - r1 + 1) * (c2 - c1 + 1);
      document.getElementById('gridSummary').textContent = `${count} celda${count === 1 ? '' : 's'}${numbers.length ? ' · Suma: ' + new Intl.NumberFormat('es-ES', { maximumFractionDigits: 8 }).format(numbers.reduce((a, b) => a + b, 0)) : ''}`;
    }
    select(r, c, extend = false, focus = true) {
      this.active = [Math.max(0, Math.min(this.data.rows - 1, r)), Math.max(0, Math.min(this.data.cols - 1, c))];
      if (!extend) this.anchor = [...this.active];
      this.paintSelection(); if (focus) this.focus();
    }
    focus() { this.table.querySelector(`[data-ref="${address(...this.active)}"]`)?.focus({ preventScroll: true }); this.table.querySelector('.grid-active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    edit(initial) {
      const ref = address(...this.active), td = this.table.querySelector(`[data-ref="${ref}"]`);
      if (!td || td.querySelector('input')) return;
      const input = document.createElement('input'); input.className = 'grid-cell-input'; input.setAttribute('aria-label', 'Editar ' + ref); input.value = initial === undefined ? this.data.cells[ref]?.value || '' : initial;
      td.replaceChildren(input); input.focus(); if (initial === undefined) input.select();
      let finished = false;
      const finish = (save, move) => {
        if (finished) return; finished = true;
        if (save) this.commit(() => this.setValue(ref, input.value));
        this.render();
        if (move) this.select(this.active[0] + move[0], this.active[1] + move[1]);
      };
      input.addEventListener('input', () => { this.formula.value = input.value; });
      input.addEventListener('blur', () => finish(true));
      input.addEventListener('keydown', e => {
        if (['Escape', 'Enter', 'Tab'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); finish(e.key !== 'Escape', e.key === 'Tab' ? [0, e.shiftKey ? -1 : 1] : e.key === 'Enter' ? [e.shiftKey ? -1 : 1, 0] : [0, 0]); }
      });
    }
    paste(text, delimiter, replace = false) {
      const rows = parseDelimited(text, delimiter), [r, c] = replace ? [0, 0] : this.bounds();
      if (r + rows.length > MAX_ROWS || c + Math.max(...rows.map(row => row.length)) > MAX_COLS) throw Error(`El límite es de ${MAX_ROWS} filas y ${MAX_COLS} columnas.`);
      this.commit(() => {
        if (replace) this.data = createData();
        this.data.rows = Math.max(this.data.rows, r + rows.length);
        this.data.cols = Math.max(this.data.cols, c + Math.max(...rows.map(row => row.length)));
        rows.forEach((row, y) => row.forEach((value, x) => this.setValue(address(r + y, c + x), value)));
        this.anchor = [r, c]; this.active = [r + rows.length - 1, c + Math.max(...rows.map(row => row.length)) - 1];
      });
    }
    selectedText() {
      const [r1, c1, r2, c2] = this.bounds();
      return Array.from({ length: r2 - r1 + 1 }, (_, r) => Array.from({ length: c2 - c1 + 1 }, (_, c) => quote(this.data.cells[address(r1 + r, c1 + c)]?.value || '', '\t')).join('\t')).join('\n');
    }
    bind() {
      this.table.addEventListener('click', e => { const td = e.target.closest('td'); if (td && e.target.tagName !== 'INPUT') this.select(...position(td.dataset.ref), e.shiftKey); });
      this.table.addEventListener('dblclick', e => { if (e.target.closest('td')) this.edit(); });
      this.table.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT') return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && ['z', 'y'].includes(e.key.toLowerCase())) { e.preventDefault(); this.history(e.key.toLowerCase() === 'y' || e.shiftKey); this.focus(); return; }
        if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); this.anchor = [0, 0]; this.active = [this.data.rows - 1, this.data.cols - 1]; this.paintSelection(); return; }
        if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); document.getElementById('gridBold').click(); return; }
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [e.shiftKey ? -1 : 1, 0], Tab: [0, e.shiftKey ? -1 : 1] };
        if (moves[e.key]) { e.preventDefault(); const [dr, dc] = moves[e.key]; this.select(this.active[0] + dr, this.active[1] + dc, e.shiftKey && e.key.startsWith('Arrow')); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.commit(() => this.eachSelected(ref => this.setValue(ref, ''))); this.focus(); }
        else if (e.key === 'F2') { e.preventDefault(); this.edit(); }
        else if (!mod && !e.altKey && e.key.length === 1) { e.preventDefault(); this.edit(e.key); }
      });
      this.table.addEventListener('copy', e => { if (e.target.tagName === 'INPUT') return; e.preventDefault(); e.clipboardData.setData('text/plain', this.selectedText()); });
      this.table.addEventListener('cut', e => { if (e.target.tagName === 'INPUT') return; e.preventDefault(); e.clipboardData.setData('text/plain', this.selectedText()); this.commit(() => this.eachSelected(ref => this.setValue(ref, ''))); this.focus(); });
      this.table.addEventListener('paste', e => { if (e.target.tagName === 'INPUT') return; e.preventDefault(); try { this.paste(e.clipboardData.getData('text/plain'), '\t'); this.focus(); } catch (err) { this.toast(err.message, 'error'); } });
      this.formula.addEventListener('change', () => { const ref = address(...this.active); this.commit(() => this.setValue(ref, this.formula.value)); });
      this.formula.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this.formula.blur(); this.focus(); }
        if (e.key === 'Escape') { this.formula.value = this.data.cells[address(...this.active)]?.value || ''; this.focus(); }
      });
      this.addressInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); try { const [r, c] = position(this.addressInput.value.trim()); if (r >= this.data.rows || c >= this.data.cols) throw Error('#REF!'); this.select(r, c); } catch { this.toast('Indica una celda existente, por ejemplo B3.', 'error'); } } });
      document.getElementById('gridUndo').onclick = () => this.history(false);
      document.getElementById('gridRedo').onclick = () => this.history(true);
      document.getElementById('gridBold').onclick = () => { const bold = !this.data.cells[address(...this.active)]?.bold; this.commit(() => this.eachSelected(ref => { this.data.cells[ref] = { ...this.data.cells[ref], bold }; })); };
      document.getElementById('gridFormat').onchange = e => { const format = e.target.value; this.commit(() => this.eachSelected(ref => { this.data.cells[ref] = { ...this.data.cells[ref], format }; })); };
      for (const [id, prop, limit] of [['gridAddRow', 'rows', MAX_ROWS], ['gridAddCol', 'cols', MAX_COLS]]) document.getElementById(id).onclick = () => {
        if (this.data[prop] >= limit) { this.toast(`Límite: ${limit} ${prop === 'rows' ? 'filas' : 'columnas'}.`, 'info'); return; }
        this.commit(() => this.data[prop]++);
      };
      document.getElementById('gridImport').onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        try {
          if (file.size > 5 * 1024 * 1024) throw Error('El archivo no puede superar 5 MB.');
          const text = await file.text();
          if (Object.keys(this.data.cells).length && !await this.confirm('Importar reemplazará los datos de esta hoja. Puedes deshacerlo. ¿Continuar?')) return;
          this.paste(text, file.name.toLowerCase().endsWith('.tsv') ? '\t' : undefined, true);
          this.toast('Hoja importada', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
        finally { e.target.value = ''; }
      };
    }
  }
  root.KanPadGrid = { Editor, createData, evaluate, result, columnName, address, position, parseDelimited, toCSV };
  if (typeof module !== 'undefined') module.exports = root.KanPadGrid;
})(typeof window === 'undefined' ? globalThis : window);
