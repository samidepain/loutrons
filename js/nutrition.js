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

// p : { sex, birth, height, weight } (poids actuel) ; n : { activity, goal: 'lose' | 'keep' | 'gain', target, by, start: { date, weight } }
// Renvoie les besoins du jour, hors sport, et l'état de l'objectif :
// 'missing' (données manquantes), 'keep', 'ok', 'fast' (trop rapide : recadré), 'target' (poids visé à indiquer),
// 'direction' (poids visé du mauvais côté), 'bmi' (refusé : IMC sous 18,5), 'minor' (refusé : perte avant 18 ans), 'date' (date à indiquer ou passée).
export function planFor(p, n, day){
  const missing = ['sex', 'birth', 'height', 'weight'].filter(k => !p[k]);
  if (!ACTIVITY[n.activity]) missing.push('activity');
  if (missing.length) return { status:'missing', missing };
  const age = ageOn(p.birth, day);
  const bmr = restingKcal(p.sex, p.weight, p.height, age);
  const base = bmr * ACTIVITY[n.activity].pal;
  const out = { age, bmr: round10(bmr), base: round10(base), status:'keep', kgWeek:0, minKg: Math.ceil(minWeight(p.height) * 2) / 2 };
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
// Besoins d'un jour donné : on ajoute la dépense des séances et des activités (extra, en kcal) ; protéines inchangées
export function withExtra(pl, extra){
  if (!pl || pl.status === 'missing' || !(extra > 0)) return pl;
  return split(Object.assign({}, pl, { base0: pl.kcal, extra: round10(extra), kcal: round10(pl.kcal + extra) }));
}
