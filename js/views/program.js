// Écran Entraînement (hors séance en cours) : le programme actif et ses séances, le planning, les exercices ; écran de planification.
import { addDays, esc, fmtDate, lowFirst, mondayOf, parseIso, today } from '../util.js';
import { DAY_SHORT, KINDS, MUSCLES, PROGRAMS } from '../library.js';
import { S } from '../store.js';
import { allEx, allTpl, daySummary, excluded, jumpsOn, mods, nextSession, perWeekOf, plannedDates, plannedSessions, programOf, rotationOf, searchEx, settings, sportInfo, sportOn, startDate, tplDef, tplEst, tplItems, weekInfo, wName } from '../data.js';
import { introCard } from './intro.js';
import { swipeRow } from '../swipe.js';
import { ICONS } from '../icons.js';

const PTABS = [['seances','Séances'],['planning','Planning'],['exercices','Exercices']];
// Sous-onglets d'un écran : le trait orange glisse d'un libellé à l'autre (animé par shift() dans nav.js)
export const subNav = (tabs, cur, act) => '<div class="subnav" role="tablist" style="--n:' + tabs.length + ';--i:' + Math.max(0, tabs.findIndex(t => t[0] === cur)) + '">'
  + tabs.map(t => '<button type="button" class="st' + (cur === t[0] ? ' on' : '') + '" data-act="' + act + '" data-v="' + t[0] + '" role="tab" aria-selected="' + (cur === t[0]) + '">' + t[1] + '</button>').join('') + '<i class="st-ind" aria-hidden="true"></i></div>';
