const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const bash = '#!/bin/bash\n# Comentario\nNAME="KanPad"\nif [ -n "$NAME" ]; then\n  echo "Hola $NAME"\nfi\n';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GRID_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://kanlane.com/**', route => route.abort());
    await page.goto(process.env.GRID_TEST_URL || 'http://127.0.0.1:8080');
    await page.locator('[data-create="code"]').click();
    await page.locator('#codeLangSelect').selectOption('bash');
    await page.locator('#codeTextarea').fill(bash);
    assert.equal(await page.locator('#codeHighlight code').textContent(), bash + '\n');
    assert.ok(await page.locator('#codeHighlight .hljs-keyword').count());
    assert.ok(await page.locator('#codeHighlight .hljs-string').count());
    assert.ok(await page.locator('#codeHighlight .hljs-comment').count());
    const unsupported = await page.evaluate(() => KanPadSyntax.highlight('<img src=x onerror=alert(1)>', 'unknown'));
    assert.match(unsupported, /&lt;img/);
    assert.equal(await page.evaluate(() => Array.from(document.querySelector('#codeLangSelect').options).every(o => o.value === 'html' || o.value === 'toml' || !!hljs.getLanguage(o.value))), true);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const colors = await page.locator('#codeHighlight').evaluate(pre => ({
        keyword: getComputedStyle(pre.querySelector('.hljs-keyword')).color,
        string: getComputedStyle(pre.querySelector('.hljs-string')).color,
        text: getComputedStyle(pre).color
      }));
      assert.notEqual(colors.keyword, colors.string); assert.notEqual(colors.keyword, colors.text);
      await page.screenshot({ path: path.join(os.tmpdir(), `kanpad-syntax-${theme}.png`) });
    }
    // Scroll en ambos ejes y Tab mantienen el original y la capa de colores alineados.
    await page.locator('#codeTextarea').fill((bash + 'echo "' + 'x'.repeat(250) + '"\n').repeat(60));
    await page.locator('#codeTextarea').evaluate(el => { el.scrollTop = 300; el.scrollLeft = 200; el.dispatchEvent(new Event('scroll')); });
    assert.deepEqual(await page.evaluate(() => {
      const a = document.getElementById('codeTextarea'), b = document.getElementById('codeHighlight');
      return [a.scrollTop === b.scrollTop, a.scrollLeft === b.scrollLeft];
    }), [true, true]);
    await page.locator('#codeTextarea').fill(bash); await page.keyboard.press('Control+End'); await page.keyboard.press('Tab');
    assert.equal(await page.locator('#codeTextarea').inputValue(), bash + '  ');
    await page.locator('#codeLangSelect').selectOption('plaintext');
    assert.equal(await page.locator('#codeHighlight span').count(), 0);
    await page.locator('#btnHome').click(); await page.locator('[data-create="markdown"]').click();
    const markdown = '```shell\n' + bash + '```\n\n```unknown\n<img src=x onerror=alert(1)>\n```';
    await page.locator('#markdownSource').fill(markdown);
    await page.locator('#markdownPreview .hljs-keyword').first().waitFor();
    assert.equal(await page.locator('#markdownPreview img').count(), 0);
    assert.equal(await page.locator('#markdownSource').inputValue(), markdown);
    // Docs: bloques existentes, selección y reapertura conservan texto y colores.
    await page.locator('#btnHome').click(); await page.locator('[data-create="doc"]').click();
    await page.locator('#docSheet').evaluate((el, source) => {
      el.innerHTML = '<pre><code class="language-bash"></code></pre><p>Después</p>';
      const code = el.querySelector('code'); code.textContent = source;
      el.focus(); const selection = getSelection(); selection.setBaseAndExtent(code.firstChild, 1, code.firstChild, 5);
    }, bash);
    await page.locator('#noteTitleInput').fill('Bash en Docs');
    assert.equal(await page.locator('#docSheet code').textContent(), bash);
    assert.ok(await page.locator('#docSheet .hljs-keyword').count());
    assert.equal(await page.locator('#noteTitleInput').inputValue(), 'Bash en Docs');
    await page.locator('#docToolbar [title="Negrita (Ctrl+B)"]').click();
    assert.equal(await page.evaluate(() => getSelection().toString()), '!/bi');
    await page.locator('#btnHome').click(); await page.reload();
    await page.getByRole('button', { name: 'Abrir Bash en Docs', exact: true }).click();
    assert.equal(await page.locator('#docSheet code').textContent(), bash);
    assert.ok(await page.locator('#docSheet .hljs-keyword').count());
    assert.deepEqual(errors, []);
    console.log('OK: Bash, lenguajes del selector, colores claro/oscuro, escape HTML, texto plano, scroll/Tab, Markdown y Docs con selección y persistencia.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
