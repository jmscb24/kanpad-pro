const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const url = process.env.GRID_TEST_URL || 'http://127.0.0.1:8080';
const source = '# Mi documento\n\nTexto con **negrita**, *cursiva*, ~~tachado~~ y `código`.\n\n- Uno\n- Dos\n\n1. Primero\n2. Segundo\n\n> Una cita\n\n- [x] Terminado\n- [ ] Pendiente\n\n| Nombre | Valor |\n| --- | ---: |\n| Prueba | 42 |\n\n```js\nconst x = "<seguro>";\n```\n\n[Enlace](https://example.com)';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GRID_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://kanlane.com/**', route => route.abort());
    await page.goto(url); await page.locator('[data-create="markdown"]').waitFor();
    await page.locator('[data-create="markdown"]').click();
    await page.locator('#noteTitleInput').fill('Mi Markdown');
    await page.locator('#markdownSource').fill(source);
    await page.locator('#markdownPreview h1').waitFor();
    assert.equal(await page.locator('#markdownPreview h1').innerText(), 'Mi documento');
    assert.equal(await page.locator('#markdownPreview strong').innerText(), 'negrita');
    assert.equal(await page.locator('#markdownPreview table td').last().innerText(), '42');
    assert.equal(await page.locator('#markdownPreview input:disabled').count(), 2);
    assert.equal(await page.locator('#markdownPreview input:checked').count(), 1);
    assert.match(await page.locator('#markdownPreview pre').innerText(), /<seguro>/);
    assert.equal(await page.locator('#markdownPreview a').getAttribute('rel'), 'noopener noreferrer');
    assert.match(await page.locator('#markdownDetected').innerText(), /detectado/);
    await page.locator('[data-markdown-view="preview"]').click();
    assert.equal(await page.locator('#markdownSource').isVisible(), false);
    await page.locator('[data-markdown-view="source"]').click();
    assert.equal(await page.locator('#markdownPreview').isVisible(), false);
    await page.locator('[data-markdown-view="split"]').click();
    // Guardado lento y error: el botón debe reflejar el resultado real.
    await page.evaluate(() => {
      const save = KanPadStorage.prototype.save;
      KanPadStorage.prototype.save = async function (data) {
        await new Promise(resolve => setTimeout(resolve, 350));
        if (window.failSave) throw Error('Error de prueba');
        return save.call(this, data);
      };
    });
    await page.locator('#btnSave').click();
    assert.equal(await page.locator('#btnSave').getAttribute('data-save-state'), 'saving');
    assert.equal(await page.locator('#btnSave').isDisabled(), true);
    await page.waitForFunction(() => document.getElementById('btnSave').dataset.saveState === 'saved');
    assert.match(await page.locator('#btnSave').innerText(), /Guardado/);
    await page.evaluate(() => { window.failSave = true; });
    await page.locator('#markdownSource').fill(source + '\n\nCambio pendiente');
    await page.locator('#btnSave').click();
    await page.waitForFunction(() => document.getElementById('btnSave').dataset.saveState === 'error');
    assert.equal(await page.locator('#btnSave').innerText(), 'Reintentar');
    assert.match(await page.locator('#statusSaveMsg').innerText(), /Sin guardar/);
    assert.match(await page.locator('#markdownSource').inputValue(), /Cambio pendiente/);
    await page.evaluate(() => { window.failSave = false; });
    await page.locator('#btnSave').click();
    await page.waitForFunction(() => document.getElementById('btnSave').dataset.saveState === 'saved');
    await page.locator('#btnHome').click(); await page.reload();
    await page.getByRole('button', { name: 'Abrir Mi Markdown', exact: true }).click();
    assert.equal(await page.locator('#markdownSource').inputValue(), source + '\n\nCambio pendiente');
    // Exportación exacta del original, sin convertirlo a HTML.
    const downloadPromise = page.waitForEvent('download'); await page.locator('#btnExport').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'Mi Markdown.md');
    assert.equal(await fs.readFile(await download.path(), 'utf8'), source + '\n\nCambio pendiente');
    await page.locator('#markdownImport').setInputFiles({ name: 'importado.md', mimeType: 'text/markdown', buffer: Buffer.from('# Importado\n\n**Listo**') });
    await page.locator('#actionCancel').click(); assert.equal(await page.locator('#noteTitleInput').inputValue(), 'Mi Markdown');
    await page.locator('#markdownImport').setInputFiles({ name: 'importado.md', mimeType: 'text/markdown', buffer: Buffer.from('# Importado\n\n**Listo**') });
    await page.locator('#actionSubmit').click();
    await page.waitForFunction(() => document.getElementById('markdownPreview').textContent.includes('Importado'));
    assert.equal(await page.locator('#noteTitleInput').inputValue(), 'importado.md');
    // HTML no confiable y enlaces ejecutables jamás llegan activos a la vista.
    await page.locator('#markdownSource').fill('# Seguro\n<script>window.pwned=1</script><img src=x onerror="window.pwned=2"><svg onload="window.pwned=3"></svg><iframe srcdoc="<script>parent.pwned=4</script>"></iframe>\n[mal](javascript:alert(1))\n<input type="text" onfocus="window.pwned=5" autofocus><p style="position:fixed" id="btnSave">texto</p>');
    await page.waitForFunction(() => document.querySelector('#markdownPreview h1')?.textContent === 'Seguro');
    assert.equal(await page.locator('#markdownPreview script, #markdownPreview iframe, #markdownPreview svg, #markdownPreview [onerror], #markdownPreview [style], #markdownPreview [id]').count(), 0);
    assert.equal(await page.locator('#markdownPreview a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => window.pwned), undefined);
    await page.locator('#markdownSource').fill(source); await page.locator('#markdownPreview table').waitFor();
    await page.screenshot({ path: '/tmp/kanpad-markdown-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('#btnSave span').isVisible(), true);
    await page.screenshot({ path: '/tmp/kanpad-markdown-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 980 });
    await page.locator('[data-mode="code"]').click();
    assert.equal(await page.locator('[data-mode="code"]').innerText(), 'Codepad');
    assert.match(await page.locator('#statusMode').innerText(), /Codepad/);
    await page.locator('#codeTextarea').fill(source);
    await page.locator('[data-mode="markdown"]').click();
    assert.equal(await page.locator('#markdownSource').inputValue(), source);
    // Pegado Markdown en Docs y marco de documento que contiene todo el texto largo.
    await page.locator('[data-mode="doc"]').click();
    await page.locator('#docSheet').fill('');
    await page.locator('#docSheet').press('End');
    await page.locator('#docSheet').evaluate((el, source) => {
      const data = new DataTransfer(); data.setData('text/plain', source);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, source);
    assert.equal(await page.locator('#docSheet h1').count(), 1);
    assert.equal(await page.locator('#docSheet h1').innerText(), 'Mi documento');
    assert.equal(await page.locator('#docSheet > p strong').innerText(), 'negrita');
    assert.equal(await page.locator('#docSheet table').count(), 1);
    await page.locator('#docSheet').evaluate(el => {
      el.innerHTML = '<p>Antes DESPUÉS</p>'; el.focus();
      const range = document.createRange(); range.setStart(el.firstChild.firstChild, 6); range.collapse(true);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const data = new DataTransfer(); data.setData('text/plain', '# En el cursor\n\nTexto');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    assert.equal(await page.locator('#docSheet > p').first().textContent(), 'Antes ');
    assert.equal(await page.locator('#docSheet > p').last().innerText(), 'DESPUÉS');
    assert.equal(await page.locator('#docSheet > h1').innerText(), 'En el cursor');
    await page.locator('#docSheet').evaluate(el => {
      el.innerHTML += '<div class="callout"><div><h1>' + 'Texto grande '.repeat(60) + '</h1></div></div>' + '<p>Documento largo con texto</p>'.repeat(80);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.ok(await page.locator('#docSheet').evaluate(el => el.getBoundingClientRect().bottom >= el.lastElementChild.getBoundingClientRect().bottom + 35));
    assert.ok(await page.locator('#docSheet .callout').evaluate(el => el.getBoundingClientRect().bottom >= el.querySelector('h1').getBoundingClientRect().bottom));
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.locator('#docSheet').evaluate(() => document.documentElement.dataset.theme = 'dark');
    await page.locator('[data-mode="markdown"]').click();
    await page.screenshot({ path: '/tmp/kanpad-markdown-dark.png' });
    await page.locator('#btnCopyMarkdown').focus(); await page.keyboard.press('Enter');
    assert.ok((await page.locator('#btnCopyMarkdown').getAttribute('class')).includes('button-feedback'));
    assert.deepEqual(errors, []);
    console.log('OK: Markdown GFM, detección, vistas, guardado/error/reintento, reapertura, importación/exportación, HTML seguro, móvil/oscuro, Codepad intacto, pegado Docs y marco adaptable.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
