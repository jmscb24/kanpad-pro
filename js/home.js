/* Inicio: presentación de notas y carpetas. Los datos los administra app.js. */
(function () {
  'use strict';
  const types = { doc: ['▤', 'Documento'], code: ['</>', 'Codepad'], grid: ['▦', 'Grid'], markdown: ['M↓', 'Markdown'] };
  function node(tag, className, text) {
    const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el;
  }
  function button(text, label, action, className = 'app-btn') {
    const el = node('button', className, text); el.type = 'button'; el.title = label; el.setAttribute('aria-label', label); el.onclick = action; return el;
  }
  function folderIcon(className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', className); svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M3 7V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0h18');
    svg.append(path); return svg;
  }
  function preview(note) {
    if (note.type === 'grid') return Object.values(note.grid?.cells || {}).map(c => c.value || '').filter(Boolean).join(' · ').slice(0, 150) || 'Hoja de cálculo vacía';
    if (note.type === 'markdown') return (note.markdown || '').slice(0, 150) || 'Markdown vacío';
    if (note.type === 'code') return (note.rawCode || '').slice(0, 150) || 'Archivo de código vacío';
    const div = document.createElement('div'); div.innerHTML = (note.content || '').replace(/<\/(p|div|h[1-6]|tr|td|th|li)>/gi, '$& '); return (div.textContent || '').trim().slice(0, 150) || 'Documento vacío';
  }
  window.KanPadHome = {
    render({ notes, visibleNotes, folders, activeFolder, sort, actions }) {
      const nav = document.getElementById('folderNav'); nav.replaceChildren();
      nav.append(node('p', 'folder-heading', 'BIBLIOTECA'));
      function folderRow(id, name, icon, count, folder) {
        const row = node('div', 'folder-row');
        const open = button('', name, () => actions.folder(id), 'folder-link' + (activeFolder === id ? ' active' : ''));
        open.append(folder ? folderIcon('folder-icon') : node('span', 'folder-icon', icon), node('span', 'folder-name', name), node('span', 'folder-count', count));
        if (activeFolder === id) open.setAttribute('aria-current', 'page');
        row.append(open);
        if (folder) {
          row.append(button('✎', 'Renombrar carpeta ' + name, () => actions.renameFolder(folder), 'folder-action'));
          row.append(button('×', 'Eliminar carpeta ' + name, () => actions.deleteFolder(folder), 'folder-action danger-action'));
        }
        nav.append(row);
      }
      folderRow('all', 'Todas las notas', '▤', notes.length);
      folderRow('unfiled', 'Sin carpeta', '◇', notes.filter(n => !n.folderId).length);
      nav.append(node('p', 'folder-heading', 'CARPETAS'));
      folders.forEach(f => folderRow(f.id, f.name, null, notes.filter(n => n.folderId === f.id).length, f));
      nav.append(button('+ Nueva carpeta', 'Nueva carpeta', actions.createFolder, 'folder-new'));
      const current = folders.find(f => f.id === activeFolder);
      document.getElementById('homeTitle').textContent = current?.name || (activeFolder === 'unfiled' ? 'Sin carpeta' : 'Todas las notas');
      document.getElementById('homeCount').textContent = `${visibleNotes.length} nota${visibleNotes.length === 1 ? '' : 's'} · ${folders.length} carpeta${folders.length === 1 ? '' : 's'}`;
      const list = document.getElementById('homeNotes'); list.replaceChildren();
      const ordered = [...visibleNotes].sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'es') : sort === 'type' ? a.type.localeCompare(b.type) || a.title.localeCompare(b.title, 'es') : b.updatedAt.localeCompare(a.updatedAt));
      if (!ordered.length && (activeFolder !== 'all' || !folders.length || notes.length)) {
        const empty = node('div', 'home-empty'); empty.append(node('span', 'home-empty-icon', '▤'), node('h3', '', 'No hay notas aquí'), node('p', 'home-muted', 'Crea una nota arriba o cambia la búsqueda y los filtros.')); list.append(empty);
      }
      function noteCard(note) {
        const card = node('article', 'home-note'); card.dataset.noteId = note.id;
        const [icon, type] = types[note.type] || types.doc;
        const open = button('', 'Abrir ' + note.title, () => actions.open(note.id), 'home-note-open');
        const top = node('div', 'home-note-top'); top.append(node('span', 'home-type-icon', icon), node('span', 'home-note-type', type));
        open.append(top, node('h3', '', note.title), node('p', 'home-note-preview', preview(note)));
        card.append(open);
        const footer = node('div', 'home-note-footer');
        const folderName = folders.find(f => f.id === note.folderId)?.name || 'Sin carpeta';
        footer.append(node('span', 'home-note-folder', folderName), node('time', '', new Date(note.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })));
        card.append(footer);
        const controls = node('div', 'home-note-actions');
        controls.append(button('Renombrar', 'Renombrar ' + note.title, () => actions.rename(note)), button('Mover', 'Mover ' + note.title, () => actions.move(note)), button('Duplicar', 'Duplicar ' + note.title, () => actions.duplicate(note)), button('Eliminar', 'Eliminar ' + note.title, () => actions.delete(note.id), 'app-btn danger-action'));
        card.append(controls); return card;
      }
      if (activeFolder !== 'all') {
        ordered.forEach(note => list.append(noteCard(note)));
        return;
      }
      // Las tarjetas navegan a la carpeta; sus notas solo se renderizan dentro de ella.
      // Agrupar después de filtrar conserva la búsqueda y los contadores de resultados.
      const byFolder = new Map(folders.map(folder => [folder.id, []]));
      const rootNotes = [];
      ordered.forEach(note => {
        const group = byFolder.get(note.folderId);
        if (group) group.push(note); else rootNotes.push(note);
      });
      const folderGrid = node('section', 'home-folder-grid'); folderGrid.setAttribute('aria-label', 'Carpetas');
      folders.forEach(folder => {
        const children = byFolder.get(folder.id);
        if (!children.length && visibleNotes.length !== notes.length) return;
        const card = button('', 'Abrir carpeta ' + folder.name, () => actions.folder(folder.id), 'home-folder');
        card.dataset.folderId = folder.id; card.title = folder.name;
        card.append(folderIcon('home-folder-icon'), node('span', 'home-folder-name', folder.name), node('span', 'home-folder-count', `${children.length} nota${children.length === 1 ? '' : 's'}`));
        folderGrid.append(card);
      });
      if (folderGrid.childElementCount) list.append(folderGrid);
      if (rootNotes.length) {
        const root = node('section', 'home-root'); root.setAttribute('aria-label', 'Notas sin carpeta');
        root.append(node('h3', 'home-root-heading', 'Notas sin carpeta'));
        const grid = node('div', 'home-notes'); rootNotes.forEach(note => grid.append(noteCard(note)));
        root.append(grid); list.append(root);
      }
    }
  };
})();
