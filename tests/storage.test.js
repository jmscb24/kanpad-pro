const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LibraryStorage, KEY } = require('../js/storage.js');
function backend(initial = {}) {
  const values = structuredClone(initial), writes = [];
  return { values, writes, wh: { storage: {
    async get(key) { return structuredClone(values[key] ?? null); },
    async set(key, value) {
      assert.ok(new TextEncoder().encode(JSON.stringify(value)).length <= 100 * 1024, '100 KB por clave');
      writes.push(key); values[key] = structuredClone(value);
    },
    async remove(key) { delete values[key]; }
  } } };
}
const library = text => ({ notes: [{ id: 'doc', type: 'doc', title: 'Doc', content: text }], folders: [] });
test('migra datos del SDK sin acceder a localStorage y conserva una colección vacía', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Origen opaco'); } });
  const data = backend({ kanpad_notes: [], kanpad_folders: [] });
  const storage = new LibraryStorage(data.wh, { interval: 0 });
  assert.deepEqual(await storage.load(), { notes: [], folders: [] });
  await storage.save(library('conservado'));
  assert.equal((await new LibraryStorage(data.wh).load()).notes[0].content, 'conservado');
  assert.deepEqual(data.values.kanpad_notes, []);
});
test('no escribe si no hay cambios y publica bibliotecas grandes por fragmentos', async () => {
  const data = backend(), storage = new LibraryStorage(data.wh, { interval: 0 });
  await storage.load(); const big = library('á💡<p>nota</p>'.repeat(14000));
  await storage.save(big);
  assert.ok(data.values[KEY].parts.length > 1);
  assert.deepEqual(await new LibraryStorage(data.wh).load(), big);
  const count = data.writes.length; await storage.save(big); assert.equal(data.writes.length, count);
});
test('un fallo al publicar no reemplaza la biblioteca confirmada', async () => {
  const data = backend(), storage = new LibraryStorage(data.wh, { interval: 0 });
  await storage.load(); await storage.save(library('original'));
  const set = data.wh.storage.set; data.wh.storage.set = async (key, value) => { if (key === KEY) throw Error('quota'); await set(key, value); };
  await assert.rejects(storage.save(library('nueva'.repeat(30000))), /quota/);
  assert.equal((await new LibraryStorage(data.wh).load()).notes[0].content, 'original');
  data.wh.storage.set = set; await storage.save(library('reintentado'));
  assert.equal((await new LibraryStorage(data.wh).load()).notes[0].content, 'reintentado');
});
test('un error de lectura se propaga y un índice incompleto no se sustituye por demos', async () => {
  const data = backend({ [KEY]: { schema: 2, parts: ['kanpad_part_missing'] } });
  await assert.rejects(new LibraryStorage(data.wh).load(), /Falta una parte/);
  data.wh.storage.get = async () => { throw Error('permission-denied'); };
  await assert.rejects(new LibraryStorage(data.wh).load(), /permission-denied/);
});
test('invalida guardados en cola al cambiar de proyecto', async () => {
  const data = backend(), storage = new LibraryStorage(data.wh, { interval: 0 });
  await storage.load(); const pending = storage.save(library('proyecto anterior')); storage.invalidate();
  await assert.rejects(pending, /proyecto/); assert.equal(data.writes.length, 0);
});