export function viewProgram(){
  let h = '<h1>Entraînement</h1>' + subNav(PTABS, S.progTab, 'ptab');
  if (!S.loaded) return h + '<p class="loading">Chargement…</p>';
  // Premier lancement, aucune séance faite : la rubrique s'explique d'abord (sans les sous-onglets)
  const intro = introCard('training'); if (intro) return '<h1>Entraînement</h1>' + intro;
  if (S.progTab === 'exercices') return h + viewExercises();
  if (S.progTab === 'planning') return h + viewPlanning();
  return h + viewTemplates();
}
// Programme actif : un sélecteur à part au-dessus des séances (pas une carte de la liste) ; le toucher ouvre « Ton programme »
function programBar(){
  const nom = (programOf() || {}).name || 'Mon programme';
  return '<button type="button" class="prog-bar" data-act="prog-change"><span class="stack prof-id"><span class="label">Programme actif</span><span class="n">' + esc(nom) + '</span></span><span class="prog-chg">Changer' + ICONS.swap + '</span></button>';
}
// Nom du programme actif, à renommer sur place (en haut de la fenêtre « Ton programme »)
export function programCard(){
  const g = programOf() || {};
  return '<section class="card"><span class="label">Programme actif</span>' + (S.renaming
    ? '<div class="row"><input class="plain" id="prog-name" value="' + esc(g.name || '') + '" aria-label="Nom du programme" style="flex:1;width:auto;min-width:0"><button type="button" class="btn primary" data-act="prog-rename-save">Enregistrer</button></div>'
    : '<div class="row between"><h2>' + esc(g.name || 'Mon programme') + '</h2><button type="button" class="link" data-act="prog-rename">Renommer</button></div>') + '</section>';
}
export function noTplCard(){
  return '<section class="card"><h2>Crée ta première séance</h2><button type="button" class="btn primary big" data-act="go-new-tpl">Créer une séance</button></section>';
}
// Séances : le programme actif en tête (sélecteur), puis ses séances, la prochaine de la rotation d'abord en carte vedette avec un grand
// « Commencer » ; les séances créées en plus d'un programme de départ sont à part (elles restent quand on change de programme)
function tplCard(t, up){
  const its = tplItems(t);
  let c = '<section class="card tpl' + (up ? ' hero' : '') + '"><div class="row between"><div class="stack" style="gap:2px">' + (up ? '<span class="label">Ta prochaine séance</span>' : '') + '<h2 class="tpl-name">' + esc(t.name) + '</h2><span class="muted small">' + its.length + ' exercices · environ ' + tplEst(t) + ' min</span></div></div>';
  c += up ? '<button type="button" class="btn primary big" data-act="start" data-v="' + esc(t.id) + '">Commencer</button><button type="button" class="link tpl-edit" data-act="edit-tpl" data-v="' + esc(t.id) + '">Modifier la séance</button></section>'
    : '<div class="tpl-btns"><button type="button" class="btn" data-act="start" data-v="' + esc(t.id) + '">Commencer</button><button type="button" class="btn" data-act="edit-tpl" data-v="' + esc(t.id) + '">Modifier</button></div></section>';
  // Une séance perso se supprime en la balayant ; celles du programme de base ne se suppriment pas
  return t.builtin ? c : swipeRow(c, 'tpl-swipe-del', esc(t.id), 'Supprimer la séance ' + esc(t.name), '').replace('class="sw"', 'class="sw card-r"');
}
function viewTemplates(){
  const next = nextSession(); const tpls = allTpl(); const base = !!PROGRAMS[(programOf() || {}).base];
  const own = base ? tpls.filter(t => t.builtin) : tpls; const extra = tpls.filter(t => own.indexOf(t) < 0);
  const list = l => l.filter(t => t.id === next).concat(l.filter(t => t.id !== next)).map(t => tplCard(t, t.id === next)).join('');
  const head = (titre, n) => '<h2 class="sec-h">' + titre + ' <span class="muted small num">' + n + '</span></h2>';
  let h = programBar() + head('Séances du programme', own.length) + (own.length ? list(own) : '<p class="empty">Aucune séance pour l’instant.</p>');
  if (extra.length) h += head('Tes séances créées', extra.length) + list(extra);
  return h + '<button type="button" class="btn big" data-act="new-tpl">+ Créer une séance</button>';
}
function viewExercises(){
  const h = '<input class="plain" type="search" id="ex-q" data-xq="1" placeholder="Nom, muscle ou « DC »…" aria-label="Rechercher un exercice" value="' + esc(S.exQ || '') + '" autocomplete="off" enterkeyhint="search">';
  return h + '<div class="stack" id="ex-list" style="gap:16px">' + exerciseList() + '</div><button type="button" class="btn big" data-act="new-ex">+ Créer un exercice</button>';
}
const exRow = (e, hidden) => (e.custom ? row => swipeRow(row, 'ex-swipe-del', esc(e.id), 'Supprimer ' + esc(e.name), '') : row => row)('<button type="button" class="pick" data-act="ex-fiche" data-v="' + esc(e.id) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(e.name) + '</span><span class="m">' + esc(KINDS[e.kind] || '') + (e.kind === 'load' || e.kind === 'bw' ? ' · ' + e.sets + ' × ' + e.lo + '-' + e.hi : e.kind === 'cardio' ? ' · ' + e.lo + ' min' : '') + (e.custom ? ' · perso' : '') + (hidden ? ' · masqué' : '') + '</span></span><span aria-hidden="true">›</span></button>');
// Avec une recherche : résultats du plus proche au moins proche ; sinon, groupes par muscle principal
export function exerciseList(){
  const hid = excluded(); const list = allEx().filter(e => e.kind !== 'plyo' || jumpsOn());
  if (String(S.exQ || '').trim()) {
    const r = searchEx(list, S.exQ);
    return r.length ? '<section class="card"><h3>' + r.length + ' résultat' + (r.length > 1 ? 's' : '') + '</h3>' + r.map(e => exRow(e, hid.indexOf(e.id) >= 0)).join('') + '</section>'
      : '<p class="empty">Aucun exercice trouvé. Tu peux le créer en bas de la liste.</p>';
  }
  const groups = {};
  list.forEach(e => { const g = hid.indexOf(e.id) >= 0 ? 'Masqués' : e.kind === 'plyo' ? 'Pliométrie' : e.kind === 'cardio' ? 'Cardio' : ((e.muscles.p || [])[0] || 'Autres'); (groups[g] = groups[g] || []).push(e); });
  return [...MUSCLES, 'Cardio', 'Pliométrie', 'Autres', 'Masqués'].filter(g => groups[g]).map(g =>
    g === 'Masqués'
      // exercices masqués, tout en bas : on peut les réafficher d'ici (anciennement dans le profil)
      ? '<section class="card"><h3>Exercices masqués <span class="muted small">' + groups[g].length + '</span></h3>' + groups[g].map(e => '<div class="pick static"><span class="n">' + esc(e.name) + '</span><button type="button" class="btn" data-act="ex-unhide" data-v="' + esc(e.id) + '">Réafficher</button></div>').join('') + '</section>'
      : '<section class="card"><h3>' + esc(g) + ' <span class="muted small">' + groups[g].length + '</span></h3>' + groups[g].map(e => exRow(e, false)).join('') + '</section>').join('');
}
// Planning : ta rotation (à glisser), tes jours prévus, cette semaine, et les deux réglages de l'entraînement.
// Les douleurs suivies et les autres sports se règlent dans le profil (Paramètres).
function viewPlanning(){
  const tpls = allTpl(); const rot = rotationOf(); const per = perWeekOf(); const off = tpls.filter(t => rot.indexOf(t.id) < 0);
  let h = '<section class="card"><h3>Ta rotation</h3>';
  if (!tpls.length) h += '<p class="small">Crée d’abord tes séances dans l’onglet Séances.</p>';
  if (rot.length > 1) h += '<p class="muted small">Maintiens une séance et glisse-la pour changer l’ordre.</p>';
  h += '<div class="rot-list">' + rot.map((id, i) => rotRow(tplDef(id), i, true)).join('') + '</div>';
  if (off.length) h += '<span class="label">Hors rotation</span><div class="rot-list">' + off.map(t => rotRow(t, -1, false)).join('') + '</div>';
  h += '<span class="label">Séances par semaine</span><div class="chips" role="group" aria-label="Séances par semaine">' + [2, 3, 4, 5, 6].map(n => '<button type="button" class="chip' + (per === n ? ' on' : '') + '" data-act="per-week" data-v="' + n + '" aria-pressed="' + (per === n) + '">' + n + '</button>').join('') + '</div>';
  if (Array.isArray(settings().rotation) || Array.isArray(settings().rotOff)) h += '<button type="button" class="link" data-act="reset-rotation">Revenir à l’ordre du programme</button>';
  return h + '</section>' + planLink() + weekCard() + settingsCard();
}
// Une séance de la rotation : poignée (on glisse la ligne ; au clavier, flèches haut et bas sur la poignée), rang, nom, case « dans la rotation »
export const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h12M6 15h12"/></svg>';
function rotRow(t, i, on){
  const id = esc(t.id); const nm = esc(t.name);
  return '<div class="rot-row' + (on ? '" data-rot="' + id : ' off') + '">'
    + (on ? '<button type="button" class="rot-grip" data-v="' + id + '" aria-label="Déplacer ' + nm + ', position ' + (i + 1) + ' : flèches haut et bas">' + GRIP + '</button><span class="rot-n num" aria-hidden="true">' + (i + 1) + '</span>' : '')
    + '<span class="rot-name">' + nm + '</span>'
    + '<input type="checkbox" class="rot-in" data-act="rot-toggle" data-v="' + id + '"' + (on ? ' checked' : '') + ' aria-label="' + nm + ' dans la rotation"></div>';
}
// Accès compact à l'écran de planification (Aujourd'hui sous la semaine, et Planning)
export function planLink(){
  const n = plannedDates().length;
  return '<button type="button" class="pick" data-act="plan-open"><span class="stack prof-id"><span class="n">Planifier mes séances</span><span class="m">' + (n ? n + (n > 1 ? ' séances prévues' : ' séance prévue') : 'Cette semaine et la suivante') + '</span></span><span aria-hidden="true">›</span></button>';
}
// Écran de planification (poussé, S.plan) : cette semaine et la suivante, un jour par ligne. Toucher un jour y prévoit une séance ou la
// retire ; chaque toucher est enregistré tout de suite (settings.planned), et les séances suivent l'ordre de la rotation
export function viewPlan(){
  const t = today(); const mon = mondayOf(t); const planned = plannedDates(); const ses = plannedSessions(); const per = perWeekOf();
  let h = '<div class="row"><button type="button" class="link" data-act="plan-close" data-back>‹ ' + (S.view === 'training' ? 'Planning' : 'Aujourd’hui') + '</button></div><h1>Planifier mes séances</h1>';
  if (!rotationOf().length) return h + '<section class="card"><p>Aucune séance dans ta rotation : choisis-les d’abord dans Entraînement › Planning.</p></section>';
  h += '<p class="muted">Touche un jour pour y prévoir une séance. Elles suivent l’ordre de ta rotation.</p>';
  const jour = d => {
    const s = daySummary(d); const quand = '<span class="pd-d"><span class="muted small">' + DAY_SHORT[parseIso(d).getDay()] + '</span><b class="num">' + parseIso(d).getDate() + '</b></span>';
    const txt = (n, m) => '<span class="ql"><span class="n">' + n + '</span>' + (m ? '<span class="m">' + m + '</span>' : '') + '</span>';
    const sport = s.label !== 'Repos' ? esc(s.label) : '';
    if (s.active || s.done.length) return '<div class="pick static pday">' + quand + txt(esc(wName(s.active || s.done[0])), s.active ? 'en cours' : 'faite') + (s.active ? '' : '<span class="pd-ok" aria-hidden="true">' + ICONS.check + '</span>') + '</div>';
    if (d < t) return '<div class="pick static pday past">' + quand + txt('<span class="muted">Pas de séance</span>') + '</div>';
    const on = planned.indexOf(d) >= 0; const tp = on && ses[d] ? tplDef(ses[d]) : null;
    return '<button type="button" class="pick pday' + (on ? ' on' : '') + '" data-act="plan-day" data-v="' + d + '" aria-pressed="' + on + '">' + quand
      + txt(tp ? esc(tp.name) : '<span class="muted">' + (d === t ? 'Aujourd’hui, libre' : 'Libre') + '</span>', [tp ? 'prévue · environ ' + tplEst(tp) + ' min' : '', sport].filter(Boolean).join(' · '))
      + '<span class="pd-t" aria-hidden="true">' + (on ? ICONS.check : '+') + '</span></button>';
  };
  [0, 7].forEach(off => {
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(mon, off + i));
    const faites = days.filter(d => daySummary(d).done.length).length; const prevues = days.filter(d => ses[d]).length;
    const bilan = [faites ? faites + (faites > 1 ? ' faites' : ' faite') : '', prevues + (prevues > 1 ? ' prévues' : ' prévue'), 'objectif ' + per].filter(Boolean).join(' · ');
    h += '<section class="card"><div class="row between"><h2>' + (off ? 'Semaine prochaine' : 'Cette semaine') + '</h2><span class="muted small">' + esc(fmtDate(days[0]) + ' – ' + fmtDate(days[6])) + '</span></div><p class="small" aria-live="polite">' + bilan + '</p><div class="stack pdays">' + days.map(jour).join('') + '</div></section>';
  });
  return h + '<button type="button" class="btn primary big" data-act="plan-close">Terminé</button>';
}
// Cette semaine : semaine chargée en sport (si sport et détente), décharge anticipée
function weekCard(){
  const wk = weekInfo(today());
  let h = '<section class="card"><h3>Cette semaine</h3>';
  if (sportOn() && jumpsOn()) h += '<label class="toggle"><input type="checkbox" id="busy-week" data-act="busy"' + (wk.busy ? ' checked' : '') + '><span><b>Semaine chargée en ' + esc(lowFirst(sportInfo().name)) + '</b><br><span class="muted small">Pas de sauts en salle cette semaine.</span></span></label>';
  h += '<label class="toggle"><input type="checkbox" id="deload-week" data-act="deload"' + (wk.forced ? ' checked' : '') + (wk.bw !== 6 ? '' : ' disabled') + '><span><b>Semaine plus légère</b><br><span class="muted small">' + (wk.bw === 6 ? 'C’est déjà ta semaine de décharge.' : 'Si tu es fatigué : mêmes charges, moins de séries.') + '</span></span></label>';
  return h + '</section>';
}
// Réglages de l'entraînement : début du programme, détente et sauts
function settingsCard(){
  return '<section class="card"><h3>Réglages</h3><label class="f"><span>Début du programme (un lundi)</span><input type="date" class="plain" id="start-date" value="' + esc(startDate()) + '"></label>'
    + '<label class="toggle"><input type="checkbox" id="mod-jumps" data-act="mod" data-v="jumps"' + (mods().jumps ? ' checked' : '') + '><span><b>Détente et sauts</b><br><span class="muted small">Des sauts dans tes séances et un test de détente à chaque bloc.</span></span></label></section>';
}
