// Anneau de progression (Dark Glow) : valeur bornée, pas d'arc à zéro, nom pour VoiceOver seulement s'il est donné.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ring } from '../js/ring.js';

const offset = h => Number((h.match(/stroke-dashoffset="([\d.]+)"/) || [])[1]);

test('l’anneau borne sa valeur entre 0 et 1 : à moitié, l’arc est à moitié caché ; au-delà de 1, il est plein', () => {
  assert.equal(offset(ring(0.5)), 157.1);
  assert.equal(offset(ring(1.8)), 0);
});

test('à zéro, ou sans valeur, l’anneau n’a pas d’arc (seulement la piste)', () => {
  assert.ok(!ring(0).includes('class="pg"'));
  assert.ok(!ring(null).includes('class="pg"'));
});

test('l’anneau est décoratif sans nom, et lu par VoiceOver avec un nom échappé', () => {
  assert.match(ring(0.3), /aria-hidden="true"/);
  assert.match(ring(0.3, { label: '1 200 kcal sur 2 000 <b>' }), /role="img" aria-label="1 200 kcal sur 2 000 &lt;b&gt;"/);
});

test('deux anneaux de la même page ont des dégradés différents', () => {
  const id = h => h.match(/id="(rg\d+)"/)[1];
  assert.notEqual(id(ring(0.2)), id(ring(0.2)));
});
