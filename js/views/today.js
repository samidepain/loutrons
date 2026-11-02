// Écran Aujourd’hui.
import { addDays, capFirst, esc, fmtDate, fmtDateLong, fmtKg, lowFirst, mondayOf, nSeries, num, parseIso, today, withDot } from '../util.js';
import { DAY_ORDER, DAY_SHORT } from '../library.js';
import { S } from '../store.js';
import { activeWorkout, allTpl, backupDue, bodyweight, countSets, jumpsOn, kneeAlert, kneeOn, planDay, settings, sportInfo, sportOn, testForBlock, tplDef, tplEst, weekGoal, weekInfo, wName, workouts } from '../data.js';
import { fatigueCheck } from '../engine.js';
import { useShare } from '../backup.js';
import { kneeChips } from '../render.js';
import { noTplCard } from './program.js';
import { calendarCard } from './calendar.js';
import { checkCard, goalTodayCard } from './goal.js';
import { emile, hey } from '../emile.js';
import { activitiesCard, waterCard } from './activity.js';
import { EFFORT, effortOf, sessionKcal, sessionMin } from '../energy.js';

export function viewToday(){
  const d = today(); const wd = parseIso(d).getDay(); const plan = planDay(wd);
  const wk = weekInfo(d); const goal = weekGoal(wk);
  const ws = workouts(); const aw = S.loaded && activeWorkout();
  const doneToday = ws.filter(w => w.date === d && w.status === 'terminée');
  const who = String(settings().name || '').trim();
  let h = '<div class="stack"><span class="hero-date">' + (who ? 'Salut ' + esc(who) + ' · ' : '') + esc(fmtDateLong(d)) + '</span>';
  h += '<div class="row"><span class="pill acc">Semaine ' + wk.n + '</span><span class="pill court">Bloc ' + wk.block + ' · semaine ' + wk.bw + '/6</span>' + (wk.busy ? '<span class="pill warn">' + esc(capFirst(sportInfo().name)) + ' chargé</span>' : '') + '</div></div>';
  h += calendarCard();
  if (S.loaded && backupDue()) {
    const le = settings().lastExport;
    h += emile('<p>' + esc(hey(le ? withDot('Ta dernière sauvegarde date du ' + fmtDate(le)) : 'Tu n’as pas encore sauvegardé tes données.')) + ' Elles ne sont que sur ce téléphone : exporte une copie pour ne rien perdre si tu changes de téléphone ou supprimes l’appli.</p>'
      + '<button type="button" class="btn primary" data-act="export" data-v="json">Exporter maintenant</button>' + (useShare('json') ? '<p class="muted small">Choisis ensuite «&nbsp;Enregistrer dans Fichiers&nbsp;».</p>' : ''), { title:'Sauvegarde', tone:'warn' });
  }
  h += checkCard();
  if (S.summary) {
    const sw = S.docs.get(S.summary.id);
    let b = sw ? '<p class="muted">' + esc(wName(sw)) + ' · ' + (sw.duration || 0) + ' min · ' + nSeries(countSets(sw)) + '</p>' : '';
    b += S.summary.prs.length ? '<p>' + esc(hey('Bien joué : ' + (S.summary.prs.length > 1 ? 'de nouveaux records !' : 'un nouveau record !'))) + '</p><div class="stack" style="gap:4px">' + S.summary.prs.map(p => '<p class="small">' + esc(p) + '</p>').join('') + '</div>'
      : '<p class="small">' + esc(hey('Pas de record cette fois. La régularité compte plus que chaque séance.')) + '</p>';
    if (sw) {
      const ef = effortOf(sw); const kc = sessionKcal(sw, bodyweight());
      b += '<div class="stack" style="gap:6px"><span class="label">Effort de la séance</span><div class="chips" role="group">' + Object.keys(EFFORT).map(k => '<button type="button" class="chip txt' + (ef === k ? ' on' : '') + '" data-act="effort" data-v="' + k + '" aria-pressed="' + (ef === k) + '">' + EFFORT[k].label + '</button>').join('') + '</div>'
        + '<p class="small muted">' + esc(EFFORT[ef].desc) + '. ' + (kc == null ? 'Indique ton poids pour estimer les calories.' : 'Environ ' + Math.round(kc / 10) * 10 + ' kcal dépensées en ' + sessionMin(sw) + ' min.') + '</p></div>';
    }
    h += emile(b, { title:'Séance enregistrée', tone:'good', close:'close-summary' });
  }
  if (S.loaded) {
    const fat = fatigueCheck();
    if (fat) h += emile('<p>' + esc(hey('Ta force baisse sur ' + fat.drops.length + ' exercices sur ' + fat.compared + ' cette semaine : ' + fat.drops.join(', ') + '.')) + (fat.avgSleep != null && fat.avgSleep < 7 ? ' Ton sommeil moyen ces derniers jours est de ' + fmtKg(Math.round(fat.avgSleep * 10) / 10) + ' h.' : '') + ' Avancer la semaine de décharge peut t’aider à récupérer.</p><div class="row"><button type="button" class="btn primary" data-act="fatigue-deload">Avancer la décharge</button><button type="button" class="btn" data-act="fatigue-ignore">Ignorer cette semaine</button></div>', { title:'Fatigue probable', tone:'warn' });
    if (jumpsOn() && wk.bw === 6 && !testForBlock(wk.block)) h += emile('<p>Test de détente cette semaine : il s’affichera au début de ta prochaine séance jambes. La décharge te laisse reposé, c’est le bon moment.</p>');
    else if (jumpsOn() && wk.bw === 5) h += emile('<p>Test de détente la semaine prochaine, pendant la décharge.</p>');
    const bb = wk.bw === 6 ? wk.block : (wk.bw === 1 && wk.block > 1 ? wk.block - 1 : 0);
    if (bb) h += '<section class="card"><div class="row between"><div class="stack" style="gap:2px"><h3>Bilan du bloc ' + bb + '</h3><span class="muted small">Force, régularité, volume, genou, poids, sommeil et détente, avec des pistes pour la suite.</span></div><button type="button" class="btn" data-act="bilan" data-v="' + bb + '">Voir</button></div></section>';
  }
  if (S.loaded && kneeAlert()) h += emile('<p>Genou au-dessus de 3/10 ces 10 derniers jours : pas de sauts, charges maintenues sur les exercices qui sollicitent le genou. Si ça ne redescend pas, consulte un kiné ou un médecin du sport.</p>', { title:'Genou', tone:'bad' });
  h += emile('<p>' + esc(goal.d) + '</p>', { title: goal.t });

  if (aw) {
    h += '<section class="card plan"><span class="label">Séance en cours</span><div class="name">' + esc(wName(aw)) + '</div><button type="button" class="btn primary big" data-act="tab" data-v="training">Reprendre la séance</button></section>';
  } else if (plan.s) {
    const t = tplDef(plan.s);
    h += '<section class="card plan"><span class="label">' + (doneToday.length ? 'Au programme' : 'Rappel : séance aujourd’hui') + '</span><div class="name">' + esc(t.name) + '</div><p>' + esc(t.focus || '') + ' · environ ' + tplEst(t) + ' min</p>' + (plan.note ? '<p class="muted small">' + esc(plan.note) + '</p>' : '');
    if (doneToday.some(w => w.tpl === plan.s || w.sess === plan.s)) h += '<div class="alert good">Séance faite aujourd’hui.</div>';
    else h += '<button type="button" class="btn primary big" data-act="start" data-v="' + plan.s + '"' + (S.loaded ? '' : ' disabled') + '>' + (S.loaded ? 'Commencer ' + esc(t.name) : 'Chargement…') + '</button>';
    h += '</section>';
  } else {
    let next = null; for (let i = 1; i <= 7 && !next; i++) { const dd = addDays(d, i); const p = planDay(parseIso(dd).getDay()); if (p.s) next = { d:dd, t:tplDef(p.s) }; }
    h += '<section class="card"><span class="label">Aujourd’hui</span><h2>' + esc(plan.label) + '</h2>' + (plan.note ? '<p class="muted">' + esc(plan.note) + '</p>' : '') + (next ? '<p class="small">Prochaine séance : <b>' + esc(next.t.name) + '</b>, ' + esc(withDot(fmtDateLong(next.d))) + '</p>' : '') + '</section>';
  }
  h += goalTodayCard();
  h += activitiesCard() + waterCard();
  // Choisir une autre séance
  const tpls = allTpl();
  if (S.loaded && !tpls.length) h += noTplCard();
  else h += '<section class="card"><h3>Faire une autre séance</h3><p class="muted small">N’importe quel jour, les objectifs sont calculés pareil.</p><div class="row">' + tpls.map(t => '<button type="button" class="btn" data-act="start" data-v="' + esc(t.id) + '"' + (S.loaded ? '' : ' disabled') + '>' + esc(t.name) + '</button>').join('') + '</div></section>';

  // Corps et sommeil
  const b = S.docs.get('b_' + d) || {};
  h += '<section class="card"><div class="stack"><h3>Corps et sommeil</h3><p class="muted small">Le poids sert aussi à calculer la charge réelle des tractions. Nuit de moins de 6 h : l’appli te conseille de garder 1 rep de plus en réserve.</p></div>';
  h += '<div class="fields"><label class="f"><span>Poids (kg)</span><input class="n" id="b-weight" data-b="weight" inputmode="decimal" value="' + esc(b.weight == null ? '' : fmtKg(num(b.weight))) + '" placeholder="' + esc(bodyweight() ? fmtKg(bodyweight()) : 'ex. 75') + '"' + (S.loaded ? '' : ' disabled') + '></label><label class="f"><span>Sommeil (h)</span><input class="n" id="b-sleep" data-b="sleep" inputmode="decimal" value="' + esc(b.sleep == null ? '' : fmtKg(num(b.sleep))) + '" placeholder="ex. 7,5"' + (S.loaded ? '' : ' disabled') + '></label></div>';
  h += '<div class="stack" style="gap:6px"><span class="label">Qualité du sommeil</span><div class="chips">' + [1,2,3,4,5].map(v => '<button type="button" class="chip" data-act="sleepq" data-v="' + v + '"' + (S.loaded ? '' : ' disabled') + ' aria-pressed="' + (b.sleepQ === v) + '"' + (b.sleepQ === v ? ' style="background:var(--ink);color:var(--bg);border-color:var(--ink)"' : '') + '>' + v + '</button>').join('') + '</div><span class="muted small">1 = très mauvaise, 5 = excellente</span></div></section>';

  // Genou
  const k = S.docs.get('k_' + d);
  if (kneeOn()) h += '<section class="card"><div class="stack"><h3>Genou ce matin</h3><p class="muted small">Douleur en montant les escaliers, de 0 à 10. Au-dessus de 3, l’appli suspend les sauts et maintient les charges.</p></div>' + kneeChips(k ? k.stairs : null, 'stairs', !S.loaded) + '</section>';

  h += '<section class="card"><h3>Cette semaine</h3>';
  if (sportOn() && jumpsOn()) h += '<label class="toggle"><input type="checkbox" id="busy-week" data-act="busy"' + (wk.busy ? ' checked' : '') + (S.loaded ? '' : ' disabled') + '><span><b>Semaine chargée en ' + esc(lowFirst(sportInfo().name)) + '</b><br><span class="muted small">Séance ou match en plus : pas de sauts en salle cette semaine.</span></span></label>';
  h += '<label class="toggle"><input type="checkbox" id="deload-week" data-act="deload"' + (wk.forced ? ' checked' : '') + (S.loaded && wk.bw !== 6 ? '' : ' disabled') + '><span><b>Décharge anticipée</b><br><span class="muted small">' + (wk.bw === 6 ? 'C’est déjà ta semaine de décharge.' : 'Fatigue accumulée' + (kneeOn() ? ' ou genou qui réagit' : '') + ' : mêmes charges, environ 1/3 de séries en moins.') + '</span></span></label></section>';
  return h;
}
