// Écran Aujourd’hui : en haut la séance du jour, la semaine et l'alimentation ; dessous un conseil d'Émile à la fois,
// puis le suivi du jour en lignes compactes (eau, poids et sommeil, activités, genou).
import { addDays, capFirst, greeting, esc, fmtDate, fmtDateLong, fmtKg, lowFirst, mondayOf, nbsp, nSeries, num, parseIso, today, withDot } from '../util.js';
import { S } from '../store.js';
import { activeWorkout, activities, allTpl, backupDue, exDef, kneeEntries, lastWeighIn, tplItems, WEIGH_DAYS, weighDue, bodyweight, countSets, jumpsOn, kneeAlert, lastSessionGap, nextSession, tplLower, planDay, plannedDates, plannedSessions, settings, sportInfo, testForBlock, tplDef, tplEst, weekGoal, weekInfo, weekProgress, wName, workouts } from '../data.js';
import { fatigueCheck, recentRecord } from '../engine.js';
import { FLAGS, PAIN_LIMIT, painAdvice, painZones, ZONES } from '../pain.js';
import { useShare } from '../backup.js';
import { kneeChips, TROPHY } from '../render.js';
import { noTplCard } from './program.js';
import { calendarCard } from './calendar.js';
import { checkCard, foodTodayCard } from './goal.js';
import { emile, emileQueue, hey, returnTip } from '../emile.js';
import { activitiesLine, lineCard, waterLine } from './activity.js';
import { EFFORT, effortOf, sessionKcal, sessionMin, sportPlanned } from '../energy.js';

// Choix de l'effort d'une séance terminée (il règle sa dépense) ; aussi sur l'écran de fin de séance
export function effortChoice(sw){
  const ef = effortOf(sw); const kc = sessionKcal(sw, bodyweight());
  return '<div class="stack" style="gap:6px"><span class="label">Effort de la séance</span><div class="chips" role="group">' + Object.keys(EFFORT).map(k => '<button type="button" class="chip txt' + (ef === k ? ' on' : '') + '" data-act="effort" data-v="' + k + '" data-w="' + esc(sw.id) + '" aria-pressed="' + (ef === k) + '">' + EFFORT[k].label + '</button>').join('') + '</div>'
    + '<p class="small muted">' + esc(EFFORT[ef].desc) + '. ' + (kc == null ? 'Indique ton poids pour estimer les calories.' : 'Environ ' + Math.round(kc / 10) * 10 + ' kcal dépensées en ' + sessionMin(sw) + ' min.') + '</p></div>';
}

