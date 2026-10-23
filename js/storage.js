/* Persistencia del proyecto: SDK en Kanlane, navegador solo en modo independiente. */
(function (root) {
  'use strict';
  const KEY = 'kanpad_library_v2', MAX_PART = 28000, INLINE_LIMIT = 90000;
  const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  function validate(value) {
    if (!value || !Array.isArray(value.notes) || !Array.isArray(value.folders)) throw Error('Los datos guardados no son una biblioteca válida.');
    return value;
  }
  class LibraryStorage {
    constructor(wh, options = {}) {
      this.wh = wh; this.generation = 0; this.queue = Promise.resolve(); this.last = null; this.parts = []; this.retired = []; this.nextWrite = 0;
      this.interval = options.interval === undefined ? 1100 : options.interval;
    }
    invalidate() { this.generation++; this.last = null; this.parts = []; this.retired = []; }
    async get(key) {
      // No leer el navegador desde un iframe: su origen es opaco y los proyectos son independientes.
      if (this.wh) return this.wh.storage.get(key);
      const text = localStorage.getItem(key); return text === null ? null : JSON.parse(text);
    }
    async load() {
      const gen = this.generation, record = await this.get(KEY);
      let value, parts = [];
      if (record !== null) {
        if (record.schema !== 2) throw Error('Versión de biblioteca no compatible.');
        if (record.data) { value = record.data; }
        else {
          if (!Array.isArray(record.parts) || record.parts.length > 100 || record.parts.some(key => !/^kanpad_part_[a-z0-9_]+$/.test(key))) throw Error('Índice de biblioteca no válido.');
          const pieces = await Promise.all(record.parts.map(key => this.get(key)));
          if (pieces.some(part => typeof part !== 'string')) throw Error('Falta una parte de la biblioteca guardada.');
          value = JSON.parse(pieces.join('')); parts = record.parts;
        }
      } else {
        // Migrar la versión anterior solo dentro del mismo proyecto/origen.
        const [notes, folders] = await Promise.all([this.get('kanpad_notes'), this.get('kanpad_folders')]);
        if (notes !== null && !Array.isArray(notes) || folders !== null && !Array.isArray(folders)) throw Error('Los datos anteriores no son válidos.');
        value = { notes: notes || [], folders: folders || [] };
      }
      if (gen !== this.generation) throw Error('El proyecto ha cambiado.');
      validate(value); this.parts = parts; this.last = JSON.stringify(value);
      return value;
    }
    save(value) {
      const json = JSON.stringify(validate(value)), gen = this.generation;
      const run = () => this.writeSnapshot(json, gen);
      this.queue = this.queue.catch(() => {}).then(run); return this.queue;
    }
    async write(key, value, gen, remove = false) {
      if (gen !== this.generation) throw Error('El proyecto ha cambiado.');
      if (this.wh) {
        const delay = Math.max(0, this.nextWrite - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        if (gen !== this.generation) throw Error('El proyecto ha cambiado.');
        this.nextWrite = Date.now() + this.interval;
        if (remove) await this.wh.storage.remove(key); else await this.wh.storage.set(key, value);
      } else if (remove) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    }
    async writeSnapshot(json, gen) {
      if (gen !== this.generation) throw Error('El proyecto ha cambiado.');
      if (json === this.last) return;
      // Limpiar solo fragmentos que ya no forman parte del índice confirmado.
      while (this.retired.length) {
        const key = this.retired[0]; await this.write(key, null, gen, true); this.retired.shift();
      }
      const data = JSON.parse(json), inline = { schema: 2, data }, next = [];
      try {
        if (!this.wh || bytes(inline) <= INLINE_LIMIT) await this.write(KEY, inline, gen);
        else {
          const revision = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
          for (let offset = 0, i = 0; offset < json.length; offset += MAX_PART, i++) {
            const key = 'kanpad_part_' + revision + '_' + i;
            await this.write(key, json.slice(offset, offset + MAX_PART), gen); next.push(key);
          }
          // Publicar el índice al final: un fallo no reemplaza los datos anteriores.
          await this.write(KEY, { schema: 2, parts: next }, gen);
        }
      } catch (error) { if (gen === this.generation) this.retired.push(...next); throw error; }
      if (gen !== this.generation) throw Error('El proyecto ha cambiado.');
      this.retired.push(...this.parts); this.parts = next; this.last = json;
      // Los datos antiguos se conservan para recuperar una migración; no se usan si hay índice v2.
    }
    flushLocal(value) {
      if (!this.wh) localStorage.setItem(KEY, JSON.stringify({ schema: 2, data: validate(value) }));
    }
  }
  root.KanPadStorage = LibraryStorage;
  if (typeof module !== 'undefined') module.exports = { LibraryStorage, KEY, validate };
})(typeof window === 'undefined' ? globalThis : window);
