// Écran Entraînement (hors séance en cours) : ton programme, ses séances, les exercices, le planning.
import { esc, fmtDateLong, fmtKg, lowFirst, num, WEEKDAYS, withDot } from '../util.js';
import { DAY_ORDER, DAY_SHORT, KINDS, MUSCLES, PROGRAMS } from '../library.js';
import { S } from '../store.js';
import { allEx, allTpl, excluded, exDef, jumpsOn, kneeOn, mods, planDay, programOf, searchEx, settings, sportInfo, sportOn, startDate, tplEst, tplItems } from '../data.js';
import { useShare } from '../backup.js';
import { VERSION } from '../version.js';

const PTABS = [['seances','Séances'],['exercices','Exercices'],['planning','Planning']];
export function viewProgram(){
  let h = '<h1>Entraînement</h1><div class="seg" role="tablist">' + PTABS.map(t => '<button type="button" class="chip' + (S.progTab === t[0] ? ' on' : '') + '" data-act="ptab" data-v="' + t[0] + '" role="tab" aria-selected="' + (S.progTab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>';
  if (!S.loaded) return h + '<p class="empty">Chargement…</p>';
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
  return h + '<button type="button" class="btn" data-act="prog-change">Changer de programme</button></section>';
}
export function noTplCard(){
  return '<section class="card"><h2>Crée ta première séance</h2><p class="muted">Donne-lui un nom, puis ajoute les exercices que tu veux. S’il en manque un, tu peux le créer depuis la liste.</p><button type="button" class="btn primary big" data-act="go-new-tpl">Créer une séance</button></section>';
}
function viewTemplates(){
  let h = programCard() + '<button type="button" class="btn primary" data-act="new-tpl">+ Créer une séance</button>';
  allTpl().forEach(t => {
    const its = tplItems(t);
    h += '<section class="card"><div class="row between"><div class="stack" style="gap:2px"><h3>' + esc(t.name) + '</h3><span class="muted small">' + esc(t.focus || '') + (t.focus ? ' · ' : '') + its.length + ' exercices · environ ' + tplEst(t) + ' min' + (t.edited ? ' · modifiée' : '') + (!t.builtin ? ' · perso' : '') + '</span></div></div>';
    h += '<p class="small muted">' + esc(its.map(it => { const e = exDef(it.ex); return e ? e.name : '?'; }).join(' · ')) + '</p>';
    h += '<div class="row"><button type="button" class="btn sm" data-act="edit-tpl" data-v="' + esc(t.id) + '">Modifier</button><button type="button" class="btn sm" data-act="start" data-v="' + esc(t.id) + '">Commencer</button></div></section>';
  });
  return h;
}
function viewExercises(){
  const n = allEx().filter(e => e.kind !== 'plyo' || jumpsOn()).length;
  let h = '<button type="button" class="btn primary" data-act="new-ex">+ Ajouter un exercice</button><p class="muted small">' + n + ' exercices. Touche un exercice pour voir sa fiche : photos, muscles travaillés et consignes.</p>';
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
    '<section class="card"><h3>' + esc(g) + ' <span class="muted small">' + groups[g].length + '</span></h3>' + (g === 'Masqués' ? '<p class="muted small">Plus proposés quand tu ajoutes ou remplaces un exercice.</p>' : '') + groups[g].map(e => exRow(e, false)).join('') + '</section>').join('');
}
function viewPlanning(){
  const tpls = allTpl(); const g = programOf() || {};
  let h = '<section class="card"><h3>Planning de la semaine</h3><p class="muted small">Sert au rappel du jour, à la séance proposée et aux séries prévues par muscle. Tu peux toujours faire une autre séance n’importe quel jour.</p>';
  if (!tpls.length) h += '<p class="small">Crée d’abord tes séances dans l’onglet Séances, puis choisis-les ici.</p>';
  DAY_ORDER.forEach(wd => {
    const p = planDay(wd);
    h += '<label class="f"><span>' + esc(WEEKDAYS[wd]) + (p.label !== 'Repos' ? ' · ' + esc(p.label) : '') + '</span><select data-plan="' + wd + '">' +
      tpls.map(t => '<option value="s:' + esc(t.id) + '"' + (p.s === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') +
      '<option value="l:Repos"' + (p.s ? '' : ' selected') + '>Pas de séance</option></select></label>';
  });
  if (sportOn()) h += '<p class="muted small">Les jours de ' + esc(lowFirst(sportInfo().name)) + ' et de match se règlent dans ton profil.</p>';
  if (PROGRAMS[g.base]) h += '<button type="button" class="link" data-act="reset-plan">Revenir au planning d’origine</button>';
  return h + '</section>';
}