// Séance du jour : en cours, faite, prévue, ou jour de repos ou de sport
function planCard(d, plan, aw, doneToday, tpls){
  const autre = tpls.length ? '<button type="button" class="link" data-act="go-seances">Voir toutes mes séances ›</button>' : '';
  if (aw) return '<section class="card plan"><span class="label">Séance en cours</span><div class="name">' + esc(wName(aw)) + '</div><button type="button" class="btn primary big" data-act="tab" data-v="training">Reprendre ' + esc(wName(aw)) + '</button></section>';
  if (doneToday.length) {
    const sw = (S.summary && doneToday.find(w => w.id === S.summary.id)) || doneToday[doneToday.length - 1];
    return '<section class="card plan"><span class="label">Séance faite</span><div class="name">' + esc(wName(sw)) + '</div><p class="muted">' + (sw.duration || 0) + ' min · ' + nSeries(countSets(sw)) + '</p>' + effortChoice(sw) + autre + '</section>';
  }
  // Jour de sport prévu (module sport) et pas encore noté : un geste pour le noter
  const sp = S.loaded && sportPlanned(d); const noter = sp && !activities(d).some(a => a.type === 'sport');
  const noterBtn = noter ? '<button type="button" class="btn" data-act="act-add" data-v="' + sp + '">+ ' + esc(sp === 'match' ? 'Noter le match' : 'Noter le ' + lowFirst(sportInfo().name)) + '</button>' : '';
  // Rotation (version 2.13) : la séance du jour prévu, sinon la séance suivante ; avancement de la semaine
  const id = S.loaded ? (plannedSessions()[d] || nextSession()) : null; const t = id && tplDef(id);
  if (!t) return tpls.length || noter ? '<section class="card"><span class="label">Aujourd’hui</span><h2>' + esc(plan.label) + '</h2>' + (tpls.length ? '<p class="small">Aucune séance dans ta rotation : choisis-les dans Entraînement › Planning.</p>' : '') + noterBtn + autre + '</section>' : '';
  const prevu = plannedDates().indexOf(d) >= 0; const p = weekProgress(d); const reached = !prevu && p.done >= p.target;
  // Match ce soir ou demain (module sport) et séance du bas du corps : garder des jambes fraîches ; note du jour du programme exemple
  const mt = sportPlanned(d) === 'match' ? 'ce soir' : sportPlanned(addDays(d, 1)) === 'match' ? 'demain' : null;
  const caution = (mt && tplLower(t) ? '<p class="small">' + esc(nbsp('Match ' + mt + ' : garde des jambes fraîches, préfère une séance du haut du corps (« Voir toutes mes séances »).')) + '</p>' : '') + (plan.note ? '<p class="muted small">' + esc(plan.note) + '</p>' : '');
  const count = p.done + ' séance' + (p.done > 1 ? 's' : '') + ' sur ' + p.target + ' cette semaine';
  // Dernière séance terminée : un repère de régularité (le décompte de la semaine est dans « Ta semaine »)
  const last = workouts().filter(w => w.status === 'terminée').reduce((m, w) => !m || w.date > m.date || (w.date === m.date && (w.startedAt || 0) > (m.startedAt || 0)) ? w : m, null);
  const lastLine = last ? '<p class="muted small last">' + esc(nbsp('Dernière : ' + wName(last) + ' · ' + fmtDate(last.date) + ' · ' + (last.duration || 0) + ' min')) + '</p>' : '';
  return '<section class="card plan"><span class="label">' + (prevu ? 'Prévue aujourd’hui' : 'Ta prochaine séance') + '</span><div class="name">' + esc(t.name) + '</div>'
    + '<p>' + esc(nbsp((t.focus ? t.focus + ' · ' : '') + 'environ ' + tplEst(t) + ' min')) + '</p>' + (reached ? '<div class="plan-rest"><img src="icons/emile.png" alt="" width="44" height="44"><p class="small">' + esc(nbsp(count + ' : objectif atteint, tu peux te reposer.')) + '</p></div>' : '') + caution
    + '<button type="button" class="btn' + (reached ? '' : ' primary') + ' big" data-act="start" data-v="' + esc(id) + '"' + (S.loaded ? '' : ' disabled') + '>' + (S.loaded ? 'Commencer ' + esc(t.name) : 'Chargement…') + '</button>' + noterBtn + autre + lastLine + '</section>';
}

// Record des 7 derniers jours (force estimée, calculé sur l'historique) : carte dorée, seulement quand il y en a un
function recordCard(d){
  const r = S.loaded ? recentRecord(d) : null; if (!r) return '';
  return '<section class="card gold"><div class="ring-row"><span class="trophy" aria-hidden="true">' + TROPHY + '</span><div class="stack rec-t"><h3>Nouveau record</h3><span class="small">' + esc(r.name) + '</span><span class="muted small num">' + esc(nbsp(fmtKg(r.kg) + ' kg estimés · +' + fmtKg(r.gain) + ' · ' + fmtDate(r.date))) + '</span></div></div></section>';
}

// Conseil replié par défaut (avatar, titre, chevron) pour laisser la place aux suivis du jour ; les alertes (rang 2 : retour après une pause,
// fatigue, genou) restent ouvertes car elles touchent la séance. Le titre est repris du <h3> de la bulle (déjà échappé).
function foldEmile(html, top){
  if (!html || top === 2) return html;
  if (S.emileOpen) return html + '<button type="button" class="link emile-more" data-act="emile-open" aria-expanded="true">Réduire le conseil</button>';
  const t = (html.match(/<h3>(.*?)<\/h3>/) || [])[1] || 'Conseil d’Émile';
  return '<section class="card line"><div class="line-row"><button type="button" class="line-h e-fold" data-act="emile-open" aria-expanded="false"><img src="icons/emile.png" alt="" width="32" height="32"><span class="n">' + t + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div></section>';
}

