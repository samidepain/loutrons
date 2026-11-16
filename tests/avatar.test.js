// Avatar en couches : configuration valide, ordre des couches, catalogue et fichiers mis en cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { avatarOf, avatarReady, fileOf, ITEMS, layersOf, SLOTS } from '../js/avatar.js';

const essai = [
  { id:'corps', slot:'body', name:'Brun' },
  { id:'heureux', slot:'face', name:'Heureux' }, { id:'rieur', slot:'face', name:'Rieur' },
  { id:'casquette', slot:'hat', name:'Casquette' }, { id:'sweat', slot:'top', name:'Sweat' },
  { id:'couronne', slot:'hat', name:'Couronne', unlock:{ level:10 } }
];

test('la personnalisation reste fermée tant qu’une couche obligatoire n’a pas d’illustration', () => {
  assert.equal(avatarReady([]), false);
  assert.equal(avatarReady(essai.filter(it => it.slot !== 'face')), false);
  assert.equal(avatarReady(essai), true);
});

test('sans choix, l’avatar prend le premier élément de chaque couche obligatoire et rien d’autre', () => {
  assert.deepEqual(avatarOf(null, essai), { body:'corps', face:'heureux' });
});

test('un élément inconnu ou pas encore débloqué est retiré de l’avatar enregistré', () => {
  assert.deepEqual(avatarOf({ face:'rieur', hat:'couronne', top:'disparu', eyes:'' }, essai), { body:'corps', face:'rieur' });
  // au niveau demandé, l'élément est débloqué
  assert.deepEqual(avatarOf({ hat:'couronne' }, essai, 10), { body:'corps', face:'heureux', hat:'couronne' });
});

test('les couches se dessinent du fond vers le dessus, dans l’ordre de SLOTS', () => {
  assert.deepEqual(layersOf({ hat:'casquette', top:'sweat', face:'rieur' }, essai).map(it => it.id), ['corps', 'sweat', 'rieur', 'casquette']);
});

test('catalogue : identifiants uniques, couche connue, image présente et mise en cache par sw.js', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal(new Set(ITEMS.map(it => it.id)).size, ITEMS.length);
  assert.deepEqual(ITEMS.filter(it => !SLOTS.some(s => s.id === it.slot)), []);
  assert.deepEqual(ITEMS.map(fileOf).filter(f => !existsSync(new URL('../' + f, import.meta.url)) || !sw.includes("'" + f + "'")), []);
});
