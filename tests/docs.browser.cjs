const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const url = process.env.GRID_TEST_URL || 'http://127.0.0.1:8080';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GRID_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://kanlane.com/**', route => route.abort());
    await page.addInitScript(() => {
      if (localStorage.getItem('seeded')) return;
      localStorage.setItem('seeded', '1');
      localStorage.setItem('kanpad_notes', JSON.stringify([{ id: 'legacy', title: 'Documento anterior', type: 'doc', updatedAt: '2026-10-28T12:00:00Z', content: '<h1>Título anterior</h1><p>Contenido conservado</p>' }]));
    });
    await page.goto(url);
    await page.locator('[data-create="doc"]').click();
    const sheet = page.locator('#docSheet'), style = page.locator('#docTextStyle');
    assert.equal(await sheet.innerText().then(text => text.trim()), '');
    assert.equal(await sheet.locator('h1, hr').count(), 0);
    assert.equal(await style.inputValue(), 'p');
    assert.equal(await sheet.evaluate(el => document.activeElement === el), true);
    await page.keyboard.type('Mi documento');
    assert.equal(await sheet.locator('p').innerText(), 'Mi documento');

    // El selector conserva el cursor al tomar el foco y mantiene el estilo activo.
    await style.selectOption('h1');
    assert.equal(await sheet.locator('h1').innerText(), 'Mi documento');
    await page.waitForFunction(() => document.getElementById('docTextStyle').value === 'h1');
    assert.equal(await sheet.locator('h1').evaluate(el => getComputedStyle(el).borderBottomWidth), '0px');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Descripción');
    assert.equal(await sheet.locator('p').innerText(), 'Descripción');
    assert.equal(await style.inputValue(), 'p');
    await style.selectOption('h2');
    assert.equal(await sheet.locator('h2').innerText(), 'Descripción');
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await page.keyboard.type('Sección'); await style.selectOption('h3');
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await page.keyboard.type('Texto normal y contenido libre.');
    await sheet.locator('h1').click();
    await page.waitForFunction(() => document.getElementById('docTextStyle').value === 'h1');
    await sheet.locator('h2').click();
    await page.waitForFunction(() => document.getElementById('docTextStyle').value === 'h2');

    // Cambiar solo el párrafo seleccionado deja intactos los vecinos.
    await sheet.locator('h3').evaluate(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    });
    await style.selectOption('h4');
    assert.equal(await sheet.locator('h4').innerText(), 'Sección');
    assert.equal(await sheet.locator('h1').innerText(), 'Mi documento');
    await style.selectOption('p');
    assert.equal(await sheet.locator('h4').count(), 0);
    assert.match(await sheet.innerText(), /Sección/);
    await sheet.locator('p').first().click(); await style.selectOption('h3');
    await page.locator('#noteTitleInput').fill('Docs libre');
    await page.locator('#btnHome').click(); await page.reload();
    await page.getByRole('button', { name: 'Abrir Docs libre', exact: true }).click();
    assert.equal(await sheet.locator('h1').innerText(), 'Mi documento');
    assert.equal(await sheet.locator('h2').innerText(), 'Descripción');
    assert.equal(await sheet.locator('h3').innerText(), 'Sección');
    assert.match(await sheet.locator('p').innerText(), /Texto normal/);
    await page.screenshot({ path: path.join(os.tmpdir(), 'kanpad-docs-light.png') });

    // Todos los selectores, incluidos ordenar, Grid y los diálogos, siguen el tema.
    for (const theme of ['dark', 'light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const colors = await page.locator('select').evaluateAll(selects => selects.map(select => {
        const root = getComputedStyle(document.documentElement);
        return {
          scheme: getComputedStyle(select).colorScheme,
          ink: root.getPropertyValue('--ink').trim(),
          surface: root.getPropertyValue('--surface').trim(),
          options: Array.from(select.options).map(option => ({ color: getComputedStyle(option).color, background: getComputedStyle(option).backgroundColor }))
        };
      }));
      for (const select of colors) {
        assert.equal(select.scheme, theme);
        // El navegador normaliza los tokens hexadecimales a rgb().
        const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(pair => parseInt(pair, 16)).join(', ')})`;
        for (const option of select.options) {
          assert.equal(option.color, rgb(select.ink));
          assert.equal(option.background, rgb(select.surface));
          assert.notEqual(option.color, option.background);
        }
      }
    }
    await sheet.locator('h2').click();
    await style.click();
    await page.screenshot({ path: path.join(os.tmpdir(), 'kanpad-docs-dark.png') });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#btnHome').click();
    await page.getByRole('button', { name: 'Abrir Docs libre', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1);
    await page.locator('#docToolbar').evaluate(el => el.scrollLeft = 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), 'kanpad-docs-mobile.png') });
    await page.locator('#btnHome').click();
    await page.getByRole('button', { name: 'Abrir Documento anterior', exact: true }).click();
    assert.equal(await sheet.innerHTML(), '<h1>Título anterior</h1><p>Contenido conservado</p>');
    assert.equal(await sheet.locator('h1').evaluate(el => getComputedStyle(el).borderBottomWidth), '0px');
    assert.deepEqual(errors, []);
    console.log('OK: Docs en blanco, estilos en el cursor y la selección, Enter a texto normal, guardado, documentos anteriores y desplegables claros/oscuros.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