// Exercices de la prochaine séance dont la charge est maintenue à cause de cette zone (au plus 4)
function heldNames(z){
  const ns = nextSession(); const t = ns && tplDef(ns); if (!t || !ZONES[z].hits) return [];
  return tplItems(t).map(it => exDef(it.ex)).filter(e => e && (e.kind === 'load' || e.kind === 'bw') && ZONES[z].hits(e)).map(e => e.name).slice(0, 4);
}
// Conseils d'Émile du jour, du plus important au moins important (rang 1 : demande une réponse ; 2 : alerte ; 3 : sauvegarde ; 4 : rappel ; 5 : semaine)
function emileCards(d, wk, goal){
  const q = [];
  // Retour après plus de 14 jours sans séance : la reprise est expliquée (rang 2, comme une alerte)
  const gap = S.loaded && !activeWorkout() && !workouts().some(w => w.date === d && w.status === 'terminée') ? lastSessionGap(d) : null;
  if (gap != null && gap > 14) q.push({ rank:2, html: emile('<p>' + esc(nbsp(returnTip(gap))) + '</p>', { key:'retour:' + addDays(d, -gap) }) });
  q.push({ rank:1, html: checkCard() });
  if (S.loaded) {
    const bb = wk.bw === 6 ? wk.block : (wk.bw === 1 && wk.block > 1 ? wk.block - 1 : 0);
    if (bb) q.push({ rank:1, html: emile('<p>' + esc(hey('Ton bilan du bloc ' + bb + ' est prêt : force, régularité et volume, avec des pistes pour la suite.')) + '</p><button type="button" class="btn" data-act="bilan" data-v="' + bb + '">Voir le bilan</button>', { title:'Bilan du bloc ' + bb, key:'bilan:' + bb }) });
    const fat = fatigueCheck();
    if (fat) q.push({ rank:2, html: emile('<p>' + esc(hey('Ta force baisse sur ' + fat.drops.length + ' exercices sur ' + fat.compared + ' cette semaine : ' + fat.drops.join(', ') + '.')) + (fat.avgSleep != null && fat.avgSleep < 7 ? ' Ton sommeil moyen ces derniers jours est de ' + fmtKg(Math.round(fat.avgSleep * 10) / 10) + ' h.' : '') + ' Avancer la semaine de décharge peut t’aider à récupérer.</p><div class="row"><button type="button" class="btn primary" data-act="fatigue-deload">Avancer la décharge</button><button type="button" class="btn" data-act="fatigue-ignore">Ignorer cette semaine</button></div>', { title:'Fatigue probable', tone:'warn', close:'fatigue-ignore' }) });
    if (kneeAlert()) q.push({ rank:2, html: emile('<p>Genou au-dessus de 3/10 ces 10 derniers jours : pas de sauts, charges maintenues sur les exercices qui sollicitent le genou. Si ça ne redescend pas, consulte un kiné ou un médecin du sport.</p>', { title:'Genou', tone:'bad', key:'knee:' + kneeEntries().filter(k => k.v > 3).map(k => k.date).sort().pop() }) });
    painZones().filter(z => z !== 'knee').forEach(z => { const a = painAdvice(z, heldNames(z)); if (a) q.push({ rank:2, html: emile(a.lines.map(l => '<p>' + esc(nbsp(l)) + '</p>').join(''), { title:a.title, tone:a.tone, key:a.key }) }); });
    if (weighDue(d)) q.push({ rank:4, html: emile('<p>' + esc(nbsp(hey(withDot('Ta dernière pesée date du ' + fmtDate(lastWeighIn().date)) + ' Une pesée toutes les 2 semaines suffit pour suivre ton poids. Pèse-toi ce matin, avant de manger.'))) + '</p><button type="button" class="btn" data-act="weigh-now">Noter mon poids</button>', { title:'Pesée', key:'weigh:' + mondayOf(d) }) });
    if (backupDue()) {
      const le = settings().lastExport;
      q.push({ rank:3, html: emile('<p>' + esc(hey(le ? withDot('Ta dernière sauvegarde date du ' + fmtDate(le)) : 'Tu n’as pas encore sauvegardé tes données.')) + ' Elles ne sont que sur ce téléphone : exporte une copie pour ne rien perdre si tu changes de téléphone ou supprimes l’appli.</p>'
        + '<button type="button" class="btn primary" data-act="export" data-v="json">Exporter maintenant</button>' + (useShare('json') ? '<p class="muted small">Choisis ensuite «&nbsp;Enregistrer dans Fichiers&nbsp;».</p>' : ''), { title:'Sauvegarde', tone:'warn', key:'backup:' + mondayOf(d) }) });
    }
    if (jumpsOn() && wk.bw === 6 && !testForBlock(wk.block)) q.push({ rank:4, html: emile('<p>Test de détente cette semaine : il s’affichera au début de ta prochaine séance jambes. La décharge te laisse reposé, c’est le bon moment.</p>', { key:'jumps:' + wk.block + ':6' }) });
    else if (jumpsOn() && wk.bw === 5) q.push({ rank:4, html: emile('<p>Test de détente la semaine prochaine, pendant la décharge.</p>', { key:'jumps:' + wk.block + ':5' }) });
  }
  q.push({ rank:5, html: emile('<p>' + esc(goal.d) + '</p>', { title: goal.t, key:'week:' + mondayOf(d) + ':' + goal.t }) });
  const f = emileQueue(q); const top = Math.min(...q.filter(x => x.html).map(x => x.rank));
  const first = foldEmile(f.first, top);
  if (!f.rest.length) return first;
  const n = f.rest.length;
  return first + (S.emileMore ? f.rest.join('') : '') + '<button type="button" class="link emile-more" data-act="emile-more" aria-expanded="' + !!S.emileMore + '">' + (S.emileMore ? 'Masquer les autres conseils' : n + (n > 1 ? ' autres conseils' : ' autre conseil')) + '</button>';
}

