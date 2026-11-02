// Besoins et objectif de poids : calculs seuls, sans affichage (testés dans tests/nutrition.test.js).
import { addDays, daysBetween, parseIso } from './util.js';

// Activité au quotidien, hors sport. Niveaux d'activité physique (NAP) pris dans les fourchettes de la FAO, l'OMS et l'UNU (2004) ;
// les valeurs retenues pour chaque choix sont un choix de l'appli.
export const ACTIVITY = {
  sit:   { pal:1.4,  label:'Surtout assis', desc:'Bureau, études, trajets en voiture ou en transports.' },
  mixed: { pal:1.55, label:'Assis, avec de la marche', desc:'Bureau ou études, mais trajets à pied ou à vélo, escaliers, courses.' },
  stand: { pal:1.7,  label:'Souvent debout', desc:'Vente, restauration, enseignement, soins.' },
  hard:  { pal:1.9,  label:'Travail physique', desc:'Chantier, manutention, agriculture.' }
};
export const KCAL_PER_KG = 7700;            // approximation courante : environ 7 700 kcal par kilo de poids
export const GAIN = { advised:0.25, max:0.5 }; // % du poids par semaine (Iraki et al., 2019)
export const LOSS = { advised:0.5, max:1 };    // % du poids par semaine (Helms et al., 2014)
export const BMI_MIN = 18.5;                // en dessous : insuffisance pondérale (OMS)
export const PROTEIN = [1.6, 2.2];          // g par kg et par jour (Morton et al., 2018)
export const FAT = [0.35, 0.40];            // part de l'énergie (ANSES, 2016)
export const FIBRE = 30;                    // g par jour (ANSES, 2016)

export function ageOn(birth, day){
  const b = parseIso(birth), d = parseIso(day);
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  return a;
}
// Dépense au repos, équation de Mifflin-St Jeor (1990)
export const restingKcal = (sex, kg, cm, age) => 10 * kg + 6.25 * cm - 5 * age + (sex === 'f' ? -161 : 5);
export const minWeight = cm => BMI_MIN * Math.pow(cm / 100, 2);
const round10 = x => Math.round(x / 10) * 10;
// Date à laquelle on atteint le poids visé à un rythme donné (en % du poids de départ par semaine), arrondie à la semaine
export function dateAt(start, target, pct){
  const kgWeek = start.weight * pct / 100;
  return addDays(start.date, Math.max(1, Math.ceil(Math.abs(target - start.weight) / kgWeek)) * 7);
}

