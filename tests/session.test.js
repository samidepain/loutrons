// Séance en cours : exercice ouvert, série en cours, question des reps en réserve ; valeur ± palier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionFocus, upNext } from '../js/data.js';
import { stepValue } from '../js/util.js';

const it = (ex, kind, ss) => ({ ex, name: ex, kind: kind || 'load', ss: ss || null, sets: 3, lo: 8, hi: 12, rest: 90, step: 2.5 });
const etat = (n, faites, extra) => Object.assign({ sets: Array.from({ length: n }, (_, i) => ({ kg: '50', reps: null, done: i < faites })), rir: null, done: false, skip: false }, extra);
const enCours = (items, ex) => ({ date: '2026-11-04', status: 'en_cours', items, ex, targets: {} });
const deux = (a, b) => enCours([it('a'), it('b')], { a, b });

test('au début, le 1er exercice est ouvert sur sa 1re série', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 0), etat(3, 0)), {}), { open: ['a'], turn: { ex: 'a', i: 0 }, ask: null });
});
test('la série en cours est la première non validée', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 2), etat(3, 0)), {}).turn, { ex: 'a', i: 2 });
});
test('après la dernière série, la question des reps en réserve garde l’exercice ouvert, sans série en cours', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 3), etat(3, 0)), { ask: 'a' }), { open: ['a'], turn: null, ask: 'a' });
});
test('une question sur un exercice qui n’est plus terminé est ignorée', () => {
  assert.equal(sessionFocus(deux(etat(3, 2), etat(3, 0)), { ask: 'a' }).ask, null);
});
test('sans question en attente, l’exercice suivant non terminé s’ouvre', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 3), etat(3, 0)), {}), { open: ['b'], turn: { ex: 'b', i: 0 }, ask: null });
});
test('un exercice ouvert à la main l’emporte, même plus loin', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 1), etat(3, 0)), { open: 'b' }), { open: ['b'], turn: { ex: 'b', i: 0 }, ask: null });
});
test('un exercice ouvert à la main qui n’est plus dans la séance est ignoré', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 1), etat(3, 0)), { open: 'zz' }).open, ['a']);
});
test('superset : les deux exercices sont ouverts et la série en cours alterne A1, B1, A2', () => {
  const w = (fa, fb) => enCours([it('a', 'load', 's1'), it('b', 'load', 's1'), it('c')], { a: etat(3, fa), b: etat(3, fb), c: etat(3, 0) });
  assert.deepEqual(sessionFocus(w(0, 0), {}), { open: ['a', 'b'], turn: { ex: 'a', i: 0 }, ask: null });
  assert.deepEqual(sessionFocus(w(1, 0), {}).turn, { ex: 'b', i: 0 });
  assert.deepEqual(sessionFocus(w(1, 1), {}).turn, { ex: 'a', i: 1 });
});
test('superset inégal : quand A est fini, la dernière série de B est en cours', () => {
  const w = enCours([it('a', 'load', 's1'), it('b', 'load', 's1')], { a: etat(3, 3), b: etat(4, 3) });
  assert.deepEqual(sessionFocus(w, {}), { open: ['a', 'b'], turn: { ex: 'b', i: 3 }, ask: null });
});
test('un exercice passé est sauté', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 0, { skip: true }), etat(3, 0)), {}), { open: ['b'], turn: { ex: 'b', i: 0 }, ask: null });
});
test('un exercice passé ouvert à la main est ouvert, sans série en cours', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 0, { skip: true }), etat(3, 0)), { open: 'a' }), { open: ['a'], turn: null, ask: null });
});
test('une séance finie n’a plus d’exercice ouvert ni de série en cours', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 3), etat(3, 3)), {}), { open: [], turn: null, ask: null });
});
test('exercice à cocher puis cardio : la série en cours est la série 0', () => {
  const w = done => enCours([it('k', 'check'), it('c', 'cardio')], { k: { sets: [], done, rir: null, skip: false }, c: etat(1, 0) });
  assert.deepEqual(sessionFocus(w(false), {}).turn, { ex: 'k', i: 0 });
  assert.deepEqual(sessionFocus(w(true), {}).turn, { ex: 'c', i: 0 });
});
test('valeur ± palier : arrondie au centième, jamais sous 0, vide compté pour 0', () => {
  assert.equal(stepValue(49.5, 1, 2.5), 52);
  assert.equal(stepValue(0.1, 1, 0.2), 0.3);
  assert.equal(stepValue(1, -1, 2.5), 0);
  assert.equal(stepValue(null, 1, 2.5), 2.5);
  assert.equal(stepValue(6, -1, 1), 5);
});
test('une question des reps en réserve en attente l’emporte sur un exercice ouvert à la main', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 3), etat(3, 0)), { open: 'b', ask: 'a' }), { open: ['a'], turn: null, ask: 'a' });
});
test('un exercice terminé ouvert à la main est ouvert, sans série en cours', () => {
  assert.deepEqual(sessionFocus(deux(etat(3, 3), etat(3, 0)), { open: 'a' }), { open: ['a'], turn: null, ask: null });
});
test('ensuite : après la dernière série d’un exercice, le suivant non terminé', () => {
  assert.equal(upNext(deux(etat(3, 3), etat(3, 0)), {}).ex, 'b');
});
test('ensuite : superset inégal dont le 2e exercice finit d’abord, la 4e série du 1er', () => {
  const w = enCours([it('a', 'load', 's1'), it('b', 'load', 's1'), it('c')], { a: etat(4, 3), b: etat(3, 3), c: etat(3, 0) });
  assert.equal(upNext(w, {}).ex, 'a');
});
test('ensuite : un exercice fait hors ordre (ouvert à la main) mène au premier exercice non terminé', () => {
  const w = enCours([it('a'), it('b'), it('c')], { a: etat(3, 0), b: etat(3, 3), c: etat(3, 0) });
  assert.equal(upNext(w, { open: 'b' }).ex, 'a');
});
test('ensuite : rien quand la séance est finie', () => {
  assert.equal(upNext(deux(etat(3, 3), etat(3, 3)), {}), null);
});
