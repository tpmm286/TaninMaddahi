import test from 'node:test';
import assert from 'node:assert/strict';

// localStorage ساختگی برای اجرای آزمون در Node
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

const mem = await import('./playbackMemory.ts');

test('موقعیت نزدیک به ابتدا و انتها ذخیره نمی‌شود', () => {
  assert.equal(mem.isResumablePosition(0.5, 100), false);
  assert.equal(mem.isResumablePosition(1.9, 100), false);
  assert.equal(mem.isResumablePosition(2, 100), true);
  assert.equal(mem.isResumablePosition(50, 100), true);
  assert.equal(mem.isResumablePosition(98, 100), false);
  assert.equal(mem.isResumablePosition(NaN, 100), false);
});

test('ذخیره و بازیابی مکان پخش هر اثر', () => {
  mem.savePositions({ a: 83.4, b: 12 });
  assert.deepEqual(mem.loadPositions(), { a: 83.4, b: 12 });
});

test('مقادیر خراب نادیده گرفته می‌شوند', () => {
  store.set('tanin_maddahi_positions_v1', JSON.stringify({ a: 'x', b: -3, c: 40 }));
  assert.deepEqual(mem.loadPositions(), { c: 40 });
  store.set('tanin_maddahi_positions_v1', '{bad json');
  assert.deepEqual(mem.loadPositions(), {});
});

test('آخرین اثر باز شده به خاطر سپرده می‌شود', () => {
  assert.equal(mem.loadLastTrackId(), null);
  mem.saveLastTrackId('track-9');
  assert.equal(mem.loadLastTrackId(), 'track-9');
});
