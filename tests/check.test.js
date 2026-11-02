// Point toutes les 2 semaines : tendance du poids, ajustement prudent (moitié de l'écart, 200 kcal au plus, ±20 % au total),
// jamais sous la dépense au repos ni vers un IMC sous 18,5, vérification par le journal, date du point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustFor, planFor, weightTrend } from '../js/nutrition.js';
import { checkDue, nextCheck } from '../js/views/goal.js';
import { donnees, docs, jour, reglages } from './aide.js';

const presque = (a, b, tol) => assert.ok(Math.abs(a - b) <= (tol || 1e-9), a + ' au lieu de ' + b);
const pesees = (list) => list.map(([date, weight]) => ({ date, weight }));
const tendance = perWeek => ({ perWeek, w0: 80, w1: 80 + perWeek * 2, days: 14 });
// Besoins simplifiés : 2 400 kcal estimés, 1 750 au repos
const besoins = extra => Object.assign({ kgWeek: 0, kcal: 2400, bmr: 1750, base: 2400, adjust: 0, minKg: 60 }, extra);

test('tendance : droite au plus près des pesées, en kg par semaine ; pas assez de pesées : rien', () => {
  const t = weightTrend(pesees([['2026-10-19', 80], ['2026-10-23', 79.8], ['2026-10-26', 79.65], ['2026-10-30', 79.45], ['2026-11-02', 79.3]]), '2026-10-19', '2026-11-02');
  presque(t.perWeek, -0.35, 1e-6);
  presque(t.w0, 80, 1e-6);
  presque(t.w1, 79.3, 1e-6);
  assert.equal(weightTrend(pesees([['2026-10-19', 80], ['2026-10-26', 79.6], ['2026-11-02', 79.3]]), '2026-10-19', '2026-11-02'), null);      // 3 pesées
  assert.equal(weightTrend(pesees([['2026-10-28', 80], ['2026-10-30', 79.9], ['2026-11-01', 79.8], ['2026-11-02', 79.7]]), '2026-10-19', '2026-11-02'), null); // sur 5 jours
});

test('ajustement : rien sous 0,1 kg par semaine d’écart, la moitié de l’écart sinon, 200 kcal au plus', () => {
  assert.equal(adjustFor(besoins({ kgWeek: -0.5 }), tendance(-0.45)).status, 'ontrack');
  const lent = adjustFor(besoins({ kgWeek: -0.5 }), tendance(-0.3));    // perd moins vite que prévu : 0,2 kg × 1 100 / 2
  assert.deepEqual([lent.status, lent.change, lent.kcal], ['change', -100, 2300]);
  assert.equal(adjustFor(besoins({ kgWeek: -0.5 }), tendance(-0.9)).change, 200);  // perd trop vite : on mange plus, 200 au plus
  assert.equal(adjustFor(besoins(), tendance(0.45)).change, -200);                  // poids qui monte alors qu'on veut le garder
});

test('limites : dépense au repos, corrections cumulées à ±20 %, IMC de 18,5', () => {
  const repos = adjustFor(besoins({ kgWeek: -0.5, kcal: 1800 }), tendance(-0.2));
  assert.deepEqual([repos.status, repos.change, repos.limit], ['change', -50, 'resting']);
  assert.deepEqual([adjustFor(besoins({ kgWeek: -0.5, kcal: 1750 }), tendance(-0.2)).status, adjustFor(besoins({ kgWeek: -0.5, kcal: 1750 }), tendance(-0.2)).limit], ['limit', 'resting']);
  const cumul = adjustFor(besoins({ adjust: -400 }), tendance(0.3));    // 20 % de 2 400 = 480, arrondi à 500
  assert.deepEqual([cumul.change, cumul.adjust, cumul.limit], [-100, -500, 'total']);
  assert.equal(adjustFor(besoins({ adjust: -500 }), tendance(0.3)).status, 'limit');
  assert.equal(adjustFor(besoins({ minKg: 81 }), tendance(0.3)).limit, 'bmi');           // tendance à 80,6 kg, plus bas conseillé 81 kg
  assert.equal(adjustFor(besoins(), null).status, 'weighins');
});

test('journal : 10 jours notés loin de l’objectif (plus de 10 %), rien n’est changé ; moins de 10 jours : ignoré', () => {
  assert.equal(adjustFor(besoins(), tendance(0.4), { days: 10, avg: 2800, target: 2400 }).status, 'offplan');
  assert.equal(adjustFor(besoins(), tendance(0.4), { days: 10, avg: 2550, target: 2400 }).status, 'change');
  assert.equal(adjustFor(besoins(), tendance(0.4), { days: 9, avg: 3500, target: 2400 }).status, 'change');
});

test('la correction s’ajoute aux besoins estimés', () => {
  const homme = { sex: 'm', birth: '1996-06-15', height: 180, weight: 80 };
  const sans = planFor(homme, { activity: 'sit', goal: 'keep' }, '2026-11-02');
  const avec = planFor(homme, { activity: 'sit', goal: 'keep', adjust: 150 }, '2026-11-02');
  assert.equal(avec.kcal, sans.kcal + 150);
  assert.equal(avec.base, sans.base); // besoins estimés, sans la correction (pour la limite de 20 %)
});

test('date du point : 14 jours après le début de l’objectif ou le dernier point ; journal lu sur les jours notés', () => {
  const nutri = extra => ({ nutrition: Object.assign({ on: true, activity: 'sit', goal: 'keep', start: { date: '2026-10-19', weight: 80 } }, extra) });
  const corps = { sex: 'm', birth: '1996-06-15', height: 180 };
  const b = [['2026-10-19', 80], ['2026-10-23', 80.3], ['2026-10-27', 80.5], ['2026-10-31', 80.8], ['2026-11-02', 80.9]].map(([d, w]) => ['b_' + d, { date: d, weight: w }]);
  jour('2026-11-01');
  donnees(docs(reglages(Object.assign({}, corps, nutri())), ...b));
  assert.equal(nextCheck().date, '2026-11-02');
  assert.equal(checkDue(), null);
  jour('2026-11-02');
  const c = checkDue();
  assert.deepEqual([c.status, c.change, c.intake.days], ['change', -200, 0]);
  // Dernier point le 2 novembre : le suivant le 16
  donnees(docs(reglages(Object.assign({}, corps, nutri({ checks: [{ date: '2026-11-02', status: 'ontrack', applied: false }] }))), ...b));
  assert.equal(nextCheck().date, '2026-11-16');
  // 10 jours notés à 3 500 kcal pour un objectif de 2 490 : rien n'est changé
  const repas = [];
  for (let i = 1; i <= 10; i++) { const d = '2026-10-' + (19 + i); repas.push(['m_' + d, { date: d, items: [{ id: 'i' + i, meal: 'lunch', key: 'own:x', name: 'Repas', g: 100, per100: { kcal: 3500 } }] }]); }
  donnees(docs(reglages(Object.assign({}, corps, nutri())), ...b, ...repas));
  const j = checkDue();
  assert.deepEqual([j.status, j.intake.days, Math.round(j.intake.avg)], ['offplan', 10, 3500]);
  // Moins de 18 ans : pas de point
  jour('2026-11-02');
  donnees(docs(reglages(Object.assign({}, corps, { birth: '2010-01-01' }, nutri())), ...b));
  assert.equal(nextCheck(), null);
});
