// Douleurs suivies (genou et autres zones) : zones, exercices concernés, alertes. Calculs seuls, sans affichage.
// Le genou garde ses documents d'origine (k_<date> et w.knee). Les autres zones : d_<date> ({ date, z:{ zone:{ v, flags } } }) et w.pain.
// Sources (détail dans « La science ») : modèle de suivi de la douleur (Thomeé 1997 ; Silbernagel et al. 2007 : jusqu'à 5/10 pendant l'effort,
// retour au niveau de départ le lendemain matin) ; Smith et al. 2017 (s'entraîner avec une douleur n'est pas un obstacle). Le seuil de 3/10 sur
// 10 jours est PLUS PRUDENT que ce modèle et ne bloque pas l'entraînement : il fige seulement la hausse des charges. 7/10 est un choix de l'appli.
// Rien ici n'est un diagnostic.
import { addDays, today } from './util.js';
import { S } from './store.js';
import { kneeEntries, kneeOn, settings } from './data.js';

export const PAIN_LIMIT = 3, PAIN_DAYS = 10, PAIN_STRONG = 7;
const mus = (e, l) => { const m = e.muscles || {}; return (m.p || []).some(x => l.indexOf(x) >= 0) || (m.s || []).some(x => l.indexOf(x) >= 0); };
// hits : exercices qui sollicitent la zone (null : l'appli ne sait pas les repérer, donc aucune adaptation automatique) ;
// what : ce que cela recouvre, dit à la personne ; ask : la situation à noter
export const ZONES = {
  knee:     { label:'Genou', ask:'Douleur en montant les escaliers', what:'le genou', hits: e => !!e.knee },
  shoulder: { label:'Épaule', ask:'Douleur en levant le bras ou en poussant', what:'les épaules ou les pectoraux (d’après les muscles travaillés)', hits: e => mus(e, ['Épaules']) || ((e.muscles || {}).p || []).indexOf('Pectoraux') >= 0 },
  elbow:    { label:'Coude', ask:'Douleur en serrant, en tirant ou en poussant', what:'les biceps ou les triceps (d’après les muscles travaillés)', hits: e => mus(e, ['Biceps', 'Triceps']) },
  lowback:  { label:'Bas du dos', ask:'Douleur en te penchant en avant ou en te redressant', what:'le bas du dos (soulevés de terre, charnières de hanche, rowings penchés, squats à la barre)', hits: e => !!e.back },
  wrist:    { label:'Poignet', ask:'Douleur en appui sur la main ou en serrant', hits: null },
  hip:      { label:'Hanche', ask:'Douleur en marchant ou en montant des marches', hits: null },
  neck:     { label:'Nuque', ask:'Douleur en tournant ou en inclinant la tête', hits: null },
  other:    { label:'Autre zone', ask:'Douleur qui revient ou gêne ton entraînement', hits: null }
};
export const ZONE_IDS = Object.keys(ZONES);
// Signaux d'alerte courants des guides cliniques (NICE ; cadre IFOMPT 2020 pour le dos et la nuque), à la valeur diagnostique faible : ils servent
// à faire consulter, pas à diagnostiquer. Seuls ceux qui ont un sens pour la zone sont demandés (flags). 'saddle' : urgence (syndrome de la queue de cheval).
export const FLAG_LABEL = { numb:'Engourdissements ou fourmillements', rest:'Douleur la nuit ou au repos', shock:'Après un choc ou un faux mouvement',
  weak:'Perte soudaine de force', swell:'Articulation chaude ou gonflée, ou fièvre', saddle:'Engourdissement de l’entrejambe, ou troubles urinaires ou intestinaux' };
const BASE = ['numb', 'rest', 'shock'];
const FLAGS_OF = { shoulder: BASE.concat(['weak', 'swell']), elbow: BASE.concat(['weak', 'swell']), wrist: BASE.concat(['weak', 'swell']), hip: BASE.concat(['swell']), lowback: BASE.concat(['saddle']), neck: BASE.concat(['weak']), other: BASE.concat(['swell']) };
Object.keys(FLAGS_OF).forEach(z => { ZONES[z].flags = FLAGS_OF[z]; });

