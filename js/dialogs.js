/* Diálogos propios: confirm/prompt están bloqueados en el sandbox de Kanlane. */
(function () {
  'use strict';
  let queue = Promise.resolve(), finish;
  const overlay = document.getElementById('actionModal'), form = document.getElementById('actionForm'), input = document.getElementById('actionInput');
  function ask(spec) {
    const run = () => new Promise(resolve => {
      const previous = document.activeElement;
      document.getElementById('actionTitle').textContent = spec.title;
      document.getElementById('actionMessage').textContent = spec.message || '';
      input.hidden = !spec.input; input.disabled = !spec.input; input.required = !!spec.input;
      input.value = spec.value || '';
      document.getElementById('actionSubmit').textContent = spec.submit || 'Aceptar';
      overlay.classList.add('active');
      finish = value => {
        overlay.classList.remove('active'); finish = null;
        if (previous?.isConnected) previous.focus();
        resolve(value);
      };
      if (spec.input) { input.focus(); input.select(); } else document.getElementById('actionCancel').focus();
    });
    const pending = queue.then(run); queue = pending.catch(() => {}); return pending;
  }
  form.onsubmit = event => { event.preventDefault(); if (finish) finish(input.disabled ? true : input.value.trim()); };
  document.getElementById('actionCancel').onclick = () => { if (finish) finish(input.disabled ? false : null); };
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); document.getElementById('actionCancel').click(); }
    if (event.key === 'Tab') {
      const elements = [...form.querySelectorAll('button,input:not([disabled])')].filter(el => !el.hidden);
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus(); }
    }
  });
  window.KanPadDialogs = {
    confirm(message, title = 'Confirmar', submit = 'Continuar') { return ask({ title, message, submit }); },
    prompt(title, value = '', message = '') { return ask({ title, input: true, value, message }); },
    cancel() { if (finish) finish(input.disabled ? false : null); },
    get isOpen() { return !!finish; },
    async copy(text) {
      if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(text); return; } catch {} }
      const area = document.createElement('textarea'); area.value = text; area.style.cssText = 'position:fixed;left:-9999px'; document.body.append(area); area.select();
      const copied = document.execCommand('copy'); area.remove();
      if (!copied) throw Error('El navegador no permitió copiar. Selecciona el texto y pulsa Ctrl+C.');
    }
  };
})();
