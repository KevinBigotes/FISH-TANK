import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasPoint, containsInk, paintStroke, replayDrawing } from '../frontend/src/drawing/canvas-model.js';

test('coordenadas táctiles escalan con el tamaño visible sin cambiar la resolución del PNG', () => {
  assert.deepEqual(canvasPoint(180, 140, { left: 20, top: 20, width: 320, height: 240 }), { x: 512, y: 384 });
  assert.deepEqual(canvasPoint(-10, 999, { left: 0, top: 0, width: 320, height: 240 }), { x: 0, y: 768 });
});

test('el borrador elimina alfa y al deshacer se reconstruyen los trazos sin ninguna guía', () => {
  const operations = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {},
    stroke() { operations.push(this.globalCompositeOperation); },
    fill() { operations.push(this.globalCompositeOperation); },
    clearRect() { operations.push('clear'); },
  };
  const stroke = { tool: 'brush', color: '#ffffff', width: 14, points: [{ x: 1, y: 1 }] };
  paintStroke(context, { ...stroke, tool: 'eraser' });
  assert.deepEqual(operations, ['destination-out']);
  operations.length = 0;
  replayDrawing(context, [stroke, { type: 'clear' }, stroke]);
  assert.deepEqual(operations, ['clear', 'source-over', 'clear', 'source-over']);
  assert.equal(containsInk({ data: new Uint8Array([255, 255, 255, 0]) }), false);
  assert.equal(containsInk({ data: new Uint8Array([255, 255, 255, 1]) }), true);
});
