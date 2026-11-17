// Onglet Social : ton profil sportif et le partage d'une séance (fenêtre S.share : { id, msg, off }). La carte partagée est une image
// dessinée sur le téléphone, envoyée par le menu de partage ; rien n'est publié sans « Partager ». Pas de faux amis ni de faux fil :
// amis, fil d'actualité et classements arriveront avec un serveur.
import { esc, fmtDate, fmtDateLong, fmtInt, mondayOf, nbsp, toast } from '../util.js';
import { S } from '../store.js';
import { settings, wName, workouts } from '../data.js';
import { findPRs, recordLog } from '../engine.js';
import { avatarReady, fileOf, ITEMS, layersOf } from '../avatar.js';
import { xpState } from '../levels.js';
import { downloadFile } from '../backup.js';
import { shareStats, shareText } from '../social.js';
import { avatarImg } from './avatar.js';
import { levelBar } from './profile.js';

const finishedSessions = () => workouts().filter(w => w.status === 'terminée');
const statsOf = w => shareStats(w, findPRs(w).length);
export function viewSocial(){
  let h = '<h1>Social</h1>';
  if (!S.loaded) return h + '<p class="loading">Chargement…</p>';
  const s = settings(); const who = String(s.name || '').trim(); const ws = finishedSessions();
  if (!ws.length) return h + '<section class="card empty-state"><img class="end-logo" src="icons/logo.png" alt="" width="96" height="96"><h2>Tes séances, à partager</h2><p class="muted">' + esc(nbsp('Après ta première séance, tu pourras l’envoyer à tes amis en une image.')) + '</p><button type="button" class="btn primary big" data-act="tab" data-v="training">Voir mes séances</button></section>' + friendsCard();
  // Profil sportif : avatar en pied, prénom, niveau, puis séances, semaines actives et records (les mêmes chiffres que le profil)
  const wk = new Set(ws.map(w => mondayOf(w.date))).size; const recs = recordLog().length;
  h += '<section class="card hero soc-me"><div class="soc-id">' + (avatarReady() ? avatarImg(s.avatar, 'soc-av') : '<span class="prof-ini" aria-hidden="true">' + esc((who[0] || '?').toUpperCase()) + '</span>')
    + '<div class="stack prof-id"><span class="label">Ton profil sportif</span><h2 class="soc-name">' + esc(who || 'Loutron') + '</h2></div></div>' + levelBar()
    + '<div class="stats"><div class="stat"><span class="v num">' + ws.length + '</span><span class="l">' + (ws.length > 1 ? 'séances' : 'séance') + '</span></div><div class="stat"><span class="v num">' + wk + '</span><span class="l">' + (wk > 1 ? 'semaines actives' : 'semaine active') + '</span></div><div class="stat"><span class="v num">' + (recs || '—') + '</span><span class="l">' + (recs > 1 ? 'records' : 'record') + '</span></div></div></section>';
  // Dernière séance terminée, prête à partager
  const w = ws[ws.length - 1];
  h += '<section class="card"><span class="label">Ta dernière séance</span><h2 class="tpl-name">' + esc(wName(w)) + '</h2><span class="muted small">' + esc([fmtDate(w.date)].concat(statsOf(w).slice(0, 3).map(x => x[1] + (x[2] ? ' ' + x[2] : '') + (x[0] === 'dur' ? '' : ' ' + x[3]))).join(' · ')) + '</span>'
    + '<button type="button" class="btn primary big" data-act="share-open" data-v="' + esc(w.id) + '">Partager cette séance</button></section>';
  return h + friendsCard();
}
// Ce qui n'existe pas encore est dit tel quel, sans rien simuler
const friendsCard = () => '<section class="card"><h2>Tes amis</h2><p class="muted">' + esc(nbsp('Bientôt ici : tes amis, leurs séances, vos encouragements et un classement de la semaine. En attendant, partage tes séances par message.')) + '</p></section>';

const LABELS = { dur:'Durée', ex:'Exercices', sets:'Séries', vol:'Volume', pr:'Records' };
export function viewShare(){
  const E = S.share; const w = S.docs.get(E.id); if (!w) return '';
  const stats = statsOf(Object.assign({ id:E.id }, w));
  let h = '<div class="row between"><h1>Partager</h1><button type="button" class="link" data-act="share-cancel">Annuler</button></div>';
  h += '<canvas class="share-cv" id="share-cv" width="1080" height="1350" role="img" aria-label="Aperçu de l’image partagée"></canvas>';
  h += '<div class="stack"><span class="label">Ce que tu montres</span><div class="chips" role="group" aria-label="Ce que tu montres">' + stats.map(x => '<button type="button" class="chip txt' + (E.off[x[0]] ? '' : ' on') + '" data-act="share-stat" data-v="' + x[0] + '" aria-pressed="' + !E.off[x[0]] + '">' + LABELS[x[0]] + '</button>').join('') + '</div></div>';
  h += '<label class="f"><span>Ton message (facultatif)</span><input id="share-msg" data-share="msg" maxlength="90" autocomplete="off" enterkeyhint="done" value="' + esc(E.msg) + '" placeholder="ex. Séance solide ce matin"></label>';
  h += '<p class="muted small">' + esc(nbsp('Rien n’est publié tout seul : l’image part seulement là où tu choisis de l’envoyer.')) + '</p>';
  return h + '<button type="button" class="btn primary big" data-act="share-send">Partager</button>';
}

