// Passage d'un écran à l'autre, comme dans les applis du téléphone : l'écran suivant arrive par la droite et repart
// vers la droite au retour (on peut aussi le tirer depuis le bord gauche), une fenêtre monte du bas et redescend,
// fondu entre les onglets, léger glissement entre les sous-onglets. Chaque écran retrouve sa position au retour.
// L'ancien écran est déplacé dans un calque fixe le temps de l'animation : le nouveau est affiché tout de suite,
// les actions peuvent donc le lire ou le faire défiler juste après render().
import { S } from './store.js';
import { activeWorkout } from './data.js';

const PTABS = ['seances', 'exercices', 'planning'], PRTABS = ['stats', 'history'];
const FOOD_LEVEL = { search:0, scan:1, notfound:2, portion:2, create:2, recipe:2, 'save-meal':0, meal:1 };
// Écran affiché : clé, profondeur, onglet (écrans du premier niveau), écran d'origine (from), fenêtre (sheet),
// rang parmi des écrans voisins (sub : sous-onglets, jours du journal)
export function screenOf(){
  if (S.setup) { const st = S.setup.step || 1; return S.setup.mode === 'welcome' ? { key:'setup-' + st, level:st } : { key:'change-' + st, level:st, sheet:'change' }; }
  if (S.picker) return { key:'picker', level:0, sheet:'picker' };
  if (S.draft) return { key:'draft-' + S.draft.kind + '-' + (S.draft.id || 'new'), level:0, sheet:'draft' };
  if (S.move) return { key:'move-' + S.move, level:0, sheet:'move' };
  if (S.act) return { key:'act', level:0, sheet:'act' };
  if (S.bilan) return { key:'bilan-' + S.bilan, level:1, from:S.view };
  const v = S.view;
  if (v === 'training') {
    if (S.loaded && activeWorkout()) return { key:'session', level:0, tab:v };
    if (S.fiche) return { key:'fiche-' + S.fiche, level:1, from:v };
    return { key:'prog-' + S.progTab, level:0, tab:v, sub:PTABS.indexOf(S.progTab) };
  }
  if (v === 'progress' && S.fiche) return { key:'fiche-' + S.fiche, level:1, from:v };
  if (v === 'progress') return { key:'progress-' + S.progressTab, level:0, tab:v, sub:PRTABS.indexOf(S.progressTab) };
  if (v === 'food' && S.food) return { key:'food-' + S.food.mode, level:FOOD_LEVEL[S.food.mode] || 0, sheet:'food' };
  if (v === 'food') return { key:'food', level:0, tab:v, sub:S.foodDay || '9999' };
  if (v === 'profile') return { key:'profile', level:1, from:S.from || 'today' };
  if (v === 'science') return { key:'science', level:2, from:S.from || 'today' };
  return { key:'today', level:0, tab:'today' };
}
function kindOf(a, b){
  if (b.sheet !== a.sheet) return !a.sheet ? 'up' : !b.sheet ? 'down' : 'fade';
  if (b.level > a.level) return 'push';
  if (b.level < a.level) return b.tab && a.from && b.tab !== a.from ? 'fade' : 'pop';
  if (a.tab && a.tab === b.tab && a.sub != null && b.sub != null && a.sub !== b.sub) return b.sub > a.sub ? 'next' : 'prev';
  return 'fade';
}

const EASE = 'cubic-bezier(.32,.72,0,1)'; // courbe des fenêtres d'iOS : départ vif, arrivée douce
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const memo = {}; // position de défilement de chaque écran
let last = null, running = null, gesture = null, cal = null;

