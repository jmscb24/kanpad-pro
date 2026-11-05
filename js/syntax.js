/* Presentación únicamente: nunca formatea ni modifica el código original. */
(function () {
  'use strict';
  const aliases = { html: 'xml', sh: 'bash', shell: 'bash', zsh: 'bash', js: 'javascript', ts: 'typescript', ps1: 'powershell', toml: 'ini', text: 'plaintext', txt: 'plaintext' };
  function language(value) {
    const name = String(value || 'plaintext').toLowerCase();
    const canonical = aliases[name] || name;
    return window.hljs?.getLanguage(canonical) ? canonical : 'plaintext';
  }
  function highlight(code, lang) {
    if (!window.hljs) {
      const element = document.createElement('code'); element.textContent = code; return element.innerHTML;
    }
    return hljs.highlight(code, { language: language(lang), ignoreIllegals: true }).value;
  }
  function blocks(root) {
    let restoredRange;
    root.querySelectorAll('pre code').forEach(element => {
      // No reemplazar nodos mientras se escribe en un bloque de Docs.
      const selection = window.getSelection();
      if (root.isContentEditable && document.activeElement === root && selection?.anchorNode && element.contains(selection.anchorNode)) return;
      let offsets;
      if (selection?.rangeCount && (element.contains(selection.anchorNode) || element.contains(selection.focusNode))) {
        // Una selección que cruza el bloque no debe perder sus extremos.
        if (!element.contains(selection.anchorNode) || !element.contains(selection.focusNode)) return;
        const offset = (node, position) => {
          const range = document.createRange(); range.selectNodeContents(element); range.setEnd(node, position); return range.toString().length;
        };
        offsets = [offset(selection.anchorNode, selection.anchorOffset), offset(selection.focusNode, selection.focusOffset)];
      }
      const lang = Array.from(element.classList).find(name => name.startsWith('language-'))?.slice(9);
      const source = element.textContent;
      element.innerHTML = highlight(source, lang);
      element.classList.add('hljs');
      if (offsets) {
        const point = offset => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let text;
          while ((text = walker.nextNode())) {
            if (offset <= text.length) return [text, offset];
            offset -= text.length;
          }
          return [element, element.childNodes.length];
        };
        // Devolver el rango sin cambiar el foco: restaurar la selección global
        // al salir de Docs haría que escribir en otro campo editase el código.
        restoredRange = document.createRange();
        restoredRange.setStart(...point(Math.min(...offsets)));
        restoredRange.setEnd(...point(Math.max(...offsets)));
      }
    });
    return restoredRange;
  }
  window.KanPadSyntax = { language, highlight, blocks };
})();