// Image de la séance (1080 × 1350), aux couleurs du thème affiché : avatar en pied, prénom et niveau, séance, chiffres choisis, message.
// Le fichier est prêt avant le toucher sur « Partager » : Safari n'ouvre le menu de partage que dans le geste lui-même.
let ready = null; let turn = 0;
const picture = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
export async function drawShare(){
  const cv = document.getElementById('share-cv'); const E = S.share; const w0 = E && S.docs.get(E.id); if (!cv || !w0) return;
  const mine = ++turn; ready = null; const w = Object.assign({ id:E.id }, w0);
  const stats = statsOf(w).filter(x => !E.off[x[0]]); const s = settings(); const who = String(s.name || '').trim();
  const css = getComputedStyle(document.documentElement); const col = n => css.getPropertyValue(n).trim();
  const imgs = await Promise.all((avatarReady() ? layersOf(s.avatar, ITEMS, xpState().level).map(fileOf) : ['icons/logo.png']).map(picture));
  try { await document.fonts.load('800 60px Archivo'); } catch (e) {}
  if (mine !== turn || !cv.isConnected) return;
  const c = cv.getContext('2d'); const W = 1080, H = 1350, P = 72; const sys = '-apple-system, system-ui, sans-serif';
  c.fillStyle = col('--surface'); c.fillRect(0, 0, W, H);
  // Le spot orange de la salle, en haut à droite, derrière l'avatar
  const g = c.createRadialGradient(820, 300, 0, 820, 300, 640); g.addColorStop(0, col('--accent')); g.addColorStop(1, 'transparent');
  c.globalAlpha = 0.22; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  // Avatar en pied (la loutre occupe le centre de sa toile carrée), ou le logo d'Émile tant qu'il n'y a pas d'avatar
  imgs.forEach(i => { if (i) { if (avatarReady()) c.drawImage(i, i.width * 0.2, i.height * 0.06, i.width * 0.62, i.height * 0.9, 620, 96, 400, 580); else c.drawImage(i, 700, 140, 300, 300); } });
  const text = (t, x, y, font, color) => { c.font = font; c.fillStyle = color; c.fillText(t, x, y); };
  // Texte coupé en lignes de largeur max (2 au plus, la suite en « … »)
  const lines = (t, font, max) => { c.font = font; const out = ['']; t.split(' ').forEach(m => { const l = out[out.length - 1]; if (!l || c.measureText(l + ' ' + m).width <= max) out[out.length - 1] = l ? l + ' ' + m : m; else out.push(m); }); return out.length > 2 ? [out[0], out[1] + '…'] : out; };
  text('LOUTRONS', P, 132, '800 expanded 40px Archivo', col('--ink'));
  // Trait orange de la marque, sous le nom
  c.fillStyle = col('--accent'); c.beginPath(); c.roundRect(P, 160, 120, 10, 5); c.fill();
  text(who || 'Loutron', P, 310, '800 64px Archivo', col('--ink'));
  text('Niveau ' + xpState().level, P, 366, '600 36px ' + sys, col('--accent-ink'));
  text('Séance terminée · ' + fmtDateLong(w.date), P, 560, '500 34px ' + sys, col('--muted'));
  let y = 660; lines(wName(w), '800 expanded 84px Archivo', 520).forEach(l => { text(l, P, y, '800 expanded 84px Archivo', col('--ink')); y += 92; });
  // Chiffres choisis : très gros, unité petite et grise, sur 2 colonnes (3 quand il y en a 5)
  const cols = stats.length > 4 ? 3 : 2; const cw = (W - 2 * P) / cols; y += 30;
  stats.forEach((x, i) => {
    const cx = P + (i % cols) * cw; const cy = y + Math.floor(i / cols) * 180;
    // un grand nombre (volume) rétrécit jusqu'à tenir dans sa colonne avec son unité
    let size = cols === 3 ? 92 : 112; const wide = () => { c.font = '800 ' + size + 'px Archivo'; return c.measureText(x[1]).width + (x[2] ? 90 : 0); };
    while (wide() > cw - 24 && size > 48) size -= 6;
    text(x[1], cx, cy + 84, '800 ' + size + 'px Archivo', col('--ink')); const nw = c.measureText(x[1]).width;
    if (x[2]) text(x[2], cx + nw + 12, cy + 84, '500 38px ' + sys, col('--muted'));
    text(x[3], cx, cy + 134, '500 34px ' + sys, col('--muted'));
  });
  // Message en bas de l'image, entre guillemets (espaces insécables : un guillemet ne reste jamais seul sur sa ligne)
  const msg = String(E.msg || '').trim();
  if (msg) { const l = lines('«\u00A0' + msg + '\u00A0»', '500 40px ' + sys, W - 2 * P); l.forEach((t, i) => text(t, P, H - 76 - (l.length - 1 - i) * 54, '500 40px ' + sys, col('--ink'))); }
  cv.setAttribute('aria-label', nbsp('Aperçu de l’image partagée : ' + shareText(w, stats, msg).replace(/\n/g, ', ')));
  cv.toBlob(b => { if (mine === turn && b) ready = { file:new File([b], 'loutrons-seance-' + w.date + '.png', { type:'image/png' }), text:shareText(w, stats, msg) }; }, 'image/png');
}
// « Partager » : menu de partage du téléphone avec l'image ; sinon (ordinateur) l'image est enregistrée. Un partage annulé laisse la fenêtre ouverte.
export function sendShare(done){
  if (!ready) { toast('Un instant, l’image se prépare…'); return; }
  const data = { files:[ready.file], text:ready.text };
  if (navigator.share && navigator.canShare && navigator.canShare(data)) navigator.share(data).then(() => done('Séance partagée.'), e => { if (!e || e.name !== 'AbortError') toast('Le partage n’a pas abouti.'); });
  else { downloadFile(ready.file); done('Image enregistrée : envoie-la à tes amis.'); }
}
