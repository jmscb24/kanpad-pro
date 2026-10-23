const { test } = require('node:test');
const assert = require('node:assert/strict');
const Grid = require('../js/grid.js');
const sheet = cells => ({ rows: 50, cols: 26, cells: Object.fromEntries(Object.entries(cells).map(([ref, value]) => [ref, { value }])) });
test('columnas y referencias más allá de Z', () => {
  assert.equal(Grid.columnName(26), 'AA');
  assert.deepEqual(Grid.position('$CV$1000'), [999, 99]);
  assert.throws(() => Grid.position('A1001'), /REF/);
});
test('fórmulas, precedencia, referencias y funciones en ambos idiomas', () => {
  const data = sheet({ A1: '10', A2: '2,5', A3: 'texto', B1: '=SUMA(A1:A3)', B2: '=AVERAGE(A1:A3)', B3: '=CONTAR(A1:A4)', C1: '=B1*2+(3^2)-1', C2: '=MIN(A1:A3)+MAX(A1:A3)', C3: '=SUM(A1;A2;2)', D1: '=-2^2', D2: '=2^3^2' });
  assert.equal(Grid.evaluate(data, 'B1'), 12.5);
  assert.equal(Grid.evaluate(data, 'B2'), 6.25);
  assert.equal(Grid.evaluate(data, 'B3'), 2);
  assert.equal(Grid.evaluate(data, 'C1'), 33);
  assert.equal(Grid.evaluate(data, 'C2'), 12.5);
  assert.equal(Grid.evaluate(data, 'C3'), 14.5);
  assert.equal(Grid.evaluate(data, 'D1'), -4);
  assert.equal(Grid.evaluate(data, 'D2'), 512);
  data.cells.A1.value = '20';
  assert.equal(Grid.evaluate(data, 'B1'), 22.5);
});
test('errores visibles sin ejecutar JavaScript y ciclos detectados', () => {
  const data = sheet({ A1: '=B1', B1: '=A1', C1: '=1/0', C2: '=A99', C3: '=alert(1)', C4: '=1+?', C5: '=SUM(A1:A2)' });
  assert.equal(Grid.result(data, 'A1'), '#CYCLE!');
  assert.equal(Grid.result(data, 'C1'), '#DIV/0!');
  assert.equal(Grid.result(data, 'C2'), '#REF!');
  assert.equal(Grid.result(data, 'C3'), '#NAME?');
  assert.equal(Grid.result(data, 'C4'), '#ERROR!');
  assert.equal(Grid.result(data, 'C5'), '#CYCLE!');
});
test('CSV y TSV con comillas, saltos de línea y BOM', () => {
  assert.deepEqual(Grid.parseDelimited('\uFEFFNombre;Importe\r\n"A;B";"2,5"\r\n'), [['Nombre', 'Importe'], ['A;B', '2,5']]);
  assert.deepEqual(Grid.parseDelimited('"a\nb"\t"c""d"\n', '\t'), [['a\nb', 'c"d']]);
  assert.throws(() => Grid.parseDelimited('"sin cerrar'), /comillas/);
  const data = sheet({ A1: 'a,b', B1: '="x"', A2: '2', B2: '=A2*3', C2: '@texto' });
  const rows = Grid.parseDelimited(Grid.toCSV(data));
  assert.equal(rows[0][0], 'a,b');
  assert.equal(rows[1][1], '6');
  assert.equal(rows[1][2], "'@texto");
});
