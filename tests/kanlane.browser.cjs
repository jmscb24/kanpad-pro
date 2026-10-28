// Usa el SDK, PluginFrame, PluginsController y PluginModel del checkout real de Kanlane.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = process.env.KANLANE_SOURCE || path.resolve(__dirname, '../../kanlane-reference');
const url = process.env.GRID_TEST_URL || 'http://127.0.0.1:8080';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GRID_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => { errors.push('Se abrió un diálogo nativo: ' + dialog.message()); dialog.dismiss(); });
    async function routes(p) {
      await p.route('**/kanlane-source/**', route => {
        const filename = path.join(source, new URL(route.request().url()).pathname.split('/kanlane-source/')[1]);
        return route.fulfill({ path: filename });
      });
      await p.route('https://kanlane.com/plugins/sdk/**', route => route.fulfill({ path: path.join(source, 'plugins/sdk', path.basename(new URL(route.request().url()).pathname)) }));
    }
    await routes(page);
    await page.goto(url + '/tests/kanlane-host.html');
    await page.evaluate(() => mount());
    const plugin = () => page.frameLocator('#stage > iframe');
    let f = plugin(); await f.locator('.home-empty').waitFor();
    assert.equal(await f.locator('#projectName').innerText(), 'Proyecto A');
    assert.ok((await page.locator('#stage iframe').getAttribute('sandbox')).includes('allow-scripts'));
    assert.ok(!(await page.locator('#stage iframe').getAttribute('sandbox')).includes('allow-same-origin'));
    assert.ok(!(await page.locator('#stage iframe').getAttribute('sandbox')).includes('allow-modals'));
    assert.equal(await page.frames()[1].evaluate(() => { try { localStorage.getItem('x'); return false; } catch { return true; } }), true);
    assert.equal(await page.evaluate(() => calls.filter(c => c.method === 'storage.set').length), 0, 'abrir el panel vacío no escribe');
    async function saved() { await f.locator('#statusSaveMsg').filter({ hasText: 'Guardado en Kanlane' }).waitFor(); }
    async function home() { await f.locator('#btnHome').click(); await saved(); }
    async function manage(value) { await f.locator('#manageName').fill(value); await f.locator('#manageForm button[type="submit"]').click(); }
    async function confirm() { await f.locator('#actionModal.active').waitFor(); await f.locator('#actionSubmit').click(); }
    await f.locator('#btnNewFolder').click(); await manage('Trabajo'); await saved();
    await f.locator('[data-create="doc"]').click(); await f.locator('#noteTitleInput').fill('Documento integrado');
    await f.locator('#docSheet').fill('Texto del proyecto A');
    await f.getByRole('button', { name: 'Insertar Tabla', exact: true }).click();
    await f.locator('#tableRowsInput').fill('2'); await f.locator('#tableColsInput').fill('2'); await f.locator('#btnConfirmTable').click();
    assert.equal(await f.locator('#docSheet table').count(), 1);
    await f.getByRole('button', { name: 'Bloque Código', exact: true }).click(); await f.locator('#actionInput').fill('python'); await f.locator('#actionSubmit').click();
    assert.equal(await f.locator('.doc-code-block').count(), 1);
    await f.locator('#btnKanlaneTasks').click(); await f.locator('.task-item-card').waitFor();
    assert.match(await f.locator('.task-item-card').innerText(), /Cliente Kanlane/);
    await f.locator('.task-item-card').click(); await home();
    await f.locator('[data-create="code"]').click(); await f.locator('#noteTitleInput').fill('Código integrado'); await f.locator('#codeTextarea').fill('const proyecto = "A";'); await home();
    await f.locator('[data-create="grid"]').click(); await f.locator('#noteTitleInput').fill('Grid integrado');
    async function cell(ref, value) { await f.locator(`[data-ref="${ref}"]`).dblclick(); await f.locator('.grid-cell-input').fill(value); await f.locator('.grid-cell-input').press('Enter'); }
    await cell('A1', '12'); await cell('A2', '3'); await cell('B1', '=SUMA(A1:A2)');
    assert.equal(await f.locator('[data-ref="B1"]').innerText(), '15'); await home();
    assert.equal(await f.locator('.home-note').count(), 3);
    // Cerrar y abrir el iframe crea un origen opaco nuevo: los datos deben venir del SDK.
    await page.evaluate(() => reopen()); f = plugin(); await f.locator('.home-note').first().waitFor();
    assert.equal(await f.locator('.home-note').count(), 3);
    await f.getByRole('button', { name: 'Abrir Documento integrado', exact: true }).click();
    assert.equal(await f.locator('#docSheet table').count(), 1);
    assert.match(await f.locator('#docSheet').innerText(), /Tarea real de prueba/); await home();
    await f.getByRole('button', { name: 'Abrir Código integrado', exact: true }).click(); assert.equal(await f.locator('#codeTextarea').inputValue(), 'const proyecto = "A";');
    await f.locator('[data-mode="doc"]').click(); assert.equal(await f.locator('#noteTitleInput').inputValue(), 'Documento integrado');
    await f.locator('[data-mode="code"]').click(); assert.equal(await f.locator('#codeTextarea').inputValue(), 'const proyecto = "A";'); await home();
    await f.getByRole('button', { name: 'Abrir Grid integrado', exact: true }).click(); assert.equal(await f.locator('[data-ref="B1"]').innerText(), '15');
    await f.locator('#gridImport').setInputFiles({ name: 'prueba.csv', mimeType: 'text/csv', buffer: Buffer.from('Producto;Total\nPrueba;42') }); await confirm();
    assert.equal(await f.locator('[data-ref="B2"]').innerText(), '42'); await home();
    // Probar el plugin oficial Apariencia real en segundo plano, no una emulación de su SDK.
    await page.evaluate(() => mount({ appearance: true, background: true }));
    await page.waitForFunction(() => calls.some(c => c.method === 'ui.setAppearance'));
    await page.evaluate(() => setLook({ theme:'dark', palette:'slate', accent:'#9B4DFF', veil:'aurora', glass:'strong', wash:'strong', font:'default', radius:'round', density:'normal' }));
    await f.locator('html[data-theme="dark"]').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-solid').trim() === '#9B4DFF');
    assert.equal(await f.locator('html').evaluate(el => el.style.getPropertyValue('--accent-solid')), '#9B4DFF');
    assert.equal(await f.locator('html').evaluate(el => el.style.getPropertyValue('--r-lg')), '14px');
    assert.equal(await f.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await page.screenshot({ path: '/tmp/kanpad-kanlane-dark.png', animations: 'disabled' });
    await page.evaluate(() => setLook({ theme:'light', palette:'warm', accent:'#B45309', font:'serif', radius:'sharp', glass:'solid', wash:'none', density:'comfortable' }));
    await f.locator('html[data-theme="light"]').waitFor();
    assert.match(await f.locator('html').evaluate(el => el.style.getPropertyValue('--font')), /Georgia/);
    assert.equal(await f.locator('html').evaluate(el => el.style.getPropertyValue('--r-lg')), '4px');
    await page.screenshot({ path: '/tmp/kanpad-kanlane-paper.png', animations: 'disabled' });
    // Borrados con confirmación propia, también en el sandbox sin allow-modals.
    await f.getByRole('button', { name: 'Eliminar carpeta Trabajo', exact: true }).click(); await confirm(); await saved();
    assert.equal(await f.locator('.home-note').count(), 3);
    await f.getByRole('button', { name: 'Eliminar Código integrado', exact: true }).click(); await f.locator('#actionCancel').click(); assert.equal(await f.locator('.home-note').count(), 3);
    await f.getByRole('button', { name: 'Eliminar Código integrado', exact: true }).click(); await confirm(); await saved(); assert.equal(await f.locator('.home-note').count(), 2);
    // Error real de almacenamiento: no prometer un guardado local imposible.
    await page.evaluate(() => { failWrites = true; });
    await f.locator('[data-create="doc"]').click(); await f.locator('#noteTitleInput').fill('Pendiente'); await f.locator('#btnSave').click();
    await f.locator('#statusSaveMsg').filter({ hasText: 'Sin guardar' }).waitFor();
    assert.ok(!(await f.locator('#statusSaveMsg').innerText()).includes('local'));
    await page.evaluate(() => { failWrites = false; }); await f.locator('#btnSave').click(); await saved(); await home();
    // El cuarto editor usa el mismo almacenamiento por proyecto en el sandbox real.
    await f.locator('[data-create="markdown"]').click();
    await f.locator('#noteTitleInput').fill('Markdown integrado');
    await f.locator('#markdownSource').fill('# Proyecto A\n\n**Markdown persistente**');
    await f.locator('#markdownPreview strong').waitFor(); await home();
    await page.evaluate(() => reopen()); f = plugin();
    await f.getByRole('button', { name: 'Abrir Markdown integrado', exact: true }).click();
    assert.equal(await f.locator('#markdownSource').inputValue(), '# Proyecto A\n\n**Markdown persistente**');
    assert.equal(await f.locator('#markdownPreview strong').innerText(), 'Markdown persistente'); await home();
    // La biblioteca puede superar 100 KB sin sobrepasar 100 KB en ninguna clave.
    await f.getByRole('button', { name: 'Abrir Pendiente', exact: true }).click();
    await f.locator('#docSheet').fill('contenido guardado '.repeat(7000)); await f.locator('#btnSave').click(); await saved();
    const record = await page.evaluate(() => JSON.parse(inspect()['project-a:com.yalerooo.kanpad-pro'].kanpad_library_v2));
    assert.ok(record.parts.length > 1); await page.evaluate(() => reopen()); f = plugin(); await f.locator('.home-note').first().waitFor();
    await f.getByRole('button', { name: 'Abrir Pendiente', exact: true }).click(); assert.ok((await f.locator('#docSheet').innerText()).length > 100000); await home();
    await page.evaluate(() => project('project-b')); f = plugin(); await f.locator('.home-empty').waitFor();
    assert.equal(await f.locator('.home-note').count(), 0);
    await f.locator('[data-create="doc"]').click(); await f.locator('#noteTitleInput').fill('Solo proyecto B'); await home();
    await page.evaluate(() => publish('kanpad_library_v2', {schema:2,data:{notes:[{id:'external',title:'Desde otra ventana',type:'doc',content:'Cambio externo',folderId:null,updatedAt:'2026-10-23T12:00:00Z'}],folders:[]}}));
    await f.getByRole('button', {name:'Abrir Desde otra ventana',exact:true}).waitFor();
    await page.evaluate(() => project('project-a')); f = plugin(); await f.locator('.home-note').first().waitFor(); assert.equal(await f.getByRole('button', { name: 'Abrir Solo proyecto B', exact: true }).count(), 0);
    // La instancia de segundo plano solo registra la acción: no lee ni guarda la biblioteca.
    const readCount = await page.evaluate(() => calls.filter(c => c.method.startsWith('storage.')).length);
    await page.evaluate(() => mount({ background: true })); await page.waitForFunction(() => buttons.some(b => b.id === 'abrir-kanpad'));
    assert.equal(await page.evaluate(() => calls.filter(c => c.method.startsWith('storage.')).length), readCount);
    // La instalación por sondeo entrega un manifiesto válido y no toca el contenido.
    const manifest = await page.evaluate(() => host.probe('/index.html', document.getElementById('backgrounds'), false).then(result => result.manifest));
    assert.equal(manifest.id, 'com.yalerooo.kanpad-pro'); assert.equal(manifest.icon, 'book'); assert.ok(!manifest.permissions.includes('tasks:write'));
    assert.deepEqual(errors, []);
    console.log('OK: SDK/host/controlador/modelo reales, sandbox opaco, Inicio, carpetas, Docs/tabla/código/Grid, guardado y reapertura, CSV, Apariencia real, cuota por clave, proyectos, segundo plano y sondeo.');
    const denied = await browser.newPage(); await routes(denied); await denied.goto(url + '/tests/kanlane-host.html');
    await denied.evaluate(() => { window.denied = true; mount(); });
    const d = denied.frameLocator('#stage iframe'); await d.locator('#connectionMessage').filter({ hasText: 'permiso' }).waitFor(); assert.equal(await d.locator('.kanpad-app').isVisible(), false);
    await denied.evaluate(() => { window.denied = false; failReads = true; reopen(); });
    await d.locator('#connectionMessage').filter({ hasText: 'Lectura fallida' }).waitFor(); assert.equal(await denied.evaluate(() => calls.filter(c => c.method === 'storage.set').length), 0);
    console.log('OK: permiso denegado y lectura fallida bloquean el editor sin sobrescribir datos.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
