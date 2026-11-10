// Bibliothèque d'exercices : identifiants conservés, champs valides, photos présentes, et recherche tolérante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { ALIAS, BASE_EX, BASE_TPL, KINDS, CATS, MUSCLES, PROGRAMS } from '../js/library.js';
import { allEx, searchEx } from '../js/data.js';
import { firstFace, musclesForMap } from '../js/bodymap.js';
import { donnees, reglages, docs } from './aide.js';

// Identifiants d'avant l'étape 11 : l'historique s'y rattache, ils ne doivent jamais disparaître
const ANCIENS = ['ua_bench', 'ua_pull', 'ua_lat', 'ua_rear', 'ua_skull', 'ua_curl', 'ua_abs', 'la_warm', 'la_pogo', 'la_cmj', 'la_hack', 'la_rdl', 'la_step', 'la_ext', 'la_calf',
  'ub_incl', 'ub_chin', 'ub_row', 'ub_fly', 'ub_ham', 'ub_rope', 'ub_abs', 'lb_rope', 'lb_press', 'lb_thrust', 'lb_curl', 'lb_abd', 'lb_back', 'lb_calf',
  'lib_press1', 'lib_revlunge', 'lib_goblet', 'lib_stepdown', 'lib_nordic', 'lib_seatcalf', 'lib_pulldown', 'lib_rowbar', 'lib_cablerow', 'lib_ohp', 'lib_ohext', 'lib_pallof',
  'lib_boxjump', 'lib_squat', 'lib_bench', 'lib_deadlift', 'lib_bulgarian', 'lib_legext', 'lib_dips', 'lib_pushup', 'lib_curlbar', 'lib_facepull', 'lib_legraise'];
const photos = new URL('../photos/', import.meta.url);

test('les anciens identifiants d’exercice existent toujours, avec leurs alias', () => {
  assert.deepEqual(ANCIENS.filter(id => !BASE_EX[id]), []);
  Object.values(ALIAS).forEach(id => assert.ok(BASE_EX[id], id));
  assert.ok(Object.keys(BASE_EX).length >= 140);
});

test('chaque exercice a des champs valides', () => {
  const erreurs = []; const noms = new Map();
  Object.entries(BASE_EX).forEach(([id, e]) => {
    const err = m => erreurs.push(id + ' : ' + m);
    if (!/^[a-z0-9_]+$/.test(id)) err('identifiant');
    if (!e.name) err('nom');
    if (noms.has(e.name)) err('même nom que ' + noms.get(e.name)); noms.set(e.name, id);
    if (!KINDS[e.kind]) err('type ' + e.kind);
    const m = e.muscles || { p: [], s: [] };
    [...m.p, ...m.s].forEach(x => { if (MUSCLES.indexOf(x) < 0) err('muscle ' + x); });
    if (m.p.some(x => m.s.indexOf(x) >= 0)) err('muscle à la fois principal et secondaire');
    if (e.kind === 'load' || e.kind === 'bw') {
      if (!CATS[e.cat]) err('catégorie ' + e.cat);
      if (!(e.sets > 0 && e.lo > 0 && e.hi >= e.lo && e.rest > 0 && e.step > 0)) err('séries, reps, repos ou palier');
      if (!m.p.length) err('aucun muscle principal');
    }
    if (e.kind === 'plyo' && !(e.sets > 0 && e.lo > 0 && e.unit)) err('séries, volume ou unité');
    if (e.aka && !(Array.isArray(e.aka) && e.aka.every(a => typeof a === 'string' && a))) err('autres noms');
  });
  assert.deepEqual(erreurs, []);
});

test('chaque photo indiquée existe (départ et arrivée), et chaque photo du dossier sert', () => {
  const utilisees = new Set();
  const manquantes = [];
  Object.entries(BASE_EX).forEach(([id, e]) => {
    if (!e.photo) return;
    [0, 1].forEach(n => { const f = e.photo + '-' + n + '.jpg'; utilisees.add(f); if (!existsSync(new URL(f, photos))) manquantes.push(id + ' : ' + f); });
  });
  assert.deepEqual(manquantes, []);
  assert.deepEqual(readdirSync(photos).filter(f => f.endsWith('.jpg') && !utilisees.has(f)), []);
});

