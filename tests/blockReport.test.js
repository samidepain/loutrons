// Bilan de bloc : régularité, force par exercice, poids, sommeil, genou et détente (selon les options).
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { blockReport } from '../js/engine.js';
import { donnees, jour, reglages, seance, docs } from './aide.js';

afterEach(() => mock.timers.reset());

// Bloc 1 : du lundi 7 septembre au dimanche 18 octobre 2026. Programme exemple : 4 séances par semaine.
function bloc(extra, ...autres){
  return docs(reglages(extra),
    seance('2026-09-08', { la_hack: { kg: 100, reps: [8, 8, 8], rir: 2 }, la_rdl: { kg: 80, reps: [7, 7, 7], rir: 2 } }),
    seance('2026-09-22', { la_hack: { kg: 105, reps: [8, 8, 8], rir: 2 }, la_rdl: { kg: 80, reps: [7, 7, 7], rir: 2 } }),
    seance('2026-10-06', { la_hack: { kg: 110, reps: [8, 8, 8], rir: 2 }, la_rdl: { kg: 80, reps: [7, 7, 7], rir: 2 } }),
    { 'b_2026-09-07': { date: '2026-09-07', weight: 75, sleep: 6 }, 'b_2026-10-15': { date: '2026-10-15', weight: 76, sleep: 6.5 } },
    { 'k_2026-09-30': { date: '2026-09-30', stairs: 5 } },
    ...autres);
}

test('bloc terminé : 6 semaines, séances prévues d’après le planning, force par exercice', () => {
  jour('2026-10-20');
  donnees(bloc());
  const R = blockReport(1);
  assert.equal(R.finished, true);
  assert.equal(R.weeks, 6);
  assert.equal(R.planned, 24);
  assert.equal(R.done.length, 3);
  const hack = R.forces.find(f => f.id === 'la_hack');
  assert.equal(Math.round(hack.pct * 10) / 10, 10); // 100 → 110 kg pour 8 reps
  const rdl = R.forces.find(f => f.id === 'la_rdl');
  assert.equal(rdl.pct, 0);
});

test('pistes : régularité, progrès, stagnation, poids et sommeil', () => {
  jour('2026-10-20');
  donnees(bloc());
  const tips = blockReport(1).tips.map(t => t[0] + ' ' + t[1]);
  assert.ok(tips.some(t => /^warn Régularité : 3 séances sur 24 prévues/.test(t)));
  assert.ok(tips.some(t => /^good Progrès sur 1 exercice, le meilleur : Hack squat \(\+10 %\)/.test(t)));
  assert.ok(tips.some(t => /^warn Pas de progrès sur : RDL/.test(t)));
  assert.ok(tips.some(t => /^good Poids en hausse de 0,25 % par semaine/.test(t)));
  assert.ok(tips.some(t => /^info Sommeil moyen 6,3 h/.test(t)));
});

test('genou : pris en compte seulement avec le module genou', () => {
  jour('2026-10-20');
  donnees(bloc());
  assert.ok(!blockReport(1).tips.some(t => /Genou/.test(t[1])));
  donnees(bloc({ modules: { knee: true, jumps: false, sport: false } }));
  const g = blockReport(1).tips.find(t => /Genou/.test(t[1]));
  assert.equal(g[0], 'bad');
  assert.match(g[1], /1 jour au-dessus de 3\/10 \(max 5\/10\)/);
});

test('détente : comparaison avec le bloc précédent seulement avec le module détente', () => {
  jour('2026-11-25');
  const tests = { t_a: { date: '2026-10-14', cm: 52 }, t_b: { date: '2026-11-25', cm: 55 } };
  donnees(bloc({}, tests));
  assert.ok(!blockReport(2).tips.some(t => /Détente/.test(t[1])));
  donnees(bloc({ modules: { knee: false, jumps: true, sport: false } }, tests));
  const d = blockReport(2).tips.find(t => /Détente/.test(t[1]));
  assert.equal(d[1], 'Détente : 55 cm contre 52 cm au bloc précédent (+3 cm).');
});

test('bloc en cours : semaines écoulées et séances prévues jusqu’à aujourd’hui', () => {
  jour('2026-09-23');
  donnees(bloc());
  const R = blockReport(1);
  assert.equal(R.finished, false);
  assert.equal(R.weeks, 3);
  assert.equal(R.planned, 12);
  assert.equal(R.done.length, 2);
});

test('poids : comparé à l’objectif choisi quand l’alimentation est suivie', () => {
  jour('2026-10-20');
  const avec = goal => bloc({ nutrition: { on: true, activity: 'sit', goal } });
  const poids = () => blockReport(1).tips.find(t => /[Pp]oids/.test(t[1]));
  donnees(avec('gain'));
  assert.match(poids()[1], /^Poids en hausse de 0,25 % par semaine/);
  donnees(avec('keep'));
  assert.deepEqual(poids(), ['good', 'Poids stable (+1 kg) : conforme à ton objectif.']);
  donnees(avec('lose'));
  assert.equal(poids()[0], 'info');
  assert.match(poids()[1], /^Poids stable ou en hausse \(\+1 kg\)\. Pour perdre de la masse grasse/);
  // Suivi arrêté : retour à la cible de prise de masse musculaire
  donnees(bloc({ nutrition: { on: false, goal: 'lose' } }));
  assert.match(poids()[1], /^Poids en hausse de 0,25 %/);
});

test('bilan : les autres zones de douleur suivies donnent leurs mesures et un conseil prudent ; sans suivi, rien', () => {
  jour('2026-10-20');
  const mesures = { 'd_2026-09-30': { date: '2026-09-30', z: { shoulder: { v: 5, flags: [] }, wrist: { v: 2, flags: [] } } }, 'd_2026-10-02': { date: '2026-10-02', z: { shoulder: { v: 2, flags: [] } } }, 'd_2026-08-20': { date: '2026-08-20', z: { shoulder: { v: 9, flags: [] } } } };
  donnees(bloc({ pain: { zones: ['shoulder', 'wrist'] } }, mesures));
  const R = blockReport(1);
  assert.deepEqual(R.pains.map(p => [p.z, p.n, p.max, p.high]), [['shoulder', 2, 5, 1], ['wrist', 1, 2, 0]]);  // la mesure d'août est hors du bloc
  assert.ok(R.tips.some(t => t[0] === 'bad' && /Épaule : 1 jour au-dessus de 3\/10 \(max 5\/10\)/.test(t[1]) && /maintenues/.test(t[1])));
  donnees(bloc({}, mesures));
  assert.deepEqual(blockReport(1).pains, []);
});
