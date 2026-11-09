// Écran Entraînement (hors séance en cours) : ton programme, ses séances, les exercices, le planning.
import { addDays, capFirst, esc, fmtDateLong, fmtKg, lowFirst, mondayOf, nbsp, num, parseIso, today, WEEKDAYS, withDot } from '../util.js';
import { DAY_ORDER, DAY_SHORT, KINDS, MUSCLES, PROGRAMS } from '../library.js';
import { S } from '../store.js';
import { allEx, allTpl, excluded, exDef, jumpsOn, kneeOn, mods, nextSession, perWeekOf, planDay, plannedDates, plannedSessions, programOf, rotationOf, searchEx, settings, sportInfo, sportOn, startDate, tplDef, tplEst, tplItems, weekInfo } from '../data.js';
import { useShare } from '../backup.js';
import { VERSION } from '../version.js';

const PTABS = [['seances','Séances'],['exercices','Exercices'],['planning','Planning']];
export function viewProgram(){
  let h = '<h1>Entraînement</h1><div class="seg" role="tablist">' + PTABS.map(t => '<button type="button" class="chip' + (S.progTab === t[0] ? ' on' : '') + '" data-act="ptab" data-v="' + t[0] + '" role="tab" aria-selected="' + (S.progTab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>';
  if (!S.loaded) return h + '<p class="loading">Chargement…</p>';
  if (S.progTab === 'exercices') return h + viewExercises();
  if (S.progTab === 'planning') return h + viewPlanning();
  return h + viewTemplates();
}
function programCard(){
  const g = programOf() || {}; const base = PROGRAMS[g.base];
  let h = '<section class="card"><span class="label">Ton programme</span>';
  h += S.renaming
    ? '<div class="row"><input class="plain" id="prog-name" value="' + esc(g.name || '') + '" aria-label="Nom du programme" style="flex:1;width:auto;min-width:0"><button type="button" class="btn primary" data-act="prog-rename-save">Enregistrer</button></div>'
    : '<div class="row between"><h2>' + esc(g.name || 'Mon programme') + '</h2><button type="button" class="link" data-act="prog-rename">Renommer</button></div>';
  h += '<p class="muted small">' + esc(base ? base.desc : 'Ton propre programme : crée tes séances et mets-y les exercices que tu veux.') + '</p>';
  return h + '<div class="row"><button type="button" class="btn" data-act="prog-change">Changer de programme</button><button type="button" class="btn" data-act="ptab" data-v="planning">Changer la rotation</button></div></section>';
}
export function noTplCard(){
  return '<section class="card"><h2>Crée ta première séance</h2><p class="muted">Donne-lui un nom, puis ajoute tes exercices : s’il en manque un, crée-le depuis la liste.</p><button type="button" class="btn primary big" data-act="go-new-tpl">Créer une séance</button></section>';
}
// Séances : la prochaine de la rotation en carte vedette avec « Commencer » en orange, les autres en gris ; « Créer » en bas
function viewTemplates(){
  const next = nextSession(); let h = programCard();
  const tpls = allTpl(); const first = tpls.filter(t => t.id === next);
  first.concat(tpls.filter(t => t.id !== next)).forEach(t => {
    const its = tplItems(t); const up = t.id === next;
    h += '<section class="card tpl' + (up ? ' hero' : '') + '"><div class="row between"><div class="stack" style="gap:2px">' + (up ? '<span class="label">Ta prochaine séance</span>' : '') + '<h2 class="tpl-name">' + esc(t.name) + '</h2><span class="muted small">' + esc(t.focus || '') + (t.focus ? ' · ' : '') + its.length + ' exercices · environ ' + tplEst(t) + ' min' + (t.edited ? ' · modifiée' : '') + (!t.builtin ? ' · perso' : '') + '</span></div></div>';
    h += '<p class="small muted">' + esc(its.map(it => { const e = exDef(it.ex); return e ? e.name : '?'; }).join(' · ')) + '</p>';
    h += '<div class="row"><button type="button" class="btn' + (up ? ' primary' : '') + '" data-act="start" data-v="' + esc(t.id) + '">Commencer</button><button type="button" class="btn" data-act="edit-tpl" data-v="' + esc(t.id) + '">Modifier</button></div></section>';
  });
  return h + '<button type="button" class="btn big" data-act="new-tpl">+ Créer une séance</button>';
}
function viewExercises(){
  const n = allEx().filter(e => e.kind !== 'plyo' || jumpsOn()).length;
  let h = '<button type="button" class="btn primary" data-act="new-ex">+ Ajouter un exercice</button><p class="muted small">' + n + ' exercices : touche-en un pour voir sa fiche.</p>';
  h += '<input class="plain" type="search" id="ex-q" data-xq="1" placeholder="Rechercher : nom, muscle, « DC », « squat »…" aria-label="Rechercher un exercice" value="' + esc(S.exQ || '') + '" autocomplete="off" enterkeyhint="search">';
  return h + '<div class="stack" id="ex-list" style="gap:16px">' + exerciseList() + '</div>';
}
const exRow = (e, hidden) => '<button type="button" class="pick" data-act="ex-fiche" data-v="' + esc(e.id) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(e.name) + '</span><span class="m">' + esc(KINDS[e.kind] || '') + (e.kind === 'load' || e.kind === 'bw' ? ' · ' + e.sets + ' × ' + e.lo + '-' + e.hi : e.kind === 'cardio' ? ' · ' + e.lo + ' min' : '') + (e.custom ? ' · perso' : '') + (hidden ? ' · masqué' : '') + '</span></span><span aria-hidden="true">›</span></button>';
// Avec une recherche : résultats du plus proche au moins proche ; sinon, groupes par muscle principal
export function exerciseList(){
  const hid = excluded(); const list = allEx().filter(e => e.kind !== 'plyo' || jumpsOn());
  if (String(S.exQ || '').trim()) {
    const r = searchEx(list, S.exQ);
    return r.length ? '<section class="card"><h3>' + r.length + ' résultat' + (r.length > 1 ? 's' : '') + '</h3>' + r.map(e => exRow(e, hid.indexOf(e.id) >= 0)).join('') + '</section>'
      : '<p class="empty">Aucun exercice trouvé. Tu peux le créer avec « Ajouter un exercice ».</p>';
  }
  const groups = {};
  list.forEach(e => { const g = hid.indexOf(e.id) >= 0 ? 'Masqués' : e.kind === 'plyo' ? 'Pliométrie' : e.kind === 'cardio' ? 'Cardio' : ((e.muscles.p || [])[0] || 'Autres'); (groups[g] = groups[g] || []).push(e); });
  return [...MUSCLES, 'Cardio', 'Pliométrie', 'Autres', 'Masqués'].filter(g => groups[g]).map(g =>
    g === 'Masqués'
      // exercices masqués, tout en bas : on peut les réafficher d'ici (anciennement dans le profil)
      ? '<section class="card"><h3>Exercices masqués <span class="muted small">' + groups[g].length + '</span></h3><p class="muted small">Ils ne sont plus proposés, mais les séances qui les contiennent ne changent pas.</p>' + groups[g].map(e => '<div class="pick static"><span class="n">' + esc(e.name) + '</span><button type="button" class="btn" data-act="ex-unhide" data-v="' + esc(e.id) + '">Réafficher</button></div>').join('') + '</section>'
      : '<section class="card"><h3>' + esc(g) + ' <span class="muted small">' + groups[g].length + '</span></h3>' + groups[g].map(e => exRow(e, false)).join('') + '</section>').join('');
}
// Planning : tes jours, cette semaine (semaine chargée, décharge anticipée), réglages de l'entraînement (début, options, jours de sport)
function viewPlanning(){
  const tpls = allTpl(); const rot = rotationOf(); const per = perWeekOf();
  let h = '<section class="card"><h3>Ta rotation</h3><p class="muted small">Tes séances reviennent dans cet ordre. Aujourd’hui te propose la suivante, quel que soit le jour ; tu peux toujours en faire une autre.</p>';
  if (!tpls.length) h += '<p class="small">Crée d’abord tes séances dans l’onglet Séances.</p>';
  rot.forEach((id, i) => { h += rotRow(tplDef(id), i, rot.length, true); });
  tpls.filter(t => rot.indexOf(t.id) < 0).forEach(t => { h += rotRow(t, -1, 0, false); });
  h += '<span class="label">Séances par semaine</span><div class="chips" role="group" aria-label="Séances par semaine">' + [2, 3, 4, 5, 6].map(n => '<button type="button" class="chip' + (per === n ? ' on' : '') + '" data-act="per-week" data-v="' + n + '" aria-pressed="' + (per === n) + '">' + n + '</button>').join('') + '</div>';
  if (Array.isArray(settings().rotation) || Array.isArray(settings().rotOff)) h += '<button type="button" class="link" data-act="reset-rotation">Revenir à l’ordre du programme</button>';
  return h + '</section>' + planAheadCard() + weekCard() + settingsCard();
}
// Une séance de la rotation : rang, nom, ↑ et ↓ pour la déplacer, et la case « Dans la rotation »
function rotRow(t, i, n, on){
  const id = esc(t.id); const nm = esc(t.name);
  return '<div class="rot-row' + (on ? '' : ' off') + '"><span class="rot-n num">' + (on ? i + 1 : '') + '</span><span class="rot-name">' + nm + '</span>'
    + '<button type="button" class="step" data-act="rot-up" data-v="' + id + '" aria-label="Monter ' + nm + '"' + (on && i > 0 ? '' : ' disabled') + '>↑</button>'
    + '<button type="button" class="step" data-act="rot-down" data-v="' + id + '" aria-label="Descendre ' + nm + '"' + (on && i < n - 1 ? '' : ' disabled') + '>↓</button>'
    + '<label class="rot-in"><input type="checkbox" data-act="rot-toggle" data-v="' + id + '"' + (on ? ' checked' : '') + '><span>Dans la rotation</span></label></div>';
}
// Prévoir tes séances (facultatif) : cette semaine et la suivante ; les jours prévus reçoivent la rotation dans l'ordre
function planAheadCard(){
  const t = today(); const mon = mondayOf(t); const planned = plannedDates(); const ses = plannedSessions();
  let h = '<section class="card"><h3>Prévoir tes séances</h3><p class="muted small">Facultatif : touche les jours où tu comptes venir. Ils reçoivent les séances de ta rotation, dans l’ordre.</p>';
  [0, 7].forEach(off => {
    h += '<span class="label">' + (off ? 'Semaine prochaine' : 'Cette semaine') + '</span><div class="days" role="group" aria-label="' + (off ? 'Semaine prochaine' : 'Cette semaine') + '">';
    for (let i = 0; i < 7; i++) { const d = addDays(mon, off + i); const on = planned.indexOf(d) >= 0;
      h += '<button type="button" class="chip txt plan-chip' + (on ? ' on' : '') + '" data-act="plan-day" data-v="' + d + '" aria-pressed="' + on + '"' + (d < t ? ' disabled' : '') + '>' + DAY_SHORT[DAY_ORDER[i]] + '<span class="num">' + parseIso(d).getDate() + '</span></button>'; }
    h += '</div>';
  });
  const list = Object.keys(ses);
  if (list.length) h += '<p class="small">' + list.map(d => esc(nbsp(capFirst(fmtDateLong(d)) + ' : ' + tplDef(ses[d]).name))).join('<br>') + '</p>';
  return h + '</section>';
}
// Cette semaine : semaine chargée en sport (si sport et détente), décharge anticipée (déplacé d'Aujourd'hui)
function weekCard(){
  const wk = weekInfo(today());
  let h = '<section class="card"><h3>Cette semaine</h3>';
  if (sportOn() && jumpsOn()) h += '<label class="toggle"><input type="checkbox" id="busy-week" data-act="busy"' + (wk.busy ? ' checked' : '') + '><span><b>Semaine chargée en ' + esc(lowFirst(sportInfo().name)) + '</b><br><span class="muted small">Séance ou match en plus : pas de sauts en salle cette semaine.</span></span></label>';
  h += '<label class="toggle"><input type="checkbox" id="deload-week" data-act="deload"' + (wk.forced ? ' checked' : '') + (wk.bw !== 6 ? '' : ' disabled') + '><span><b>Décharge anticipée</b><br><span class="muted small">' + (wk.bw === 6 ? 'C’est déjà ta semaine de décharge.' : 'Fatigue accumulée' + (kneeOn() ? ' ou genou qui réagit' : '') + ' : mêmes charges, environ 1/3 de séries en moins.') + '</span></span></label>';
  return h + '</section>';
}
// Réglages de l'entraînement : début du programme, options, sport et jours (déplacés du profil)
function settingsCard(){
  const m = mods(); const sp = sportInfo(); const raw = settings().sport || {};
  const tog = (k, title, desc) => '<label class="toggle"><input type="checkbox" id="mod-' + k + '" data-act="mod" data-v="' + k + '"' + (m[k] ? ' checked' : '') + '><span><b>' + title + '</b><br><span class="muted small">' + desc + '</span></span></label>';
  let h = '<section class="card"><h3>Réglages de l’entraînement</h3><label class="f"><span>Début du programme</span><input type="date" class="plain" id="start-date" value="' + esc(startDate()) + '"></label><p class="muted small">Choisis le lundi de ta première semaine : il fixe tes blocs de 6 semaines.</p>';
  h += '<p class="muted small">Options, désactivées au départ : active seulement ce qui te sert.</p>';
  h += tog('knee', 'Suivi d’une douleur au genou', 'Douleur le matin et pendant les séances jambes. Au-dessus de 3/10, pas de sauts et pas de hausse de charge sur les exercices qui sollicitent le genou.');
  h += tog('jumps', 'Détente et sauts', 'Exercices de pliométrie dans les séances et un test de détente pendant chaque semaine de décharge.');
  h += tog('sport', 'Sport collectif à côté', 'Tes jours d’entraînement et de match apparaissent dans ta semaine.' + (m.jumps ? ' Tu peux aussi signaler une semaine chargée : pas de sauts en salle.' : ''));
  if (m.sport) {
    const days = k => '<div class="days" role="group">' + DAY_ORDER.map(wd => '<button type="button" class="chip txt' + (sp[k].indexOf(wd) >= 0 ? ' on' : '') + '" data-act="sport-day" data-k="' + k + '" data-v="' + wd + '" aria-pressed="' + (sp[k].indexOf(wd) >= 0) + '">' + DAY_SHORT[wd] + '</button>').join('') + '</div>';
    h += '<div class="stack"><label class="f"><span>Ton sport</span><input id="set-sport" value="' + esc(raw.name || '') + '" placeholder="ex. Basket, foot, hand"></label><span class="label">Jours d’entraînement</span>' + days('train') + '<span class="label">Jours de match</span>' + days('match') + '</div>';
  }
  return h + '</section>';
}