test('les séances et programmes de départ n’utilisent que des exercices et séances qui existent', () => {
  Object.entries(BASE_TPL).forEach(([id, t]) => t.items.forEach(it => assert.ok(BASE_EX[it.ex], id + ' : ' + it.ex)));
  Object.values(PROGRAMS).forEach(p => p.tpls.forEach(t => assert.ok(BASE_TPL[t], t)));
});

test('silhouette : muscles de l’exercice, jambes pour les sauts, rien pour un échauffement', () => {
  assert.deepEqual(musclesForMap(BASE_EX.lib_bench).p, ['Pectoraux']);
  assert.deepEqual(musclesForMap(BASE_EX.la_cmj).p, ['Quadriceps', 'Fessiers', 'Mollets']);
  assert.equal(musclesForMap(BASE_EX.la_warm), null);
});

const noms = (q) => searchEx(allEx(), q).map(e => e.id);

test('recherche : accents, majuscules et ponctuation ignorés, tous les mots doivent correspondre', () => {
  donnees(docs(reglages()));
  assert.deepEqual(noms('developpe couche').slice(0, 4).sort(), ['ex_closebench', 'ex_smithbench', 'lib_bench', 'ua_bench']);
  assert.deepEqual(noms('DÉVELOPPÉ   Couché'), noms('developpe couche'));
  assert.deepEqual(noms('step-up'), ['la_step']);
  assert.ok(noms('developpe incline').every(id => ['ub_incl', 'ex_inclbar'].indexOf(id) >= 0));
  assert.deepEqual(noms('xyz'), []);
});

test('recherche : autres noms (DC, bench), pluriels, mots collés et muscles', () => {
  donnees(docs(reglages()));
  ['lib_bench', 'ua_bench', 'ex_smithbench', 'ex_closebench'].forEach(id => assert.ok(noms('DC').indexOf(id) >= 0, id));
  assert.ok(noms('bench').indexOf('lib_bench') >= 0);
  assert.ok(noms('squats').indexOf('lib_squat') >= 0);
  assert.deepEqual(noms('hipthrust'), ['lb_thrust']);
  const pecs = searchEx(allEx(), 'pectoraux');
  assert.ok(pecs.length >= 15);
  assert.ok(pecs.every(e => e.muscles.p.concat(e.muscles.s).indexOf('Pectoraux') >= 0));
});

test('recherche : le nom qui commence par la recherche passe d’abord, puis les noms, puis les muscles', () => {
  donnees(docs(reglages()));
  const r = noms('squat');
  assert.equal(r[0], 'lib_squat'); // « Squat à la barre » : premier dans l'ordre alphabétique des noms qui commencent par « squat »
  const ischios = searchEx(allEx(), 'ischio');
  const premierSecondaire = ischios.findIndex(e => e.muscles.p.indexOf('Ischios') < 0);
  assert.ok(premierSecondaire > 0 && ischios.slice(premierSecondaire).every(e => e.muscles.p.indexOf('Ischios') < 0));
  const liste = allEx(); assert.equal(searchEx(liste, '  '), liste);
});

test('recherche : un exercice créé par la personne se trouve aussi', () => {
  donnees(docs(reglages(), ['x_c1', { name: 'Tirage à la machine Hammer', kind: 'load', cat: 'upper', sets: 3, lo: 8, hi: 12, rest: 90, step: 5, muscles: { p: ['Dos'], s: [] } }]));
  assert.deepEqual(noms('hammer tirage'), ['c1']);
});

test('silhouette en 3D : elle montre d’abord la face qui porte le plus de muscles principaux', () => {
  assert.equal(firstFace(BASE_EX.ex_shrugbar.muscles), 'back'); // trapèzes : surtout visibles de dos
  assert.equal(firstFace(BASE_EX.lb_curl.muscles), 'back');
  assert.equal(firstFace(BASE_EX.ua_bench.muscles), 'front');
  assert.equal(firstFace(BASE_EX.la_rdl.muscles), 'back');
});