// Douleurs du jour : le genou comme avant, plus les zones choisies, en une ligne compacte. Une douleur au-dessus du seuil appelle,
// pour les autres zones, les signaux d'alerte (une seule question de plus, seulement dans ce cas)
function painLine(d){
  const zs = painZones(); if (!zs.length) return '';
  const day = (S.docs.get('d_' + d) || {}).z || {}; const k = S.docs.get('k_' + d);
  const val = z => z === 'knee' ? (k ? k.stairs : null) : day[z] ? day[z].v : null;
  const solo = zs.length === 1 && zs[0] === 'knee'; const sum = zs.filter(z => val(z) != null).map(z => solo ? val(z) + '/10' : ZONES[z].label + ' ' + val(z));
  const tail = z => z === 'knee' ? 'sauts suspendus et charges maintenues' : ZONES[z].hits ? 'charges maintenues sur les exercices concernés' : 'je note, sans pouvoir adapter tes exercices';
  let b = '';
  zs.forEach(z => {
    const v = val(z); const fl = z !== 'knee' && day[z] ? day[z].flags || [] : [];
    b += '<div class="stack">' + (solo ? '' : '<span class="label">' + ZONES[z].label + '</span>') + '<p class="muted small">' + esc(ZONES[z].ask) + ', de 0 à 10 : au-dessus de ' + PAIN_LIMIT + ', ' + tail(z) + '.</p>' + kneeChips(v, z === 'knee' ? 'stairs' : 'pain-d', false, z === 'knee' ? null : z);
    if (v > PAIN_LIMIT && z !== 'knee') b += '<span class="muted small">Ça s’accompagne de…</span><div class="chips" role="group" aria-label="Signaux d’alerte">' + FLAGS.map(f => '<button type="button" class="chip txt' + (fl.indexOf(f[0]) >= 0 ? ' on hi' : '') + '" data-act="pain-flag" data-z="' + z + '" data-v="' + f[0] + '" aria-pressed="' + (fl.indexOf(f[0]) >= 0) + '">' + f[1] + '</button>').join('') + '</div>';
    b += '</div>';
  });
  return lineCard(solo ? 'genou' : 'douleurs', solo ? 'Genou ce matin' : 'Douleurs', sum.join(' · ') || 'À noter', '', b + (solo ? '' : '<p class="muted small">Ce n’est pas un diagnostic : si une douleur dure ou revient, consulte un médecin ou un kiné.</p>'));
}

