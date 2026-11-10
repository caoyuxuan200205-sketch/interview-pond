import test from 'node:test';
import assert from 'node:assert/strict';
import { rollAppearance } from '../src/birth.mjs';
test('all 12 species and all 17 palettes are reachable independently', () => {
  const combinations = new Set();
  for (let sprite = 0; sprite < 12; sprite++) for (let skin = 0; skin < 17; skin++) {
    const samples = [(sprite + .5) / 12, skin === 16 ? .04 : .08 + (skin + .5) * .92 / 16];
    const a = rollAppearance(() => samples.shift());
    assert.equal(a.sprite, sprite); assert.equal(a.skin, skin); combinations.add(`${a.sprite}:${a.skin}`);
  }
  assert.equal(combinations.size, 204);
});
test('probability buckets: internet 8%, each classic palette 5.75%', () => {
  const counts = Array(17).fill(0);
  for (let n = 0; n < 10000; n++) { let call = 0; const a = rollAppearance(() => call++ ? (n + .5) / 10000 : .5); counts[a.skin]++; }
  assert.equal(counts[16], 800);
  assert.deepEqual(counts.slice(0, 16), Array(16).fill(575));
});
