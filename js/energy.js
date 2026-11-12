// Dépense des séances et des activités, et eau : calculs seuls, sans affichage (testés dans tests/energy.test.js).
// Documents : a_<date>_<id> (activité : { date, type, min, km, level, sport, name, kcal }) et e_<date> (eau : { date, ml }).
// Une séance de muscu terminée garde son effort (w.effort) et sa dépense (w.kcal, calculée à la fin de la séance).
import { norm, num, parseIso, today } from './util.js';
import { S } from './store.js';
import { bodyweight, daySummary, exDef, itemsOf, settings, sportInfo, sportOn, wName } from './data.js';

// Valeurs MET du Compendium of Physical Activities 2024 (Herrmann et al.) ; 1 MET ≈ 1 kcal par kg et par heure, au repos.
// La dépense comptée est nette (MET − 1) : le repos est déjà dans les besoins du jour.
export const EFFORT = {
  classic: { met:3.5, label:'Classique', desc:'8 à 15 reps, charges variées' },          // code 02054
  heavy:   { met:5.0, label:'Lourde', desc:'squat, soulevé de terre, séries lourdes' },   // 02052
  intense: { met:6.0, label:'Très intense', desc:'effort vigoureux du début à la fin' }   // 02050
};
// [identifiant, nom, précision, MET]
export const LEVELS = {
  bike: [['easy', 'Balade', 'moins de 16 km/h', 4.0], ['light', 'Tranquille', '16 à 19 km/h', 6.8], ['mod', 'Soutenu', '19 à 22 km/h', 8.0], ['fast', 'Rapide', '22 à 26 km/h', 10.0]], // 01010, 01020, 01030, 01040
  swim: [['easy', 'Tranquille', 'longueurs lentes', 5.8], ['mod', 'Soutenu', 'crawl, environ 45 m par minute', 8.0], ['fast', 'Rapide', 'longueurs rapides', 9.8]],                  // 18240, 18290, 18230
  walk: [['easy', 'Normale', '4,5 à 5,5 km/h', 3.8], ['mod', 'Rapide', '5,6 à 6,3 km/h', 4.8], ['fast', 'Très rapide', '6,4 à 7,1 km/h', 5.5]]                                   // 17190, 17200, 17220
};
// Entraînement ou loisir / match
export const SPORTS = {
  basket:    { label:'Basket', train:7.5, match:8.0, names:['basket'] },          // 15055, 15040
  foot:      { label:'Football', train:7.0, match:9.5, names:['foot', 'soccer'] }, // 15610, 15605
  hand:      { label:'Handball', train:8.0, match:8.0, names:['hand'] },          // 15330
  rugby:     { label:'Rugby', train:6.3, match:8.3, names:['rugby'] },            // 15562 (toucher), 15560
  volley:    { label:'Volley', train:3.0, match:6.0, names:['volley'] },          // 15720, 15711
  tennis:    { label:'Tennis', train:6.8, match:8.0, names:['tennis'] },          // 15675, 15676
  badminton: { label:'Badminton', train:5.5, match:7.0, names:['bad'] }           // 15030, 15020
};
export const TYPES = [['run', 'Course à pied'], ['bike', 'Vélo'], ['swim', 'Natation'], ['walk', 'Marche'], ['sport', 'Sports collectifs'], ['other', 'Autre']];
// Choix du formulaire d'activité : les activités directement (chaque sport est un choix, 'sport:basket'), « Autre » pour le reste.
// Les documents gardent type:'sport' et sport:'basket' : les anciennes activités restent lisibles.
export const CHOICES = TYPES.filter(t => t[0] !== 'sport' && t[0] !== 'other').concat(Object.keys(SPORTS).map(k => ['sport:' + k, SPORTS[k].label]), [TYPES[TYPES.length - 1]]);
export const choiceOf = a => a.type === 'sport' ? (a.sport ? 'sport:' + a.sport : 'sport') : a.type;
export const RUN_KCAL = 1; // course : environ 1 kcal par kg et par km, quelle que soit la vitesse (dépense nette ; Margaria et al., 1963)
// Eau à boire par jour : apport total conseillé par l'EFSA (2010), 2,5 L pour un homme et 2,0 L pour une femme, dont environ 20 %
// apportés par les aliments ; plus environ 0,5 L par heure de sport (repère de l'appli)
export const WATER = { m:2000, f:1600, other:1800, perHour:500 };
export const GLASS = 250;

const net = (met, kg, min) => Math.max(0, (met - 1) * kg * min / 60);
export const typeName = t => (TYPES.find(x => x[0] === t) || ['', 'Activité'])[1];
// Sport du module « sport collectif », reconnu à son nom (« Basket-ball », « Foot »…)
export function sportOf(name){ const n = norm(name); return Object.keys(SPORTS).find(k => SPORTS[k].names.some(x => n.indexOf(x) === 0)) || null; }

