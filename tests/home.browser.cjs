const { chromium } = require('playwright');
const assert = require('node:assert/strict');
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
    page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'Eliminar carpeta Proyecto', exact: true }).click();
    assert.equal(await page.locator('#homeTitle').innerText(), 'Proyecto');
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Eliminar carpeta Proyecto', exact: true }).click();
    assert.equal(await page.locator('#homeTitle').innerText(), 'Sin carpeta');
    assert.equal(await page.locator('.home-note').count(), 5);
    await page.locator('#searchInput').fill('renombrado'); assert.equal(await page.locator('.home-note').count(), 2);
    await page.locator('#searchInput').fill('');
    await page.locator('[data-filter="code"]').click(); assert.equal(await page.locator('.home-note').count(), 1);
    await page.locator('[data-filter="all"]').click();
    await page.screenshot({ path: '/tmp/kanpad-home-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => document.getElementById('btnToggleSidebar').getAttribute('aria-expanded') === 'false');
    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '/tmp/kanpad-home-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    while (await page.locator('.home-note').count()) {
      page.once('dialog', d => d.accept()); await page.locator('.home-note').first().getByRole('button', { name: /^Eliminar / }).click();
    }
    assert.equal(await page.locator('.home-empty').count(), 1);
    await page.reload(); await page.locator('.home-empty').waitFor();
    assert.equal(await page.locator('.home-note').count(), 0);
    await page.locator('[data-create="doc"]').click();
    await page.getByRole('button', { name: 'Insertar Tabla', exact: true }).click();
    await page.locator('#btnConfirmTable').click(); assert.equal(await page.locator('#docSheet table').count(), 1);
    assert.deepEqual(errors, []);
    console.log('OK: tabla en cursor y persistencia, validación, migración, carpetas, mover/renombrar/duplicar, filtros, borrar última nota, crear tras vaciar, móvil.');
    // La colección remota vacía debe prevalecer sobre un respaldo local antiguo.
    const sdk = await browser.newPage();
    await sdk.route('https://kanlane.com/**', route => route.abort());
    await sdk.route('http://127.0.0.1:8080/host-test', route => route.fulfill({ contentType: 'text/html', body: '<iframe src="/"></iframe>' }));
    await sdk.addInitScript(() => {
      localStorage.setItem('kanpad_notes', JSON.stringify([{ id: 'stale', title: 'Copia antigua', type: 'doc', content: 'No restaurar' }]));
      window.testStore = { kanpad_notes: [], kanpad_folders: [] };
      window.WorkhubPlugin = { connect: async () => ({ storage: { get: async key => window.testStore[key], set: async (key, value) => { window.testStore[key] = JSON.parse(JSON.stringify(value)); } }, ui: { toast() {} } }) };
    });
    await sdk.goto(url + '/host-test');
    const frame = sdk.frameLocator('iframe'); await frame.locator('.home-empty').waitFor();
    await frame.locator('#btnNewFolder').click(); await frame.locator('#manageName').fill('Remota'); await frame.locator('#manageForm button[type="submit"]').click();
    await frame.locator('[data-create="doc"]').click(); await frame.locator('#btnHome').click();
    await frame.locator('#statusSaveMsg').filter({ hasText: 'Guardado en Kanlane' }).waitFor();
    const remote = await sdk.frames()[1].evaluate(() => window.testStore);
    assert.equal(remote.kanpad_notes.length, 1); assert.equal(remote.kanpad_folders[0].name, 'Remota');
    console.log('OK: SDK simulado, colección vacía y persistencia de notas y carpetas.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
