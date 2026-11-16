// Niveaux, XP et badges : règles de jeu calculées sur l'historique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docs, donnees, jour, reglages, seance } from './aide.js';
import { badges, levelFloor, levelOf, XP, xpState } from '../js/levels.js';

const s = (date, kg) => seance(date, { dc: { kg: kg || 60, reps: [8, 8, 8], rir: 2 } });

test('chaque niveau demande 300 XP de plus que le précédent', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(levelFloor), [0, 300, 900, 1800, 3000]);
  assert.deepEqual([0, 299, 300, 899, 900, 3000].map(levelOf), [1, 1, 2, 2, 3, 5]);
});

test('sans séance : niveau 1, 0 XP, aucun badge', () => {
  jour('2026-11-16'); donnees(docs(reglages()));
  const x = xpState();
  assert.equal(x.total, 0); assert.equal(x.level, 1);
  assert.equal(badges().filter(b => b.got).length, 0);
});

test('une séance rapporte 100 XP, la 2e et les suivantes de la semaine 50 de plus, un record 50', () => {
  jour('2026-11-16');
  // semaine du 2 novembre : 3 séances, la 3e bat la force estimée des précédentes
  donnees(docs(reglages(), s('2026-11-02'), s('2026-11-04'), s('2026-11-06', 70)));
  const x = xpState();
  assert.equal(x.parts.sessions.xp, 3 * XP.session);
  assert.equal(x.parts.regular.xp, 2 * XP.regular);
  assert.equal(x.parts.records.xp, XP.record);
  assert.equal(x.total, 450); assert.equal(x.level, 2);
  assert.deepEqual(Object.values(x.bySession).sort((a, b) => a - b), [100, 150, 200]);
});

test('deux séances le même jour ne comptent qu’une fois, une séance sans série validée ne compte pas', () => {
  jour('2026-11-16');
  const vide = seance('2026-11-05', { dc: { kg: 60, reps: [8], rir: 2 } }); vide[1].ex.dc.sets[0].done = false;
  donnees(docs(reglages(), s('2026-11-03'), s('2026-11-03'), vide));
  assert.equal(xpState().total, XP.session);
});

test('changer l’objectif de séances par semaine ne change pas l’XP', () => {
  jour('2026-11-16');
  const ws = [s('2026-11-02'), s('2026-11-04')];
  donnees(docs(reglages({ perWeek: 2 }), ...ws)); const a = xpState().total;
  donnees(docs(reglages({ perWeek: 6 }), ...ws));
  assert.equal(xpState().total, a);
});

test('un bloc de 6 semaines passé, avec des séances sur 4 de ses semaines, rapporte 300 XP et son badge', () => {
  jour('2026-11-16');
  // bloc 1 : du 7 septembre au 18 octobre 2026 ; les séances suivantes évitent une pause de plus de 14 jours
  const dates = ['2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10'];
  donnees(docs(reglages(), ...dates.map(d => s(d))));
  const x = xpState();
  assert.equal(x.parts.blocks.xp, XP.block);
  assert.equal(badges().find(b => b.id === 'block1').got, true);
  assert.equal(badges().find(b => b.id === 's10').got, true);
  // une séance par semaine : pas le badge des 4 semaines d'affilée (il en faut 2 par semaine)
  assert.equal(badges().find(b => b.id === 'streak4').got, false);
});

test('badge « 4 semaines d’affilée » : au moins 2 séances chaque semaine, sans semaine vide entre deux', () => {
  jour('2026-11-16');
  const sem = m => [s('2026-' + m), s('2026-' + m.slice(0, 3) + String(Number(m.slice(3)) + 2).padStart(2, '0'))];
  donnees(docs(reglages(), ...sem('10-05'), ...sem('10-12'), ...sem('10-19'), ...sem('10-26')));
  assert.equal(badges().find(b => b.id === 'streak4').got, true);
  donnees(docs(reglages(), ...sem('09-28'), ...sem('10-05'), ...sem('10-19'), ...sem('10-26')));
  assert.equal(badges().find(b => b.id === 'streak4').got, false);
});