export function viewToday(){
  const d = today(); const plan = planDay(parseIso(d).getDay());
  const wk = weekInfo(d); const goal = weekGoal(wk);
  const aw = S.loaded && activeWorkout(); const tpls = allTpl();
  const doneToday = workouts().filter(w => w.date === d && w.status === 'terminée');
  const who = String(settings().name || '').trim(); 
  const hi = greeting(new Date().getHours()) + (who ? ', ' + who : '');
  let h = '<div class="greet"><span class="g-hi">' + esc(hi) + '</span><span class="hero-date">' + esc(capFirst(fmtDateLong(d))) + ' · bloc ' + wk.block + ', semaine ' + wk.bw + '/6</span>' + (wk.busy ? '<div class="row"><span class="pill warn">' + esc(capFirst(sportInfo().name)) + ' chargé</span></div>' : '') + '</div>';
  h += planCard(d, plan, aw, doneToday, tpls);
  if (S.loaded && !tpls.length) h += noTplCard();
  h += calendarCard();
  h += foodTodayCard();
  h += emileCards(d, wk, goal) + recordCard(d);
  if (!S.loaded) return h;

  // Ton suivi du jour
  h += '<h2>Ton suivi du jour</h2>' + waterLine();
  const b = S.docs.get('b_' + d) || {};
  const corps = [b.weight != null ? fmtKg(num(b.weight)) + ' kg' : '', b.sleep != null ? fmtKg(num(b.sleep)) + ' h' : ''].filter(Boolean).join(' · ') || 'À noter';
  const lw = lastWeighIn();
  const wnote = lw ? withDot('Dernière pesée : ' + fmtKg(num(lw.weight)) + ' kg le ' + fmtDate(lw.date)) + ' Une pesée toutes les 2 semaines suffit' + (weighDue(d) ? ' : c’est le moment, le matin avant de manger.' : ' : ' + withDot('la prochaine vers le ' + fmtDate(addDays(lw.date, WEIGH_DAYS)))) : 'Une pesée toutes les 2 semaines suffit : note ton poids le matin, avant de manger.';
  let cb = '<p class="muted small">' + esc(nbsp(wnote)) + '</p><p class="muted small">Nuit de moins de 6 h : garde 1 rep de plus en réserve.</p>';
  cb += '<div class="fields"><label class="f"><span>Poids (kg)</span><input class="n" id="b-weight" data-b="weight" inputmode="decimal" value="' + esc(b.weight == null ? '' : fmtKg(num(b.weight))) + '" placeholder="' + esc(bodyweight() ? fmtKg(bodyweight()) : 'ex. 75') + '"></label><label class="f"><span>Sommeil (h)</span><input class="n" id="b-sleep" data-b="sleep" inputmode="decimal" value="' + esc(b.sleep == null ? '' : fmtKg(num(b.sleep))) + '" placeholder="ex. 7,5"></label></div>';
  cb += '<div class="stack" style="gap:6px"><span class="label">Qualité du sommeil</span><div class="chips">' + [1,2,3,4,5].map(v => '<button type="button" class="chip' + (b.sleepQ === v ? ' on' : '') + '" data-act="sleepq" data-v="' + v + '" aria-pressed="' + (b.sleepQ === v) + '">' + v + '</button>').join('') + '</div><span class="muted small">1 = très mauvaise, 5 = excellente</span></div>';
  h += lineCard('corps', 'Poids et sommeil', corps, '', cb);
  h += activitiesLine();
  h += painLine(d);
  return h;
}
