const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const url = process.env.GRID_TEST_URL || 'http://127.0.0.1:8080';
const oldNotes = [
  { id: 'old-doc', title: 'Documento anterior', type: 'doc', updatedAt: '2026-10-23T10:00:00Z', content: '<p id="before">Antes</p><p id="after">Después</p>' },
  { id: 'old-code', title: 'Código anterior', type: 'code', updatedAt: '2026-10-22T10:00:00Z', rawCode: 'const intacto = true;', language: 'javascript' },
  { id: 'old-grid', title: 'Grid anterior', type: 'grid', updatedAt: '2026-10-21T10:00:00Z', grid: { rows: 50, cols: 26, cells: { A1: { value: '7' } } } }
];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GRID_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://kanlane.com/**', route => route.abort());
    await page.addInitScript(notes => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('kanpad_notes', JSON.stringify(notes)); } }, oldNotes);
    await page.goto(url);
    await page.locator('.home-note').first().waitFor();
    assert.equal(await page.locator('.home-note').count(), 3);
    assert.equal(await page.locator('#homeTitle').innerText(), 'Todas las notas');
    async function manageSubmit(name) { await page.locator('#manageName').fill(name); await page.locator('#manageForm button[type="submit"]').click(); }
    async function openHome() { await page.locator('#btnHome').click(); }
    async function folder(name) { await page.locator('#folderNav').getByRole('button', { name, exact: true }).click(); }
    const docCard = () => page.locator('.home-note[data-note-id="old-doc"]');
    await page.getByRole('button', { name: 'Abrir Documento anterior', exact: true }).click();
    await page.locator('#docSheet').evaluate(el => {
      el.focus(); const range = document.createRange(); range.setStart(el.querySelector('#before').firstChild, 5); range.collapse(true); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    });
    await page.getByRole('button', { name: 'Insertar Tabla', exact: true }).click();
    await page.locator('#tableRowsInput').fill('2'); await page.locator('#tableColsInput').fill('2');
    await page.locator('#btnConfirmTable').click();
    assert.equal(await page.locator('#docSheet table').count(), 1);
    assert.equal(await page.locator('#docSheet table tbody tr').count(), 2);
    assert.equal(await page.locator('#docSheet table th').count(), 2);
    assert.ok(await page.locator('#docSheet').evaluate(el => !!(el.querySelector('table').compareDocumentPosition(el.querySelector('#after')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    await page.locator('#docSheet table td').first().fill('Celda guardada');
    await openHome(); await page.reload();
    await page.getByRole('button', { name: 'Abrir Documento anterior', exact: true }).click();
    assert.equal(await page.locator('#docSheet table td').first().innerText(), 'Celda guardada');
    await page.getByRole('button', { name: 'Insertar Tabla', exact: true }).click();
    await page.locator('#tableRowsInput').fill('0'); await page.locator('#btnConfirmTable').click();
    assert.equal(await page.locator('#docSheet table').count(), 1);
    assert.ok(await page.locator('#tableModal').evaluate(el => el.classList.contains('active')));
    await page.keyboard.press('Escape'); await openHome();
    await page.locator('#btnNewFolder').click(); await manageSubmit('Trabajo');
    assert.equal(await page.locator('#homeTitle').innerText(), 'Trabajo');
    assert.equal(await page.locator('.home-note').count(), 0);
    await folder('Todas las notas');
    await docCard().getByRole('button', { name: 'Mover Documento anterior', exact: true }).click();
    const folderId = await page.locator('#manageFolder option').filter({ hasText: 'Trabajo' }).getAttribute('value');
    await page.locator('#manageFolder').selectOption(folderId); await page.locator('#manageForm button[type="submit"]').click();
    const group = page.getByRole('button', { name: 'Abrir carpeta Trabajo', exact: true });
    assert.equal(await group.count(), 1);
    assert.equal(await group.locator('.home-folder-name').innerText(), 'Trabajo');
    assert.equal(await group.locator('.home-folder-count').innerText(), '1 nota');
    assert.equal(await group.locator('svg[stroke="currentColor"]').count(), 1);
    assert.equal(await group.locator('svg path').getAttribute('d'), await page.locator('#folderNav .folder-link svg path').getAttribute('d'));
    assert.equal(await page.locator('#homeNotes details, #homeNotes summary').count(), 0);
    assert.equal(await docCard().count(), 0, 'las notas de la carpeta no se renderizan en Inicio');
    assert.equal(await page.locator('.home-root .home-note').count(), 2);
    await group.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#homeTitle').innerText(), 'Trabajo');
    assert.equal(await docCard().isVisible(), true); assert.equal(await page.locator('.home-note').count(), 1);
    await folder('Todas las notas');
    await group.focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('#homeTitle').innerText(), 'Trabajo');
    await folder('Todas las notas');
    await page.locator('#searchInput').fill('Documento anterior');
    assert.equal(await group.count(), 1); assert.equal(await page.locator('.home-root').count(), 0);
    await group.click(); assert.equal(await docCard().isVisible(), true);
    await page.locator('#searchInput').fill(''); await folder('Todas las notas');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const resting = await group.evaluate(el => getComputedStyle(el).backgroundColor);
      await group.hover(); await page.waitForTimeout(180);
      assert.notEqual(await group.evaluate(el => getComputedStyle(el).backgroundColor), resting);
      await page.locator('#homeSort').focus(); await page.keyboard.press('Tab');
      assert.equal(await group.evaluate(el => el.matches(':focus-visible')), true);
      assert.equal(await group.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      await page.screenshot({ path: path.join(os.tmpdir(), `kanpad-folder-${theme}-desktop.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await page.screenshot({ path: path.join(os.tmpdir(), `kanpad-folder-${theme}-mobile.png`) });
    }
    await group.click(); assert.equal(await page.locator('#homeTitle').innerText(), 'Trabajo');
    await page.setViewportSize({ width: 1440, height: 900 });
    await folder('Trabajo'); assert.equal(await page.locator('.home-note').count(), 1);
    await docCard().getByRole('button', { name: 'Renombrar Documento anterior', exact: true }).click(); await manageSubmit('Documento renombrado');
    await docCard().getByRole('button', { name: 'Duplicar Documento renombrado', exact: true }).click();
    assert.equal(await page.locator('.home-note').count(), 2);
    await page.locator('[data-create="grid"]').click();
    await page.locator('#noteTitleInput').fill('Datos de trabajo'); await openHome();
    assert.equal(await page.locator('.home-note').count(), 3);
    await page.getByRole('button', { name: 'Renombrar carpeta Trabajo', exact: true }).click(); await manageSubmit('Proyecto');
    await page.reload(); await page.locator('.home-note').first().waitFor();
    await folder('Proyecto'); assert.equal(await page.locator('.home-note').count(), 3);
    await page.locator('#btnNewFolder').click(); await manageSubmit('Proyecto');
    assert.equal(await page.locator('#manageError').innerText(), 'Ya existe una carpeta con ese nombre.');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Eliminar carpeta Proyecto', exact: true }).click(); await page.locator('#actionModal.active').waitFor(); await page.locator('#actionCancel').click();
    assert.equal(await page.locator('#homeTitle').innerText(), 'Proyecto');
    await page.getByRole('button', { name: 'Eliminar carpeta Proyecto', exact: true }).click(); await page.locator('#actionModal.active').waitFor(); await page.locator('#actionSubmit').click();
    assert.equal(await page.locator('#homeTitle').innerText(), 'Sin carpeta');
    assert.equal(await page.locator('.home-note').count(), 5);
    await page.locator('#searchInput').fill('renombrado'); assert.equal(await page.locator('.home-note').count(), 2);
    await page.locator('#searchInput').fill('');
    await page.locator('[data-filter="code"]').click(); assert.equal(await page.locator('.home-note').count(), 1);
    await page.locator('[data-filter="all"]').click();
    await page.screenshot({ path: path.join(os.tmpdir(), 'kanpad-home-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => document.getElementById('btnToggleSidebar').getAttribute('aria-expanded') === 'false');
    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), 'kanpad-home-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    while (await page.locator('.home-note').count()) {
      await page.locator('.home-note').first().getByRole('button', { name: /^Eliminar / }).click(); await page.locator('#actionModal.active').waitFor(); await page.locator('#actionSubmit').click();
    }
    assert.equal(await page.locator('.home-empty').count(), 1);
    await page.reload(); await page.locator('.home-empty').waitFor();
    assert.equal(await page.locator('.home-note').count(), 0);
    await page.locator('[data-create="doc"]').click();
    await page.getByRole('button', { name: 'Insertar Tabla', exact: true }).click();
    await page.locator('#btnConfirmTable').click(); assert.equal(await page.locator('#docSheet table').count(), 1);
    assert.deepEqual(errors, []);
    console.log('OK: tabla en cursor y persistencia, validación, migración, carpetas, mover/renombrar/duplicar, filtros, borrar última nota, crear tras vaciar, móvil.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
