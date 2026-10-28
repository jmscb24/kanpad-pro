/* Markdown local: conservar el original y sanear siempre el HTML de presentación. */
(function () {
  'use strict';
  const options = {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'strong', 'em', 'del', 's', 'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'start', 'align', 'type', 'checked', 'disabled'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false
  };
  // Las casillas de tareas se muestran como lectura, nunca como formularios activos.
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName === 'INPUT') { node.setAttribute('type', 'checkbox'); node.setAttribute('disabled', ''); }
    if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
  });
  function render(source) {
    return DOMPurify.sanitize(marked.parse(String(source || ''), { gfm: true, breaks: false, async: false }), options);
  }
  function detect(source) {
    const text = String(source || '').replace(/\r\n?/g, '\n');
    // Exigir sintaxis clara para no transformar prosa o fragmentos de código corrientes.
    return /^ {0,3}#{1,6}\s+\S/m.test(text) || /^ {0,3}(`{3,}|~{3,})[^\n]*\n/m.test(text) ||
      /^[^\n]+\n {0,3}(?:={3,}|-{3,})\s*$/m.test(text) ||
      /^\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}:?\s*\|/m.test(text) ||
      /\*\*[^*\n]+\*\*|__[^_\n]+__|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)/.test(text) ||
      (text.match(/^\s*(?:[-+*]|\d+[.)])\s+\S/gm) || []).length >= 2 ||
      (text.match(/^ {0,3}>\s+\S/gm) || []).length >= 2;
  }
  window.KanPadMarkdown = { render, detect };
})();