// Durée comptée d'une séance : sa durée réelle, ou sa durée prévue si elle a duré plus du double (séance oubliée, terminée plus tard)
export function sessionMin(w){
  const est = num(w.est) || 60; const d = num(w.duration);
  return d == null || d <= 0 ? est : d > 2 * est ? est : d;
}
export const effortOf = w => EFFORT[w.effort] ? w.effort : 'classic';
// Cardio fait pendant la séance : minutes et dépense, avec la valeur MET de l'allure choisie
export function sessionCardio(w, kg){
  let min = 0, kcal = 0;
  itemsOf(w).forEach(it => {
    if (it.kind !== 'cardio') return; const st = w.ex && w.ex[it.ex]; if (!st) return;
    const lv = ((exDef(it.ex) || {}).levels || []).find(l => l[0] === st.level);
    (st.sets || []).forEach(s => { const m = num(s.min); if (s.done && m > 0) { min += m; if (lv) kcal += net(lv[3], kg || 0, m); } });
  });
  return { min, kcal };
}
// Séance de muscu : le cardio avec sa propre valeur, le reste de la durée avec l'effort choisi
export function computeSessionKcal(w, kg){
  if (!kg) return null; const c = sessionCardio(w, kg);
  return Math.round(net(EFFORT[effortOf(w)].met, kg, Math.max(0, sessionMin(w) - c.min)) + c.kcal);
}
export const sessionKcal = (w, kg) => w.kcal != null ? w.kcal : computeSessionKcal(w, kg);

export function activityMet(a){
  if (LEVELS[a.type]) { const l = LEVELS[a.type].find(x => x[0] === a.level); return l ? l[3] : null; }
  if (a.type === 'sport' && SPORTS[a.sport]) return SPORTS[a.sport][a.level === 'match' ? 'match' : 'train'];
  return null;
}
// Dépense d'une activité ; null si elle ne peut pas être calculée (poids inconnu, champ manquant)
export function activityKcal(a, kg){
  if (a.type === 'other') { const k = num(a.kcal); return k != null && k >= 0 ? Math.round(k) : null; }
  if (!kg) return null;
  if (a.type === 'run') { const km = num(a.km); return km > 0 ? Math.round(RUN_KCAL * kg * km) : null; }
  const met = activityMet(a); const min = num(a.min);
  return met && min > 0 ? Math.round(net(met, kg, min)) : null;
}
export function activityName(a){
  if (a.type === 'other') return String(a.name || '').trim() || 'Autre activité';
  if (a.type === 'sport') return (SPORTS[a.sport] ? SPORTS[a.sport].label : 'Sport collectif') + (a.level === 'match' ? ' (match)' : '');
  return typeName(a.type);
}

// Ce qui compte dans la dépense d'un jour : séances faites, séance en cours (durée estimée, puis la vraie une fois terminée), activités.
// Une séance seulement prévue ne compte pas (version 2.13). kind : 'session' | 'planned' (séance en cours) | 'activity' ; kcal null si incalculable.
export function dayEnergy(day){
  const kg = bodyweight(); const items = []; const s = daySummary(day);
  s.done.forEach(w => items.push({ kind:'session', id:w.id, name:wName(w), min:sessionMin(w), kcal:sessionKcal(w, kg), effort:effortOf(w) }));
  if (day === today()) {
    const est = s.active ? num(s.active.est) || 60 : 0;
    if (est) items.push({ kind:'planned', name: wName(s.active), min:est, kcal: kg ? Math.round(net(EFFORT.classic.met, kg, est)) : null, active: true });
  }
  s.acts.forEach(a => items.push({ kind:'activity', id:a.id, a, name:activityName(a), min:num(a.min) || 0, kcal: a.kcal != null ? a.kcal : activityKcal(a, kg) }));
  return { items, kcal: items.reduce((t, i) => t + (i.kcal || 0), 0), min: items.reduce((t, i) => t + (i.min || 0), 0), unknown: items.some(i => i.kcal == null) };
}

// Eau
export const glassOf = () => num(settings().glass) || GLASS;
export const waterOf = day => num((S.docs.get('e_' + day) || {}).ml) || 0;
export function waterBase(sex){ return WATER[sex === 'm' || sex === 'f' ? sex : 'other']; }
// Repère de l'appli en mL, arrondi à 100 mL : boissons + 0,5 L par heure de sport (séances commencées ou faites, activités)
export function waterAuto(day){ return Math.round((waterBase(settings().sex) + WATER.perHour * dayEnergy(day).min / 60) / 100) * 100; }
// Objectif choisi par la personne (settings.waterGoal, en mL, de 0,5 à 6 L), ou null : alors le repère de l'appli
export const WATER_RANGE = [500, 6000];
export function waterChosen(){ const c = num(settings().waterGoal); return c != null && c >= WATER_RANGE[0] && c <= WATER_RANGE[1] ? Math.round(c / 50) * 50 : null; }
// Objectif du jour : celui de la personne s'il existe ; les quantités déjà bues (e_) ne dépendent pas de lui
export const waterGoal = day => waterChosen() || waterAuto(day);
// Sport du module « sport collectif » prévu ce jour-là : 'train', 'match' ou null
export function sportPlanned(day){
  if (!sportOn()) return null; const sp = sportInfo(); const wd = parseIso(day).getDay();
  return sp.match.indexOf(wd) >= 0 ? 'match' : sp.train.indexOf(wd) >= 0 ? 'train' : null;
}
