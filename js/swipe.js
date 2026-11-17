// Balayer une ligne vers la gauche découvre « Supprimer », comme dans les applis iOS : un geste voulu, puis un toucher sur le bouton rouge.
// Structure : .sw > .sw-in (la ligne) + button.sw-del (derrière). Une seule ligne ouverte à la fois ; un nouvel affichage les referme.
// Variante .sw.auto (exercices de l'éditeur de séance) : la ligne suit le doigt sur toute sa largeur ; lâchée au-delà de 45 %, elle
// est supprimée tout de suite (le fond devient rouge plein pour le dire, l'action propose « Annuler »), sinon le bouton reste découvert.
const W = 92;
const rows = () => Array.from(document.querySelectorAll('.sw.open'));
export const swipeRow = (inner, act, v, label, extra) =>
  '<div class="sw"><div class="sw-in">' + inner + '</div><button type="button" class="sw-del" data-act="' + act + '" data-v="' + v + '"' + (extra || '') + ' aria-label="' + label + '" tabindex="-1">Supprimer</button></div>';

const armed = g => g.pos < -g.sw.offsetWidth * 0.45;
// Balayage complet : la ligne sort par la gauche, sa place se referme, puis le bouton caché fait la suppression
function flyOut(sw, inn){
  const go = () => sw.querySelector('.sw-del').click();
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return go();
  const gap = parseFloat(getComputedStyle(sw.parentElement).rowGap) || 0;
  sw.classList.add('open', 'arm'); sw.style.overflow = 'hidden'; inn.style.transform = 'translateX(-100%)';
  sw.animate([{ height:sw.offsetHeight + 'px', marginBottom:'0px' }, { height:'0px', marginBottom:-gap + 'px' }], { duration:200, delay:140, easing:'ease-in', fill:'forwards' }).finished.then(go, go);
}
export function initSwipeRows(){
  let g = null; let mute = 0;
  document.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button > 0) return;
    const inn = e.target.closest('.sw-in'); const sw = inn && inn.parentElement;
    // Un toucher ailleurs referme les lignes ouvertes (sauf sur leur bouton : son clic fait la suppression)
    if (!e.target.closest('.sw-del')) rows().forEach(r => { if (r !== sw) r.classList.remove('open'); });
    // La poignée d'une ligne sert à la déplacer, pas à la balayer
    g = sw && !e.target.closest('.rot-grip') ? { sw, inn, x0:e.clientX, y0:e.clientY, base: sw.classList.contains('open') ? -W : 0, drag:false, id:e.pointerId, auto:sw.classList.contains('auto') } : null;
  });
  document.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0; const dy = e.clientY - g.y0;
    if (!g.drag) {
      // un défilement, ou une ligne qu'on est en train de déplacer (appui maintenu) : pas de balayage
      if ((Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) || g.sw.closest('.sorting')) { g = null; return; }
      if (Math.abs(dx) < 8) return;
      g.drag = true; g.sw.classList.add('moving'); try { g.inn.setPointerCapture(e.pointerId); } catch (err) {}
    }
    g.pos = Math.max(g.auto ? -g.sw.offsetWidth : -W * 1.25, Math.min(0, g.base + dx));
    g.inn.style.transform = 'translateX(' + g.pos + 'px)';
    if (g.auto) g.sw.classList.toggle('arm', armed(g));
  });
  const end = e => {
    if (!g || e.pointerId !== g.id) return; const d = g; g = null; if (!d.drag) return;
    const kill = d.auto && e.type === 'pointerup' && armed(d);
    d.sw.classList.remove('moving', 'arm'); d.inn.style.transform = '';
    if (kill) { mute = Date.now() + 350; flyOut(d.sw, d.inn); return; }
    d.sw.classList.toggle('open', e.type === 'pointerup' && d.pos < -W / 2);
    mute = Date.now() + 350;
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  // Le clic qui suit un glissement, ou qui touche une ligne ouverte, ne doit pas ouvrir la ligne : il la referme
  document.addEventListener('click', e => {
    const inn = e.target.closest('.sw-in'); if (!inn || !e.isTrusted) return;
    if (Date.now() < mute) { e.stopPropagation(); e.preventDefault(); return; }
    if (inn.parentElement.classList.contains('open')) { e.stopPropagation(); e.preventDefault(); inn.parentElement.classList.remove('open'); }
  }, true);
}
