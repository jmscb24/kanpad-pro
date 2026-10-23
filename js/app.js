/**
 * KanPad Pro - Aplicación Principal
 * El bloc de notas avanzado para Kanlane:
 * Documentos enriquecidos (tipo Word/Docs) con tablas + Editor de código (tipo Notepad++) con formateo inteligente.
 */

(function () {
  'use strict';

  // Estado de la aplicación
  const state = {
    wh: null,                // Instancia de Kanlane SDK si está conectado
    ready: false,
    dirty: false,
    isStandalone: false,     // Modo de desarrollo/local
    isHome: true,
    folders: [],
    activeFolder: 'all',
    homeSort: 'updated',
    notes: [],               // Lista de notas y documentos
    currentNoteId: null,     // ID de la nota activa
    currentMode: 'doc',      // 'doc' | 'code' | 'grid'
    activeFilter: 'all',     // 'all' | 'doc' | 'code' | 'grid'
    searchQuery: '',
    autosaveTimer: null,
    isSaving: false
  };

  // Elementos del DOM
  const DOM = {
    // Header
    noteTitleInput: document.getElementById('noteTitleInput'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    btnSave: document.getElementById('btnSave'),
    btnNewNote: document.getElementById('btnNewNote'),
    btnExport: document.getElementById('btnExport'),
    btnKanlaneTasks: document.getElementById('btnKanlaneTasks'),
    btnToggleSidebar: document.getElementById('btnToggleSidebar'),
    sidebar: document.getElementById('sidebar'),
    notesList: document.getElementById('notesList'),
    searchInput: document.getElementById('searchInput'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    // Views
    docViewport: document.getElementById('docViewport'),
    docSheet: document.getElementById('docSheet'),
    docToolbar: document.getElementById('docToolbar'),
    codeContainer: document.getElementById('codeContainer'),
    codeTextarea: document.getElementById('codeTextarea'),
    codeLineNumbers: document.getElementById('codeLineNumbers'),
    codeLangSelect: document.getElementById('codeLangSelect'),
    btnFormatCode: document.getElementById('btnFormatCode'),
    btnCopyCode: document.getElementById('btnCopyCode'),
    // Modals
    taskModal: document.getElementById('taskModal'),
    taskListContainer: document.getElementById('taskListContainer'),
    tableModal: document.getElementById('tableModal'),
    tableRowsInput: document.getElementById('tableRowsInput'),
    tableColsInput: document.getElementById('tableColsInput'),
    btnConfirmTable: document.getElementById('btnConfirmTable'),
    // Status bar
    statusMode: document.getElementById('statusMode'),
    statusWords: document.getElementById('statusWords'),
    statusCursor: document.getElementById('statusCursor'),
    statusSaveMsg: document.getElementById('statusSaveMsg'),
    statusDot: document.getElementById('statusDot')
  };

  /* ==========================================================================
     Inicialización e Integración con Kanlane SDK
     ========================================================================== */
  let grid;
  let savedDocRange = null;
  let manageAction = null;
  let store;
  let saving = null;
  let saveAgain = false;
  let projectGeneration = 0;
  let saveTask = 0;
  let savedInKanlane = false;
  const MANIFEST = {
    id: 'com.yalerooo.kanpad-pro', name: 'KanPad Pro', version: '1.3.0',
    description: 'Notas, documentos, código y hojas Grid organizados en carpetas del proyecto. Sigue la apariencia de Kanlane.',
    author: 'Javier', homepage: 'https://github.com/jmscb24/kanpad-pro', icon: 'book', color: 214,
    permissions: ['storage', 'tasks:read', 'ui:extend']
  };
  const has = permission => !!state.wh?.has(permission);
  function connectionMessage(message, retry = false) {
    document.getElementById('connectionState').hidden = false;
    document.getElementById('connectionMessage').textContent = message;
    document.getElementById('btnRetryConnection').hidden = !retry;
    document.querySelector('.kanpad-app').hidden = true;
  }
  async function init() {
    document.getElementById('btnRetryConnection').onclick = () => location.reload();
    state.isStandalone = window.parent === window;
    try {
      if (!state.isStandalone) {
        if (!window.WorkhubPlugin) throw Error('No se ha cargado el SDK de Kanlane. Revisa la conexión y vuelve a abrir el plugin.');
        state.wh = await WorkhubPlugin.connect(MANIFEST);
        // Las instalaciones antiguas con ui:extend tienen una segunda instancia oculta.
        // No debe cargar ni guardar una biblioteca ni abrir el editor.
        if (state.wh.isBackground) {
          document.getElementById('connectionState').hidden = true;
          if (has('ui:extend')) {
            await state.wh.ui.addButton({ id: 'abrir-kanpad', location: 'command', label: 'Abrir KanPad Pro', icon: 'book' });
            state.wh.on('action', ({ id }) => { if (id === 'abrir-kanpad') state.wh.ui.openPanel().catch(() => {}); });
          }
          return;
        }
        if (!has('storage')) throw Error('Activa el permiso «Guardar sus propios datos» en los permisos de KanPad Pro en Kanlane.');
        state.wh.on('project', reloadProject);
        state.wh.on('storage', async event => {
          if (event.scope === 'user' || !['kanpad_library_v2', 'kanpad_notes', 'kanpad_folders'].includes(event.key)) return;
          if (state.dirty || saving || KanPadDialogs.isOpen) { showToast('Hay cambios en otra ventana. Guarda tus cambios antes de volver a abrir el plugin.', 'important'); return; }
          await reloadProject();
        });
      }
      store = new KanPadStorage(state.wh);
      grid = new KanPadGrid.Editor(() => {
        updateCurrentNoteFromView(); triggerAutosave(); renderNotesList(); updateStats();
      }, updateStats, showToast, message => KanPadDialogs.confirm(message, 'Importar hoja'));
      setupEventListeners(); updateLineNumbers();
      await loadNotes();
      state.ready = true;
      document.getElementById('connectionState').hidden = true;
      document.querySelector('.kanpad-app').hidden = false;
      document.getElementById('envBadge').textContent = state.isStandalone ? 'LOCAL' : 'KANLANE';
      document.getElementById('projectName').textContent = state.wh?.context.project?.name || '';
      DOM.btnKanlaneTasks.hidden = !has('tasks:read');
      showHome();
    } catch (error) {
      state.ready = false;
      connectionMessage('No se pudo abrir KanPad: ' + error.message, true);
    }
  }

  async function reloadProject() {
    if (!store) return;
    const generation = ++projectGeneration;
    saveTask++; saving = null; saveAgain = false;
    state.ready = false; state.dirty = false; clearTimeout(state.autosaveTimer);
    store.invalidate(); state.currentNoteId = null; state.isHome = true;
    savedDocRange = null; closeModals(); KanPadDialogs.cancel();
    connectionMessage('Cargando las notas del proyecto…');
    try {
      await loadNotes();
      if (generation !== projectGeneration) return;
      state.activeFolder = 'all'; state.activeFilter = 'all'; state.searchQuery = '';
      DOM.searchInput.value = ''; DOM.filterTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.filter === 'all'));
      document.getElementById('projectName').textContent = state.wh?.context.project?.name || '';
      state.ready = true;
      document.getElementById('connectionState').hidden = true;
      document.querySelector('.kanpad-app').hidden = false;
      showHome();
    } catch (error) { if (generation === projectGeneration) connectionMessage('No se pudieron cargar las notas: ' + error.message, true); }
  }

  async function loadNotes() {
    const library = await store.load();
    state.notes = library.notes;
    state.folders = library.folders;
    state.notes.forEach(note => { if (!state.folders.some(folder => folder.id === note.folderId)) note.folderId = null; });
  }

  async function saveNotes() {
    if (!state.ready) return false;
    updateCurrentNoteFromView();
    if (saving) { saveAgain = true; return saving; }
    const generation = projectGeneration, task = ++saveTask;
    saving = (async () => {
      try {
        do {
          saveAgain = false;
          setSavingStatus(true);
          const snapshot = { notes: state.notes, folders: state.folders };
          const serialized = JSON.stringify(snapshot);
          await store.save(snapshot);
          if (generation !== projectGeneration) return false;
          updateCurrentNoteFromView();
          if (serialized !== JSON.stringify({ notes: state.notes, folders: state.folders })) saveAgain = true;
        } while (saveAgain);
        state.dirty = false; savedInKanlane = !state.isStandalone;
        setSavingStatus(false); return true;
      } catch (error) {
        if (generation !== projectGeneration) return false;
        state.dirty = true; state.isSaving = false;
        DOM.statusDot.classList.remove('saving'); DOM.statusSaveMsg.textContent = 'Sin guardar · ' + error.message;
        showToast('No se pudo guardar: ' + error.message, 'error'); return false;
      } finally { if (task === saveTask) saving = null; }
    })();
    return saving;
  }

  function setSavingStatus(saving) {
    state.isSaving = saving;
    if (DOM.statusDot) {
      if (saving) {
        DOM.statusDot.classList.add('saving');
        DOM.statusSaveMsg.textContent = 'Guardando...';
      } else {
        DOM.statusDot.classList.remove('saving');
        DOM.statusSaveMsg.textContent = savedInKanlane ? 'Guardado en Kanlane' : 'Guardado localmente';
      }
    }
  }

  function triggerAutosave() {
    state.dirty = true;
    setSavingStatus(true);
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(() => {
      saveNotes(true);
    }, 1500);
  }

  /* ==========================================================================
     Gestión de Notas
     ========================================================================== */
  function newId(prefix) {
    return prefix + '_' + (window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  function showHome() {
    updateCurrentNoteFromView();
    clearTimeout(state.autosaveTimer);
    state.isHome = true;
    state.currentNoteId = null;
    savedDocRange = null;
    document.querySelector('.kanpad-app').classList.add('is-home');
    DOM.btnNewNote.querySelector('span').textContent = 'Nueva nota';
    renderNotesList();
    updateStats();
    saveNotes();
  }

  function renderHome() {
    KanPadHome.render({
      notes: state.notes, visibleNotes: filteredNotes(), folders: state.folders,
      activeFolder: state.activeFolder, sort: state.homeSort,
      actions: {
        open: selectNote,
        folder(id) {
          state.activeFolder = id; renderNotesList();
          if (window.matchMedia('(max-width: 700px)').matches) { DOM.sidebar.classList.add('is-collapsed'); DOM.btnToggleSidebar.setAttribute('aria-expanded', 'false'); }
        },
        createFolder() { manage('createFolder'); },
        renameFolder(folder) { manage('renameFolder', folder); },
        deleteFolder,
        rename(note) { manage('renameNote', note); },
        move(note) { manage('moveNote', note); },
        duplicate(note) {
          const copy = JSON.parse(JSON.stringify(note));
          copy.id = newId('note'); copy.title += ' (copia)'; copy.updatedAt = new Date().toISOString();
          state.notes.unshift(copy); saveNotes(); renderNotesList(); updateStats();
        },
        delete: deleteNote
      }
    });
  }

  function manage(action, item = null) {
    manageAction = { action, id: item?.id };
    const input = document.getElementById('manageName'), select = document.getElementById('manageFolder');
    const moving = action === 'moveNote';
    const titles = { createFolder: 'Nueva carpeta', renameFolder: 'Renombrar carpeta', renameNote: 'Renombrar nota', moveNote: 'Mover nota' };
    document.getElementById('manageTitle').textContent = titles[action];
    document.getElementById('manageLabel').textContent = moving ? 'Carpeta de destino' : 'Nombre';
    document.getElementById('manageLabel').htmlFor = moving ? 'manageFolder' : 'manageName';
    document.getElementById('manageError').textContent = '';
    input.hidden = moving; input.disabled = moving;
    input.value = item?.name || item?.title || '';
    select.hidden = !moving; select.disabled = !moving; select.replaceChildren();
    if (moving) {
      const option = new Option('Sin carpeta', ''); select.append(option);
      state.folders.forEach(folder => select.append(new Option(folder.name, folder.id)));
      select.value = item.folderId || '';
    }
    document.getElementById('manageModal').classList.add('active');
    if (moving) select.focus(); else { input.focus(); input.select(); }
  }

  function confirmManage(event) {
    event.preventDefault();
    if (!manageAction) return;
    const { action, id } = manageAction;
    const name = document.getElementById('manageName').value.trim();
    const folderAction = action === 'createFolder' || action === 'renameFolder';
    if (action !== 'moveNote' && !name) { document.getElementById('manageError').textContent = 'Escribe un nombre.'; return; }
    if (folderAction && state.folders.some(f => f.id !== id && f.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) {
      document.getElementById('manageError').textContent = 'Ya existe una carpeta con ese nombre.'; return;
    }
    if (action === 'createFolder') {
      const folder = { id: newId('folder'), name }; state.folders.push(folder); state.activeFolder = folder.id;
    } else if (action === 'renameFolder') {
      const folder = state.folders.find(f => f.id === id); if (folder) folder.name = name;
    } else {
      const note = state.notes.find(n => n.id === id);
      if (note) {
        if (action === 'moveNote') note.folderId = document.getElementById('manageFolder').value || null;
        else note.title = name;
        note.updatedAt = new Date().toISOString();
      }
    }
    closeModals(); saveNotes(); renderNotesList(); updateStats();
  }

  async function deleteFolder(folder) {
    const count = state.notes.filter(n => n.folderId === folder.id).length;
    if (!await KanPadDialogs.confirm(`¿Eliminar la carpeta "${folder.name}"?${count ? ' Sus ' + count + ' notas pasarán a «Sin carpeta».' : ''}`, 'Eliminar carpeta', 'Eliminar')) return;
    state.notes.forEach(note => { if (note.folderId === folder.id) note.folderId = null; });
    state.folders = state.folders.filter(f => f.id !== folder.id);
    if (state.activeFolder === folder.id) state.activeFolder = 'unfiled';
    saveNotes(); renderNotesList(); updateStats();
  }

  function rememberDocSelection() {
    if (state.isHome || state.currentMode !== 'doc') return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount && DOM.docSheet.contains(selection.anchorNode) && DOM.docSheet.contains(selection.focusNode)) savedDocRange = selection.getRangeAt(0).cloneRange();
  }

  function restoreDocSelection() {
    const storedRange = savedDocRange?.cloneRange();
    DOM.docSheet.focus();
    const selection = window.getSelection();
    const range = storedRange && DOM.docSheet.contains(storedRange.commonAncestorContainer) ? storedRange.cloneRange() : document.createRange();
    if (!storedRange || !DOM.docSheet.contains(range.commonAncestorContainer)) { range.selectNodeContents(DOM.docSheet); range.collapse(false); }
    selection.removeAllRanges(); selection.addRange(range);
  }

  function insertDocHTML(html) {
    restoreDocSelection();
    if (!document.execCommand('insertHTML', false, html)) {
      const range = window.getSelection().getRangeAt(0);
      range.deleteContents();
      const fragment = range.createContextualFragment(html), last = fragment.lastChild;
      range.insertNode(fragment);
      if (last) { range.setStartAfter(last); range.collapse(true); window.getSelection().removeAllRanges(); window.getSelection().addRange(range); }
    }
    rememberDocSelection(); updateCurrentNoteFromView(); triggerAutosave(); updateStats(); renderNotesList();
  }

  function createNewNote(type = 'doc') {
    state.activeFilter = 'all'; state.searchQuery = ''; DOM.searchInput.value = '';
    DOM.filterTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.filter === 'all'));
    const isCode = type === 'code';
    const newNote = {
      id: newId('note'),
      folderId: state.folders.some(f => f.id === state.activeFolder) ? state.activeFolder : null,
      title: type === 'grid' ? 'Nueva hoja de cálculo' : isCode ? 'nuevo_script.js' : 'Nuevo Documento',
      type: type,
      language: isCode ? 'javascript' : 'markdown',
      updatedAt: new Date().toISOString(),
      content: isCode ? '' : '<h1>Nuevo Documento</h1><p>Escribe aquí tu contenido...</p>',
      rawCode: isCode ? '// Nuevo archivo de código\n' : ''
    };

    if (type === 'grid') newNote.grid = KanPadGrid.createData();
    state.notes.unshift(newNote);
    renderNotesList();
    selectNote(newNote.id);
    saveNotes();

    // Enfocar el título
    DOM.noteTitleInput.focus();
    DOM.noteTitleInput.select();
  }

  function selectNote(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    // Guardar cambios de la nota anterior si existía
    if (state.currentNoteId && state.currentNoteId !== id) {
      updateCurrentNoteFromView();
    }

    if (window.matchMedia('(max-width: 700px)').matches) { DOM.sidebar.classList.add('is-collapsed'); DOM.btnToggleSidebar.setAttribute('aria-expanded', 'false'); }
    state.currentNoteId = id;
    DOM.noteTitleInput.value = note.title;

    savedDocRange = null;
    state.isHome = false;
    document.querySelector('.kanpad-app').classList.remove('is-home');

    // Cambiar modo automáticamente según el tipo de nota
    if (note.type === 'code') {
      DOM.codeTextarea.value = note.rawCode || '';
      DOM.codeLangSelect.value = note.language || 'javascript';
      setMode('code');
    } else if (note.type === 'grid') {
      grid.load(note.grid);
      setMode('grid');
    } else {
      DOM.docSheet.innerHTML = note.content || '';
      setMode('doc');
    }

    renderNotesList();
    updateStats();
  }

  async function deleteNote(id, event) {
    if (event) event.stopPropagation();

    const note = state.notes.find(n => n.id === id);
    const confirmMsg = `¿Deseas eliminar "${note ? note.title : 'esta nota'}"?`;
    if (!await KanPadDialogs.confirm(confirmMsg, 'Eliminar nota', 'Eliminar')) return;

    state.notes = state.notes.filter(n => n.id !== id);

    if (state.currentNoteId === id) {
      state.currentNoteId = null;
      showHome();
    } else {
      renderNotesList();
    }

    saveNotes();
    updateStats();
    showToast('Nota eliminada', 'info');
  }

  function updateCurrentNoteFromView() {
    if (state.isHome) return;
    const note = state.notes.find(n => n.id === state.currentNoteId);
    if (!note) return;

    const before = JSON.stringify(note);
    note.title = DOM.noteTitleInput.value.trim() || 'Sin título';

    if (state.currentMode === 'code') {
      note.rawCode = DOM.codeTextarea.value;
      note.language = DOM.codeLangSelect.value;
      note.type = 'code';
    } else if (state.currentMode === 'grid') {
      note.grid = grid.snapshot();
      note.type = 'grid';
    } else {
      note.content = DOM.docSheet.innerHTML;
      note.type = 'doc';
    }
    if (JSON.stringify(note) !== before) { note.updatedAt = new Date().toISOString(); state.dirty = true; }
  }

  function filteredNotes() {
    const query = state.searchQuery.toLowerCase();
    const filtered = state.notes.filter(note => {
      const matchFilter = state.activeFilter === 'all' || note.type === state.activeFilter;
      const matchSearch = !query || note.title.toLowerCase().includes(query) ||
        (note.content && note.content.toLowerCase().includes(query)) ||
        (note.rawCode && note.rawCode.toLowerCase().includes(query)) ||
        (note.grid && Object.values(note.grid.cells).some(cell => (cell.value || '').toLowerCase().includes(query)));
      const matchFolder = state.activeFolder === 'all' || (state.activeFolder === 'unfiled' ? !note.folderId : note.folderId === state.activeFolder);
      return matchFilter && matchSearch && matchFolder;
    });

    return filtered;
  }

  function renderNotesList() {
    renderHome();
    const filtered = filteredNotes();
    DOM.notesList.innerHTML = '';

    if (filtered.length === 0) {
      DOM.notesList.innerHTML = `
        <div style="padding: 24px 10px; text-align: center; color: var(--ink-faint); font-size: 12px;">
          No se encontraron notas
        </div>
      `;
      return;
    }

    filtered.forEach(note => {
      const isSelected = note.id === state.currentNoteId;
      const item = document.createElement('div');
      item.className = `note-item ${isSelected ? 'active' : ''}`;
      item.onclick = () => selectNote(note.id);

      // Limpiar preview
      let previewText = '';
      if (note.type === 'code') {
        previewText = (note.rawCode || '').trim().slice(0, 60);
      } else if (note.type === 'grid') {
        previewText = Object.values(note.grid?.cells || {}).map(cell => cell.value || '').filter(Boolean).join(' · ').slice(0, 60) || 'Hoja de cálculo vacía';
      } else {
        const tmp = document.createElement('div');
        tmp.innerHTML = note.content || '';
        previewText = tmp.textContent.trim().slice(0, 60);
      }

      const dateStr = new Date(note.updatedAt).toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
      });

      item.innerHTML = `
        <div class="note-item-header">
          <span class="note-item-title">${escapeHtml(note.title)}</span>
          <span class="note-item-type">${note.type === 'code' ? (note.language || 'code') : note.type === 'grid' ? 'grid' : 'doc'}</span>
        </div>
        <div class="note-item-preview">${escapeHtml(previewText || 'Nota vacía...')}</div>
        <div class="note-item-footer">
          <span>${dateStr}</span>
          <button class="note-item-delete" title="Eliminar nota">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      item.querySelector('.note-item-delete').onclick = event => deleteNote(note.id, event);
      DOM.notesList.appendChild(item);
    });
  }

  /* ==========================================================================
     Control de Modos: Documento (Word/Docs) vs Código (Notepad++)
     ========================================================================== */
  function setMode(mode) {
    state.currentMode = mode;
    document.getElementById('gridContainer').hidden = mode !== 'grid';
    DOM.btnNewNote.querySelector('span').textContent = mode === 'grid' ? 'Nueva hoja Grid' : 'Nueva Nota / Doc';
    DOM.btnExport.title = mode === 'grid' ? 'Descargar hoja como CSV' : 'Descargar documento o código';
    DOM.btnKanlaneTasks.disabled = mode === 'grid' || !has('tasks:read');

    DOM.modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'doc') {
      DOM.docToolbar.style.display = 'flex';
      DOM.docViewport.style.display = 'flex';
      DOM.codeContainer.style.display = 'none';

      DOM.statusMode.textContent = 'Modo: Documento (Word/Docs)';
    } else if (mode === 'code') {
      DOM.docToolbar.style.display = 'none';
      DOM.docViewport.style.display = 'none';
      DOM.codeContainer.style.display = 'flex';

      updateLineNumbers();
      DOM.statusMode.textContent = `Modo: Notepad++ [${DOM.codeLangSelect.value.toUpperCase()}]`;
    } else if (mode === 'grid') {
      DOM.docToolbar.style.display = 'none';
      DOM.docViewport.style.display = 'none';
      DOM.codeContainer.style.display = 'none';
      DOM.statusMode.textContent = 'Modo: Grid (Hoja de cálculo)';
    }

    updateStats();
  }

  // Cada editor abre notas de su tipo; nunca convierte ni reutiliza el contenido de otra.
  function switchMode(mode) {
    if (!state.isHome && mode === state.currentMode) return;
    updateCurrentNoteFromView();
    const inFolder = note => state.activeFolder === 'all' || (state.activeFolder === 'unfiled' ? !note.folderId : note.folderId === state.activeFolder);
    const existing = state.notes.find(note => note.type === mode && inFolder(note));
    if (existing) selectNote(existing.id); else createNewNote(mode);
    triggerAutosave(); renderNotesList();
  }

  /* ==========================================================================
     Herramientas del Modo Documento (WYSIWYG, Tablas, Callouts)
     ========================================================================== */
  function execDocCmd(command, value = null) {
    restoreDocSelection();
    document.execCommand(command, false, value);
    rememberDocSelection();
    triggerAutosave();
    updateStats();
  }

  function insertTableModal() {
    rememberDocSelection();
    DOM.tableModal.classList.add('active');
    DOM.tableRowsInput.focus();
  }

  function confirmInsertTable() {
    const rows = Number(DOM.tableRowsInput.value);
    const cols = Number(DOM.tableColsInput.value);
    if (!Number.isInteger(rows) || rows < 1 || rows > 50) { DOM.tableRowsInput.reportValidity(); return; }
    if (!Number.isInteger(cols) || cols < 1 || cols > 15) { DOM.tableColsInput.reportValidity(); return; }

    let html = '<table><thead><tr>';
    for (let c = 1; c <= cols; c++) {
      html += `<th>Columna ${c}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (let r = 1; r <= rows; r++) {
      html += '<tr>';
      for (let c = 1; c <= cols; c++) {
        html += `<td>Dato ${r},${c}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    closeModals();
    insertDocHTML(html);
  }

  function insertCallout(type = 'info') {
    const titles = {
      info: '💡 Nota importante',
      warning: '⚠️ Advertencia',
      success: '✅ Verificado / Listo'
    };
    const classes = {
      info: 'callout',
      warning: 'callout callout-warning',
      success: 'callout callout-success'
    };

    const html = `
      <div class="${classes[type]}">
        <div>
          <strong>${titles[type]}</strong><br>
          Escribe aquí el contenido de la alerta...
        </div>
      </div>
      <p><br></p>
    `;

    insertDocHTML(html);
  }

  async function insertDocCodeBlock() {
    rememberDocSelection();
    const choice = await KanPadDialogs.prompt('Lenguaje del bloque', 'javascript', 'javascript, python, html, css, sql o json');
    if (choice === null) return;
    const lang = ['javascript', 'python', 'html', 'css', 'sql', 'json'].includes(choice.toLowerCase()) ? choice.toLowerCase() : 'plaintext';
    const sample = `// Escribe tu código ${lang} aquí...\nconsole.log("Hola desde KanPad Pro");`;

    const html = `
      <div class="doc-code-block">
        <div class="doc-code-header">
          <span>${lang}</span>
          <button class="doc-code-copy-btn" onclick="KanPad.copySnippet(this)">Copiar</button>
        </div>
        <pre><code class="language-${lang}">${escapeHtml(sample)}</code></pre>
      </div>
      <p><br></p>
    `;

    insertDocHTML(html);
  }

  /* ==========================================================================
     Herramientas del Modo Notepad++ (Prettify, Formateo, Líneas)
     ========================================================================== */
  function formatCurrentCode() {
    const code = DOM.codeTextarea.value;
    if (!code.trim()) return;

    const lang = DOM.codeLangSelect.value;
    const formatted = window.CodeTools ? window.CodeTools.beautify(code, lang) : code;

    DOM.codeTextarea.value = formatted;
    updateLineNumbers();
    triggerAutosave();
    showToast('¡Código formateado con éxito!', 'success');
  }

  function updateLineNumbers() {
    const lines = DOM.codeTextarea.value.split('\n').length;
    let gutterHTML = '';
    for (let i = 1; i <= lines; i++) {
      gutterHTML += `<div>${i}</div>`;
    }
    DOM.codeLineNumbers.innerHTML = gutterHTML;
  }

  async function insertLink() {
    rememberDocSelection();
    const value = await KanPadDialogs.prompt('URL del enlace', 'https://');
    if (!value) return;
    try {
      const url = new URL(value);
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw Error('Protocolo no permitido');
      execDocCmd('createLink', url.href);
    } catch { showToast('Introduce un enlace http, https o mailto válido.', 'error'); }
  }

  function copyCurrentCode() {
    const code = DOM.codeTextarea.value;
    KanPadDialogs.copy(code).then(() => {
      showToast('Código copiado al portapapeles', 'info');
    }).catch(error => showToast(error.message, 'error'));
  }

  /* ==========================================================================
     Integración con Tareas de Kanlane
     ========================================================================== */
  async function openKanlaneTasksModal() {
    rememberDocSelection();
    DOM.taskModal.classList.add('active');
    DOM.taskListContainer.innerHTML = '<div style="padding:16px; text-align:center;">Cargando tareas de Kanlane...</div>';

    let tasks = [];
    if (state.wh && state.wh.tasks) {
      try {
        tasks = await state.wh.tasks.list();
      } catch (e) {
        DOM.taskListContainer.textContent = 'No se pudieron cargar las tareas: ' + e.message;
        return;
      }
    }

    if (!tasks || !tasks.length) {
      DOM.taskListContainer.textContent = 'No hay tareas disponibles en este proyecto.';
      return;
    }

    DOM.taskListContainer.innerHTML = '';
    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-item-card';
      card.innerHTML = `
        <div>
          <div style="font-weight:600; font-size:13px; color:var(--ink);">${escapeHtml(task.title || 'Sin título')}</div>
          <div style="font-size:11px; color:var(--ink-faint);">${escapeHtml(task.cliente || 'Sin cliente')} · ${escapeHtml(task.status || 'abierta')}</div>
        </div>
        <button class="app-btn btn-primary" style="height:24px; font-size:11px;">Insertar</button>
      `;

      card.onclick = () => {
        insertTaskIntoDocument(task);
        closeModals();
      };

      DOM.taskListContainer.appendChild(card);
    });
  }

  function insertTaskIntoDocument(task) {
    if (state.currentMode === 'code') {
      const comment = `// Tarea Kanlane #${task.id}: ${task.title} [${task.status}]\n`;
      const curPos = DOM.codeTextarea.selectionStart;
      const text = DOM.codeTextarea.value;
      DOM.codeTextarea.value = text.slice(0, curPos) + comment + text.slice(curPos);
      triggerAutosave();
    } else {
      const taskCardHTML = `
        <div class="callout callout-info" style="display:flex; justify-content:space-between; align-items:center; margin: 10px 0;">
          <div>
            <strong>📌 Tarea Kanlane:</strong> ${escapeHtml(task.title)}
            <span class="task-card-pill" style="margin-left:8px;">${escapeHtml(task.status || 'abierta')}</span>
          </div>
          <span style="font-size:11px; color:var(--ink-soft); font-family:var(--mono);">#${task.id}</span>
        </div>
        <p><br></p>
      `;
      insertDocHTML(taskCardHTML);
    }
    showToast(`Tarea "${task.title}" vinculada`, 'success');
  }

  /* ==========================================================================
     Exportación de Archivos
     ========================================================================== */
  function exportCurrentNote() {
    const note = state.notes.find(n => n.id === state.currentNoteId);
    if (!note) return;

    updateCurrentNoteFromView();

    let content = '';
    let filename = note.title;
    let mimeType = 'text/plain';

    if (note.type === 'grid') {
      content = KanPadGrid.toCSV(note.grid);
      if (!filename.toLowerCase().endsWith('.csv')) filename += '.csv';
      mimeType = 'text/csv;charset=utf-8';
    } else if (note.type === 'code') {
      content = note.rawCode || '';
      const extMap = {
        javascript: 'js',
        python: 'py',
        html: 'html',
        css: 'css',
        sql: 'sql',
        json: 'json',
        markdown: 'md'
      };
      const ext = extMap[note.language] || 'txt';
      if (!filename.includes('.')) filename += `.${ext}`;
    } else {
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(note.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;line-height:1.6;padding:0 20px;}table{width:100%;border-collapse:collapse;margin:16px 0;}th,td{border:1px solid #ccc;padding:8px 12px;text-align:left;}th{background:#f0f0f0;}.callout{background:#f0f7ff;border-left:4px solid #2563eb;padding:12px;margin:16px 0;}pre{background:#2d3748;color:#fff;padding:14px;border-radius:6px;overflow-x:auto;}</style></head><body>${note.content}</body></html>`;
      if (!filename.endsWith('.html')) filename += '.html';
      mimeType = 'text/html';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Archivo "${filename}" descargado`, 'success');
  }

  /* ==========================================================================
     Estadísticas y Utilidades
     ========================================================================== */
  function updateStats() {
    let text = '';
    if (state.isHome) {
      DOM.statusMode.textContent = 'Inicio';
      DOM.statusWords.textContent = `${state.notes.length} notas`;
    } else if (state.currentMode === 'grid' && grid) {
      DOM.statusWords.textContent = `${grid.data.rows} filas × ${grid.data.cols} columnas`;
    } else if (state.currentMode === 'code') {
      text = DOM.codeTextarea.value;
      const lines = text.split('\n').length;
      const chars = text.length;
      DOM.statusWords.textContent = `${lines} líneas | ${chars} caracteres`;
    } else {
      text = DOM.docSheet.innerText || '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      DOM.statusWords.textContent = `${words} palabras | ${chars} caracteres`;
    }
  }

  function showToast(message, type = 'info') {
    if (state.wh && state.wh.ui && typeof state.wh.ui.toast === 'function') {
      state.wh.ui.toast(message, { type: type === 'info' ? 'important' : type }).catch(() => {});
      return;
    }

    // Toast flotante propio
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;bottom:36px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:9999;pointer-events:none;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `background:var(--surface);border:1px solid var(--line-strong);color:var(--ink);padding:8px 14px;border-radius:var(--r-md);font-size:12px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.2s;pointer-events:auto;display:flex;align-items:center;gap:8px;`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  function closeModals() {
    document.querySelectorAll('.modal-overlay:not(#actionModal)').forEach(m => m.classList.remove('active'));
    manageAction = null;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ==========================================================================
     Event Listeners
     ========================================================================== */
  function setupEventListeners() {
    document.getElementById('btnHome').onclick = showHome;
    document.getElementById('btnNewFolder').onclick = () => manage('createFolder');
    document.querySelectorAll('[data-create]').forEach(btn => { btn.onclick = () => createNewNote(btn.dataset.create); });
    document.getElementById('homeSort').onchange = e => { state.homeSort = e.target.value; renderHome(); };
    document.getElementById('manageForm').onsubmit = confirmManage;
    document.addEventListener('selectionchange', rememberDocSelection);
    // Conservar la selección al pulsar botones; los selectores y los modales pueden tomar el foco.
    DOM.docToolbar.addEventListener('mousedown', e => {
      rememberDocSelection();
      if (e.target.closest('button')) e.preventDefault();
    });
    // Título de la nota
    DOM.noteTitleInput.addEventListener('input', () => {
      updateCurrentNoteFromView();
      triggerAutosave();
      renderNotesList();
    });

    // Guardado manual
    DOM.btnSave.addEventListener('click', async () => {
      if (await saveNotes(true)) showToast('Guardado correctamente', 'success');
    });

    // Nueva nota
    DOM.btnNewNote.addEventListener('click', () => {
      createNewNote(state.isHome ? 'doc' : state.currentMode);
    });

    // Exportar
    DOM.btnExport.addEventListener('click', exportCurrentNote);

    // Tareas Kanlane
    DOM.btnKanlaneTasks.addEventListener('click', openKanlaneTasksModal);

    // Sidebar colapso
    DOM.btnToggleSidebar.addEventListener('click', () => {
      DOM.sidebar.classList.toggle('is-collapsed');
      DOM.btnToggleSidebar.setAttribute('aria-expanded', String(!DOM.sidebar.classList.contains('is-collapsed')));
    });
    const mobile = window.matchMedia('(max-width: 700px)');
    const adaptSidebar = () => {
      DOM.sidebar.classList.toggle('is-collapsed', mobile.matches);
      DOM.btnToggleSidebar.setAttribute('aria-expanded', String(!mobile.matches));
    };
    mobile.addEventListener('change', adaptSidebar);
    adaptSidebar();

    // Búsqueda
    DOM.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderNotesList();
    });

    // Filtros de nota
    DOM.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        DOM.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeFilter = tab.dataset.filter;
        renderNotesList();
      });
    });

    // Modos
    DOM.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        switchMode(btn.dataset.mode);
      });
    });

    // Editor de Documentos (input)
    DOM.docSheet.addEventListener('input', () => {
      triggerAutosave();
      updateStats();
    });

    // Editor de Código (textarea)
    DOM.codeTextarea.addEventListener('input', () => {
      updateLineNumbers();
      triggerAutosave();
      updateStats();
    });

    // Sincronizar scroll entre gutter de números y textarea
    DOM.codeTextarea.addEventListener('scroll', () => {
      DOM.codeLineNumbers.scrollTop = DOM.codeTextarea.scrollTop;
    });

    // Soporte para tecla Tab en el textarea
    DOM.codeTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = DOM.codeTextarea.selectionStart;
        const end = DOM.codeTextarea.selectionEnd;
        DOM.codeTextarea.value = DOM.codeTextarea.value.substring(0, start) + '  ' + DOM.codeTextarea.value.substring(end);
        DOM.codeTextarea.selectionStart = DOM.codeTextarea.selectionEnd = start + 2;
        updateLineNumbers();
        triggerAutosave();
      }
    });

    // Selector de lenguaje en modo código
    DOM.codeLangSelect.addEventListener('change', () => {
      const lang = DOM.codeLangSelect.value;
      DOM.statusMode.textContent = `Modo: Notepad++ [${lang.toUpperCase()}]`;
      triggerAutosave();
    });

    // Formatear código (Prettify)
    DOM.btnFormatCode.addEventListener('click', formatCurrentCode);

    // Copiar código
    DOM.btnCopyCode.addEventListener('click', copyCurrentCode);

    // Confirmar inserción de tabla
    DOM.btnConfirmTable.addEventListener('click', confirmInsertTable);

    document.addEventListener('visibilitychange', () => { if (document.hidden && state.dirty) saveNotes(); });
    window.addEventListener('pagehide', () => {
      if (!state.ready) return;
      updateCurrentNoteFromView();
      // Dentro de Kanlane el origen opaco no permite respaldo local.
      if (state.isStandalone) { try { store.flushLocal({ notes: state.notes, folders: state.folders }); } catch {} }
    });

    // Cerrar modales con tecla Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModals();
    });
  }

  // API pública para elementos dinámicos
  window.KanPad = {
    init,
    deleteNote,
    insertTableModal,
    insertCallout,
    insertDocCodeBlock,
    insertLink,
    execDocCmd,
    closeModals,
    copySnippet(btn) {
      const codeBlock = btn.closest('.doc-code-block');
      if (codeBlock) {
        const code = codeBlock.querySelector('code').innerText;
        KanPadDialogs.copy(code).then(() => {
          btn.textContent = '¡Copiado!';
          setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
        }).catch(error => showToast(error.message, 'error'));
      }
    }
  };

  // Iniciar al cargar el DOM
  document.addEventListener('DOMContentLoaded', init);
})();
