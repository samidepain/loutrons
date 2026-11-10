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

test('tendance : droite au plus près de pesées espacées de 2 semaines, avec sa marge ; trop peu de pesées ou trop serrées : rien', () => {
  const t = weightTrend(pesees([['2026-10-05', 80], ['2026-10-19', 79.6], ['2026-11-02', 79.3]]), '2026-10-05', '2026-11-02');
  presque(t.perWeek, -0.175, 1e-6);
  presque(t.w0, 79.98333, 1e-4);
  presque(t.w1, 79.28333, 1e-4);
  presque(t.se, 0.7 / Math.sqrt(392) * 7, 1e-9);                                                                                       // marge : 0,25 kg par semaine avec 3 pesées
  assert.equal(weightTrend(pesees([['2026-10-19', 80], ['2026-11-02', 79.3]]), '2026-10-19', '2026-11-02'), null);                      // 2 pesées : trop tôt
  assert.equal(weightTrend(pesees([['2026-10-19', 80], ['2026-10-26', 79.6], ['2026-11-02', 79.3]]), '2026-10-19', '2026-11-02'), null); // 3 pesées sur 14 jours : trop serré
  assert.ok(weightTrend(pesees([['2026-09-21', 80], ['2026-10-05', 79.8], ['2026-10-19', 79.6], ['2026-11-02', 79.3]]), '2026-09-21', '2026-11-02').se < t.se); // plus de pesées, marge plus étroite
});

test('une variation dans la marge de la tendance n’est pas un écart : rien n’est changé', () => {
  const t = Object.assign(tendance(-0.3), { se: 0.3 });                  // 0,2 kg d'écart avec le plan, marge de 0,3
  assert.equal(adjustFor(besoins({ kgWeek: -0.5 }), t).status, 'ontrack');
  assert.equal(adjustFor(besoins({ kgWeek: -0.5 }), Object.assign(tendance(-0.3), { se: 0.1 })).status, 'change');
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
  // Une pesée toutes les 2 semaines : trois pesées couvrent le mois depuis le début de l'objectif ; le point du 19 octobre a déjà eu lieu
  const b = [['2026-10-05', 80], ['2026-10-19', 80.5], ['2026-11-02', 81]].map(([d, w]) => ['b_' + d, { date: d, weight: w }]);
  const d1 = { start: { date: '2026-10-05', weight: 80 }, checks: [{ date: '2026-10-19', status: 'ontrack', applied: false }] };
  jour('2026-11-01');
  donnees(docs(reglages(Object.assign({}, corps, nutri(d1))), ...b));
  assert.equal(nextCheck().date, '2026-11-02');
  assert.equal(checkDue(), null);
  jour('2026-11-02');
  const c = checkDue();
  assert.deepEqual([c.status, c.change, c.intake.days, c.n], ['change', -150, 0, 3]);
  // Seulement 2 pesées : trop tôt pour conclure
  donnees(docs(reglages(Object.assign({}, corps, nutri({ start: { date: '2026-10-19', weight: 80 } }))), b[1], b[2]));
  assert.equal(checkDue().status, 'weighins');
  // Dernier point le 2 novembre : le suivant le 16
  donnees(docs(reglages(Object.assign({}, corps, nutri(Object.assign({}, d1, { checks: [{ date: '2026-11-02', status: 'ontrack', applied: false }] })))), ...b));
  assert.equal(nextCheck().date, '2026-11-16');
  // 10 jours notés à 3 500 kcal pour un objectif de 2 490 : rien n'est changé
  const repas = [], cafes = [];
  const item = (id, meal, kcal) => ({ id, meal, key: 'own:x', name: 'Repas', g: 100, per100: { kcal } });
  for (let i = 1; i <= 10; i++) {
    const d = '2026-10-' + (19 + i);
    repas.push(['m_' + d, { date: d, items: [item('l' + i, 'lunch', 1750), item('d' + i, 'dinner', 1750)] }]);
    cafes.push(['m_' + d, { date: d, items: [item('c' + i, 'breakfast', 30)] }]);
  }
  donnees(docs(reglages(Object.assign({}, corps, nutri(d1))), ...b, ...repas));
  const j = checkDue();
  assert.deepEqual([j.status, j.intake.days, Math.round(j.intake.avg)], ['offplan', 10, 3500]);
  // Un seul repas noté (un café) : le jour ne compte pas, la moyenne n'est pas faussée
  donnees(docs(reglages(Object.assign({}, corps, nutri(d1))), ...b, ...cafes));
  assert.deepEqual([checkDue().status, checkDue().intake.days], ['change', 0]);
  // Moins de 18 ans : pas de point
  jour('2026-11-02');
  donnees(docs(reglages(Object.assign({}, corps, { birth: '2010-01-01' }, nutri(d1))), ...b));
  assert.equal(nextCheck(), null);
});