// p : { sex, birth, height, weight } (poids actuel) ; n : { activity, goal: 'lose' | 'keep' | 'gain', target, by, start: { date, weight },
// adjust : correction des besoins en kcal par jour, issue des points toutes les 2 semaines }
// Renvoie les besoins du jour, hors sport, et l'état de l'objectif :
// 'missing' (données manquantes), 'keep', 'ok', 'fast' (trop rapide : recadré), 'target' (poids visé à indiquer),
// 'direction' (poids visé du mauvais côté), 'bmi' (refusé : IMC sous 18,5), 'minor' (refusé : perte avant 18 ans), 'date' (date à indiquer ou passée).
export function planFor(p, n, day){
  const missing = ['sex', 'birth', 'height', 'weight'].filter(k => !p[k]);
  if (!ACTIVITY[n.activity]) missing.push('activity');
  if (missing.length) return { status:'missing', missing };
  const age = ageOn(p.birth, day);
  const bmr = restingKcal(p.sex, p.weight, p.height, age);
  // Dépense estimée : repos × activité, corrigée par les points toutes les 2 semaines
  const adjust = Number(n.adjust) || 0; const base = bmr * ACTIVITY[n.activity].pal + adjust;
  const out = { age, bmr: round10(bmr), base: round10(base - adjust), adjust, status:'keep', kgWeek:0, minKg: Math.ceil(minWeight(p.height) * 2) / 2 };
  const goal = n.goal === 'lose' || n.goal === 'gain' ? n.goal : 'keep';
  const target = Number(n.target);
  const start = n.start && n.start.weight ? n.start : { date: day, weight: p.weight };
  if (goal !== 'keep') {
    if (goal === 'lose' && age < 18) out.status = 'minor';
    else if (!(target > 0)) out.status = 'target';
    else if (target < out.minKg) out.status = 'bmi';
    else if (goal === 'lose' ? target >= start.weight : target <= start.weight) out.status = 'direction';
    else if (!n.by || n.by <= day || n.by <= start.date) out.status = 'date';
    else {
      const weeks = daysBetween(start.date, n.by) / 7;
      const asked = (target - start.weight) / weeks;
      // Rythme maximal : 0,5 % par semaine en prise, 1 % en perte, et jamais moins que la dépense au repos
      const floorKg = (base - bmr) * 7 / KCAL_PER_KG;
      const pctMax = goal === 'gain' ? GAIN.max : LOSS.max;
      const maxKg = goal === 'gain' ? start.weight * GAIN.max / 100 : Math.min(start.weight * LOSS.max / 100, floorKg);
      out.limit = goal === 'lose' && floorKg < start.weight * LOSS.max / 100 ? 'resting' : 'pct';
      out.kgWeek = Math.abs(asked) > maxKg + 1e-9 ? Math.sign(asked) * maxKg : asked;
      out.status = Math.abs(asked) > maxKg + 1e-9 ? 'fast' : 'ok';
      if (out.status === 'fast') out.realistic = addDays(start.date, Math.ceil(Math.abs(target - start.weight) / maxKg) * 7);
      out.pctWeek = out.kgWeek / start.weight * 100; out.maxKg = maxKg; out.pctMax = pctMax;
    }
    out.advised = target > 0 ? dateAt(start, target, goal === 'gain' ? GAIN.advised : LOSS.advised) : null;
  }
  out.goal = goal; out.target = target > 0 ? target : null; out.start = start;
  const kcal = Math.max(bmr, base + out.kgWeek * KCAL_PER_KG / 7);
  out.kcal = round10(kcal);
  out.protein = PROTEIN.map(g => Math.round(g * p.weight / 5) * 5);
  out.fibre = FIBRE;
  return split(out);
}
// Lipides (part de l'énergie) et glucides (le reste) pour out.kcal
function split(out){
  out.fat = FAT.map(f => Math.round(out.kcal * f / 9 / 5) * 5);
  out.carbs = Math.max(0, Math.round((out.kcal - out.protein[0] * 4 - out.fat[0] * 9) / 4 / 5) * 5);
  return out;
}
// Point toutes les 2 semaines : règles de l'appli (voir La science). days : écart entre deux points ; weighins, span : pesées
// nécessaires et jours qu'elles doivent couvrir ; tolerance : écart ignoré (kg par semaine) ; share : part de l'écart corrigée ;
// step : correction maximale à chaque point (kcal par jour) ; total : correction cumulée maximale (part des besoins estimés) ;
// logDays : jours de journal suffisants pour vérifier ce qui a été mangé ; offPlan : écart toléré avec l'objectif (part)
export const CHECK = { days:14, maxDays:28, weighins:4, span:7, tolerance:0.1, share:0.5, step:200, total:0.2, logDays:10, offPlan:0.1 };
// Tendance du poids : droite des moindres carrés sur les pesées [{ date, weight }] (triées) entre from et to.
// Renvoie le rythme en kg par semaine et le poids de la tendance à from (w0) et à to (w1), ou null si les pesées manquent.
export function weightTrend(points, from, to){
  const pts = points.filter(p => p.date >= from && p.date <= to && p.weight > 0);
  if (pts.length < CHECK.weighins) return null;
  const xs = pts.map(p => daysBetween(from, p.date)); if (xs[xs.length - 1] - xs[0] < CHECK.span) return null;
  const mx = xs.reduce((a, x) => a + x, 0) / xs.length; const my = pts.reduce((a, p) => a + p.weight, 0) / pts.length;
  let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (pts[i].weight - my); sxx += (x - mx) * (x - mx); });
  const slope = sxy / sxx; const end = daysBetween(from, to);
  return { n: pts.length, days: end, perWeek: slope * 7, w0: my - slope * mx, w1: my + slope * (end - mx) };
}
// Proposition au point des 2 semaines. pl : besoins actuels (planFor) ; trend : weightTrend ; intake : { days, avg, target } (journal)
// status : 'weighins' (pas assez de pesées), 'offplan' (journal loin de l'objectif), 'ontrack', 'change', 'limit' (rien de possible : limit dit pourquoi)
export function adjustFor(pl, trend, intake){
  if (!trend) return { status:'weighins' };
  const out = { planned: pl.kgWeek || 0, actual: trend.perWeek, w0: trend.w0, w1: trend.w1, days: trend.days };
  const delta = out.actual - out.planned;
  if (intake && intake.days >= CHECK.logDays && Math.abs(intake.avg - intake.target) > CHECK.offPlan * intake.target) return Object.assign(out, { status:'offplan' });
  if (Math.abs(delta) <= CHECK.tolerance) return Object.assign(out, { status:'ontrack' });
  // La moitié de l'écart (environ 7 700 kcal par kilo), arrondie à 50 kcal, au plus 200 kcal
  const want = Math.max(-CHECK.step, Math.min(CHECK.step, Math.round(-delta * KCAL_PER_KG / 7 * CHECK.share / 50) * 50));
  const cap = Math.round(pl.base * CHECK.total / 50) * 50; const adj = pl.adjust || 0;
  let change = Math.max(-cap, Math.min(cap, adj + want)) - adj; let limit = change !== want ? 'total' : null;
  if (change < 0 && pl.kcal + change < pl.bmr) { change = Math.min(0, Math.ceil((pl.bmr - pl.kcal) / 10) * 10); limit = 'resting'; }
  if (change < 0 && trend.w1 <= pl.minKg) { change = 0; limit = 'bmi'; }
  if (!change) return Object.assign(out, { status:'limit', limit: limit || 'total' });
  return Object.assign(out, { status:'change', change, kcal: pl.kcal + change, adjust: adj + change, limit });
}
// Besoins d'un jour donné : on ajoute la dépense des séances et des activités (extra, en kcal) ; protéines inchangées
export function withExtra(pl, extra){
  if (!pl || pl.status === 'missing' || !(extra > 0)) return pl;
  return split(Object.assign({}, pl, { base0: pl.kcal, extra: round10(extra), kcal: round10(pl.kcal + extra) }));
}
