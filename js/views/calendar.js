// Calendrier en haut d'Aujourd'hui : la semaine et le mois ; toucher un jour ouvre l'écran de ce jour (viewDay).
import { addDays, capFirst, esc, shortName, fmtDateLong, fmtMonth, lowFirst, mondayOf, monthDays, nSeries, parseIso, today } from '../util.js';
import { DAY_SHORT } from '../library.js';
import { S } from '../store.js';
import { activityFamily, bodyweight, countSets, dayFamilies, daySummary, perWeekOf, plannedDates, sportInfo, tplDef, tplEst, wName, workouts } from '../data.js';
import { workoutLines } from './history.js';
import { activityKcal, activityName, sessionKcal } from '../energy.js';
import { actDetail } from './activity.js';
import { ring } from '../ring.js';
import { ICONS } from '../icons.js';

const INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
// Points d'une case : un par famille présente ce jour-là (couleur : famille ; forme : état)
const dot = f => '<i class="mk fam-' + f.fam + ' ' + f.state + '" aria-hidden="true"></i>';
// Sport prévu ce jour-là (module sport) : « Match » les jours de match, sinon le nom du sport
const sportPrevu = day => sportInfo().match.indexOf(parseIso(day).getDay()) >= 0 ? 'Match' : capFirst(sportInfo().name);
function cell(day, mois){
  const s = daySummary(day); const fams = dayFamilies(day);
  const nom = s.active ? wName(s.active) : s.done.length ? wName(s.done[0]) : s.planned ? tplDef(s.planned).name : s.acts.length ? activityName(s.acts[0]) : s.plannedActs.length ? activityName(s.plannedActs[0]) : (s.label !== 'Repos' ? s.label : '');
  // ce que lit VoiceOver : la séance, puis chaque activité, puis le sport prévu
  const acts = s.acts.map(a => lowFirst(activityName(a))); const prevues = s.plannedActs.map(a => lowFirst(activityName(a)));
  const dit = [s.active ? 'séance en cours' : s.done.length ? 'séance faite' : s.planned ? 'séance prévue' : '', s.active || s.done.length || s.planned ? nom : '', acts.length ? (acts.length > 1 ? 'activités : ' : 'activité : ') + acts.join(', ') : '', prevues.length ? (prevues.length > 1 ? 'activités prévues : ' : 'activité prévue : ') + prevues.join(', ') : '', fams.some(f => f.fam === 'collectif' && f.state === 'planned') ? lowFirst(sportPrevu(day)) + ' prévu' : ''].filter(Boolean);
  const aria = fmtDateLong(day) + (dit.length ? ' : ' + dit.join(', ') : '');
  let h = '<button type="button" class="cday' + (day === today() ? ' today' : '') + (S.calDay === day ? ' sel' : '') + '" data-act="cal-day" data-v="' + day + '" aria-pressed="' + (S.calDay === day) + '" aria-label="' + esc(aria) + '">';
  if (!mois) h += '<span class="dn">' + DAY_SHORT[parseIso(day).getDay()] + '</span>';
  h += '<span class="dd">' + Number(day.slice(8)) + '</span><span class="mks" aria-hidden="true">' + fams.map(dot).join('') + '</span>';
  if (!mois) h += '<span class="s">' + esc(shortName(nom)) + '</span>';
  return h + '</button>';
}
// Écran d'un jour (poussé depuis le calendrier) : séances, activités (consulter, modifier, supprimer, ajouter) et prévu
const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
function actRow(a, kg){
  const kc = a.kcal != null ? a.kcal : activityKcal(a, kg); const name = activityName(a);
  if (S.confirm === 'act-del:' + a.id) return '<div class="stack"><p class="small">Supprimer « ' + esc(name) + ' » du ' + esc(fmtDateLong(a.date)) + ' ? Elle sera effacée pour de bon.</p><div class="row"><button type="button" class="btn danger" data-act="act-del-yes" data-v="' + esc(a.id) + '">Supprimer</button><button type="button" class="btn ghost" data-act="cancel-confirm">Garder</button></div></div>';
  const det = [a.planned ? (a.date < today() ? 'prévue, pas notée' : 'prévue') : '', actDetail(a), kc == null ? '' : '≈ ' + Math.round(kc / 10) * 10 + ' kcal'].filter(Boolean).join(' · ');
  // Activité prévue : ligne en pointillés ; une coche la note comme faite quand son jour est venu
  const ok = a.planned && a.date <= today() ? '<button type="button" class="plus ok" data-act="act-done" data-v="' + esc(a.id) + '" aria-label="' + esc('Marquer ' + lowFirst(name) + ' comme faite') + '">' + ICONS.check + '</button>' : '';
  return '<div class="quick"><button type="button" class="pick' + (a.planned ? ' planned' : '') + '" data-act="act-edit" data-v="' + esc(a.id) + '"><span class="ql"><span class="n">' + dot({ fam:activityFamily(a.type, a.sport), state: a.planned ? 'planned' : 'done' }) + esc(name) + '</span>' + (det ? '<span class="m">' + esc(det) + '</span>' : '') + '</span><span aria-hidden="true">›</span></button>' + ok + '<button type="button" class="plus del" data-act="act-ask-del" data-v="' + esc(a.id) + '" aria-label="' + esc('Supprimer ' + lowFirst(name)) + '">' + TRASH + '</button></div>';
}
export function viewDay(){
  const day = S.day; const s = daySummary(day); const t = today(); const kg = bodyweight();
  const kc = k => k == null ? '' : ' · ≈ ' + Math.round(k / 10) * 10 + ' kcal';
  let h = '<div class="row"><button type="button" class="link" data-act="day-close" data-back>‹ ' + (S.calMonth ? 'Calendrier' : 'Aujourd’hui') + '</button></div><h1>' + esc(capFirst(fmtDateLong(day))) + '</h1>';
  const sp = dayFamilies(day).some(f => f.fam === 'collectif' && f.state === 'planned');
  // Séance de salle : en cours, faite ou prévue
  h += '<section class="card"><h2>Séance</h2><div class="cal-detail">';
  if (s.active) h += '<p>' + dot({ fam:'salle', state:'active' }) + '<b>' + esc(wName(s.active)) + '</b> : séance en cours.</p><button type="button" class="btn primary" data-act="tab" data-v="training">Reprendre la séance</button>';
  s.done.forEach(w => { h += '<div class="stack"><p>' + dot({ fam:'salle', state:'done' }) + '<b>' + esc(wName(w)) + '</b> · ' + (w.duration ? w.duration + ' min' : 'durée non notée') + ' · ' + nSeries(countSets(w)) + kc(sessionKcal(w, kg)) + '</p>' + workoutLines(w) + '<button type="button" class="link" data-act="cal-hist" data-v="' + esc(w.id) + '">Voir dans l’historique</button></div>'; });
  if (s.planned) {
    const tp = tplDef(s.planned);
    h += '<p>' + dot({ fam:'salle', state:'planned' }) + 'Prévu : <b>' + esc(tp.name) + '</b> · environ ' + tplEst(tp) + ' min.</p>';
    if (day === t) h += '<button type="button" class="btn primary" data-act="start" data-v="' + esc(tp.id) + '">Commencer ' + esc(tp.name) + '</button>';
  }
  if (sp) h += '<p>' + dot({ fam:'collectif', state:'planned' }) + 'Prévu : <b>' + esc(sportPrevu(day)) + '</b></p>';
  // Prévoir à l'avance (facultatif) : aujourd'hui et les jours à venir, sans séance faite ni en cours
  if (day >= t && !s.active && !s.done.length) { const on = plannedDates().indexOf(day) >= 0; h += '<button type="button" class="btn" data-act="plan-day" data-v="' + day + '">' + (on ? 'Retirer la séance prévue' : 'Prévoir une séance') + '</button>'; }
  if (!s.active && !s.done.length && !s.planned && !sp) h += '<p class="muted">' + (day < t ? 'Aucune séance notée ce jour-là.' : s.label !== 'Repos' ? esc(s.label) + ' : pas de séance de salle prévue.' : 'Repos : pas de séance prévue.') + '</p>';
  h += '</div></section>';
  // Activités : ajouter (jours passés et aujourd'hui), modifier, supprimer avec confirmation
  const all = s.acts.concat(s.plannedActs);
  h += '<section class="card"><h2>Activités</h2>' + (all.length ? all.map(a => actRow(a, kg)).join('') : '<p class="muted">' + (day > t ? 'Aucune activité prévue.' : 'Aucune activité notée.') + '</p>');
  // Jours passés et aujourd'hui : noter ce qui a été fait ; aujourd'hui et jours à venir : prévoir à l'avance
  h += '<div class="row">' + (day <= t ? '<button type="button" class="btn" data-act="act-add" data-d="' + day + '">+ Ajouter une activité</button>' : '') + (day >= t ? '<button type="button" class="btn" data-act="act-add" data-p="1" data-d="' + day + '">+ Prévoir une activité</button>' : '') + '</div>';
  return h + '</section>';
}
export function calendarCard(){
  if (!S.loaded) return '';
  if (!S.calMonth) {
    const mon = mondayOf(today()); const n = workouts().filter(w => w.date >= mon && w.date <= addDays(mon, 6) && w.status === 'terminée').length;
    const pw = perWeekOf();
    let h = '<section class="card cal"><div class="row between"><div class="ring-row">' + ring(n / pw, { cls:'xs', html:'<b class="num">' + n + '/' + pw + '</b>' }) + '<div class="stack" style="gap:2px"><h3>Ta semaine</h3><span class="muted small">' + n + ' séance' + (n > 1 ? 's' : '') + ' sur ' + pw + '</span>' + '</div></div><button type="button" class="link" data-act="cal-month">Voir le mois</button></div><div class="cal-week">';
    for (let i = 0; i < 7; i++) h += cell(addDays(mon, i), false);
    return h + '</div></section>';
  }
  const ym = S.calMonth;
  let h = '<section class="card cal"><div class="row between"><button type="button" class="btn sm" data-act="cal-prev" aria-label="Mois précédent">‹</button><h3 class="cal-title" aria-live="polite">' + esc(capFirst(fmtMonth(ym))) + '</h3><button type="button" class="btn sm" data-act="cal-next" aria-label="Mois suivant">›</button></div>';
  h += '<div class="cal-month">' + INITIALES.map(x => '<span class="cal-h" aria-hidden="true">' + x + '</span>').join('') + monthDays(ym).map(d => d ? cell(d, true) : '<span></span>').join('') + '</div>';
  h += '<div class="stack"><span class="legend"><span><i class="mk fam-salle done"></i>Salle</span><span><i class="mk fam-cardio done"></i>Cardio</span><span><i class="mk fam-collectif done"></i>Sports collectifs</span><span><i class="mk fam-individuel done"></i>Sports individuels</span><span><i class="mk fam-autre done"></i>Autre</span></span><span class="legend"><span><i class="mk fam-autre done"></i>fait</span><span><i class="mk fam-autre planned"></i>prévu</span></span></div><div class="row"><button type="button" class="link" data-act="cal-week">Revenir à la semaine</button></div>';
  return h + '</section>';
}
