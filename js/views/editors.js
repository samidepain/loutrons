// Éditeurs de séance modèle et d’exercice.
import { esc, fmtKg, fmtRest, num, REST_CHOICES } from '../util.js';
import { CATS, KINDS, M, MUSCLES } from '../library.js';
import { S } from '../store.js';
import { excluded, exDef, jumpsOn, kneeOn, tplDef, tplEst } from '../data.js';

// Liste des temps de repos (« 1 min 30 »…), avec la valeur actuelle si elle n'y est pas
export function restSelect(id, attrs, value){
  const v = num(value) || 90; const opts = REST_CHOICES.indexOf(v) >= 0 ? REST_CHOICES : REST_CHOICES.concat([v]).sort((a, b) => a - b);
  return '<label class="f"><span>Repos</span><select id="' + id + '" ' + attrs + '>' + opts.map(x => '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + fmtRest(x) + '</option>').join('') + '</select></label>';
}
export function blankEx(){ return { name:'', kind:'load', cat:'iso', step:2.5, sets:3, lo:8, hi:12, rest:90, unit:'reps', uni:false, knee:false, muscles:M(), cue:'' }; }
export function viewDraft(){ return S.draft.kind === 'tpl' ? viewTplEditor() : viewExEditor(); }
function viewTplEditor(){
  const D = S.draft; const t = D.data;
  let h = '<section class="card"><div class="row between"><h2>' + (D.isNew ? 'Nouvelle séance' : 'Modifier la séance') + '</h2><button type="button" class="link" data-act="draft-cancel">Annuler</button></div>';
  h += '<div class="fields"><label class="f"><span>Nom</span><input id="d-name" data-d="name" value="' + esc(t.name || '') + '" placeholder="ex. Full body"></label><label class="f"><span>Objectif</span><input id="d-focus" data-d="focus" value="' + esc(t.focus || '') + '" placeholder="ex. Force et détente"></label></div>';
  // « Si le temps manque, couper » : seulement pour les séances qui l'avaient déjà (séances de départ), pas à la création
  if (!D.isNew && t.cut) h += '<label class="f"><span>Si le temps manque, couper</span><input id="d-cut" data-d="cut" value="' + esc(t.cut || '') + '"></label>';
  h += '<span class="label">Exercices (' + t.items.length + ') · environ ' + tplEst(t) + ' min</span>';
  t.items.forEach((it, i) => {
    const e = exDef(it.ex) || { name:'Exercice supprimé', kind:'load' };
    const isSet = e.kind === 'load' || e.kind === 'bw';
    h += '<div class="item"><div class="row between"><span class="t">' + (i + 1) + '. ' + esc(e.name) + '</span><span class="row" style="gap:4px"><button type="button" class="btn sm" data-act="it-up" data-i="' + i + '" aria-label="Monter"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="btn sm" data-act="it-down" data-i="' + i + '" aria-label="Descendre"' + (i < t.items.length - 1 ? '' : ' disabled') + '>↓</button><button type="button" class="btn sm danger" data-act="it-rm" data-i="' + i + '" aria-label="Retirer">✕</button></span></div>';
    if (e.kind === 'cardio') h += '<div class="fields"><label class="f"><span>Durée (min)</span><input id="it-' + i + '-lo" data-it="' + i + '" data-k="lo" inputmode="numeric" value="' + esc(it.lo || e.lo || '') + '"></label></div>';
    else if (e.kind !== 'check') {
      h += '<div class="fields"><label class="f"><span>Séries</span><input id="it-' + i + '-sets" data-it="' + i + '" data-k="sets" inputmode="numeric" value="' + esc(it.sets || e.sets || '') + '"></label>';
      h += '<label class="f"><span>' + (isSet ? 'Reps min' : 'Volume') + '</span><input id="it-' + i + '-lo" data-it="' + i + '" data-k="lo" inputmode="numeric" value="' + esc(it.lo || e.lo || '') + '"></label>';
      if (isSet) h += '<label class="f"><span>Reps max</span><input id="it-' + i + '-hi" data-it="' + i + '" data-k="hi" inputmode="numeric" value="' + esc(it.hi || e.hi || '') + '"></label></div><div class="fields">' + restSelect('it-' + i + '-rest', 'data-it="' + i + '" data-k="rest"', it.rest || e.rest);
      h += '<label class="f"><span>Superset</span><select id="it-' + i + '-ss" data-it="' + i + '" data-k="ss"><option value="">Non</option>' + 'ABCDEFGH'.split('').map(l => '<option' + (it.ss === l ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label></div>';
    }
    h += '</div>';
  });
  h += '<button type="button" class="btn" data-act="pick-draft">+ Ajouter un exercice</button>';
  h += '<p class="muted small">Superset : donne la même lettre à deux exercices qui se suivent.</p>';
  h += '<button type="button" class="btn primary big" data-act="save-tpl">Enregistrer la séance</button>';
  if (!D.isNew) {
    const t0 = tplDef(D.id);
    if (t0 && t0.builtin && t0.edited) h += '<button type="button" class="btn ghost" data-act="reset-tpl">Revenir à la version d’origine</button>';
    if (t0 && !t0.builtin) h += S.confirm === 'del-tpl' ? '<button type="button" class="btn danger" data-act="del-tpl-yes">Confirmer la suppression</button>' : '<button type="button" class="btn danger" data-act="del-tpl">Supprimer cette séance</button>';
  }
  return h + '</section>';
}
function viewExEditor(){
  const D = S.draft; const e = D.data; const isSet = e.kind === 'load' || e.kind === 'bw';
  let h = '<section class="card"><div class="row between"><h2>' + (D.isNew ? 'Nouvel exercice' : 'Modifier l’exercice') + '</h2><button type="button" class="link" data-act="draft-cancel">Annuler</button></div>';
  h += '<label class="f"><span>Nom</span><input id="e-name" data-e="name" value="' + esc(e.name || '') + '" placeholder="ex. Tirage horizontal à la machine"></label>';
  h += '<div class="stack" style="gap:6px"><span class="label">Type</span><div class="chips">' + Object.keys(KINDS).filter(k => (k !== 'plyo' || jumpsOn() || e.kind === 'plyo') && (k !== 'cardio' || e.kind === 'cardio')).map(k => '<button type="button" class="chip txt' + (e.kind === k ? ' on' : '') + '" data-act="e-kind" data-v="' + k + '" aria-pressed="' + (e.kind === k) + '">' + KINDS[k] + '</button>').join('') + '</div></div>';
  if (isSet) {
    h += '<div class="stack" style="gap:6px"><span class="label">Catégorie (règle la hausse de charge)</span><div class="chips">' + Object.keys(CATS).map(k => '<button type="button" class="chip txt' + (e.cat === k ? ' on' : '') + '" data-act="e-cat" data-v="' + k + '" aria-pressed="' + (e.cat === k) + '">' + CATS[k] + '</button>').join('') + '</div></div>';
    h += '<div class="stack" style="gap:6px"><span class="label">Muscles principaux</span><div class="chips">' + MUSCLES.map(x => '<button type="button" class="chip txt' + ((e.muscles.p || []).indexOf(x) >= 0 ? ' on' : '') + '" data-act="e-mp" data-v="' + x + '">' + x + '</button>').join('') + '</div></div>';
    h += '<div class="stack" style="gap:6px"><span class="label">Muscles secondaires (comptent 0,5)</span><div class="chips">' + MUSCLES.map(x => '<button type="button" class="chip txt sec' + ((e.muscles.s || []).indexOf(x) >= 0 ? ' on' : '') + '" data-act="e-ms" data-v="' + x + '">' + x + '</button>').join('') + '</div></div>';
  }
  if (e.kind === 'cardio') h += '<div class="fields"><label class="f"><span>Durée par défaut (min)</span><input id="e-lo" class="n" data-e="lo" inputmode="numeric" value="' + esc(e.lo) + '"></label></div>';
  else if (e.kind !== 'check') {
    h += '<div class="fields"><label class="f"><span>Séries</span><input id="e-sets" class="n" data-e="sets" inputmode="numeric" value="' + esc(e.sets) + '"></label>';
    h += '<label class="f"><span>' + (isSet ? 'Reps min' : 'Volume par série') + '</span><input id="e-lo" class="n" data-e="lo" inputmode="numeric" value="' + esc(e.lo) + '"></label>';
    if (isSet) h += '<label class="f"><span>Reps max</span><input id="e-hi" class="n" data-e="hi" inputmode="numeric" value="' + esc(e.hi) + '"></label></div><div class="fields">' + restSelect('e-rest', 'data-e="rest"', e.rest) + '<label class="f"><span>Palier (kg)</span><input id="e-step" class="n" data-e="step" inputmode="decimal" value="' + esc(fmtKg(e.step)) + '"></label>';
    else h += '<label class="f"><span>Unité</span><input id="e-unit" data-e="unit" value="' + esc(e.unit || '') + '" placeholder="sauts, contacts, s"></label>';
    h += '</div>';
  }
  if (isSet) {
    h += '<label class="toggle"><input type="checkbox" id="e-uni" data-act="e-flag" data-v="uni"' + (e.uni ? ' checked' : '') + '><span><b>Unilatéral</b><br><span class="muted small">Les reps se comptent par jambe ou par bras.</span></span></label>';
    if (kneeOn()) h += '<label class="toggle"><input type="checkbox" id="e-knee" data-act="e-flag" data-v="knee"' + (e.knee ? ' checked' : '') + '><span><b>Sollicite le genou</b><br><span class="muted small">Charge maintenue si le genou dépasse 3/10.</span></span></label>';
  }
  if (!D.isNew) h += '<label class="toggle"><input type="checkbox" id="e-hide" data-act="ex-hide" data-v="' + esc(D.id) + '"' + (excluded().indexOf(D.id) >= 0 ? ' checked' : '') + '><span><b>Masquer cet exercice</b><br><span class="muted small">Il ne sera plus proposé quand tu ajoutes ou remplaces un exercice.</span></span></label>';
  h += '<label class="f"><span>Consignes</span><textarea id="e-cue" data-e="cue" placeholder="Placement, amplitude, réglages de machine…">' + esc(e.cue || '') + '</textarea></label>';
  h += '<button type="button" class="btn primary big" data-act="save-ex">Enregistrer l’exercice</button>';
  if (!D.isNew) {
    const e0 = exDef(D.id);
    if (e0 && !e0.custom && S.docs.has('x_' + D.id)) h += '<button type="button" class="btn ghost" data-act="reset-ex">Revenir à la version d’origine</button>';
    if (e0 && e0.custom) h += S.confirm === 'del-ex' ? '<button type="button" class="btn danger" data-act="del-ex-yes">Confirmer la suppression (l’historique reste)</button>' : '<button type="button" class="btn danger" data-act="del-ex">Supprimer cet exercice</button>';
  }
  return h + '</section>';
}
