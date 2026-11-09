// Calendrier en haut d'Aujourd'hui : la semaine ; toucher un jour ouvre le mois avec le détail de ce jour.
import { addDays, capFirst, esc, fmtDateLong, fmtMonth, lowFirst, mondayOf, monthDays, nSeries, parseIso, today } from '../util.js';
import { DAY_SHORT } from '../library.js';
import { S } from '../store.js';
import { activityFamily, bodyweight, countSets, dayFamilies, daySummary, perWeekOf, plannedDates, sportInfo, tplDef, tplEst, wName, workouts } from '../data.js';
import { workoutLines } from './history.js';
import { activityKcal, activityName, sessionKcal } from '../energy.js';
import { actDetail } from './activity.js';
import { ring } from '../ring.js';

const INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
// Points d'une case : un par famille présente ce jour-là (couleur : famille ; forme : état)
const dot = f => '<i class="mk fam-' + f.fam + ' ' + f.state + '" aria-hidden="true"></i>';
// Sport prévu ce jour-là (module sport) : « Match » les jours de match, sinon le nom du sport
const sportPrevu = day => sportInfo().match.indexOf(parseIso(day).getDay()) >= 0 ? 'Match' : capFirst(sportInfo().name);
function cell(day, mois){
  const s = daySummary(day); const fams = dayFamilies(day);
  const nom = s.active ? wName(s.active) : s.done.length ? wName(s.done[0]) : s.planned ? tplDef(s.planned).name : s.acts.length ? activityName(s.acts[0]) : (s.label !== 'Repos' ? s.label : '');
  // ce que lit VoiceOver : la séance, puis chaque activité, puis le sport prévu
  const acts = s.acts.map(a => lowFirst(activityName(a)));
  const dit = [s.active ? 'séance en cours' : s.done.length ? 'séance faite' : s.planned ? 'séance prévue' : '', s.active || s.done.length || s.planned ? nom : '', acts.length ? (acts.length > 1 ? 'activités : ' : 'activité : ') + acts.join(', ') : '', fams.some(f => f.fam === 'collectif' && f.state === 'planned') ? lowFirst(sportPrevu(day)) + ' prévu' : ''].filter(Boolean);
  const aria = fmtDateLong(day) + (dit.length ? ' : ' + dit.join(', ') : '');
  let h = '<button type="button" class="cday' + (day === today() ? ' today' : '') + (S.calDay === day ? ' sel' : '') + '" data-act="cal-day" data-v="' + day + '" aria-label="' + esc(aria) + '">';
  if (!mois) h += '<span class="dn">' + DAY_SHORT[parseIso(day).getDay()] + '</span>';
  h += '<span class="dd">' + Number(day.slice(8)) + '</span><span class="mks" aria-hidden="true">' + fams.map(dot).join('') + '</span>';
  if (!mois) h += '<span class="s">' + esc(nom) + '</span>';
  return h + '</button>';
}
function dayDetail(day){
  const s = daySummary(day); const t = today();
  let h = '<div class="cal-detail"><h3>' + esc(capFirst(fmtDateLong(day))) + '</h3>';
  if (s.active) h += '<p>' + dot({ fam:'salle', state:'active' }) + '<b>' + esc(wName(s.active)) + '</b> : séance en cours.</p><button type="button" class="btn primary" data-act="tab" data-v="training">Reprendre la séance</button>';
  const kg = bodyweight(); const kc = k => k == null ? '' : ' · ≈ ' + Math.round(k / 10) * 10 + ' kcal';
  s.done.forEach(w => { h += '<div class="stack" style="gap:4px"><p>' + dot({ fam:'salle', state:'done' }) + '<b>' + esc(wName(w)) + '</b> · ' + (w.duration || 0) + ' min · ' + nSeries(countSets(w)) + kc(sessionKcal(w, kg)) + '</p>' + workoutLines(w) + '<button type="button" class="link" data-act="cal-hist" data-v="' + esc(w.id) + '">Voir dans l’historique</button></div>'; });
  if (s.planned) {
    const tp = tplDef(s.planned);
    h += '<p>' + dot({ fam:'salle', state:'planned' }) + 'Prévu : <b>' + esc(tp.name) + '</b> · environ ' + tplEst(tp) + ' min.</p>';
    if (day === t) h += '<button type="button" class="btn primary" data-act="start" data-v="' + esc(tp.id) + '">Commencer ' + esc(tp.name) + '</button>';
  }
  s.acts.forEach(a => { h += '<p>' + dot({ fam:activityFamily(a.type), state:'done' }) + '<b>' + esc(activityName(a)) + '</b>' + (actDetail(a) ? ' · ' + esc(actDetail(a)) : '') + kc(a.kcal != null ? a.kcal : activityKcal(a, kg)) + '</p>'; });
  const sp = dayFamilies(day).some(f => f.fam === 'collectif' && f.state === 'planned');
  if (sp) h += '<p>' + dot({ fam:'collectif', state:'planned' }) + 'Prévu : <b>' + esc(sportPrevu(day)) + '</b></p>';
  // Prévoir à l'avance (facultatif) : aujourd'hui et les jours à venir, sans séance faite ni en cours
  if (day >= t && !s.active && !s.done.length) { const on = plannedDates().indexOf(day) >= 0; h += '<button type="button" class="btn" data-act="plan-day" data-v="' + day + '">' + (on ? 'Retirer la séance prévue' : 'Prévoir une séance') + '</button>'; }
  if (!s.active && !s.done.length && !s.planned && !s.acts.length && !sp) h += '<p class="muted">' + (day < t ? 'Aucune séance notée ce jour-là.' : s.label !== 'Repos' ? esc(s.label) + ' : pas de séance de salle prévue.' : 'Repos : pas de séance prévue.') + '</p>';
  return h + '</div>';
}
export function calendarCard(){
  if (!S.loaded) return '';
  if (!S.calMonth) {
    const mon = mondayOf(today()); const n = workouts().filter(w => w.date >= mon && w.date <= addDays(mon, 6) && w.status === 'terminée').length;
    const pw = perWeekOf();
    let h = '<section class="card cal"><div class="row between"><div class="ring-row">' + ring(n / pw, { cls:'xs', html:'<b class="num">' + n + '/' + pw + '</b>' }) + '<div class="stack" style="gap:2px"><h3>Ta semaine</h3><span class="muted small">' + n + ' séance' + (n > 1 ? 's' : '') + ' sur ' + pw + '</span></div></div><button type="button" class="link" data-act="cal-month">Voir le mois</button></div><div class="cal-week">';
    for (let i = 0; i < 7; i++) h += cell(addDays(mon, i), false);
    return h + '</div></section>';
  }
  const ym = S.calMonth;
  let h = '<section class="card cal"><div class="row between"><button type="button" class="btn sm" data-act="cal-prev" aria-label="Mois précédent">‹</button><h3 class="cal-title" aria-live="polite">' + esc(capFirst(fmtMonth(ym))) + '</h3><button type="button" class="btn sm" data-act="cal-next" aria-label="Mois suivant">›</button></div>';
  h += '<div class="cal-month">' + INITIALES.map(x => '<span class="cal-h" aria-hidden="true">' + x + '</span>').join('') + monthDays(ym).map(d => d ? cell(d, true) : '<span></span>').join('') + '</div>';
  h += '<div class="stack"><span class="legend"><span><i class="mk fam-salle done"></i>Salle</span><span><i class="mk fam-cardio done"></i>Cardio</span><span><i class="mk fam-collectif done"></i>Sports collectifs</span><span><i class="mk fam-autre done"></i>Autre</span></span><span class="legend"><span><i class="mk fam-autre done"></i>fait</span><span><i class="mk fam-autre planned"></i>prévu</span></span></div><div class="row"><button type="button" class="link" data-act="cal-week">Revenir à la semaine</button></div>';
  if (S.calDay && S.calDay.slice(0, 7) === ym) h += dayDetail(S.calDay);
  return h + '</section>';
}