// À appeler à chaque affichage : paint() dessine l'écran demandé par l'état S
export function navigate(paint){
  const next = Object.assign(screenOf(), { loaded:S.loaded }); const prev = last; last = next;
  let kind = prev && prev.loaded && prev.key !== next.key ? kindOf(prev, next) : null;
  if (kind && S.navHint) kind = S.navHint;
  S.navHint = null;
  if (!kind) { const h0 = calHeight(); paint(); calMotion(h0); return; }
  memo[prev.key] = window.scrollY;
  const back = kind === 'pop' || kind === 'down' || kind === 'next' || kind === 'prev' || (kind === 'fade' && next.level === 0);
  const y = back ? memo[next.key] || 0 : 0;
  finish(); cal = { m:S.calMonth, d:S.calDay };
  if (kind === 'next' || kind === 'prev') { paint(); window.scrollTo(0, y); if (!reduced()) shift(kind); return; }
  const old = detach(); paint(); window.scrollTo(0, y);
  const fresh = document.getElementById('app');
  if (gesture && gesture.state === 'start') { gesture.view = { old, fresh }; gesture.state = 'drag'; follow(0); return; }
  animate(reduced() ? 'fade' : kind, old, fresh);
}
// L'ancien écran passe dans un calque fixe, à la même place, découpé à la taille de l'écran (el) ;
// un <main id="app"> vide prend sa place
function detach(){
  const app = document.getElementById('app'); const r = app.getBoundingClientRect();
  const layer = document.createElement('div'); layer.className = 'nav-layer'; layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
  const shade = document.createElement('div'); shade.className = 'nav-shade';
  const clip = document.createElement('div'); clip.className = 'nav-clip'; clip.style.cssText = 'left:' + r.left + 'px;width:' + r.width + 'px';
  const fresh = app.cloneNode(false); app.replaceWith(fresh); app.removeAttribute('id');
  app.style.cssText = 'margin:' + r.top + 'px 0 0';
  clip.append(app); layer.append(clip); document.body.append(layer);
  return { layer, el:clip, main:app, shade };
}
// Écran du dessus : il cache celui du dessous ; l'ombre assombrit légèrement celui du dessous
function stack(old, fresh, onTop){
  if (onTop === 'new') { old.layer.append(old.shade); fresh.classList.add('nav-top'); }
  else { old.layer.prepend(old.shade); old.layer.classList.add('over'); old.el.classList.add('nav-top'); }
}
function animate(kind, old, fresh){
  const W = window.innerWidth, H = window.innerHeight; const anims = [];
  const go = (el, frames, dur, ease, delay) => anims.push(el.animate(frames, { duration:dur, easing:ease || EASE, delay:delay || 0, fill:'backwards' }));
  const tx = x => ({ transform:'translateX(' + x + 'px)' }), ty = y => ({ transform:'translateY(' + y + 'px)' });
  if (kind === 'push') { stack(old, fresh, 'new'); go(fresh, [tx(W), tx(0)], 420); go(old.el, [tx(0), tx(-W * 0.3)], 420); go(old.shade, [{ opacity:0 }, { opacity:1 }], 420); }
  else if (kind === 'pop') { stack(old, fresh, 'old'); go(old.el, [tx(0), tx(W)], 380); go(fresh, [tx(-W * 0.3), tx(0)], 380); go(old.shade, [{ opacity:1 }, { opacity:0 }], 380); }
  else if (kind === 'up') { stack(old, fresh, 'new'); fresh.classList.add('nav-sheet'); go(fresh, [ty(H), ty(0)], 460); go(old.shade, [{ opacity:0 }, { opacity:1 }], 460); }
  else if (kind === 'down') { stack(old, fresh, 'old'); old.el.classList.add('nav-sheet'); go(old.el, [ty(0), ty(H)], 360); go(old.shade, [{ opacity:1 }, { opacity:0 }], 360); }
  // Fondu : l'ancien écran s'efface, puis le nouveau apparaît, sans que les deux se superposent. L'ancien reste effacé
  // jusqu'à la fin (fill 'forwards') : sinon il réapparaît par-dessus le nouveau tant que celui-ci finit d'apparaître
  else {
    anims.push(old.el.animate([{ opacity:1 }, { opacity:0 }], { duration:110, easing:'ease-out', fill:'forwards' })); go(fresh, [{ opacity:0, transform:'scale(.985)' }, { opacity:1, transform:'none' }], 220, 'ease-out', 110);
    // Changement d'onglet : les 4 premières cartes montent de 8 px, décalées de 30 ms (Dark Glow, version 3.1)
    if (!reduced()) Array.from(fresh.querySelectorAll(':scope > .card')).slice(0, 4).forEach((c, i) => go(c, [{ opacity:0, transform:'translateY(8px)' }, { opacity:1, transform:'none' }], 220, EASE, 140 + i * 30));
  }
  track(old, fresh, anims);
}
function track(old, fresh, anims){
  const cur = { anims, done(){
    if (running !== cur) return; running = null;
    old.layer.remove(); fresh.classList.remove('nav-top', 'nav-sheet');
  } };
  running = cur;
  Promise.all(anims.map(a => a.finished)).then(cur.done, cur.done);
}
// Nouvelle navigation pendant une animation : on la termine tout de suite
function finish(){ if (running) { const r = running; r.anims.forEach(a => a.cancel()); r.done(); } }
// Sous-onglets et jours : le contenu sous les onglets glisse légèrement, les onglets restent en place
function shift(kind){
  const app = document.getElementById('app'); const bar = app.querySelector('.seg, .daynav');
  let el = bar ? bar.nextElementSibling : app.firstElementChild; const d = kind === 'next' ? 28 : -28;
  for (; el; el = el.nextElementSibling) el.animate([{ opacity:0, transform:'translateX(' + d + 'px)' }, { opacity:1, transform:'none' }], { duration:260, easing:EASE });
}
// Calendrier d'Aujourd'hui : la carte s'agrandit ou se réduit en douceur, le mois glisse dans le sens choisi
function calHeight(){ const c = document.querySelector('#app .cal'); return c ? c.offsetHeight : null; }
function calMotion(h0){
  const before = cal; cal = { m:S.calMonth, d:S.calDay };
  const c = document.querySelector('#app .cal'); if (!c || !before || h0 == null || reduced()) return;
  if (before.m && cal.m && before.m !== cal.m) {
    const d = cal.m > before.m ? 36 : -36;
    c.querySelectorAll('.cal-month, .cal-title').forEach(el => el.animate([{ opacity:0, transform:'translateX(' + d + 'px)' }, { opacity:1, transform:'none' }], { duration:260, easing:EASE }));
  }
  const h1 = c.offsetHeight;
  if (Math.abs(h1 - h0) > 2 && (before.m !== cal.m || before.d !== cal.d)) {
    c.style.overflow = 'hidden';
    c.animate([{ height:h0 + 'px' }, { height:h1 + 'px' }], { duration:300, easing:EASE }).finished.then(() => { c.style.overflow = ''; }, () => { c.style.overflow = ''; });
    if (!before.m !== !cal.m) Array.from(c.children).forEach(el => el.animate([{ opacity:0 }, { opacity:1 }], { duration:220, delay:60, easing:'ease-out', fill:'backwards' }));
    else { const det = c.querySelector('.cal-detail'); if (det && cal.d !== before.d) det.animate([{ opacity:0, transform:'translateY(-6px)' }, { opacity:1, transform:'none' }], { duration:240, easing:EASE }); }
  }
}