// Zones suivies : le genou par l'option d'origine, les autres par settings.pain.zones
export function painZones(){
  const on = (settings().pain || {}).zones || [];
  return ZONE_IDS.filter(z => z === 'knee' ? kneeOn() : on.indexOf(z) >= 0);
}
// Mesures d'une zone, de la plus ancienne à la plus récente : { date, v, src:'stairs' | 'day' | 'session', flags }
export function painEntries(z){
  if (z === 'knee') return kneeEntries();
  const out = [];
  S.docs.forEach((o, id) => {
    if (id.indexOf('d_') === 0 && o.z && o.z[z] && o.z[z].v != null) out.push({ date:o.date, v:o.z[z].v, src:'day', flags:o.z[z].flags || [] });
    if (id.indexOf('w_') === 0 && o.pain && o.pain[z] != null) out.push({ date:o.date, v:o.pain[z], src:'session', flags:[] });
  });
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
// Mesures au-dessus du seuil ces 10 derniers jours
export function painRecent(z){
  if (painZones().indexOf(z) < 0) return [];
  const lim = addDays(today(), -PAIN_DAYS); return painEntries(z).filter(k => k.date >= lim && k.v > PAIN_LIMIT);
}
export const painAlert = z => painRecent(z).length > 0;
// Zones en alerte qui sollicitent cet exercice (le moteur y maintient la charge)
export const soreZones = e => ZONE_IDS.filter(z => ZONES[z].hits && ZONES[z].hits(e) && painAlert(z));
// Prudence renforcée : douleur forte ou signal d'alerte noté dans la période (les zones sans repère d'exercice y sont aussi soumises)
export const painStrong = z => painRecent(z).some(k => k.v >= PAIN_STRONG || k.flags.length > 0);
// Texte de maintien d'un exercice (cible de la séance)
export function holdText(sore){
  if (sore.length === 1 && sore[0] === 'knee') return 'Genou sensible ces derniers jours : garde la charge et une amplitude confortable, sans chercher de record.';
  return 'Zone sensible (' + sore.map(z => ZONES[z].label.toLowerCase()).join(', ') + ') au-dessus de 3/10 ces 10 derniers jours : garde la charge et une amplitude confortable, sans chercher de record.';
}
// Conseil d'une zone en alerte (hors genou, qui garde le sien) : { title, lines, tone } ou null
export function painAdvice(z, held){
  const r = painRecent(z); if (!r.length) return null; const Z = ZONES[z];
  const max = Math.max.apply(null, r.map(k => k.v));
  const lines = [Z.label + ' : jusqu’à ' + max + '/10 ces ' + PAIN_DAYS + ' derniers jours (seuil de prudence : ' + PAIN_LIMIT + '/10).'];
  lines.push(Z.hits ? 'Je ne monte pas la charge des exercices qui sollicitent ' + Z.what + ' : c’est une règle de prudence de l’appli. Choisis une amplitude confortable, ou remplace un mouvement qui déclenche la douleur.'
    : 'Je consigne cette douleur sans modifier ton programme : je ne peux pas relier cette zone à tes exercices de façon fiable, donc tes charges restent calculées comme d’habitude. À toi d’adapter les mouvements qui la déclenchent.');
  if (held && held.length) lines.push('Dans ta prochaine séance, charge maintenue sur : ' + held.join(', ') + '.');
  const fl = []; r.forEach(k => k.flags.forEach(f => { if (fl.indexOf(f) < 0 && FLAG_LABEL[f]) fl.push(f); }));
  if (fl.indexOf('saddle') >= 0) lines.splice(1, lines.length, 'Engourdissement de l’entrejambe ou troubles urinaires ou intestinaux avec une douleur au dos : c’est une urgence médicale, consulte sans attendre.');
  else if (painStrong(z)) lines.push('Tu as noté ' + (fl.length ? 'un signal d’alerte (' + fl.map(f => FLAG_LABEL[f].charAt(0).toLowerCase() + FLAG_LABEL[f].slice(1)).join(', ') + ')' : 'une douleur forte') + ' : consulte un médecin ou un kiné avant de recharger cette zone.');
  else lines.push('Si elle dure ou revient, consulte un médecin ou un kiné. Ce n’est pas un diagnostic.');
  return { title:Z.label, lines, tone: painStrong(z) ? 'bad' : 'warn', key:'pain:' + z + ':' + r[r.length - 1].date };
}