// Retour en tirant l'écran depuis le bord gauche, sur les écrans qui ont un bouton « ‹ Retour » (data-back).
// Le retour est fait au début du geste ; si le geste est abandonné, l'état et l'écran d'avant sont remis.
export function initSwipeBack(restore){
  const EDGE = 24;
  document.addEventListener('touchstart', e => {
    gesture = null;
    if (e.touches.length !== 1 || running) return;
    const t = e.touches[0]; if (t.clientX > EDGE) return;
    const btn = document.querySelector('#app [data-back]'); if (!btn) return;
    gesture = { state:'wait', btn, x0:t.clientX, y0:t.clientY, pts:[{ x:t.clientX, t:e.timeStamp }] };
  }, { passive:true });
  document.addEventListener('touchmove', e => {
    const g = gesture; if (!g) return;
    const t = e.touches[0]; const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (g.state === 'wait') {
      if (Math.abs(dy) > 10 && Math.abs(dy) > dx) { gesture = null; return; }
      if (dx < 10 || dx < Math.abs(dy)) return;
      // Démarrage : on garde de quoi tout remettre, puis on fait le retour
      try { g.saved = saveState(); } catch (err) { gesture = null; return; }
      g.y = window.scrollY; g.prev = last; g.state = 'start'; g.btn.click();
      if (g.state !== 'drag') { gesture = null; return; } // le bouton n'a pas changé d'écran
    }
    if (g.state !== 'drag') return;
    if (e.cancelable) e.preventDefault();
    g.pts.push({ x:t.clientX, t:e.timeStamp }); if (g.pts.length > 5) g.pts.shift();
    follow(Math.max(0, dx));
  }, { passive:false });
  const end = e => {
    const g = gesture; gesture = null; if (!g || g.state !== 'drag') return;
    const W = window.innerWidth; const t = e.changedTouches[0]; const dx = Math.max(0, t.clientX - g.x0);
    const p0 = g.pts[0]; const v = (t.clientX - p0.x) / Math.max(1, e.timeStamp - p0.t); // px par ms
    const done = e.type === 'touchend' && (dx > W * 0.4 || (v > 0.35 && dx > 20));
    const { old, fresh } = g.view; const anims = []; const dur = done ? 260 : 300;
    const x = dx / W;
    anims.push(old.el.animate([{ transform:'translateX(' + dx + 'px)' }, { transform:'translateX(' + (done ? W : 0) + 'px)' }], { duration:dur, easing:EASE }));
    anims.push(fresh.animate([{ transform:'translateX(' + (-0.3 * W * (1 - x)) + 'px)' }, { transform:'translateX(' + (done ? 0 : -0.3 * W) + 'px)' }], { duration:dur, easing:EASE }));
    anims.push(old.shade.animate([{ opacity:1 - x }, { opacity:done ? 0 : 1 }], { duration:dur, easing:EASE }));
    old.el.style.transform = fresh.style.transform = old.shade.style.opacity = '';
    if (done) { track(old, fresh, anims); return; }
    // Geste abandonné : l'ancien écran reprend sa place, avec l'état d'avant
    Promise.all(anims.map(a => a.finished)).then(() => {
      restoreState(g.saved); last = g.prev;
      old.layer.remove(); old.main.removeAttribute('style'); old.main.id = 'app';
      fresh.replaceWith(old.main); window.scrollTo(0, g.y); restore();
    });
  };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
}
function follow(dx){
  const { old, fresh } = gesture.view; const W = window.innerWidth;
  if (!old.layer.classList.contains('over')) stack(old, fresh, 'old');
  old.el.style.transform = 'translateX(' + dx + 'px)';
  fresh.style.transform = 'translateX(' + (-0.3 * (W - dx)) + 'px)';
  old.shade.style.opacity = String(1 - dx / W);
}
function saveState(){ const o = {}; Object.keys(S).forEach(k => { if (k !== 'docs') o[k] = S[k]; }); return structuredClone(o); }
function restoreState(o){ Object.keys(S).forEach(k => { if (k !== 'docs' && !(k in o)) delete S[k]; }); Object.assign(S, o); }
